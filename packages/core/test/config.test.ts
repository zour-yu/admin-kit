import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseConfig,
  safeParseConfig,
  parseYamlConfig,
  safeParseYamlConfig,
  formatConfigError,
  formatConfigErrorDetails,
  isMutationEnabled,
  normalizeMutation,
  AdminKitConfigSchema,
} from "../dist/index.js";

const EXAMPLE_YAML = `
version: "1.0"

project:
  name: "Operations Admin"
  base_url: "/api/v1"
  branding:
    primary_color: "#4f46e5"
    theme: "system"

auth:
  strategy: "bearer"
  login_endpoint: "/auth/login"
  me_endpoint: "/auth/me"
  role_claim_path: "user.roles"

access:
  default_policy: "deny"
  superadmin_roles: ["superadmin"]

resources:
  refund_requests:
    label: "Refund Requests"
    endpoint: "/refunds"
    primary_key: "id"
    access:
      roles: ["finance", "support"]

    table:
      page_size: 25
      searchable_fields: ["customer_email"]
      filterable_fields: ["status"]
      columns:
        - key: "id"
          label: "ID"
          type: "string"
          copyable: true
        - key: "customer_email"
          label: "Customer"
          type: "string"
        - key: "amount"
          label: "Amount"
          type: "currency"
          sortable: true
        - key: "status"
          label: "Status"
          type: "badge"
          badge_map:
            pending: "yellow"
            approved: "green"
            rejected: "red"

    mutations:
      creatable: false
      editable: false
      deletable:
        enabled: true
        endpoint: "/refunds/{id}"
        method: "DELETE"
        roles: ["superadmin"]

    actions:
      - name: "approve"
        label: "Approve"
        style: "success"
        visible_if: "row.status == 'pending'"
        access:
          roles: ["finance"]
        confirm_dialog:
          title: "Approve Refund?"
          message: "This will immediately refund the customer."
        api:
          endpoint: "/refunds/{id}/approve"
          method: "POST"
        on_success:
          toast: "Refund approved."
          invalidate: ["refund_requests"]

      - name: "reject"
        label: "Reject"
        style: "danger"
        visible_if: "row.status == 'pending'"
        access:
          roles: ["finance", "support"]
        api:
          endpoint: "/refunds/{id}/reject"
          method: "POST"
        inputs:
          - key: "reason"
            label: "Rejection Reason"
            type: "select"
            required: true
            options:
              - label: "Fraudulent"
                value: "fraud"
              - label: "Out of Policy"
                value: "policy"
          - key: "notes"
            label: "Internal Notes"
            type: "textarea"
            required: false
        on_success:
          toast: "Refund rejected."
          invalidate: ["refund_requests"]
`;

