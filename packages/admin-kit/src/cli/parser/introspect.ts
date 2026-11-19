import path from "node:path";
import SwaggerParser from "@apidevtools/swagger-parser";
import {
  AdminKitConfigSchema,
  type AdminKitConfig,
  type ResourceConfig,
  type SubResourceConfig,
  type ResourceFilter,
  type TableColumn,
  type ActionConfig,
  type MutationsConfig,
} from "../../core";
import {
  stripApiPrefix,
  extractResourceKey,
  inferColumnType,
  inferFormFields,
  inferActionStyle,
  isSensitiveField,
} from "./heuristics";
import { toSnakeCase, toTitleCase, singularize, pluralize, toPastTense } from "../utils/formatting";
import type { IntrospectionOptions, IntrospectResult } from "./types";

/**
 * Normalizes SwaggerParser export across ESM and CommonJS bundles.
 */
function getSwaggerParser() {
  const parser = SwaggerParser as any;
  if (typeof parser.dereference === "function") return parser;
  if (parser.default && typeof parser.default.dereference === "function") return parser.default;
  return parser;
}

/**
 * Introspects an OpenAPI 3.0/3.1 document from a file path or URL and synthesizes an AdminKitConfig object.
 */
export async function introspectOpenApi(options: IntrospectionOptions): Promise<IntrospectResult> {
  const parser = getSwaggerParser();

  // Resolve source: if it's not a URL, resolve relative to current working directory
  const isUrl = /^https?:\/\//i.test(options.source);
  const sourcePath = isUrl ? options.source : path.resolve(process.cwd(), options.source);

  const api: any = await parser.dereference(sourcePath);

  const rawPaths: Record<string, any> = api.paths || {};

  // Step 1: Collect and normalize all endpoint paths & preliminary resource keys
  const allResourceKeysSet = new Set<string>();
  const resourceEndpointsMap: Record<string, Array<{ path: string; strippedPath: string; method: string; op: any }>> = {};

  for (const [p, pathItem] of Object.entries<any>(rawPaths)) {
    if (!pathItem || typeof pathItem !== "object") continue;

    const stripped = stripApiPrefix(p);
    const resourceKey = extractResourceKey(stripped);
    if (!resourceKey) continue;

    allResourceKeysSet.add(resourceKey);

    if (!resourceEndpointsMap[resourceKey]) {
      resourceEndpointsMap[resourceKey] = [];
    }

    const methods = ["get", "post", "put", "patch", "delete"];
    for (const m of methods) {
      if (pathItem[m]) {
        resourceEndpointsMap[resourceKey].push({
          path: p,
          strippedPath: stripped,
          method: m.toUpperCase(),
          op: pathItem[m],
        });
      }
    }
  }

  const allResourceKeys = Array.from(allResourceKeysSet);

  // Step 2: Extract primary item schemas per resource to aid relation discovery
  const resourceSchemas: Record<string, any> = {};
  for (const key of allResourceKeys) {
    const endpoints = resourceEndpointsMap[key] || [];
    const getList = endpoints.find(
      (e) => e.method === "GET" && isCollectionPath(e.strippedPath, key)
    );
    if (getList) {
      const responseSchema = getResponseSchema(getList.op);
      resourceSchemas[key] = extractItemSchema(responseSchema);
    }
  }

  // Step 3: Process each resource group
  const resources: Record<string, ResourceConfig> = {};
  let totalActions = 0;
  let totalColumns = 0;

  for (const resourceKey of allResourceKeys) {
    const endpoints = resourceEndpointsMap[resourceKey] || [];

    // Filter out non-collection RPC endpoints (e.g. /auth/sync, /storage/upload) that have no GET queries
    const hasGetEndpoint = endpoints.some((e) => e.method === "GET");
    if (!hasGetEndpoint) {
      continue;
    }

    const resourceLabel = toTitleCase(pluralize(resourceKey));
    const singularLabel = toTitleCase(singularize(resourceKey));

    // Find collection base endpoint (e.g. "/refunds" or "/users")
    const collectionEp = endpoints.find(
      (e) => isCollectionPath(e.strippedPath, resourceKey)
    );
    const baseEndpoint = collectionEp ? collectionEp.path : `/${resourceKey}`;

    // Find item detail endpoint (e.g. GET /refunds/{id})
    const getDetail = endpoints.find(
      (e) => e.method === "GET" && isItemDetailPath(e.strippedPath, resourceKey)
    );
    const detailEndpoint = getDetail ? getDetail.path : undefined;

    // 3.1: Table definition from GET collection
    const getCollection = endpoints.find(
      (e) => e.method === "GET" && isCollectionPath(e.strippedPath, resourceKey)
    );

    let columns: TableColumn[] = [];
    let searchableFields: string[] = [];
    let filterableFields: string[] = [];
    let hasStatusField = false;
    const resourceFilters: ResourceFilter[] = [];

    if (getCollection) {
      const responseSchema = getResponseSchema(getCollection.op);
      let itemSchema = extractItemSchema(responseSchema);

      // If GET collection has no discoverable properties, fallback to GET item detail endpoint schema
      if ((!itemSchema || !itemSchema.properties || Object.keys(itemSchema.properties).length === 0) && getDetail) {
        const detailResponseSchema = getResponseSchema(getDetail.op);
        const detailItemSchema = extractItemSchema(detailResponseSchema);
        if (detailItemSchema && detailItemSchema.properties && Object.keys(detailItemSchema.properties).length > 0) {
          itemSchema = detailItemSchema;
        }
      }

      if (itemSchema && itemSchema.properties && Object.keys(itemSchema.properties).length > 0) {
        for (const [propKey, propSchema] of Object.entries<any>(itemSchema.properties)) {
          const { type, relation, badge_map } = inferColumnType(propKey, propSchema, allResourceKeys);

          // If relation was inferred, attempt to resolve target resource display field
          let resolvedRelation = relation;
          if (resolvedRelation) {
            const targetSchema = resourceSchemas[resolvedRelation.target_resource];
            if (targetSchema && targetSchema.properties) {
              const targetProps = Object.keys(targetSchema.properties);
              if (targetProps.includes("name")) resolvedRelation.display_field = "name";
              else if (targetProps.includes("email")) resolvedRelation.display_field = "email";
              else if (targetProps.includes("title")) resolvedRelation.display_field = "title";
              else if (targetProps.includes("full_name")) resolvedRelation.display_field = "full_name";
              else if (targetProps.includes("username")) resolvedRelation.display_field = "username";
            }
          }

          if (propKey === "status") {
            hasStatusField = true;
          }

          const colLabel = toTitleCase(propKey);
          const isPrimaryKey = propKey === "id";
          const isCopyable = propKey === "id" || propKey.endsWith("_id") || propKey.endsWith("Id");
          const isSortable = type === "currency" || type === "number" || type === "date" || type === "datetime";
          const isSensitive = isSensitiveField(propKey);

          columns.push({
            key: propKey,
            label: colLabel,
            type,
            primary_key: isPrimaryKey ? true : undefined,
            sortable: isSortable,
            copyable: isCopyable,
            sensitive: isSensitive,
            hidden_by_default: false,
            badge_map,
            relation: resolvedRelation,
          });

          // Searchable & Filterable inference
          if (type === "string" && (propKey.includes("name") || propKey.includes("email") || propKey.includes("title"))) {
            searchableFields.push(propKey);
          }
          if (type === "badge" || propKey === "status" || propKey === "role" || propKey === "type") {
            filterableFields.push(propKey);
          }
        }
      }

      // Check query parameters for search, filters, and required query parameter gates
      if (Array.isArray(getCollection.op.parameters)) {
        for (const param of getCollection.op.parameters) {
          if (param.in === "query") {
            const name = param.name;
            const isRequired = Boolean(param.required);
            const paramType = param.schema?.type || "string";
            const paramOptions = Array.isArray(param.schema?.enum)
              ? param.schema.enum.map((opt: any) => ({ label: toTitleCase(String(opt)), value: opt }))
              : undefined;

            if (["search", "query", "q"].includes(name.toLowerCase()) && searchableFields.length === 0 && columns.length > 0) {
              const firstStringCol = columns.find((c) => c.type === "string");
              if (firstStringCol) searchableFields.push(firstStringCol.key);
            }
            if (columns.some((c) => c.key === name) && !filterableFields.includes(name)) {
              filterableFields.push(name);
            }

            resourceFilters.push({
              key: name,
              label: toTitleCase(name),
              type: paramOptions ? "select" : (paramType === "number" || paramType === "integer" ? "number" : paramType === "boolean" ? "boolean" : "string"),
              required: isRequired,
              options: paramOptions,
              default_value: param.schema?.default,
              placeholder: param.description || `Filter by ${toTitleCase(name)}`,
            });
          }
        }
      }
    }

    // Fallback if no columns discovered (e.g. empty schemas, omitted responses, or properties: {})
    if (columns.length === 0) {
      columns.push({
        key: "id",
        label: "ID",
        type: "string",
        primary_key: true,
        sortable: false,
        copyable: true,
        sensitive: false,
        hidden_by_default: false,
      });

      // Check if status endpoints or status-related actions exist
      const hasStatusEndpoints = endpoints.some((e) => {
        const verb = extractActionVerb(e.strippedPath, resourceKey);
        return (
          e.strippedPath.toLowerCase().includes("status") ||
          ["approve", "reject", "cancel", "close", "reopen", "archive", "publish"].includes(
            (verb || "").toLowerCase()
          )
        );
      });

      if (hasStatusEndpoints || hasStatusField) {
        columns.push({
          key: "status",
          label: "Status",
          type: "badge",
          badge_map: {
            pending: "yellow",
            active: "green",
            approved: "green",
            rejected: "red",
            closed: "gray",
          },
          sortable: false,
          copyable: false,
          sensitive: false,
          hidden_by_default: false,
        });
        if (!filterableFields.includes("status")) {
          filterableFields.push("status");
        }
      }

      columns.push(
        {
          key: "created_at",
          label: "Created At",
          type: "string",
          sortable: true,
          copyable: false,
          sensitive: false,
          hidden_by_default: false,
        },
        {
          key: "updated_at",
          label: "Updated At",
          type: "string",
          sortable: true,
          copyable: false,
          sensitive: false,
          hidden_by_default: false,
        }
      );

      if (searchableFields.length === 0) {
        searchableFields.push("id");
      }
    }

    totalColumns += columns.length;

    // 3.2: CRUD Mutations mapping
    let creatable: MutationsConfig["creatable"] = false;
    let editable: MutationsConfig["editable"] = false;
    let deletable: MutationsConfig["deletable"] = false;

    // POST /resource -> creatable
    const postCollection = endpoints.find(
      (e) => e.method === "POST" && isCollectionPath(e.strippedPath, resourceKey)
    );
    if (postCollection) {
      const bodySchema = getRequestBodySchema(postCollection.op);
      const fields = inferFormFields(bodySchema);
      creatable = {
        enabled: true,
        endpoint: postCollection.path,
        method: "POST",
        fields,
      };
    }

    // PUT / PATCH /resource/{id} -> editable
    const putItem = endpoints.find(
      (e) => (e.method === "PUT" || e.method === "PATCH") && isItemPath(e.strippedPath, resourceKey)
    );
    if (putItem) {
      const bodySchema = getRequestBodySchema(putItem.op);
      const fields = inferFormFields(bodySchema);
      editable = {
        enabled: true,
        endpoint: putItem.path,
        method: putItem.method as "PUT" | "PATCH",
        fields,
      };
    }

    // DELETE /resource/{id} -> deletable
    const deleteItem = endpoints.find(
      (e) => e.method === "DELETE" && isItemPath(e.strippedPath, resourceKey)
    );
    if (deleteItem) {
      deletable = {
        enabled: true,
        endpoint: deleteItem.path,
        method: "DELETE",
        fields: [],
      };
    }

    // 3.3: Detect relational sub-resources (e.g. GET/POST /cases/{id}/notes, GET /cases/{id}/evidence)
    const subResourcesMap = new Map<string, SubResourceConfig>();
    for (const ep of endpoints) {
      const { subResourceId, isSubResource } = isSubResourcePath(ep.strippedPath, resourceKey);
      if (isSubResource && subResourceId) {
        const existing = subResourcesMap.get(subResourceId);
        if (!existing) {
          subResourcesMap.set(subResourceId, {
            id: subResourceId,
            label: toTitleCase(subResourceId),
            endpoint: ep.path,
            method: "GET",
            create_endpoint: ep.method === "POST" ? ep.path : undefined,
            primary_key: "id",
            columns: [],
          });
        } else {
          if (ep.method === "POST") {
            existing.create_endpoint = ep.path;
          }
        }
      }
    }

    // 3.4: Custom Actions mapping (e.g. POST /refunds/{id}/approve)
    const actions: ActionConfig[] = [];

    for (const ep of endpoints) {
      // 1. Do NOT create an action for any HTTP GET endpoint!
      // Auxiliary GET endpoints (e.g. /cases/metrics, /cases/investigators, /complaints/pending, /auth/me)
      // must NOT be classified as row/resource actions.
      if (ep.method === "GET") continue;

      // 2. Only endpoints with POST, PUT, PATCH, or DELETE can become actions
      if (!["POST", "PUT", "PATCH", "DELETE"].includes(ep.method)) continue;

      // 3. Routes ending with .../{id} are item detail or standard CRUD mutation routes, not actions
      if (isItemDetailPath(ep.strippedPath, resourceKey)) continue;

      // 4. Collection base routes (e.g. POST /refunds) are collection create mutations, not actions
      if (isCollectionPath(ep.strippedPath, resourceKey)) continue;

      // 5. If this route is a sub-resource endpoint, attach it to sub_resources instead of a flat row action button
      const subResCheck = isSubResourcePath(ep.strippedPath, resourceKey);
      if (subResCheck.isSubResource && subResourcesMap.has(subResCheck.subResourceId)) {
        continue;
      }

      const actionVerb = extractActionVerb(ep.strippedPath, resourceKey);
      if (!actionVerb) continue;

      const isRowScope = ep.strippedPath.includes("{");
      const actionName = toSnakeCase(actionVerb);
      let actionLabel = toTitleCase(actionVerb);
      if (actionName === "status" || actionName === "update_status") {
        actionLabel = "Update Status";
      } else if (actionName === "assign" || actionName === "assign_investigator") {
        actionLabel = "Assign";
      }
      const style = inferActionStyle(actionName);

      const { schema: bodySchema, isMultipart } = getRequestBodyInfo(ep.op);
      if (bodySchema && Object.keys(bodySchema.properties || {}).length === 0) {
        console.warn(
          `[admin-kit:warn] Action endpoint ${ep.method} ${ep.path} has an empty requestBody schema (properties: {}).`
        );
      }
      const inputs = inferFormFields(bodySchema);

      // Determine visible_if condition
      let visibleIf: string | undefined = undefined;
      if (hasStatusField) {
        if (["approve", "reject", "cancel"].includes(actionName)) {
          visibleIf = "row.status == 'pending'";
        }
      }

      // Determine confirmation dialog
      let confirmDialog = undefined;
      if (inputs.length === 0 || ["approve", "delete", "ban", "terminate"].includes(actionName)) {
        let confirmMsg = `Are you sure you want to ${actionName.replace(/_/g, " ")} this ${singularLabel.toLowerCase()}?`;
        if (actionName === "status" || actionName === "update_status") {
          confirmMsg = `Are you sure you want to update the status of this ${singularLabel.toLowerCase()}?`;
        } else if (actionName === "assign") {
          confirmMsg = `Are you sure you want to assign this ${singularLabel.toLowerCase()}?`;
        }
        confirmDialog = {
          title: `${actionLabel} ${singularLabel}?`,
          message: confirmMsg,
          confirm_text: actionLabel,
          cancel_text: "Cancel",
        };
      }

      actions.push({
        name: actionName,
        label: actionLabel,
        style,
        scope: isRowScope ? "row" : "global",
        visible_if: visibleIf,
        confirm_dialog: confirmDialog,
        api: {
          endpoint: ep.path,
          method: ep.method as "POST" | "PUT" | "PATCH" | "DELETE",
          content_type: isMultipart ? "multipart/form-data" : "application/json",
        },
        inputs: inputs,
        on_success: {
          toast: `${singularLabel} ${toPastTense(actionName)} successfully.`,
          invalidate: [resourceKey],
        },
      });
    }

    totalActions += actions.length;

    resources[resourceKey] = {
      label: resourceLabel,
      endpoint: baseEndpoint,
      detail_endpoint: detailEndpoint,
      primary_key: "id",
      table: {
        page_size: 20,
        searchable_fields: searchableFields,
        filterable_fields: filterableFields,
        columns,
      },
      mutations: {
        creatable,
        editable,
        deletable,
      },
      actions,
      sub_resources: Array.from(subResourcesMap.values()),
      filters: resourceFilters,
    };
  }

  // Step 4: Assemble top-level configuration
  const projectName = options.projectName || api.info?.title || "Admin Dashboard";
  const baseUrl = options.baseUrl || "/api";

  // Scan OpenAPI paths for dynamically discovered authentication routes
  let discoveredLoginEndpoint: string | undefined = undefined;
  let discoveredMeEndpoint: string | undefined = undefined;

  for (const [p, pathItem] of Object.entries<any>(rawPaths)) {
    if (!pathItem || typeof pathItem !== "object") continue;
    const lowerP = p.toLowerCase();
    if (
      pathItem.post &&
      ["/login", "/auth/login", "/token", "/auth/token", "/api/auth/login", "/api/login"].some((suffix) => lowerP.endsWith(suffix))
    ) {
      discoveredLoginEndpoint = p;
    }
    if (
      pathItem.get &&
      ["/me", "/auth/me", "/users/me", "/profile", "/api/auth/me", "/api/me"].some((suffix) => lowerP.endsWith(suffix))
    ) {
      discoveredMeEndpoint = p;
    }
  }

  const rawConfig = {
    version: "1.0",
    project: {
      name: projectName,
      base_url: baseUrl,
      branding: {
        primary_color: "#4f46e5",
        theme: "system" as const,
      },
    },
    auth: {
      strategy: "bearer" as const,
      ...(discoveredLoginEndpoint ? { login_endpoint: discoveredLoginEndpoint } : {}),
      ...(discoveredMeEndpoint ? { me_endpoint: discoveredMeEndpoint } : {}),
      token_storage: "sessionStorage" as const,
      role_claim_path: "roles",
      permission_claim_path: "permissions",
    },
    access: {
      default_policy: "deny" as const,
      superadmin_roles: ["superadmin", "admin"],
    },
    resources,
  };

  // Step 5: Strict validation against @admin-kit-yu/core schema
  const validatedConfig: AdminKitConfig = AdminKitConfigSchema.parse(rawConfig);

  return {
    config: validatedConfig,
    detectedResources: resources,
    stats: {
      resourceCount: Object.keys(resources).length,
      actionCount: totalActions,
      tableColumnCount: totalColumns,
    },
  };
}

