import { z } from "zod";

/**
 * UI branding configuration including logo, primary theme color, and color mode preference.
 */
export const ProjectBrandingSchema = z.object({
  logo_url: z.string().optional(),
  primary_color: z.string().default("#4f46e5"),
  theme: z.enum(["light", "dark", "system"]).default("system"),
});
export type ProjectBranding = z.infer<typeof ProjectBrandingSchema>;

/**
 * Project-level configuration defining application metadata, base API path, and branding.
 */
export const ProjectConfigSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  base_url: z.string().default("/api"),
  branding: ProjectBrandingSchema.optional(),
});
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
