import type { Request, Response, NextFunction } from "express";
import type { AdminKitConfig } from "@admin-kit-yu/core";

export interface MountAdminStudioOptions {
  /**
   * Path to the admin.config.yaml file on disk.
   * Defaults to "./admin.config.yaml" relative to process.cwd().
   */
  configPath?: string;

  /**
   * Direct pre-loaded configuration object or YAML string.
   * If provided, overrides reading from `configPath`.
   */
  config?: AdminKitConfig | string;

  /**
   * Custom path where @admin-kit-yu/react precompiled static files are stored.
   * If omitted, automatically resolves from @admin-kit-yu/react/dist.
   */
  assetsDir?: string;

  /**
   * Custom title displayed in the HTML title tag.
   */
  title?: string;

  /**
   * Base route path where the admin dashboard is mounted (e.g. "/admin").
   * Default: "/admin".
   */
  basePath?: string;

  /**
   * Enable real-time file watching on configPath to auto-reload in development.
   * Default: false.
   */
  watchConfig?: boolean;

  /**
   * Optional custom authorization middleware to protect the admin studio routes.
   * Invoked before serving /__config or the studio UI.
   */
  authMiddleware?: (req: Request, res: Response, next: NextFunction) => void;
}