/**
 * Checks if a stripped path represents a collection endpoint (e.g. "/users", "/cases/all", "/cases/list").
 */
function isCollectionPath(strippedPath: string, resourceKey: string): boolean {
  const segments = strippedPath.split("/").filter(Boolean);
  if (segments.length === 1 && toSnakeCase(segments[0]) === resourceKey) return true;
  if (
    segments.length === 2 &&
    toSnakeCase(segments[0]) === resourceKey &&
    ["all", "list", "items", "all_items", "all-items", "get_all", "get-all"].includes(segments[1].toLowerCase())
  ) {
    return true;
  }
  return false;
}

/**
 * Checks if a stripped path represents a single item endpoint (e.g. "/users/{id}").
 */
function isItemPath(strippedPath: string, resourceKey: string): boolean {
  const segments = strippedPath.split("/").filter(Boolean);
  return (
    segments.length === 2 &&
    toSnakeCase(segments[0]) === resourceKey &&
    segments[1].startsWith("{") &&
    segments[1].endsWith("}")
  );
}

/**
 * Checks if a stripped path represents an item detail route ending in a parameter like {id}.
 */
function isItemDetailPath(strippedPath: string, resourceKey: string): boolean {
  const segments = strippedPath.split("/").filter(Boolean);
  if (toSnakeCase(segments[0]) !== resourceKey) return false;
  const last = segments[segments.length - 1];
  return Boolean(last && last.startsWith("{") && last.endsWith("}"));
}

