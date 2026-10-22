import { z } from "zod";
import { AccessRuleSchema } from "./common";
import { FormFieldSchema } from "./field";

/**
 * HTTP methods permitted for standard CRUD mutations.
 */
export const MutationMethodSchema = z.enum(["POST", "PUT", "PATCH", "DELETE"]);
export type MutationMethod = z.infer<typeof MutationMethodSchema>;

/**
 * Detailed object configuration for a single mutation (creatable, editable, or deletable).
 */
export const MutationActionObjectSchema = z.object({
  enabled: z.boolean().default(true),
  endpoint: z.string().optional(),
  method: MutationMethodSchema.optional(),
  roles: z.array(z.string()).optional(),
  permissions: z.array(z.string()).optional(),
  access: AccessRuleSchema.optional(),
  fields: z.array(FormFieldSchema).optional().default([]),
});
export type MutationActionObject = z.infer<typeof MutationActionObjectSchema>;

/**
 * Mutation action descriptor allowing either a simple boolean toggle or detailed object configuration.
 */
export const MutationActionSchema = z
  .union([z.boolean(), MutationActionObjectSchema])
  .default(false);
export type MutationAction = z.infer<typeof MutationActionSchema>;

/**
 * Standard CRUD mutations configuration for a resource.
 */
export const MutationsConfigSchema = z.object({
  creatable: MutationActionSchema.default(false),
  editable: MutationActionSchema.default(false),
  deletable: MutationActionSchema.default(false),
});
export type MutationsConfig = z.infer<typeof MutationsConfigSchema>;

/**
 * Checks whether a mutation action (boolean or object) is enabled.
 */
export function isMutationEnabled(action?: MutationAction | null): boolean {
  if (typeof action === "boolean") {
    return action;
  }
  if (action && typeof action === "object") {
    return action.enabled !== false;
  }
  return false;
}

/**
 * Normalizes a mutation action (boolean or object) into a standardized MutationActionObject,
 * applying default endpoints and methods if provided.
 */
export function normalizeMutation(
  action: MutationAction | undefined,
  defaultEndpoint?: string,
  defaultMethod?: MutationMethod
): MutationActionObject | null {
  if (!action) return null;
  if (typeof action === "boolean") {
    if (!action) return null;
    return {
      enabled: true,
      endpoint: defaultEndpoint,
      method: defaultMethod,
      fields: [],
    };
  }
  if (!action.enabled) return null;
  return {
    ...action,
    endpoint: action.endpoint ?? defaultEndpoint,
    method: action.method ?? defaultMethod,
    fields: action.fields ?? [],
  };
}
