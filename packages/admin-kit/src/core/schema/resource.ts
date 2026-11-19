import { z } from "zod";
import { AccessRuleSchema } from "./common";
import { TableConfigSchema } from "./table";
import { MutationsConfigSchema } from "./mutation";
import { ActionConfigSchema } from "./action";

/**
 * Child collection / relational sub-resource attached to a record (e.g. /cases/{id}/notes).
 */
export const SubResourceConfigSchema = z.object({
  id: z.string().min(1, "Sub-resource id is required"),
  label: z.string().min(1, "Sub-resource label is required"),
  endpoint: z.string().min(1, "Sub-resource endpoint is required"),
  method: z.enum(["GET", "POST"]).default("GET"),
  create_endpoint: z.string().optional(),
  primary_key: z.string().default("id"),
  columns: z.array(z.any()).optional().default([]),
});
export type SubResourceConfig = z.infer<typeof SubResourceConfigSchema>;

/**
 * Filter definition for collection query parameters (e.g. ?role=investigator).
 */
export const ResourceFilterSchema = z.object({
  key: z.string().min(1, "Filter key is required"),
  label: z.string().min(1, "Filter label is required"),
  type: z.enum(["string", "select", "number", "boolean"]).default("string"),
  required: z.boolean().default(false),
  options: z.array(z.any()).optional(),
  default_value: z.any().optional(),
  placeholder: z.string().optional(),
});
export type ResourceFilter = z.infer<typeof ResourceFilterSchema>;

/**
 * Resource configuration representing an individual entity (e.g., users, refund_requests).
 */
export const ResourceConfigSchema = z.object({
  label: z.string().min(1, "Resource label is required"),
  icon: z.string().optional(),
  endpoint: z.string().min(1, "Resource endpoint is required"),
  detail_endpoint: z.string().optional(),
  primary_key: z.string().default("id"),
  access: AccessRuleSchema.optional(),
  table: TableConfigSchema.optional(),
  mutations: MutationsConfigSchema.optional(),
  actions: z.array(ActionConfigSchema).optional().default([]),
  sub_resources: z.array(SubResourceConfigSchema).optional().default([]),
  filters: z.array(ResourceFilterSchema).optional().default([]),
});
export type ResourceConfig = z.infer<typeof ResourceConfigSchema>;