/**
 * Detects if a route represents a child sub-resource under a parent record (e.g. /cases/{id}/notes).
 */
function isSubResourcePath(strippedPath: string, resourceKey: string): { subResourceId: string; isSubResource: boolean } {
  const segments = strippedPath.split("/").filter(Boolean);
  if (toSnakeCase(segments[0]) !== resourceKey) return { subResourceId: "", isSubResource: false };

  const idIndex = segments.findIndex((s) => s.startsWith("{") && s.endsWith("}"));
  if (idIndex >= 0 && idIndex < segments.length - 1) {
    const trailing = segments.slice(idIndex + 1);
    if (trailing.length === 1 && !trailing[0].startsWith("{")) {
      const candidate = trailing[0].toLowerCase();
      const isSubResourceNoun = [
        "notes", "evidence", "comments", "attachments", "documents",
        "logs", "history", "files", "items", "records", "tasks", "members",
        "activity", "messages", "tags", "audit", "events"
      ].includes(candidate);
      return { subResourceId: candidate, isSubResource: isSubResourceNoun };
    }
  }
  return { subResourceId: "", isSubResource: false };
}

/**
 * Extracts action verb from a custom action path.
 * e.g. "/refunds/{id}/approve" -> "approve"
 *      "/users/investigators/{id}/approve" -> "approve"
 *      "/cases/bulk-assign" -> "bulk_assign"
 */
