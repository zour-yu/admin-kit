import path from "node:path";
import { Command } from "commander";
import { introspectOpenApi } from "../parser/introspect";
import { writeConfigFile, saveSnapshot, ensureGitignoreContains } from "../utils/fs";

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

        const outputPath = path.resolve(process.cwd(), options.output || "./admin.config.yaml");
        const targetDir = path.dirname(outputPath);

        // Write config
        writeConfigFile(outputPath, result.config);

        // Save snapshot for drift detection
        saveSnapshot(targetDir, result.config);

        // Ensure gitignore contains .admin-kit/
        ensureGitignoreContains(targetDir, ".admin-kit/");

        const resourceNames = Object.keys(result.detectedResources);

        console.log(`[admin-kit] Successfully generated configuration!`);
        console.log(`[admin-kit] Output: ${outputPath}`);
        console.log(`[admin-kit] Summary:`);
        console.log(`  - Resources: ${result.stats.resourceCount} (${resourceNames.join(", ")})`);
        console.log(`  - Table Columns: ${result.stats.tableColumnCount}`);
        console.log(`  - Custom Actions: ${result.stats.actionCount}`);

        for (const [resKey, resConfig] of Object.entries(result.detectedResources)) {
          const actionNames = resConfig.actions.map((a) => a.name).join(", ");
          const colCount = resConfig.table?.columns.length || 0;
          console.log(`    * ${resKey}: ${colCount} columns${actionNames ? `, actions: [${actionNames}]` : ""}`);
        }
      } catch (err: any) {
        console.error(`[admin-kit] Error during pull:`, err.message || err);
        process.exit(1);
      }
    });
}
