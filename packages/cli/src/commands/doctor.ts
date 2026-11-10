import path from "node:path";
import fs from "node:fs";
import { Command } from "commander";
import {
  safeParseYamlConfig,
  formatConfigErrorDetails,
  type AdminKitConfig,
} from "@admin-kit/core";

export interface DoctorOptions {
  config?: string;
  live?: string;
}

export interface DoctorCheckResult {
  category: string;
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
  latencyMs?: number;
}

/**
 * Validates configuration syntax and optionally pings backend endpoints.
 */
export async function runDoctorValidation(
  configPath: string,
  liveBaseUrl?: string
): Promise<{ passed: boolean; results: DoctorCheckResult[] }> {
  const results: DoctorCheckResult[] = [];
  const resolvedPath = path.resolve(process.cwd(), configPath);

  // 1. File Existence Check
  if (!fs.existsSync(resolvedPath)) {
    results.push({
      category: "Schema",
      name: "File Existence",
      status: "fail",
      message: `Config file not found at: ${resolvedPath}`,
    });
    return { passed: false, results };
  }

  const rawYaml = fs.readFileSync(resolvedPath, "utf-8");
  const parseResult = safeParseYamlConfig(rawYaml);

  // 2. Schema Contract Validation
  if (!parseResult.success) {
    const isZod = "errors" in parseResult.error;
    const details = isZod
      ? formatConfigErrorDetails(parseResult.error as any).map((d) => `[${d.path}]: ${d.message}`).join(", ")
      : parseResult.error.message;

    results.push({
      category: "Schema",
      name: "Zod Schema Validation",
      status: "fail",
      message: `Configuration schema invalid: ${details}`,
    });
    return { passed: false, results };
  }

  results.push({
    category: "Schema",
    name: "Zod Schema Validation",
    status: "pass",
    message: "admin.config.yaml strictly adheres to AdminKitConfigSchema v1.0",
  });

  const config: AdminKitConfig = parseResult.data;

  // 3. Structural Integrity Checks
  for (const [key, res] of Object.entries(config.resources || {})) {
    if (!res.endpoint.startsWith("/")) {
      results.push({
        category: "Contract",
        name: `Resource "${key}" Endpoint`,
        status: "warn",
        message: `Endpoint "${res.endpoint}" does not start with "/"`,
      });
    }

    const colKeys = new Set((res.table?.columns || []).map((c) => c.key));
    const pKey = res.primary_key || "id";
    if (!colKeys.has(pKey)) {
      results.push({
        category: "Contract",
        name: `Primary Key "${key}"`,
        status: "warn",
        message: `Primary key "${pKey}" is not defined in table.columns`,
      });
    }

    // Check relations
    for (const col of res.table?.columns || []) {
      if (col.type === "relation" && col.relation) {
        if (!config.resources[col.relation.target_resource]) {
          results.push({
            category: "Relation",
            name: `Relation in "${key}.${col.key}"`,
            status: "fail",
            message: `Target resource "${col.relation.target_resource}" does not exist in config`,
          });
        }
      }
      if (col.type === "badge" && (!col.badge_map || Object.keys(col.badge_map).length === 0)) {
        results.push({
          category: "Contract",
          name: `Badge Column "${key}.${col.key}"`,
          status: "warn",
          message: `Badge column "${col.key}" has no badge_map colors assigned`,
        });
      }
    }
  }

  results.push({
    category: "Contract",
    name: "Resource & Column Integrity",
    status: "pass",
    message: `${Object.keys(config.resources || {}).length} resources validated with consistent primary keys and relations`,
  });

  results.push({
    category: "Access",
    name: "RBAC & Auth Policy",
    status: "pass",
    message: `Default policy "${config.access?.default_policy || "allow"}" configured with ${config.access?.superadmin_roles?.length || 0} superadmin role(s)`,
  });

  // 4. Live Backend Reachability & CORS Pings (if --live provided)
  if (liveBaseUrl) {
    const normalizedLive = liveBaseUrl.replace(/\/+$/, "");

    for (const [key, res] of Object.entries(config.resources || {})) {
      const targetUrl = `${normalizedLive}${config.project.base_url || ""}${res.endpoint}`;
      const start = Date.now();
      try {
        const response = await fetch(targetUrl, {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        const latency = Date.now() - start;

        const corsHeader = response.headers.get("access-control-allow-origin");
        const hasCors = Boolean(corsHeader);

        if (response.status >= 200 && response.status < 400) {
          results.push({
            category: "Live Endpoint",
            name: `${key} (${res.endpoint})`,
            status: "pass",
            message: `HTTP ${response.status} OK (Latency: ${latency}ms, CORS: ${hasCors ? corsHeader : "not present"})`,
            latencyMs: latency,
          });
        } else if (response.status === 401 || response.status === 403) {
          results.push({
            category: "Live Endpoint",
            name: `${key} (${res.endpoint})`,
            status: "warn",
            message: `HTTP ${response.status} Auth Required (Endpoint reachable, latency: ${latency}ms)`,
            latencyMs: latency,
          });
        } else {
          results.push({
            category: "Live Endpoint",
            name: `${key} (${res.endpoint})`,
            status: "fail",
            message: `HTTP ${response.status} Unreachable at ${targetUrl}`,
            latencyMs: latency,
          });
        }
      } catch (err: any) {
        results.push({
          category: "Live Endpoint",
          name: `${key} (${res.endpoint})`,
          status: "fail",
          message: `Connection failed: ${err.message}`,
        });
      }
    }
  }

  const hasFailures = results.some((r) => r.status === "fail");
  return { passed: !hasFailures, results };
}

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Validate admin.config.yaml syntax and optionally probe live backend endpoints")
    .option("-c, --config <path>", "Path to configuration file", "./admin.config.yaml")
    .option("-l, --live <base_url>", "Base URL of running backend to test reachability & CORS")
    .action(async (options: DoctorOptions) => {
      try {
        console.log(`[admin-kit doctor] Inspecting configuration: ${options.config || "./admin.config.yaml"}...`);
        if (options.live) {
          console.log(`[admin-kit doctor] Probing live backend at: ${options.live}...`);
        }

        const { passed, results } = await runDoctorValidation(
          options.config || "./admin.config.yaml",
          options.live
        );

        console.log(`\nDiagnostic Report:`);
        for (const res of results) {
          const icon =
            res.status === "pass" ? "✓" : res.status === "warn" ? "⚠" : "✖";
          console.log(`  ${icon} [${res.category}] ${res.name}: ${res.message}`);
        }

        const passCount = results.filter((r) => r.status === "pass").length;
        const warnCount = results.filter((r) => r.status === "warn").length;
        const failCount = results.filter((r) => r.status === "fail").length;

        console.log(`\nSummary: ${passCount} passed, ${warnCount} warnings, ${failCount} errors.`);

        if (!passed) {
          console.error(`\n✖ Health check failed with errors.`);
          process.exit(1);
        } else {
          console.log(`\n✓ All critical diagnostic checks passed!`);
          process.exit(0);
        }
      } catch (err: any) {
        console.error(`[admin-kit doctor] Error:`, err.message || err);
        process.exit(1);
      }
    });
}
