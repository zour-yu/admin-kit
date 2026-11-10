import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deepMergeAiEnrichment, type AiEnrichmentPayload } from "../dist/index.js";
import type { AdminKitConfig } from "@admin-kit/core";

describe("@admin-kit/cli AI Synthesis & Deep Merge", () => {
  const baseConfig: AdminKitConfig = {
    version: "1.0",
    project: {
      name: "Acme API",
      base_url: "/api",
    },
    resources: {
      users: {
        label: "users",
        endpoint: "/users",
        primary_key: "id",
        table: {
          columns: [
            { key: "id", label: "id", type: "string" },
            { key: "email_address", label: "email_address", type: "string" },
            { key: "password_hash", label: "password_hash", type: "string" },
            { key: "role", label: "role", type: "string" },
          ],
        },
        mutations: { creatable: false, editable: false, deletable: false },
        actions: [],
      },
      refunds: {
        label: "refunds",
        endpoint: "/refunds",
        primary_key: "id",
        table: {
          columns: [
            { key: "id", label: "id", type: "string" },
            { key: "amount", label: "amount", type: "number" },
            { key: "status", label: "status", type: "string" },
          ],
        },
        mutations: { creatable: false, editable: false, deletable: false },
        actions: [
          {
            name: "approve",
            label: "approve",
            scope: "row",
            api: { endpoint: "/refunds/{id}/approve", method: "POST" },
            inputs: [],
          },
          {
            name: "reject",
            label: "reject",
            scope: "row",
            api: { endpoint: "/refunds/{id}/reject", method: "POST" },
            inputs: [],
          },
        ],
      },
    },
  };

  it("deep-merges semantic badge colors, sensitive flags, readable labels, and visible_if expressions", () => {
    const mockEnrichment: AiEnrichmentPayload = {
      resources: [
        {
          resource_key: "users",
          label: "Users",
          columns: [
            { key: "email_address", label: "Email Address" },
            { key: "password_hash", label: "Password Hash", sensitive: true },
            {
              key: "role",
              label: "Role",
              badge_map: {
                user: "blue",
                admin: "purple",
              },
            },
          ],
        },
        {
          resource_key: "refunds",
          label: "Refunds",
          columns: [
            {
              key: "status",
              label: "Status",
              badge_map: {
                pending: "yellow",
                approved: "green",
                rejected: "red",
              },
            },
          ],
          actions: [
            {
              name: "approve",
              visible_if: "row.status == 'pending'",
              style: "success",
              confirm_dialog: {
                title: "Approve Refund?",
                message: "Are you sure you want to approve this refund?",
                confirm_text: "Approve",
              },
            },
            {
              name: "reject",
              visible_if: "row.status == 'pending'",
              style: "danger",
            },
          ],
        },
      ],
    };

    const merged = deepMergeAiEnrichment(baseConfig, mockEnrichment);

    // 1. Readable Labels
    assert.equal(merged.resources.users.label, "Users");
    assert.equal(merged.resources.refunds.label, "Refunds");
    assert.equal(
      merged.resources.users.table?.columns.find((c) => c.key === "email_address")?.label,
      "Email Address"
    );

    // 2. Sensitive Keys Flagging
    const passwordCol = merged.resources.users.table?.columns.find(
      (c) => c.key === "password_hash"
    );
    assert.equal(passwordCol?.sensitive, true);

    // 3. Status Badge Color Mapping
    const statusCol = merged.resources.refunds.table?.columns.find(
      (c) => c.key === "status"
    );
    assert.equal(statusCol?.type, "badge");
    assert.deepEqual(statusCol?.badge_map, {
      pending: "yellow",
      approved: "green",
      rejected: "red",
    });

    const roleCol = merged.resources.users.table?.columns.find((c) => c.key === "role");
    assert.equal(roleCol?.type, "badge");
    assert.deepEqual(roleCol?.badge_map, {
      user: "blue",
      admin: "purple",
    });

    // 4. visible_if & Semantic Action Styles
    const approveAction = merged.resources.refunds.actions.find((a) => a.name === "approve");
    assert.equal(approveAction?.visible_if, "row.status == 'pending'");
    assert.equal(approveAction?.style, "success");
    assert.equal(approveAction?.confirm_dialog?.title, "Approve Refund?");

    const rejectAction = merged.resources.refunds.actions.find((a) => a.name === "reject");
    assert.equal(rejectAction?.visible_if, "row.status == 'pending'");
    assert.equal(rejectAction?.style, "danger");
  });

  it("safely ignores hallucinated resources that do not exist in the base schema", () => {
    const mockEnrichmentWithHallucination: AiEnrichmentPayload = {
      resources: [
        {
          resource_key: "hallucinated_resource",
          label: "Hallucinated",
          columns: [{ key: "fake", label: "Fake" }],
        },
      ],
    };

    const merged = deepMergeAiEnrichment(baseConfig, mockEnrichmentWithHallucination);
    assert.equal((merged.resources as any).hallucinated_resource, undefined);
  });
});

