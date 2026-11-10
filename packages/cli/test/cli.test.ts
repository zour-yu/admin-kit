import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import {
  introspectOpenApi,
  computeConfigDiff,
  runDoctorValidation,
  startStudioServer,
} from "../dist/index.js";
import { parseConfig, parseYamlConfig } from "@admin-kit-yu/core";

const repoRoot = fs.existsSync(path.resolve(process.cwd(), "mocks/dummy-openapi.json"))
  ? process.cwd()
  : path.resolve(process.cwd(), "../..");

describe("@admin-kit-yu/cli OpenAPI Introspection", () => {
  it("introspects mocks/dummy-openapi.json and produces a valid AdminKitConfig", async () => {
    const dummyPath = path.resolve(repoRoot, "mocks/dummy-openapi.json");
    const result = await introspectOpenApi({
      source: dummyPath,
      baseUrl: "/api/v1",
    });

    assert.ok(result);
    assert.equal(result.config.version, "1.0");
    assert.equal(result.config.project.name, "Acme API");
    assert.equal(result.config.project.base_url, "/api/v1");

    // Resources check
    const resources = result.config.resources;
    assert.ok(resources.users);
    assert.ok(resources.refunds);

    // Users resource check
    const users = resources.users;
    assert.equal(users.label, "Users");
    assert.equal(users.endpoint, "/users");
    assert.equal(users.table?.columns.length, 4);

    const emailCol = users.table?.columns.find((c) => c.key === "email");
    assert.ok(emailCol);
    assert.equal(emailCol.type, "string");

    const roleCol = users.table?.columns.find((c) => c.key === "role");
    assert.ok(roleCol);
    assert.equal(roleCol.type, "badge");
    assert.deepEqual(roleCol.badge_map, { user: "blue", admin: "purple" });

    const createdCol = users.table?.columns.find((c) => c.key === "created_at");
    assert.ok(createdCol);
    assert.equal(createdCol.type, "datetime");

    // Refunds resource check
    const refunds = resources.refunds;
    assert.equal(refunds.label, "Refunds");
    assert.equal(refunds.endpoint, "/refunds");
    assert.equal(refunds.table?.columns.length, 4);

    const userIdCol = refunds.table?.columns.find((c) => c.key === "user_id");
    assert.ok(userIdCol);
    assert.equal(userIdCol.type, "relation");
    assert.equal(userIdCol.relation?.target_resource, "users");
    assert.equal(userIdCol.relation?.display_field, "email");

    const amountCol = refunds.table?.columns.find((c) => c.key === "amount");
    assert.ok(amountCol);
    assert.equal(amountCol.type, "currency");
    assert.equal(amountCol.sortable, true);

    const statusCol = refunds.table?.columns.find((c) => c.key === "status");
    assert.ok(statusCol);
    assert.equal(statusCol.type, "badge");
    assert.deepEqual(statusCol.badge_map, {
      pending: "yellow",
      approved: "green",
      rejected: "red",
    });

    // Custom actions check
    assert.equal(refunds.actions.length, 2);

    const approve = refunds.actions.find((a) => a.name === "approve");
    assert.ok(approve);
    assert.equal(approve.style, "success");
    assert.equal(approve.visible_if, "row.status == 'pending'");
    assert.equal(approve.confirm_dialog?.title, "Approve Refund?");
    assert.equal(approve.api.endpoint, "/refunds/{id}/approve");

    const reject = refunds.actions.find((a) => a.name === "reject");
    assert.ok(reject);
    assert.equal(reject.style, "danger");
    assert.equal(reject.visible_if, "row.status == 'pending'");
    assert.equal(reject.inputs?.length, 2);

    const reasonInput = reject.inputs?.find((i) => i.key === "reason");
    assert.ok(reasonInput);
    assert.equal(reasonInput.type, "select");
    assert.equal(reasonInput.required, true);
    assert.equal(reasonInput.options?.length, 3);

    const notesInput = reject.inputs?.find((i) => i.key === "notes");
    assert.ok(notesInput);
    assert.equal(notesInput.type, "textarea");
    assert.equal(notesInput.required, false);
  });

  it("verifies the generated admin.config.yaml file parses without error", () => {
    const configPath = path.resolve(repoRoot, "admin.config.yaml");
    assert.ok(fs.existsSync(configPath), "admin.config.yaml must exist on disk");

    const content = fs.readFileSync(configPath, "utf-8");
    const parsed = parseYamlConfig(content);
    assert.equal(parsed.version, "1.0");
    assert.ok(parsed.resources.users);
    assert.ok(parsed.resources.refunds);
  });

  it("diffs admin.config.yaml against dummy-openapi.json and verifies inSync state", async () => {
    const configPath = path.resolve(repoRoot, "admin.config.yaml");
    const specPath = path.resolve(repoRoot, "mocks/dummy-openapi.json");
    const diff = await computeConfigDiff(configPath, specPath);

    assert.ok(diff);
    assert.equal(diff.hasBreakingChanges, false, "Diff should not detect breaking changes against source spec");
    assert.equal(diff.summary.removedResources, 0);
  });

  it("runs doctor validation on admin.config.yaml and confirms all checks pass", async () => {
    const configPath = path.resolve(repoRoot, "admin.config.yaml");
    const { passed, results } = await runDoctorValidation(configPath);

    assert.equal(passed, true, "Doctor validation must pass for valid config");
    assert.ok(results.length >= 3, "Doctor should run multiple structural checks");
    const schemaCheck = results.find((r) => r.name === "Zod Schema Validation");
    assert.ok(schemaCheck && schemaCheck.status === "pass");
  });

  it("launches the studio server and verifies /admin and /admin/__config", async () => {
    const configPath = path.resolve(repoRoot, "admin.config.yaml");
    const { server, port } = await startStudioServer({
      config: configPath,
      port: 0, // dynamic unallocated port
      watch: false,
    });

    try {
      const resHtml = await fetch(`http://127.0.0.1:${port}/admin`);
      assert.equal(resHtml.status, 200);
      const html = await resHtml.text();
      assert.ok(html.includes('<div id="root">'));

      const resConfig = await fetch(`http://127.0.0.1:${port}/admin/__config`);
      assert.equal(resConfig.status, 200);
      const configJson = await resConfig.json();
      assert.equal(configJson.project.name, "Acme API");
    } finally {
      server.close();
    }
  });

  it("handles real-world specs: filters out GET actions, identifies detail_endpoint, and generates fallback columns for empty schemas", async () => {
    const tempSpecPath = path.resolve(repoRoot, "mocks/temp-realworld-spec.json");
    const specContent = {
      openapi: "3.0.0",
      info: { title: "Real World API", version: "1.0.0" },
      paths: {
        "/cases": {
          get: {
            summary: "List cases",
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": {
                    schema: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {}, // empty DTO properties
                      },
                    },
                  },
                },
              },
            },
          },
        },
        "/cases/{id}": {
          get: {
            summary: "Get case by id",
            responses: { "200": { description: "OK" } },
          },
        },
        "/cases/metrics": {
          get: {
            summary: "Case metrics",
            responses: { "200": { description: "OK" } },
          },
        },
        "/cases/investigators": {
          get: {
            summary: "Investigators list",
            responses: { "200": { description: "OK" } },
          },
        },
        "/cases/{id}/escalate": {
          post: {
            summary: "Escalate case",
            responses: { "200": { description: "Case escalated" } },
          },
        },
        "/cases/{id}/status": {
          put: {
            summary: "Update status",
            responses: { "200": { description: "Status updated" } },
          },
        },
      },
    };

    fs.writeFileSync(tempSpecPath, JSON.stringify(specContent, null, 2), "utf-8");

    try {
      const result = await introspectOpenApi({
        source: tempSpecPath,
        baseUrl: "/api",
      });

      assert.ok(result);
      const casesResource = result.config.resources.cases;
      assert.ok(casesResource);

      // Verify detail_endpoint was set and not an action
      assert.equal(casesResource.detail_endpoint, "/cases/{id}");

      // Verify auxiliary GET endpoints (/metrics, /investigators) are NOT actions
      const actionNames = (casesResource.actions || []).map((a) => a.name);
      assert.ok(!actionNames.includes("metrics"), "GET /cases/metrics must not become an action");
      assert.ok(!actionNames.includes("investigators"), "GET /cases/investigators must not become an action");
      assert.ok(!actionNames.includes("id"), "GET /cases/{id} must not become an action");

      // Verify POST /cases/{id}/escalate and PUT /cases/{id}/status are the actions
      assert.equal(actionNames.length, 2);
      assert.deepEqual(actionNames.sort(), ["escalate", "status"]);
      const escalateAct = casesResource.actions?.find((a) => a.name === "escalate");
      assert.equal(escalateAct?.api.method, "POST");
      const statusAct = casesResource.actions?.find((a) => a.name === "status");
      assert.equal(statusAct?.api.method, "PUT");

      // Verify fallback columns for empty schema
      const cols = casesResource.table?.columns || [];
      assert.ok(cols.length >= 3, "Expected fallback columns for empty schema");

      const idCol = cols.find((c) => c.key === "id");
      assert.ok(idCol, "id column must exist");
      assert.equal(idCol.primary_key, true);

      const statusCol = cols.find((c) => c.key === "status");
      assert.ok(statusCol, "status badge column must exist due to /status endpoint");
      assert.equal(statusCol?.type, "badge");

      const createdCol = cols.find((c) => c.key === "created_at");
      assert.ok(createdCol, "created_at column must exist");

      const updatedCol = cols.find((c) => c.key === "updated_at");
      assert.ok(updatedCol, "updated_at column must exist");
    } finally {
      if (fs.existsSync(tempSpecPath)) {
        fs.unlinkSync(tempSpecPath);
      }
    }
  });
});
