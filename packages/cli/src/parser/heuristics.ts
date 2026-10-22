import type {
  ColumnType,
  FormField,
  ActionStyle,
} from "@admin-kit/core";
import { toSnakeCase, toTitleCase, pluralize } from "../utils/formatting";

const CURRENCY_KEYWORDS = ["amount", "price", "cost", "balance", "total", "fee", "subtotal", "salary", "wage"];
const SENSITIVE_KEYWORDS = ["ssn", "tax_id", "password", "secret", "token", "bank_account", "routing_number", "credit_card", "cvv"];

/**
 * Strips common version and base prefixes like /api/v1, /v1, /api from an endpoint path.
 */
export function stripApiPrefix(path: string): string {
  return path
    .replace(/^\/api\/v\d+(\.\d+)?(?=\/|$)/i, "")
    .replace(/^\/v\d+(\.\d+)?(?=\/|$)/i, "")
    .replace(/^\/api(?=\/|$)/i, "") || "/";
}

/**
 * Extracts the primary resource name from a normalized path.
 * e.g., "/refunds" -> "refunds", "/refund-requests/{id}" -> "refund_requests"
 */
export function extractResourceKey(strippedPath: string): string | null {
  const segments = strippedPath.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  const first = segments[0];
  if (first.startsWith("{") && first.endsWith("}")) return null;
  return toSnakeCase(first);
}

/**
 * Infers an admin-kit column type from an OpenAPI schema property.
 */
export function inferColumnType(
  key: string,
  schema: any,
  allResourceKeys: string[]
): { type: ColumnType; relation?: { target_resource: string; value_field: string; display_field: string }; badge_map?: Record<string, string> } {
  const propName = key.toLowerCase();

  // Check relation heuristic: Property ending in _id or Id
  if (propName.endsWith("_id") || (key.endsWith("Id") && key.length > 2)) {
    let noun = propName.endsWith("_id") ? propName.slice(0, -3) : key.slice(0, -2).toLowerCase();
    const pluralCandidate = toSnakeCase(pluralize(noun));
    const singularCandidate = toSnakeCase(noun);

    const targetResource = allResourceKeys.find(
      (r) => r === pluralCandidate || r === singularCandidate
    );

    if (targetResource) {
      return {
        type: "relation",
        relation: {
          target_resource: targetResource,
          value_field: "id",
          display_field: "email", // will be refined against target resource schema if known
        },
      };
    }
  }

  // Schema type and format
  const schemaType = schema?.type;
  const format = schema?.format;

  if (schemaType === "string") {
    if (format === "date-time") {
      return { type: "datetime" };
    }
    if (format === "date") {
      return { type: "date" };
    }
    if (Array.isArray(schema.enum) && schema.enum.length > 0) {
      return {
        type: "badge",
        badge_map: inferBadgeMap(schema.enum),
      };
    }
    if (format === "uri" || format === "url" || propName.includes("image") || propName.includes("avatar")) {
      return { type: "image" };
    }
    return { type: "string" };
  }

  if (schemaType === "integer" || schemaType === "number") {
    const isCurrency = CURRENCY_KEYWORDS.some((kw) => propName.includes(kw));
    if (isCurrency) {
      return { type: "currency" };
    }
    return { type: "number" };
  }

  if (schemaType === "boolean") {
    return { type: "boolean" };
  }

  if (schemaType === "object" || schemaType === "array") {
    return { type: "json" };
  }

  return { type: "string" };
}

/**
 * Deterministically generates badge color mappings for enum values.
 */
export function inferBadgeMap(enumValues: string[]): Record<string, string> {
  const map: Record<string, string> = {};

  for (const val of enumValues) {
    const lower = String(val).toLowerCase();
    if (["pending", "processing", "in_progress", "review", "queued", "draft"].some((k) => lower.includes(k))) {
      map[val] = "yellow";
    } else if (["approved", "active", "completed", "success", "paid", "verified", "resolved"].some((k) => lower.includes(k))) {
      map[val] = "green";
    } else if (["rejected", "failed", "banned", "cancelled", "error", "inactive", "suspended", "declined"].some((k) => lower.includes(k))) {
      map[val] = "red";
    } else if (["user", "member", "customer", "info"].some((k) => lower.includes(k))) {
      map[val] = "blue";
    } else if (["admin", "superadmin", "manager", "vip", "lead"].some((k) => lower.includes(k))) {
      map[val] = "purple";
    } else {
      map[val] = "gray";
    }
  }

  return map;
}

/**
 * Checks if a field name implies sensitivity (PII/credentials).
 */
export function isSensitiveField(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Converts OpenAPI requestBody properties into FormField configurations.
 */
export function inferFormFields(schema: any): FormField[] {
  if (!schema || typeof schema !== "object") return [];

  const properties = schema.properties || {};
  const requiredList: string[] = Array.isArray(schema.required) ? schema.required : [];

  const fields: FormField[] = [];

  for (const [key, prop] of Object.entries<any>(properties)) {
    const isRequired = requiredList.includes(key);
    const label = toTitleCase(key);
    let type = "string";
    let options: Array<{ label: string; value: string | number | boolean }> | undefined;

    if (Array.isArray(prop?.enum) && prop.enum.length > 0) {
      type = "select";
      options = prop.enum.map((opt: any) => ({
        label: toTitleCase(String(opt)),
        value: opt,
      }));
    } else if (prop?.type === "string") {
      if (prop.format === "date-time") type = "datetime";
      else if (prop.format === "date") type = "date";
      else if (["notes", "note", "description", "reason", "comment", "message", "body"].some((kw) => key.toLowerCase().includes(kw))) {
        type = "textarea";
      } else {
        type = "string";
      }
    } else if (prop?.type === "number" || prop?.type === "integer") {
      type = "number";
    } else if (prop?.type === "boolean") {
      type = "boolean";
    } else if (prop?.type === "object" || prop?.type === "array") {
      type = "json";
    }

    fields.push({
      key,
      label,
      type,
      required: isRequired,
      placeholder: prop?.description ? prop.description : undefined,
      options,
    });
  }

  return fields;
}

/**
 * Assigns semantic button styling based on action name.
 */
export function inferActionStyle(actionName: string): ActionStyle {
  const lower = actionName.toLowerCase();
  if (["approve", "verify", "activate", "complete", "accept", "unban", "enable", "publish"].some((k) => lower.includes(k))) {
    return "success";
  }
  if (["reject", "delete", "ban", "revoke", "cancel", "deactivate", "disable", "terminate", "remove"].some((k) => lower.includes(k))) {
    return "danger";
  }
  if (["suspend", "escalate", "flag", "pause", "warn", "hold"].some((k) => lower.includes(k))) {
    return "warning";
  }
  return "primary";
}
