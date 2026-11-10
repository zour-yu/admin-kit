import path from "node:path";
import fs from "node:fs";
import { Command } from "commander";
import dotenv from "dotenv";
import { introspectOpenApi } from "../parser/introspect";
import { writeConfigFile, readConfigFile, saveSnapshot, ensureGitignoreContains } from "../utils/fs";
import { synthesizeAiEnrichment } from "../ai/synthesis";
import { mergeConfigs } from "../parser/merge";

// Automatically load .env from current directory or monorepo root
function loadEnvironment(): void {
  dotenv.config();
  let curr = process.cwd();
  while (curr !== path.dirname(curr)) {
    const candidate = path.join(curr, ".env");
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate });
      return;
    }
    curr = path.dirname(curr);
  }
}
loadEnvironment();

export interface PullOptions {
  source: string;
  output?: string;
  baseUrl?: string;
  ai?: boolean;
  provider?: string;
  force?: boolean;
}

export function registerPullCommand(program: Command): void {
  program
    .command("pull")
    .description("Introspect OpenAPI 3.0/3.1 document and generate or update admin.config.yaml")
    .requiredOption("-s, --source <path_or_url>", "HTTP URL or local file path to OpenAPI specification")
    .option("-o, --output <path>", "Target configuration file path", "./admin.config.yaml")
    .option("--base-url <url>", "Base API URL prefix", "/api")
    .option("--ai", "Enable LLM-assisted workflow pairing and synthesis")
    .option("--provider <name>", "AI provider to use with --ai (gemini | openai | anthropic)", "gemini")
    .option("-f, --force", "Overwrite existing configuration completely")
    .action(async (options: PullOptions) => {
      try {
        console.log(`[admin-kit] Introspecting OpenAPI specification from: ${options.source}...`);

        const result = await introspectOpenApi({
          source: options.source,
          baseUrl: options.baseUrl,
        });

        let finalConfig = result.config;

        // Run AI synthesis layer if --ai flag is passed
        if (options.ai) {
          console.log(`[admin-kit] Running AI synthesis engine (--ai)...`);
          finalConfig = await synthesizeAiEnrichment(result.config);
        }

        const outputPath = path.resolve(process.cwd(), options.output || "./admin.config.yaml");
        const targetDir = path.dirname(outputPath);

        // Perform non-destructive three-way merge if config already exists and --force is not passed
        if (!options.force && fs.existsSync(outputPath)) {
          try {
            const existingConfig = readConfigFile(outputPath);
            console.log(`[admin-kit] Existing configuration detected at: ${outputPath}. Performing non-destructive three-way merge...`);
            const { mergedConfig, warnings, addedResources, addedColumns, addedActions } = mergeConfigs(existingConfig, finalConfig);
            finalConfig = mergedConfig;

            if (addedResources.length > 0) {
              console.log(`  + Merged new resources: [${addedResources.join(", ")}]`);
            }
            if (addedColumns.length > 0) {
              console.log(`  + Merged new columns: [${addedColumns.join(", ")}]`);
            }
            if (addedActions.length > 0) {
              console.log(`  + Merged new actions: [${addedActions.join(", ")}]`);
            }
            for (const warn of warnings) {
              console.warn(`  ⚠️ ${warn}`);
            }
          } catch (mergeErr: any) {
            console.warn(`[admin-kit] Could not merge with existing config (${mergeErr.message}). Writing fresh configuration.`);
          }
        }

        // Write config
        writeConfigFile(outputPath, finalConfig);

        // Save snapshot for drift detection
        saveSnapshot(targetDir, finalConfig);

        // Ensure gitignore contains .admin-kit/
        ensureGitignoreContains(targetDir, ".admin-kit/");

        const resourceNames = Object.keys(finalConfig.resources || {});

        console.log(`[admin-kit] Successfully generated configuration!`);
        console.log(`[admin-kit] Output: ${outputPath}`);
        console.log(`[admin-kit] Summary:`);
        console.log(`  - Resources: ${resourceNames.length} (${resourceNames.join(", ")})`);

        for (const [resKey, resConfig] of Object.entries(finalConfig.resources || {})) {
          const actionNames = (resConfig.actions || []).map((a) => a.name).join(", ");
          const colCount = resConfig.table?.columns.length || 0;
          console.log(`    * ${resKey}: ${colCount} columns${actionNames ? `, actions: [${actionNames}]` : ""}`);
        }
      } catch (err: any) {
        console.error(`[admin-kit] Error during pull:`, err.message || err);
        process.exit(1);
      }
    });
}
