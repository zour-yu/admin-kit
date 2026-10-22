import { z } from "zod";
import {
  AccessRuleSchema,
  RelationConfigSchema,
  SortDirectionSchema,
} from "./common";

/**
 * Supported data types for table cell rendering.
 */
export const ColumnTypeSchema = z.enum([
  "string",
  "number",
  "boolean",
  "currency",
  "date",
  "datetime",
  "badge",
  "relation",
  "json",
  "image",
]);
export type ColumnType = z.infer<typeof ColumnTypeSchema>;

/**
 * Specification for an individual column in a resource table.
 */
export const TableColumnSchema = z.object({
  key: z.string().min(1, "Column key is required"),
  label: z.string().min(1, "Column label is required"),
  type: ColumnTypeSchema,
  sortable: z.boolean().default(false),
  copyable: z.boolean().default(false),
  sensitive: z.boolean().default(false),
  hidden_by_default: z.boolean().optional().default(false),
  currency_code: z.string().optional(),
  badge_map: z.record(z.string(), z.string()).optional(),
  relation: RelationConfigSchema.optional(),
  access: AccessRuleSchema.optional(),
});
export type TableColumn = z.infer<typeof TableColumnSchema>;

/**
 * Default sorting rule for a collection table view.
 */
export const DefaultSortSchema = z.object({
  field: z.string().min(1, "Sort field is required"),
  direction: SortDirectionSchema.default("asc"),
});
export type DefaultSort = z.infer<typeof DefaultSortSchema>;

/**
 * Table configuration controlling how the collection list view renders.
 */
export const TableConfigSchema = z.object({
  page_size: z.number().int().positive().default(20),
  default_sort: DefaultSortSchema.optional(),
  searchable_fields: z.array(z.string()).default([]),
  filterable_fields: z.array(z.string()).default([]),
  columns: z.array(TableColumnSchema).min(1, "Table must contain at least one column"),
});
export type TableConfig = z.infer<typeof TableConfigSchema>;
