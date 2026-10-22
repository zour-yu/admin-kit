import path from "node:path";
import SwaggerParser from "@apidevtools/swagger-parser";
import {
  AdminKitConfigSchema,
  type AdminKitConfig,
  type ResourceConfig,
  type TableColumn,
  type ActionConfig,
  type MutationsConfig,
} from "@admin-kit/core";
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
    const resourceLabel = toTitleCase(pluralize(resourceKey));
    const singularLabel = toTitleCase(singularize(resourceKey));

    // Find collection base endpoint (e.g. "/refunds" or "/users")
    const collectionEp = endpoints.find(
      (e) => isCollectionPath(e.strippedPath, resourceKey)
    );
    const baseEndpoint = collectionEp ? collectionEp.path : `/${resourceKey}`;

    // 3.1: Table definition from GET collection
    const getCollection = endpoints.find(
      (e) => e.method === "GET" && isCollectionPath(e.strippedPath, resourceKey)
    );

    let columns: TableColumn[] = [];
    let searchableFields: string[] = [];
    let filterableFields: string[] = [];
    let hasStatusField = false;

    if (getCollection) {
      const responseSchema = getResponseSchema(getCollection.op);
      const itemSchema = extractItemSchema(responseSchema);

      if (itemSchema && itemSchema.properties) {
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
          const isCopyable = propKey === "id" || propKey.endsWith("_id") || propKey.endsWith("Id");
          const isSortable = type === "currency" || type === "number" || type === "date" || type === "datetime";
          const isSensitive = isSensitiveField(propKey);

          columns.push({
            key: propKey,
            label: colLabel,
            type,
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

      // Check query parameters for search and filters
      if (Array.isArray(getCollection.op.parameters)) {
        for (const param of getCollection.op.parameters) {
          if (param.in === "query") {
            const name = param.name;
            if (["search", "query", "q"].includes(name.toLowerCase()) && searchableFields.length === 0 && columns.length > 0) {
              const firstStringCol = columns.find((c) => c.type === "string");
              if (firstStringCol) searchableFields.push(firstStringCol.key);
            }
            if (columns.some((c) => c.key === name) && !filterableFields.includes(name)) {
              filterableFields.push(name);
            }
          }
        }
      }
    }

    // Fallback if no columns discovered
    if (columns.length === 0) {
      columns.push({
        key: "id",
        label: "ID",
        type: "string",
        sortable: false,
        copyable: true,
        sensitive: false,
        hidden_by_default: false,
      });
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

    // 3.3: Custom Actions mapping (e.g. POST /refunds/{id}/approve)
    const actions: ActionConfig[] = [];

    for (const ep of endpoints) {
      const actionVerb = extractActionVerb(ep.strippedPath, resourceKey);
      if (!actionVerb) continue;

      const isRowScope = ep.strippedPath.includes("{");
      const actionName = toSnakeCase(actionVerb);
      const actionLabel = toTitleCase(actionVerb);
      const style = inferActionStyle(actionName);

      const bodySchema = getRequestBodySchema(ep.op);
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
        confirmDialog = {
          title: `${actionLabel} ${singularLabel}?`,
          message: `Are you sure you want to ${actionName} this ${singularLabel.toLowerCase()}?`,
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
    };
  }

  // Step 4: Assemble top-level configuration
  const projectName = options.projectName || api.info?.title || "Admin Dashboard";
  const baseUrl = options.baseUrl || "/api";

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
      login_endpoint: "/auth/login",
      me_endpoint: "/auth/me",
      token_storage: "sessionStorage" as const,
      role_claim_path: "roles",
      permission_claim_path: "permissions",
    },
    access: {
      default_policy: "deny" as const,
      superadmin_roles: ["superadmin"],
    },
    resources,
  };

  // Step 5: Strict validation against @admin-kit/core schema
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
 * Checks if a stripped path represents a collection endpoint (e.g. "/users" or "/refunds").
 */
function isCollectionPath(strippedPath: string, resourceKey: string): boolean {
  const segments = strippedPath.split("/").filter(Boolean);
  return segments.length === 1 && toSnakeCase(segments[0]) === resourceKey;
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
 * Extracts action verb from a custom action path.
 * e.g. "/refunds/{id}/approve" -> "approve"
 */
function extractActionVerb(strippedPath: string, resourceKey: string): string | null {
  const segments = strippedPath.split("/").filter(Boolean);
  if (toSnakeCase(segments[0]) !== resourceKey) return null;

  // Pattern: /resource/{id}/verb
  if (segments.length === 3 && segments[1].startsWith("{") && segments[1].endsWith("}")) {
    return segments[2];
  }

  // Pattern: /resource/verb (where verb is not a parameter and not standard collection)
  if (segments.length === 2 && !segments[1].startsWith("{")) {
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
 * Extracts the requestBody schema from an operation.
 */
function getRequestBodySchema(op: any): any {
  if (!op || !op.requestBody) return null;
  return op.requestBody?.content?.["application/json"]?.schema;
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
