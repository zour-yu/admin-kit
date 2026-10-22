import { z } from "zod";

/**
 * Strategy used to send credentials in HTTP requests.
 */
export const AuthStrategySchema = z.enum(["bearer", "cookie", "custom_header"]);
export type AuthStrategy = z.infer<typeof AuthStrategySchema>;

/**
 * Client-side storage mechanism where authentication tokens or sessions are kept.
 */
export const TokenStorageSchema = z.enum(["localStorage", "sessionStorage", "cookie"]);
export type TokenStorage = z.infer<typeof TokenStorageSchema>;

/**
 * Authentication configuration defining endpoints, token storage, and claim paths.
 */
export const AuthConfigSchema = z.object({
  strategy: AuthStrategySchema.default("bearer"),
  login_endpoint: z.string().min(1, "login_endpoint is required"),
  logout_endpoint: z.string().optional(),
  refresh_endpoint: z.string().optional(),
  me_endpoint: z.string().min(1, "me_endpoint is required"),
  token_storage: TokenStorageSchema.default("sessionStorage"),
  role_claim_path: z.string().default("roles"),
  permission_claim_path: z.string().default("permissions"),
});
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
