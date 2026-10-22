import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { AdminKitConfigSchema, AdminKitConfig } from "../schema/config";

export interface ConfigValidationErrorDetail {
  path: string;
  message: string;
}

/**
 * Formats a ZodError into an array of readable path/message objects.
 */
export function formatConfigErrorDetails(error: z.ZodError): ConfigValidationErrorDetail[] {
  return error.errors.map((err) => ({
    path: err.path.join(".") || "(root)",
    message: err.message,
  }));
}

/**
 * Formats a ZodError into a human-readable multi-line string.
 */
export function formatConfigError(error: z.ZodError): string {
  const details = formatConfigErrorDetails(error);
  return details.map((d) => `  - [${d.path}]: ${d.message}`).join("\n");
}

/**
 * Parses and validates an unknown JavaScript object against the AdminKitConfig schema.
 * Throws a ZodError if validation fails.
 */
export function parseConfig(input: unknown): AdminKitConfig {
  return AdminKitConfigSchema.parse(input);
}

/**
 * Safely validates an unknown JavaScript object against the AdminKitConfig schema.
 * Returns { success: true, data } or { success: false, error }.
 */
export function safeParseConfig(input: unknown): z.SafeParseReturnType<unknown, AdminKitConfig> {
  return AdminKitConfigSchema.safeParse(input);
}

/**
 * Parses and validates a YAML string into a typed AdminKitConfig object.
 * Throws an Error if YAML syntax is invalid or if the schema validation fails.
 */
export function parseYamlConfig(yamlString: string): AdminKitConfig {
  const raw = parseYaml(yamlString);
  return parseConfig(raw);
}

/**
 * Safely parses and validates a YAML string.
 * Returns { success: true, data } or { success: false, error: Error | z.ZodError }.
 */
export function safeParseYamlConfig(
  yamlString: string
):
  | { success: true; data: AdminKitConfig }
  | { success: false; error: Error | z.ZodError } {
  try {
    const raw = parseYaml(yamlString);
    const result = safeParseConfig(raw);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}
