import { z } from "zod";

/**
 * Default fallback access policy when a resource does not explicitly define access rules.
 */
export const AccessPolicySchema = z.enum(["allow", "deny"]);
export type AccessPolicy = z.infer<typeof AccessPolicySchema>;

/**
 * Global role-based access control (RBAC) defaults.
 */
export const GlobalAccessConfigSchema = z.object({
  default_policy: AccessPolicySchema.default("deny"),
  superadmin_roles: z.array(z.string()).default(["superadmin"]),
});
export type GlobalAccessConfig = z.infer<typeof GlobalAccessConfigSchema>;
