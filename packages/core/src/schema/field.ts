import { z } from "zod";
import { RelationConfigSchema } from "./common";

/**
 * Supported field types for form inputs in mutations and workflow action modals.
 */
export const FormFieldTypeSchema = z.union([
  z.enum([
    "string",
    "text",
    "textarea",
    "number",
    "boolean",
    "select",
    "date",
    "datetime",
    "json",
    "relation",
  ]),
  z.string(),
]);
export type FormFieldType = z.infer<typeof FormFieldTypeSchema>;

/**
 * Option descriptor for select dropdowns and radio/checkbox groups.
 */
export const FormFieldOptionSchema = z.union([
  z.object({
    label: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()]),
  }),
  z.string(),
]);
export type FormFieldOption = z.infer<typeof FormFieldOptionSchema>;

/**
 * Form field specification for CRUD mutations and custom action modals.
 */
export const FormFieldSchema = z.object({
  key: z.string().min(1, "Field key is required"),
  label: z.string().min(1, "Field label is required"),
  type: FormFieldTypeSchema,
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  default_value: z.unknown().optional(),
  options: z.array(FormFieldOptionSchema).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  regex: z.string().optional(),
  relation: RelationConfigSchema.optional(),
});
export type FormField = z.infer<typeof FormFieldSchema>;
