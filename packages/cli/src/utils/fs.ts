import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { stringify as stringifyYaml, parse as parseYaml } from "yaml";
import { parseYamlConfig, type AdminKitConfig } from "@admin-kit/core";

/**
 * Ensures that .gitignore in the target directory contains the specified pattern.
 */
export function ensureGitignoreContains(dir: string, pattern: string): void {
  const gitignorePath = path.resolve(dir, ".gitignore");
  let content = "";
  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, "utf-8");
  }

  const lines = content.split(/\r?\n/);
  const exists = lines.some((line) => line.trim() === pattern.trim());
  if (!exists) {
    const trailingNewline = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
    fs.writeFileSync(gitignorePath, `${content}${trailingNewline}${pattern}\n`, "utf-8");
  }
}

/**
 * Saves a normalized snapshot of the OpenAPI spec in .admin-kit/snapshot.json.
 */
export function saveSnapshot(targetDir: string, spec: unknown): void {
  const adminKitDir = path.resolve(targetDir, ".admin-kit");
  if (!fs.existsSync(adminKitDir)) {
    fs.mkdirSync(adminKitDir, { recursive: true });
  }

  const serialized = JSON.stringify(spec, null, 2);
  const hash = crypto.createHash("sha256").update(serialized).digest("hex");

  const snapshotPath = path.join(adminKitDir, "snapshot.json");
  fs.writeFileSync(
    snapshotPath,
    JSON.stringify(
      {
        hash,
        timestamp: new Date().toISOString(),
        spec,
      },
      null,
      2
    ),
    "utf-8"
  );
}

/**
 * Sorts object keys according to a preferred order with remainder sorted alphabetically.
 */
function sortObjectKeys(obj: any, preferredOrder: string[] = []): any {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return obj;
  }
  const ordered: Record<string, any> = {};
  for (const key of preferredOrder) {
    if (key in obj) {
      ordered[key] = obj[key];
    }
  }
  const remainingKeys = Object.keys(obj)
    .filter((k) => !preferredOrder.includes(k))
    .sort();
  for (const key of remainingKeys) {
    ordered[key] = obj[key];
  }
  return ordered;
}

/**
 * Normalizes an AdminKitConfig object into a canonical, deterministic key order.
 * Ensures zero-churn git diffs across successive CLI pull / merge runs.
 */
export function canonicalizeConfig(config: AdminKitConfig): AdminKitConfig {
  const topKeys = ["version", "project", "auth", "access", "resources", "rbac"];
  const resKeys = ["label", "icon", "endpoint", "primary_key", "access", "table", "mutations", "actions"];
  const tableKeys = ["page_size", "default_sort", "searchable_fields", "filterable_fields", "columns"];
  const colKeys = ["key", "label", "type", "sortable", "copyable", "sensitive", "hidden_by_default", "badge_map", "relation", "currency_code", "access"];
  const actKeys = ["name", "label", "icon", "style", "scope", "visible_if", "access", "confirm_dialog", "api", "inputs", "on_success"];

  const canonical: any = sortObjectKeys(config, topKeys);

  if (canonical.resources && typeof canonical.resources === "object") {
    const sortedResources: Record<string, any> = {};
    const sortedResourceNames = Object.keys(canonical.resources).sort();

    for (const name of sortedResourceNames) {
      const res = canonical.resources[name];
      if (!res || typeof res !== "object") {
        sortedResources[name] = res;
        continue;
      }

      const resObj = sortObjectKeys(res, resKeys);

      if (resObj.table && typeof resObj.table === "object") {
        resObj.table = sortObjectKeys(resObj.table, tableKeys);
        if (Array.isArray(resObj.table.columns)) {
          resObj.table.columns = resObj.table.columns.map((col: any) =>
            sortObjectKeys(col, colKeys)
          );
        }
      }

      if (Array.isArray(resObj.actions)) {
        resObj.actions = resObj.actions.map((act: any) =>
          sortObjectKeys(act, actKeys)
        );
      }

      sortedResources[name] = resObj;
    }

    canonical.resources = sortedResources;
  }

  return canonical;
}

/**
 * Writes an AdminKitConfig object to the target file path formatted as YAML with deterministic key ordering.
 */
export function writeConfigFile(outputPath: string, config: AdminKitConfig): void {
  const dir = path.dirname(path.resolve(outputPath));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const canonical = canonicalizeConfig(config);

  const yamlContent = stringifyYaml(canonical, {
    indent: 2,
    lineWidth: 0,
  });

  fs.writeFileSync(outputPath, yamlContent, "utf-8");
}

/**
 * Reads and parses an AdminKitConfig from a YAML file path.
 */
export function readConfigFile(configPath: string): AdminKitConfig {
  const resolved = path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Configuration file not found: ${resolved}`);
  }
  const content = fs.readFileSync(resolved, "utf-8");
  return parseYamlConfig(content);
}
