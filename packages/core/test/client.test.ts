import test from "node:test";
import assert from "node:assert/strict";
import { AdminClient, AdminApiError, createAdminClient, type AdminKitConfig } from "../dist/index.js";

const mockConfig: AdminKitConfig = {
  version: "1.0",
  project: {
    name: "Test Ops",
    base_url: "http://api.local:4000",
  },
  auth: {
    strategy: "bearer",
    token_storage: "sessionStorage",
  },
  resources: {
    refunds: {
      endpoint: "/api/refunds",
      primary_key: "id",
      table: {
        columns: [
          { field: "id", label: "ID", type: "string" },
          { field: "amount", label: "Amount", type: "currency" },
          { field: "status", label: "Status", type: "badge" },
        ],
      },
      actions: [
        {
          id: "approve",
          name: "Approve Refund",
          api: {
            endpoint: "/api/refunds/{id}/approve",
            method: "POST",
          },
        },
      ],
    },
  },
};

test("AdminClient: parameter interpolation and URL resolution", () => {
  const client = new AdminClient(mockConfig);

  const endpoint = client.interpolateEndpoint("/api/refunds/{id}/approve", { id: "ref_999" });
  assert.equal(endpoint, "/api/refunds/ref_999/approve");

  const resolved = client.resolveUrl("/api/refunds");
  assert.equal(resolved, "http://api.local:4000/api/refunds");
});

test("AdminClient: fetchResourceList with custom fetch interceptor", async () => {
  let requestedUrl = "";
  let authHeader = "";

  const customFetch = (async (url: string, init?: RequestInit) => {
    requestedUrl = url;
    authHeader = (init?.headers as Record<string, string>)?.["Authorization"] || "";
    return {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => [{ id: "ref_1", amount: 100, status: "pending" }],
    };
  }) as any;

  const client = createAdminClient(mockConfig, {
    customFetch,
    getToken: () => "secret-token-123",
  });

  const result = await client.fetchResourceList("refunds", {
    page: 2,
    limit: 25,
    search: "john",
  });

  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].id, "ref_1");
  assert.equal(authHeader, "Bearer secret-token-123");
  assert.ok(requestedUrl.includes("page=2"));
  assert.ok(requestedUrl.includes("limit=25"));
  assert.ok(requestedUrl.includes("search=john"));
});

test("AdminClient: executeAction dispatches POST request with body and parameters", async () => {
  let executedUrl = "";
  let executedBody = "";
  let executedMethod = "";

  const customFetch = (async (url: string, init?: RequestInit) => {
    executedUrl = url;
    executedMethod = init?.method || "";
    executedBody = (init?.body as string) || "";
    return {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ success: true, refundId: "ref_123" }),
    };
  }) as any;

  const client = new AdminClient(mockConfig, { customFetch });

  const action = mockConfig.resources.refunds.actions![0];
  const response = await client.executeAction(action, { id: "ref_123" }, { reason: "VIP customer" });

  assert.equal(executedUrl, "http://api.local:4000/api/refunds/ref_123/approve");
  assert.equal(executedMethod, "POST");
  assert.deepEqual(JSON.parse(executedBody), { reason: "VIP customer" });
  assert.equal(response.success, true);
});

test("AdminClient: raises AdminApiError on HTTP error status", async () => {
  const customFetch = (async () => {
    return {
      ok: false,
      status: 403,
      statusText: "Forbidden",
      headers: new Headers(),
      text: async () => "Insufficient privileges",
    };
  }) as any;

  const client = new AdminClient(mockConfig, { customFetch });

  await assert.rejects(
    async () => {
      await client.fetchResourceList("refunds");
    },
    (err: any) => {
      assert.ok(err instanceof AdminApiError);
      assert.equal(err.status, 403);
      assert.equal(err.statusText, "Forbidden");
      return true;
    }
  );
});
