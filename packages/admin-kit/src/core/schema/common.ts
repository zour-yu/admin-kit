import { z } from "zod";

/**
 * Standard badge color palette supported by the AdminKit UI engine.
 */
export const BadgeColorSchema = z.enum([
  "gray",
  "red",
  "yellow",
  "green",
  "blue",
  "purple",
]);
export type BadgeColor = z.infer<typeof BadgeColorSchema>;

/**
 * Direction for sorting lists and tables.
 */
export const SortDirectionSchema = z.enum(["asc", "desc"]);
export type SortDirection = z.infer<typeof SortDirectionSchema>;

/**
 * Standard HTTP methods supported in mutations and custom action workflows.
 */
export const HttpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);
export type HttpMethod = z.infer<typeof HttpMethodSchema>;

/**
 * Reusable Access Control Rule for resources, columns, mutations, and actions.
 */
export const AccessRuleSchema = z.object({
  roles: z.array(z.string()).optional().default([]),
  permissions: z.array(z.string()).optional().default([]),
});
export type AccessRule = z.infer<typeof AccessRuleSchema>;

/**
 * Foreign key relation descriptor linking a column or field to another resource.
 */
export const RelationConfigSchema = z.object({
  target_resource: z.string().min(1, "target_resource is required"),
  value_field: z.string().min(1, "value_field is required"),
  display_field: z.string().min(1, "display_field is required"),
});
export type RelationConfig = z.infer<typeof RelationConfigSchema>;
