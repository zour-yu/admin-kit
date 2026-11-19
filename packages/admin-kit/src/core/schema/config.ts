import { z } from "zod";
import { ProjectConfigSchema } from "./project";
import { AuthConfigSchema } from "./auth";
import { GlobalAccessConfigSchema } from "./access";
import { ResourceConfigSchema } from "./resource";

/**
 * Top-level AdminKit configuration schema representing `admin.config.yaml`.
 * Declarative contract between backend APIs and the generated Admin UI.
 */
export const AdminKitConfigSchema = z.object({
  version: z.string().default("1.0"),
  project: ProjectConfigSchema,
  auth: AuthConfigSchema.optional(),
  access: GlobalAccessConfigSchema.optional(),
  resources: z.record(z.string(), ResourceConfigSchema),
});

/**
 * Validated AdminKitConfig object with all default values populated.
 */
export type AdminKitConfig = z.infer<typeof AdminKitConfigSchema>;

/**
 * Input type accepted by AdminKitConfigSchema before default values and transformations.
 */
export type AdminKitConfigInput = z.input<typeof AdminKitConfigSchema>;
