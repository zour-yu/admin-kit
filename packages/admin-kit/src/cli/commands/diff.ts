import path from "node:path";
import { Command } from "commander";
import { introspectOpenApi } from "../parser/introspect";
import { readConfigFile } from "../utils/fs";

export interface DiffOptions {
  source: string;
  config?: string;
}

export interface ResourceDiff {
  resourceKey: string;
  type: "added" | "removed" | "modified";
  endpoint: string;
  addedColumns: string[];
  removedColumns: string[];
  addedActions: string[];
  removedActions: string[];
}

export interface DiffResult {
  inSync: boolean;
  hasBreakingChanges: boolean;
  resourceDiffs: ResourceDiff[];
  summary: {
    addedResources: number;
    removedResources: number;
    modifiedResources: number;
  };
}

/**
 * Compares an existing AdminKit configuration against a fresh OpenAPI specification.
 */
export async function computeConfigDiff(
  currentConfigPath: string,
  newSource: string
): Promise<DiffResult> {
  const currentConfig = readConfigFile(currentConfigPath);
  const introspectResult = await introspectOpenApi({
    source: newSource,
    baseUrl: currentConfig.project.base_url,
  });
  const newConfig = introspectResult.config;

  const currentResources = currentConfig.resources || {};
  const newResources = newConfig.resources || {};

  const currentKeys = new Set(Object.keys(currentResources));
  const newKeys = new Set(Object.keys(newResources));

  const resourceDiffs: ResourceDiff[] = [];
  let hasBreaking = false;

  // 1. Added Resources
  for (const key of newKeys) {
    if (!currentKeys.has(key)) {
      const res = newResources[key];
      resourceDiffs.push({
        resourceKey: key,
        type: "added",
        endpoint: res.endpoint,
        addedColumns: (res.table?.columns || []).map((c) => c.key),
        removedColumns: [],
        addedActions: (res.actions || []).map((a) => a.name),
        removedActions: [],
      });
    }
  }

  // 2. Removed / Broken Resources (Breaking Change)
  for (const key of currentKeys) {
    if (!newKeys.has(key)) {
      const res = currentResources[key];
      hasBreaking = true;
      resourceDiffs.push({
        resourceKey: key,
        type: "removed",
        endpoint: res.endpoint,
        addedColumns: [],
        removedColumns: (res.table?.columns || []).map((c) => c.key),
        addedActions: [],
        removedActions: (res.actions || []).map((a) => a.name),
      });
    }
  }

  // 3. Modified Resources
  for (const key of currentKeys) {
    if (newKeys.has(key)) {
      const currRes = currentResources[key];
      const newRes = newResources[key];

      const currCols = new Set((currRes.table?.columns || []).map((c) => c.key));
      const newCols = new Set((newRes.table?.columns || []).map((c) => c.key));

      const addedColumns: string[] = [];
      const removedColumns: string[] = [];

      for (const col of newCols) {
        if (!currCols.has(col)) addedColumns.push(col);
      }
      for (const col of currCols) {
        if (!newCols.has(col)) {
          removedColumns.push(col);
          hasBreaking = true;
        }
      }

      const currActions = new Set((currRes.actions || []).map((a) => a.name));
      const newActions = new Set((newRes.actions || []).map((a) => a.name));

      const addedActions: string[] = [];
      const removedActions: string[] = [];

      for (const act of newActions) {
        if (!currActions.has(act)) addedActions.push(act);
      }
      for (const act of currActions) {
        if (!newActions.has(act)) {
          removedActions.push(act);
          hasBreaking = true;
        }
      }

      if (
        addedColumns.length > 0 ||
        removedColumns.length > 0 ||
        addedActions.length > 0 ||
        removedActions.length > 0
      ) {
        resourceDiffs.push({
          resourceKey: key,
          type: "modified",
          endpoint: currRes.endpoint,
          addedColumns,
          removedColumns,
          addedActions,
          removedActions,
        });
      }
    }
  }

  const addedCount = resourceDiffs.filter((d) => d.type === "added").length;
  const removedCount = resourceDiffs.filter((d) => d.type === "removed").length;
  const modifiedCount = resourceDiffs.filter((d) => d.type === "modified").length;

  return {
    inSync: resourceDiffs.length === 0,
    hasBreakingChanges: hasBreaking,
    resourceDiffs,
    summary: {
      addedResources: addedCount,
      removedResources: removedCount,
      modifiedResources: modifiedCount,
    },
  };
}

export function registerDiffCommand(program: Command): void {
  program
    .command("diff")
    .description("Compare admin.config.yaml against an updated OpenAPI spec and report schema drift")
    .requiredOption("-s, --source <path_or_url>", "HTTP URL or local file path to the updated OpenAPI specification")
    .option("-c, --config <path>", "Path to current configuration file", "./admin.config.yaml")
    .action(async (options: DiffOptions) => {
      try {
        const configPath = path.resolve(process.cwd(), options.config || "./admin.config.yaml");
        console.log(`[admin-kit diff] Comparing ${configPath} against: ${options.source}...`);

        const diff = await computeConfigDiff(configPath, options.source);

        if (diff.inSync) {
          console.log(`\n✓ In Sync: Configuration exactly matches the OpenAPI specification.`);
          process.exit(0);
        }

        console.log(`\nDetected Schema Drift:`);

        for (const r of diff.resourceDiffs) {
          if (r.type === "added") {
            console.log(`  + [Added Resource] ${r.resourceKey} (${r.endpoint})`);
            if (r.addedColumns.length > 0) {
              console.log(`      + columns: [${r.addedColumns.join(", ")}]`);
            }
            if (r.addedActions.length > 0) {
              console.log(`      + actions: [${r.addedActions.join(", ")}]`);
            }
          } else if (r.type === "removed") {
            console.log(`  - [Removed / Broken Resource] ${r.resourceKey} (${r.endpoint})`);
          } else {
            console.log(`  ~ [Modified Resource] ${r.resourceKey} (${r.endpoint})`);
            if (r.addedColumns.length > 0) {
              console.log(`      + added columns: [${r.addedColumns.join(", ")}]`);
            }
            if (r.removedColumns.length > 0) {
              console.log(`      - removed columns: [${r.removedColumns.join(", ")}]`);
            }
            if (r.addedActions.length > 0) {
              console.log(`      + added actions: [${r.addedActions.join(", ")}]`);
            }
            if (r.removedActions.length > 0) {
              console.log(`      - removed actions: [${r.removedActions.join(", ")}]`);
            }
          }
        }

        console.log(`\nSummary:`);
        console.log(`  - Added resources:    ${diff.summary.addedResources}`);
        console.log(`  - Removed resources:  ${diff.summary.removedResources}`);
        console.log(`  - Modified resources: ${diff.summary.modifiedResources}`);

        if (diff.hasBreakingChanges) {
          console.error(`\n✖ Breaking Drift Detected: Removed endpoints or columns detected.`);
          process.exit(1);
        } else {
          console.log(`\n✓ Non-breaking additions detected.`);
          process.exit(0);
        }
      } catch (err: any) {
        console.error(`[admin-kit diff] Error:`, err.message || err);
        process.exit(1);
      }
    });
}
