import path from "node:path";
import fs from "node:fs";
import { Command } from "commander";
import express from "express";
import { mountAdminStudio } from "@admin-kit/express";

export interface StudioOptions {
  config?: string;
  port?: string | number;
  watch?: boolean;
}

/**
 * Spins up a local standalone Express server serving AdminKit Studio.
 */
export async function startStudioServer(options: StudioOptions = {}): Promise<{
  app: express.Express;
  server: import("node:http").Server;
  port: number;
  url: string;
}> {
  const app = express();
  const rawPort = options.port || process.env.PORT || 3333;
  const port = typeof rawPort === "string" ? parseInt(rawPort, 10) : rawPort;
  const configPath = path.resolve(process.cwd(), options.config || "./admin.config.yaml");

  if (!fs.existsSync(configPath)) {
    throw new Error(`AdminKit config file not found at: ${configPath}`);
  }

  app.use(express.json());

  // Mount AdminStudio at /admin
  app.use(
    "/admin",
    mountAdminStudio({
      configPath,
      basePath: "/admin",
      watchConfig: options.watch ?? true,
    })
  );

  // Redirect root to /admin
  app.get("/", (_req: any, res: any) => {
    res.redirect("/admin");
  });

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      const boundAddress = server.address();
      const boundPort =
        typeof boundAddress === "object" && boundAddress !== null
          ? boundAddress.port
          : port;
      const url = `http://localhost:${boundPort}/admin`;
      resolve({ app, server, port: boundPort, url });
    });

    server.on("error", (err: Error) => {
      reject(err);
    });
  });
}

export function registerStudioCommand(program: Command): void {
  program
    .command("studio")
    .description("Spin up a standalone local web server running AdminKit Studio")
    .option("-c, --config <path>", "Path to configuration file", "./admin.config.yaml")
    .option("-p, --port <number>", "Port to run the studio server on", "3333")
    .option("-w, --watch", "Watch admin.config.yaml for changes", true)
    .action(async (options: StudioOptions) => {
      try {
        console.log(`[admin-kit studio] Starting studio server...`);
        const { port, url } = await startStudioServer(options);

        console.log(`\n🚀 AdminKit Studio running at:`);
        console.log(`   - Dashboard: ${url}`);
        console.log(`   - Config:    http://localhost:${port}/admin/__config\n`);
        console.log(`Press Ctrl+C to terminate the studio server.`);
      } catch (err: any) {
        console.error(`[admin-kit studio] Error:`, err.message || err);
        process.exit(1);
      }
    });
}
