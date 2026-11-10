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
  .version("0.1.0");

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
import { fileURLToPath } from "node:url";

// Parse arguments only when invoked directly as CLI executable
const isDirectRun =
  Boolean(process.argv[1]) &&
  (path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ||
    path.basename(process.argv[1]).replace(/\.[cm]?[jt]s$/, "") === "admin-kit");

if (isDirectRun) {
  program.parse(process.argv);
}

export { program };
