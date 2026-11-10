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
 * Base properties shared across all table column definitions.
 */
const BaseTableColumnSchema = z.object({
  key: z.string().min(1, "Column key is required"),
  label: z.string().min(1, "Column label is required"),
  sortable: z.boolean().default(false),
  copyable: z.boolean().default(false),
  sensitive: z.boolean().default(false),
  hidden_by_default: z.boolean().optional().default(false),
  access: AccessRuleSchema.optional(),
});

export const StringTableColumnSchema = BaseTableColumnSchema.extend({
  type: z.literal("string"),
});
export type StringTableColumn = z.infer<typeof StringTableColumnSchema>;

export const NumberTableColumnSchema = BaseTableColumnSchema.extend({
  type: z.literal("number"),
});
export type NumberTableColumn = z.infer<typeof NumberTableColumnSchema>;

export const BooleanTableColumnSchema = BaseTableColumnSchema.extend({
  type: z.literal("boolean"),
});
export type BooleanTableColumn = z.infer<typeof BooleanTableColumnSchema>;

export const DateTableColumnSchema = BaseTableColumnSchema.extend({
  type: z.literal("date"),
});
export type DateTableColumn = z.infer<typeof DateTableColumnSchema>;

export const DatetimeTableColumnSchema = BaseTableColumnSchema.extend({
  type: z.literal("datetime"),
});
export type DatetimeTableColumn = z.infer<typeof DatetimeTableColumnSchema>;

export const JsonTableColumnSchema = BaseTableColumnSchema.extend({
  type: z.literal("json"),
});
export type JsonTableColumn = z.infer<typeof JsonTableColumnSchema>;

export const ImageTableColumnSchema = BaseTableColumnSchema.extend({
  type: z.literal("image"),
});
export type ImageTableColumn = z.infer<typeof ImageTableColumnSchema>;

export const CurrencyTableColumnSchema = BaseTableColumnSchema.extend({
  type: z.literal("currency"),
  currency_code: z.string().optional(),
});
export type CurrencyTableColumn = z.infer<typeof CurrencyTableColumnSchema>;

export const BadgeTableColumnSchema = BaseTableColumnSchema.extend({
  type: z.literal("badge"),
  badge_map: z.record(z.string(), z.string()).optional(),
});
export type BadgeTableColumn = z.infer<typeof BadgeTableColumnSchema>;

export const RelationTableColumnSchema = BaseTableColumnSchema.extend({
  type: z.literal("relation"),
  relation: RelationConfigSchema.optional(),
});
export type RelationTableColumn = z.infer<typeof RelationTableColumnSchema>;

/**
 * Discriminated union of all table column types.
 * Enforces type safety so properties like `badge_map` only exist on `badge` columns,
 * `relation` only exists on `relation` columns, and `currency_code` on `currency` columns.
 */
export const TableColumnSchema = z.discriminatedUnion("type", [
  StringTableColumnSchema,
  NumberTableColumnSchema,
  BooleanTableColumnSchema,
  CurrencyTableColumnSchema,
  DateTableColumnSchema,
  DatetimeTableColumnSchema,
  BadgeTableColumnSchema,
  RelationTableColumnSchema,
  JsonTableColumnSchema,
  ImageTableColumnSchema,
]);
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