describe("AdminKit Core Configuration Schema", () => {
  it("successfully parses the complete example from CONFIG_SCHEMA.md", () => {
    const config = parseYamlConfig(EXAMPLE_YAML);

    assert.equal(config.version, "1.0");
    assert.equal(config.project.name, "Operations Admin");
    assert.equal(config.project.base_url, "/api/v1");
    assert.equal(config.project.branding?.primary_color, "#4f46e5");
    assert.equal(config.project.branding?.theme, "system");

    assert.equal(config.auth?.strategy, "bearer");
    assert.equal(config.auth?.login_endpoint, "/auth/login");
    assert.equal(config.auth?.me_endpoint, "/auth/me");
    assert.equal(config.auth?.role_claim_path, "user.roles");
    assert.equal(config.auth?.permission_claim_path, "permissions");
    assert.equal(config.auth?.token_storage, "sessionStorage");

    assert.equal(config.access?.default_policy, "deny");
    assert.deepEqual(config.access?.superadmin_roles, ["superadmin"]);

    const resource = config.resources.refund_requests;
    assert.ok(resource);
    assert.equal(resource.label, "Refund Requests");
    assert.equal(resource.endpoint, "/refunds");
    assert.equal(resource.primary_key, "id");
    assert.deepEqual(resource.access?.roles, ["finance", "support"]);

    // Table checks
    assert.equal(resource.table?.page_size, 25);
    assert.deepEqual(resource.table?.searchable_fields, ["customer_email"]);
    assert.deepEqual(resource.table?.filterable_fields, ["status"]);
    assert.equal(resource.table?.columns.length, 4);

    const amountCol = resource.table?.columns.find((c) => c.key === "amount");
    assert.equal(amountCol?.type, "currency");
    assert.equal(amountCol?.sortable, true);
    assert.equal(amountCol?.copyable, false);

    const statusCol = resource.table?.columns.find((c) => c.key === "status");
    assert.equal(statusCol?.type, "badge");
    assert.deepEqual(statusCol?.badge_map, {
      pending: "yellow",
      approved: "green",
      rejected: "red",
    });

    // Mutations checks
    assert.equal(isMutationEnabled(resource.mutations?.creatable), false);
    assert.equal(isMutationEnabled(resource.mutations?.editable), false);
    assert.equal(isMutationEnabled(resource.mutations?.deletable), true);

    const normalizedDeletable = normalizeMutation(resource.mutations?.deletable);
    assert.equal(normalizedDeletable?.endpoint, "/refunds/{id}");
    assert.equal(normalizedDeletable?.method, "DELETE");
    assert.deepEqual(normalizedDeletable?.roles, ["superadmin"]);

    // Actions checks
    assert.equal(resource.actions.length, 2);

    const approveAction = resource.actions.find((a) => a.name === "approve");
    assert.ok(approveAction);
    assert.equal(approveAction.style, "success");
    assert.equal(approveAction.scope, "row");
    assert.equal(approveAction.visible_if, "row.status == 'pending'");
    assert.equal(approveAction.confirm_dialog?.title, "Approve Refund?");
    assert.equal(approveAction.confirm_dialog?.confirm_text, "Confirm");
    assert.equal(approveAction.api.endpoint, "/refunds/{id}/approve");
    assert.equal(approveAction.api.method, "POST");
    assert.equal(approveAction.on_success?.toast, "Refund approved.");
    assert.deepEqual(approveAction.on_success?.invalidate, ["refund_requests"]);

    const rejectAction = resource.actions.find((a) => a.name === "reject");
    assert.ok(rejectAction);
    assert.equal(rejectAction.style, "danger");
    assert.equal(rejectAction.inputs.length, 2);
    assert.equal(rejectAction.inputs[0].key, "reason");
    assert.equal(rejectAction.inputs[0].type, "select");
    assert.equal(rejectAction.inputs[0].required, true);
    assert.equal(rejectAction.inputs[1].key, "notes");
    assert.equal(rejectAction.inputs[1].type, "textarea");
    assert.equal(rejectAction.inputs[1].required, false);
  });

  it("applies default values for minimal configurations", () => {
    const minimal = {
      project: {
        name: "Test Admin",
      },
      resources: {
        items: {
          label: "Items",
          endpoint: "/items",
          table: {
            columns: [
              { key: "id", label: "ID", type: "string" },
            ],
          },
        },
      },
    };

    const parsed = parseConfig(minimal);
    assert.equal(parsed.version, "1.0");
    assert.equal(parsed.project.base_url, "/api");
    assert.equal(parsed.resources.items.primary_key, "id");
    assert.equal(parsed.resources.items.table?.page_size, 20);
    assert.equal(parsed.resources.items.table?.columns[0].sortable, false);
    assert.equal(parsed.resources.items.table?.columns[0].copyable, false);
    assert.equal(parsed.resources.items.table?.columns[0].sensitive, false);
    assert.deepEqual(parsed.resources.items.actions, []);
  });

  it("rejects invalid configs and produces readable error formatting", () => {
    const invalidConfig = {
      project: {}, // Missing name
      resources: {
        items: {
          label: "Items",
          // Missing endpoint
          table: {
            columns: [
              { key: "status", label: "Status", type: "invalid_type" }, // Invalid type
            ],
          },
        },
      },
    };

    const result = safeParseConfig(invalidConfig);
    assert.equal(result.success, false);
    if (!result.success) {
      const details = formatConfigErrorDetails(result.error);
      assert.ok(details.length >= 3);

      const formatted = formatConfigError(result.error);
      assert.ok(formatted.includes("project.name"));
      assert.ok(formatted.includes("resources.items.endpoint"));
      assert.ok(formatted.includes("resources.items.table.columns.0.type"));
    }
  });

  it("handles relation columns and form inputs properly", () => {
    const configWithRelation = {
      project: { name: "Store Admin" },
      resources: {
        orders: {
          label: "Orders",
          endpoint: "/orders",
          table: {
            columns: [
              {
                key: "customer_id",
                label: "Customer",
                type: "relation",
                relation: {
                  target_resource: "customers",
                  value_field: "id",
                  display_field: "full_name",
                },
              },
            ],
          },
        },
      },
    };

    const parsed = parseConfig(configWithRelation);
    const col = parsed.resources.orders.table?.columns[0];
    assert.equal(col?.type, "relation");
    assert.equal(col?.relation?.target_resource, "customers");
    assert.equal(col?.relation?.value_field, "id");
    assert.equal(col?.relation?.display_field, "full_name");
  });

  it("safely parses YAML strings and handles syntax errors", () => {
    const badYaml = `
      project: [unclosed array
    `;
    const res = safeParseYamlConfig(badYaml);
    assert.equal(res.success, false);
    assert.ok(res.error instanceof Error);
  });
});
