#!/usr/bin/env node

import { Command } from "commander";
import { registerInitCommand } from "./commands/init";
import { registerPullCommand } from "./commands/pull";
import { registerDiffCommand } from "./commands/diff";
import { registerDoctorCommand } from "./commands/doctor";
import { registerStudioCommand } from "./commands/studio";

const program = new Command();

program
  .name("admin-kit")
  .description("AdminKit CLI - API-driven admin dashboard generator and OpenAPI introspector")
  .version("0.2.1");

// Register commands
registerInitCommand(program);
registerPullCommand(program);
registerDiffCommand(program);
registerDoctorCommand(program);
registerStudioCommand(program);

// Export commands and parser for programmatic use as well
export * from "./parser/introspect";
export * from "./parser/heuristics";
export * from "./parser/types";
export { mergeConfigs, type MergeResult } from "./parser/merge";
export { computeConfigDiff } from "./commands/diff";
export { runDoctorValidation } from "./commands/doctor";
export { startStudioServer } from "./commands/studio";
export { synthesizeAiEnrichment, deepMergeAiEnrichment } from "./ai/synthesis";

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// Parse arguments when invoked directly as CLI executable
function isDirectRun(): boolean {
  if (!process.argv[1]) return false;
  try {
    const scriptPath = fs.realpathSync(path.resolve(process.argv[1]));
    const currentModulePath = fs.realpathSync(fileURLToPath(import.meta.url));
    if (scriptPath === currentModulePath) return true;
  } catch {
    // ignore filesystem resolution errors
  }
  const base = path.basename(process.argv[1]).replace(/\.[cm]?[jt]s$/, "");
  // Only parse if directly executing index.js, since bin/admin-kit.js calls program.parse() itself
  return base === "index";
}

if (isDirectRun()) {
  program.parse(process.argv);
}

export { program };
