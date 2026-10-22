import { z } from "zod";
import { AccessRuleSchema } from "./common";
import { FormFieldSchema } from "./field";

/**
 * Visual button styling for custom action triggers.
 */
export const ActionStyleSchema = z.enum([
  "primary",
  "secondary",
  "success",
  "danger",
  "warning",
]);
export type ActionStyle = z.infer<typeof ActionStyleSchema>;

/**
 * Operational execution scope of the action:
 * - "row": Applied to a single record row.
 * - "bulk": Applied to multiple selected record rows.
 * - "global": Displayed in the top toolbar without record context.
 */
export const ActionScopeSchema = z.enum(["row", "bulk", "global"]);
export type ActionScope = z.infer<typeof ActionScopeSchema>;

/**
 * Confirmation dialog shown before firing an action.
 */
export const ConfirmDialogSchema = z.object({
  title: z.string().min(1, "Confirm dialog title is required"),
  message: z.string().min(1, "Confirm dialog message is required"),
  confirm_text: z.string().default("Confirm"),
  cancel_text: z.string().default("Cancel"),
});
export type ConfirmDialog = z.infer<typeof ConfirmDialogSchema>;

/**
 * API call descriptor executed when an action triggers.
 */
export const ActionApiSchema = z.object({
  endpoint: z.string().min(1, "Action endpoint is required"),
  method: z.enum(["POST", "PUT", "PATCH", "DELETE"]).default("POST"),
});
export type ActionApi = z.infer<typeof ActionApiSchema>;

/**
 * Post-execution handling instructions after an action succeeds.
 */
export const ActionOnSuccessSchema = z.object({
  toast: z.string().optional(),
  invalidate: z.array(z.string()).default([]),
});
export type ActionOnSuccess = z.infer<typeof ActionOnSuccessSchema>;

/**
 * Custom RPC workflow action specification.
 */
export const ActionConfigSchema = z.object({
  name: z.string().min(1, "Action name is required"),
  label: z.string().min(1, "Action label is required"),
  icon: z.string().optional(),
  style: ActionStyleSchema.default("primary"),
  scope: ActionScopeSchema.default("row"),
  visible_if: z.string().optional(),
  access: AccessRuleSchema.optional(),
  confirm_dialog: ConfirmDialogSchema.optional(),
  api: ActionApiSchema,
  inputs: z.array(FormFieldSchema).optional().default([]),
  on_success: ActionOnSuccessSchema.optional(),
});
export type ActionConfig = z.infer<typeof ActionConfigSchema>;
