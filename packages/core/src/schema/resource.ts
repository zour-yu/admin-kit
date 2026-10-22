import { z } from "zod";
import { AccessRuleSchema } from "./common";
import { TableConfigSchema } from "./table";
import { MutationsConfigSchema } from "./mutation";
import { ActionConfigSchema } from "./action";

/**
 * Resource configuration representing an individual entity (e.g., users, refund_requests).
 */
export const ResourceConfigSchema = z.object({
  label: z.string().min(1, "Resource label is required"),
  icon: z.string().optional(),
  endpoint: z.string().min(1, "Resource endpoint is required"),
  primary_key: z.string().default("id"),
  access: AccessRuleSchema.optional(),
  table: TableConfigSchema.optional(),
  mutations: MutationsConfigSchema.optional(),
  actions: z.array(ActionConfigSchema).optional().default([]),
});
export type ResourceConfig = z.infer<typeof ResourceConfigSchema>;
