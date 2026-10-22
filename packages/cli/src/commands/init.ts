import path from "node:path";
import fs from "node:fs";
import { Command } from "commander";
import { AdminKitConfigSchema, type AdminKitConfig } from "@admin-kit/core";
import { ensureGitignoreContains, writeConfigFile } from "../utils/fs";

export interface InitOptions {
  output?: string;
  baseUrl?: string;
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize AdminKit in the current project by creating a starter admin.config.yaml")
    .option("-o, --output <path>", "Path for the generated config file", "./admin.config.yaml")
    .option("--base-url <url>", "Default API base URL prefix", "/api")
    .action(async (options: InitOptions) => {
      try {
        const outputPath = path.resolve(process.cwd(), options.output || "./admin.config.yaml");
        const baseUrl = options.baseUrl || "/api";
        const targetDir = path.dirname(outputPath);

        if (fs.existsSync(outputPath)) {
          console.log(`[admin-kit] Existing configuration found at: ${outputPath}`);
          console.log(`[admin-kit] To re-introspect endpoints, run: npx @admin-kit/cli pull --source <spec>`);
          return;
        }

        const starterConfig: AdminKitConfig = AdminKitConfigSchema.parse({
          version: "1.0",
          project: {
            name: "Admin Dashboard",
            base_url: baseUrl,
            branding: {
              primary_color: "#4f46e5",
              theme: "system",
            },
          },
          auth: {
            strategy: "bearer",
            login_endpoint: "/auth/login",
            me_endpoint: "/auth/me",
            token_storage: "sessionStorage",
            role_claim_path: "roles",
            permission_claim_path: "permissions",
          },
          access: {
            default_policy: "deny",
            superadmin_roles: ["superadmin"],
          },
          resources: {},
        });

        writeConfigFile(outputPath, starterConfig);
        ensureGitignoreContains(targetDir, ".admin-kit/");

        console.log(`[admin-kit] Successfully initialized starter configuration!`);
        console.log(`[admin-kit] Config written to: ${outputPath}`);
        console.log(`[admin-kit] Added .admin-kit/ to .gitignore`);
        console.log(`[admin-kit] Next step: Pull endpoints from your OpenAPI spec:`);
        console.log(`  npx @admin-kit/cli pull --source <url_or_filepath>`);
      } catch (err: any) {
        console.error(`[admin-kit] Error initializing AdminKit:`, err.message || err);
        process.exit(1);
      }
    });
}
