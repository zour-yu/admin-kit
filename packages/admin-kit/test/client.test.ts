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

  // Mongoose _id <-> id bidirectional fallback
  const mongooseEndpoint = client.interpolateEndpoint("/api/cases/{id}/escalate", { _id: "mongo_case_789" });
  assert.equal(mongooseEndpoint, "/api/cases/mongo_case_789/escalate");

  const invertedEndpoint = client.interpolateEndpoint("/api/cases/{_id}/escalate", { id: "regular_case_123" });
  assert.equal(invertedEndpoint, "/api/cases/regular_case_123/escalate");

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

test("AdminClient: attaches Bearer header when token is supplied even without explicit auth strategy in config", async () => {
  let capturedHeaders: Record<string, string> = {};

  const configNoAuth: AdminKitConfig = {
    version: "1.0",
    project: { name: "No Auth Config", base_url: "http://api.local:4000" },
    resources: {
      cases: {
        endpoint: "/cases/all",
        table: { columns: [{ field: "id", label: "ID" }] },
      },
    },
  };

  const customFetch = (async (url: string, init?: RequestInit) => {
    capturedHeaders = (init?.headers as Record<string, string>) || {};
    return {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => [{ id: "case_101" }],
    };
  }) as any;

  const client = new AdminClient(configNoAuth, {
    customFetch,
    getToken: () => "firebase-jwt-token-xyz",
  });

  const res = await client.fetchResourceList("cases");
  assert.equal(res.data.length, 1);
  assert.equal(capturedHeaders["Authorization"], "Bearer firebase-jwt-token-xyz");
});

test("AdminClient: fetchSubResourceList queries child collection endpoint", async () => {
  let requestedUrl = "";

  const configWithSubRes: AdminKitConfig = {
    version: "1.0",
    project: { name: "Sub-Resource Ops", base_url: "http://api.local:4000" },
    resources: {
      cases: {
        endpoint: "/api/cases",
        sub_resources: [
          {
            id: "notes",
            label: "Case Notes",
            endpoint: "/api/cases/{id}/notes",
            method: "GET",
          },
        ],
      },
    },
  };

  const customFetch = (async (url: string) => {
    requestedUrl = url;
    return {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => [{ id: "note_1", content: "Witness interviewed" }],
    };
  }) as any;

  const client = new AdminClient(configWithSubRes, { customFetch });
  const result = await client.fetchSubResourceList("cases", "notes", "case_999");

  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].content, "Witness interviewed");
  assert.equal(requestedUrl, "http://api.local:4000/api/cases/case_999/notes");
});

test("AdminClient: executeAction constructs FormData for multipart uploads", async () => {
  let capturedBody: any = null;
  let capturedHeaders: Record<string, string> = {};

  const configWithUpload: AdminKitConfig = {
    version: "1.0",
    project: { name: "Upload Ops", base_url: "http://api.local:4000" },
    resources: {
      storage: {
        endpoint: "/api/storage",
        actions: [
          {
            id: "upload",
            name: "upload_file",
            label: "Upload File",
            api: {
              endpoint: "/api/storage/upload",
              method: "POST",
              content_type: "multipart/form-data",
            },
            inputs: [{ key: "file", label: "File", type: "file" }],
          },
        ],
      },
    },
  };

  const customFetch = (async (url: string, init?: RequestInit) => {
    capturedBody = init?.body;
    capturedHeaders = (init?.headers as Record<string, string>) || {};
    return {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ file_id: "file_888", url: "https://cdn.example.com/file_888" }),
    };
  }) as any;

  const client = new AdminClient(configWithUpload, { customFetch });
  const action = configWithUpload.resources.storage.actions![0];

  const fakeBlob = new Blob(["test file content"], { type: "text/plain" });
  await client.executeAction(action, {}, { file: fakeBlob, category: "evidence" });

  assert.ok(capturedBody instanceof FormData);
  // Ensure Content-Type was not set to application/json so browser generates multipart boundary
  assert.equal(capturedHeaders["Content-Type"], undefined);
});
