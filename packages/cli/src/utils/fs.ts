import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { stringify as stringifyYaml } from "yaml";
import type { AdminKitConfig } from "@admin-kit/core";

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
 * Writes an AdminKitConfig object to the target file path formatted as YAML.
 */
export function writeConfigFile(outputPath: string, config: AdminKitConfig): void {
  const dir = path.dirname(path.resolve(outputPath));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const yamlContent = stringifyYaml(config, {
    indent: 2,
    lineWidth: 0,
  });

  fs.writeFileSync(outputPath, yamlContent, "utf-8");
}
