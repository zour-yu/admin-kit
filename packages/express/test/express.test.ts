import { describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { mountAdminStudio } from "../dist/index.js";

const SAMPLE_CONFIG_YAML = `
version: "1.0"
project:
  name: Test Operations
  base_url: /api
  branding:
    primary_color: "#6366f1"
auth:
  strategy: bearer
  login_endpoint: /auth/login
  me_endpoint: /auth/me
access:
  default_policy: deny
  superadmin_roles:
    - superadmin
resources:
  orders:
    label: Orders
    endpoint: /orders
    primary_key: id
    table:
      columns:
        - key: id
          label: ID
          type: string
        - key: status
          label: Status
          type: badge
    mutations:
      creatable: false
      editable: false
      deletable: false
    actions: []
`;

function getWorkspaceRoot(): string {
  let curr = process.cwd();
  while (curr !== path.dirname(curr)) {
    if (fs.existsSync(path.join(curr, "pnpm-workspace.yaml"))) {
      return curr;
    }
    curr = path.dirname(curr);
  }
  return process.cwd();
}

describe("@admin-kit/express: mountAdminStudio", () => {
  it("creates an express router that serves /__config with valid parsed JSON", async () => {
    const app = express();
    const router = mountAdminStudio({
      config: SAMPLE_CONFIG_YAML,
      basePath: "/admin",
    });

    app.use("/admin", router);

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/admin/__config`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("content-type")?.includes("application/json"), true);

      const json = await res.json();
      assert.equal(json.version, "1.0");
      assert.equal(json.project.name, "Test Operations");
      assert.equal(json.resources.orders.label, "Orders");
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("serves the SPA HTML shell on any subpath (e.g. /admin and /admin/orders)", async () => {
    const app = express();
    const router = mountAdminStudio({
      config: SAMPLE_CONFIG_YAML,
      basePath: "/admin",
      title: "Custom Admin Studio",
    });

    app.use("/admin", router);

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    try {
      // Test root admin route
      const res1 = await fetch(`http://127.0.0.1:${port}/admin`);
      assert.equal(res1.status, 200);
      assert.equal(res1.headers.get("content-type")?.includes("text/html"), true);
      const html1 = await res1.text();
      assert.match(html1, /<title>Custom Admin Studio<\/title>/);
      assert.match(html1, /\/admin\/__config/);
      assert.match(html1, /<div id="root">/);

      // Test deep link subpath route
      const res2 = await fetch(`http://127.0.0.1:${port}/admin/orders`);
      assert.equal(res2.status, 200);
      assert.equal(res2.headers.get("content-type")?.includes("text/html"), true);
      const html2 = await res2.text();
      assert.match(html2, /<title>Custom Admin Studio<\/title>/);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("returns 500 with diagnostic details when configuration is invalid", async () => {
    const app = express();
    const router = mountAdminStudio({
      config: "invalid: yaml: [broken",
      basePath: "/admin",
    });

    app.use("/admin", router);

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/admin/__config`);
      assert.equal(res.status, 500);
      const body = await res.json();
      assert.equal(body.error, "Failed to load AdminKit configuration");
      assert.ok(body.message);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("serves static CSS assets from the resolved assets directory", async () => {
    const app = express();
    const workspaceRoot = getWorkspaceRoot();
    const router = mountAdminStudio({
      config: SAMPLE_CONFIG_YAML,
      basePath: "/admin",
      assetsDir: path.resolve(workspaceRoot, "packages/react/dist"),
    });

    app.use("/admin", router);

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/admin/__assets/style.css`);
      assert.equal(res.status, 200);
      const css = await res.text();
      assert.match(css, /--ak-primary/);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