function extractActionVerb(strippedPath: string, resourceKey: string): string | null {
  const segments = strippedPath.split("/").filter(Boolean);
  if (toSnakeCase(segments[0]) !== resourceKey) return null;

  // Pattern: route with parameter like {id} followed by verb(s)
  const idIndex = segments.findIndex((s) => s.startsWith("{") && s.endsWith("}"));
  if (idIndex >= 0 && idIndex < segments.length - 1) {
    return segments.slice(idIndex + 1).join("_");
  }

  // Pattern without parameter: e.g. /cases/bulk-assign or /cases/export
  if (segments.length === 2 && !segments[1].startsWith("{")) {
    const verb = segments[1].toLowerCase();
    if (["all", "list", "items", "all-items", "all_items", "get-all", "get_all"].includes(verb)) {
      return null;
    }
    return segments[1];
  }

  return null;
}

/**
 * Extracts the 200/201 response schema from an operation.
 */
function getResponseSchema(op: any): any {
  if (!op || !op.responses) return null;
  const res = op.responses["200"] || op.responses["201"] || op.responses.default;
  return res?.content?.["application/json"]?.schema || res?.schema;
}

/**
 * Extracts the requestBody schema and multipart flag from an operation.
 */
function getRequestBodyInfo(op: any): { schema: any; isMultipart: boolean } {
  if (!op || !op.requestBody) return { schema: null, isMultipart: false };
  const content = op.requestBody?.content || {};
  if (content["multipart/form-data"]?.schema) {
    return { schema: content["multipart/form-data"].schema, isMultipart: true };
  }
  if (content["application/json"]?.schema) {
    return { schema: content["application/json"].schema, isMultipart: false };
  }
  if (content["application/x-www-form-urlencoded"]?.schema) {
    return { schema: content["application/x-www-form-urlencoded"].schema, isMultipart: false };
  }
  const firstKey = Object.keys(content)[0];
  if (firstKey && content[firstKey]?.schema) {
    return { schema: content[firstKey].schema, isMultipart: firstKey.includes("form-data") };
  }
  return { schema: null, isMultipart: false };
}

/**
 * Extracts the requestBody schema from an operation.
 */
function getRequestBodySchema(op: any): any {
  return getRequestBodyInfo(op).schema;
}

/**
 * Extracts the array item schema if schema is an array or paginated object.
 */
function extractItemSchema(schema: any): any {
  if (!schema) return null;
  if (schema.type === "array" && schema.items) {
    return schema.items;
  }
  if (schema.type === "object" && schema.properties) {
    for (const key of ["data", "items", "results", "records"]) {
      if (schema.properties[key]?.type === "array" && schema.properties[key]?.items) {
        return schema.properties[key].items;
      }
    }
    return schema;
  }
  return schema;
}
