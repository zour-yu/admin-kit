import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { introspectOpenApi } from "../dist/index.js";
import { parseConfig, parseYamlConfig } from "@admin-kit/core";

const repoRoot = fs.existsSync(path.resolve(process.cwd(), "mocks/dummy-openapi.json"))
  ? process.cwd()
  : path.resolve(process.cwd(), "../..");

describe("@admin-kit/cli OpenAPI Introspection", () => {
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
});
