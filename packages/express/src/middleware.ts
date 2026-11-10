import express, { Router, type Request, type Response, type NextFunction } from "express";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  parseConfig,
  parseYamlConfig,
  formatConfigErrorDetails,
  type AdminKitConfig,
} from "@admin-kit/core";
import { renderStudioHtml } from "./html";
import type { MountAdminStudioOptions } from "./types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Finds the monorepo root directory containing packages/ or pnpm-workspace.yaml.
 */
function findWorkspaceRoot(): string {
  let curr = process.cwd();
  while (curr !== path.dirname(curr)) {
    if (
      fs.existsSync(path.join(curr, "pnpm-workspace.yaml")) ||
      fs.existsSync(path.join(curr, "packages", "react"))
    ) {
      return curr;
    }
    curr = path.dirname(curr);
  }
  return process.cwd();
}

/**
 * Resolves the location of @admin-kit/react static dist assets.
 */
function resolveDefaultAssetsDir(): string {
  try {
    const require = createRequire(import.meta.url);
    const reactPkgJson = require.resolve("@admin-kit/react/package.json");
    const distPath = path.resolve(path.dirname(reactPkgJson), "dist");
    if (fs.existsSync(distPath)) {
      return distPath;
    }
  } catch {
    // Continue to fallback
  }

  const workspaceRoot = findWorkspaceRoot();

  // Fallback for monorepo workspace layouts
  const fallbackCandidates = [
    path.resolve(workspaceRoot, "packages/react/dist"),
    path.resolve(workspaceRoot, "node_modules/@admin-kit/react/dist"),
    path.resolve(__dirname, "../../react/dist"),
    path.resolve(__dirname, "../../../react/dist"),
  ];

  for (const candidate of fallbackCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.resolve(workspaceRoot, "packages/react/dist");
}

/**
 * Creates an Express router middleware serving the complete AdminKit Studio.
 *
 * Implements the delivery model specified in docs/ARCHITECTURE.md:
 * - Exposes `GET /__config` returning validated AdminKitConfig JSON.
 * - Serves static bundle assets from `@admin-kit/react/dist`.
 * - Serves the SPA HTML shell on any subpath (e.g. `/admin/*`).
 */
export function mountAdminStudio(options: MountAdminStudioOptions = {}): Router {
  const router = Router();

  const workspaceRoot = findWorkspaceRoot();
  const configPath = options.configPath
    ? path.resolve(process.cwd(), options.configPath)
    : path.resolve(workspaceRoot, "admin.config.yaml");

  const assetsDir = options.assetsDir
    ? path.resolve(process.cwd(), options.assetsDir)
    : resolveDefaultAssetsDir();

  let cachedConfig: AdminKitConfig | null = null;
  let lastMtime: number = 0;

  /**
   * Loads and validates the configuration from options or disk.
   */
  const loadConfig = (): AdminKitConfig => {
    // If direct config supplied, parse and return
    if (options.config) {
      if (typeof options.config === "string") {
        return parseYamlConfig(options.config);
      }
      return parseConfig(options.config);
    }

    // Check if file exists on disk
    if (!fs.existsSync(configPath)) {
      throw new Error(`AdminKit configuration file not found at: ${configPath}`);
    }

    const stat = fs.statSync(configPath);
    if (!cachedConfig || options.watchConfig || stat.mtimeMs > lastMtime) {
      const rawYaml = fs.readFileSync(configPath, "utf-8");
      cachedConfig = parseYamlConfig(rawYaml);
      lastMtime = stat.mtimeMs;
    }

    return cachedConfig;
  };

  // Pre-load once on startup to fail fast if config has syntax errors
  try {
    loadConfig();
  } catch (err: any) {
    console.warn(`[admin-kit/express] Initial configuration warning: ${err.message}`);
  }

  // 1. Optional Auth Guard Middleware
  if (options.authMiddleware) {
    router.use(options.authMiddleware);
  }

  // 2. Metadata Endpoint: GET /__config
  router.get("/__config", (_req: Request, res: Response) => {
    try {
      const config = loadConfig();
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.json(config);
    } catch (err: any) {
      const isZod = Boolean(err.errors);
      res.status(500).json({
        error: "Failed to load AdminKit configuration",
        message: err.message || String(err),
        details: isZod ? formatConfigErrorDetails(err) : undefined,
      });
    }
  });

  // 3. Static Assets: /__assets/* and general static files
  if (fs.existsSync(assetsDir)) {
    router.use("/__assets", express.static(assetsDir, { maxAge: "1d" }));
    // Disable automatic index.html serving so the SPA catch-all handler can inject configuration
    router.use(express.static(assetsDir, { maxAge: "1d", index: false }));

    // Direct asset aliases
    router.get("/style.css", (_req: Request, res: Response) => {
      const p = path.join(assetsDir, "style.css");
      if (fs.existsSync(p)) res.sendFile(p);
      else res.status(404).send("style.css not found");
    });

    router.get("/index.js", (_req: Request, res: Response) => {
      const p = path.join(assetsDir, "index.js");
      if (fs.existsSync(p)) res.sendFile(p);
      else res.status(404).send("index.js not found");
    });
  }

  // 4. SPA Catch-All Handler: Serves the Studio HTML Shell
  router.get("*", (req: Request, res: Response) => {
    const rawBasePath = req.baseUrl || options.basePath || "/admin";
    const normalizedBasePath = rawBasePath.replace(/\/+$/, "");

    let currentConfig: AdminKitConfig | null = null;
    try {
      currentConfig = loadConfig();
    } catch {
      // Allow HTML shell to load and let the client-side fetch report config errors
    }

    // Check if custom pre-built index.html exists in assets directory
    const customHtmlPath = path.join(assetsDir, "index.html");
    if (fs.existsSync(customHtmlPath)) {
      let customHtml = fs.readFileSync(customHtmlPath, "utf-8");
      const title = options.title || currentConfig?.project?.name || "AdminKit Studio";
      customHtml = customHtml.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);
      const configJsonStr = currentConfig ? JSON.stringify(currentConfig).replace(/</g, "\\u003c") : "null";
      // Inject base tag and config endpoint if needed
      customHtml = customHtml.replace(
        "<head>",
        `<head>\n  <base href="${normalizedBasePath}/">\n  <script>window.__ADMIN_KIT_CONFIG_URL__ = "${normalizedBasePath}/__config"; window.__ADMIN_KIT_INITIAL_CONFIG__ = ${configJsonStr};</script>`
      );
      res.type("html").send(customHtml);
      return;
    }

    const html = renderStudioHtml({
      title: options.title || currentConfig?.project?.name || "AdminKit Studio",
      basePath: normalizedBasePath,
      configUrl: `${normalizedBasePath}/__config`,
      assetPrefix: `${normalizedBasePath}/__assets`,
      initialConfigJson: currentConfig ? JSON.stringify(currentConfig) : undefined,
    });

    res.type("html").send(html);
  });

  return router;
}
