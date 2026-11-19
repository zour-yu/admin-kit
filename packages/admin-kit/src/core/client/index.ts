import type { AdminKitConfig, ActionConfig, ResourceConfig } from "../types";

export interface AdminClientOptions {
  baseUrl?: string;
  getToken?: () => string | null | Promise<string | null>;
  customFetch?: typeof fetch;
}

export interface ResourceQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, string | number | boolean>;
}

export class AdminApiError extends Error {
  public status: number;
  public statusText: string;
  public url: string;
  public responseBody: any;

  constructor(message: string, status: number, statusText: string, url: string, responseBody?: any) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.statusText = statusText;
    this.url = url;
    this.responseBody = responseBody;
  }
}

/**
 * Universal API Client for AdminKit with parameter interpolation and auth interceptors.
 * Implements the execution flows specified in docs/ARCHITECTURE.md Section 3 and 4.3.
 */
export class AdminClient {
  private config: AdminKitConfig;
  private baseUrl: string;
  private getToken?: () => string | null | Promise<string | null>;
  private fetchFn: typeof fetch;

  constructor(config: AdminKitConfig, options: AdminClientOptions = {}) {
    this.config = config;
    this.baseUrl = (options.baseUrl || config.project?.base_url || "").replace(/\/+$/, "");
    this.getToken = options.getToken;
    this.fetchFn = options.customFetch || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : (fetch as any));
  }

  /**
   * Resolves the active authentication token from options or browser storage.
   */
  private async resolveAuthToken(): Promise<string | null> {
    if (this.getToken) {
      return await this.getToken();
    }

    if (typeof window === "undefined") {
      return null;
    }

    const storageType = this.config.auth?.token_storage || "sessionStorage";
    const storageKey = "admin_kit_token";

    try {
      if (storageType === "sessionStorage") {
        return window.sessionStorage.getItem(storageKey);
      }
      if (storageType === "localStorage") {
        return window.localStorage.getItem(storageKey);
      }
    } catch {
      return null;
    }

    return null;
  }

  /**
   * Prepares request headers with JSON content-type and Bearer token if configured.
   */
  private async buildHeaders(customHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...customHeaders,
    };

    const strategy = this.config.auth?.strategy;
    if (!strategy || strategy === "bearer") {
      const token = await this.resolveAuthToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  /**
   * Replaces URL path variables like `{id}` or `{userId}` with record field values.
   * Handles Mongoose `_id` <-> `id` equivalence automatically.
   */
  public interpolateEndpoint(template: string, params: Record<string, any> = {}): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => {
      if (params[key] !== undefined && params[key] !== null) {
        return encodeURIComponent(String(params[key]));
      }
      if (key === "id" && params._id !== undefined && params._id !== null) {
        return encodeURIComponent(String(params._id));
      }
      if (key === "_id" && params.id !== undefined && params.id !== null) {
        return encodeURIComponent(String(params.id));
      }
      return "";
    });
  }

  /**
   * Builds the fully-qualified URL for a given relative endpoint path.
   */
  public resolveUrl(endpoint: string): string {
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    if (this.baseUrl && !cleanEndpoint.startsWith(this.baseUrl)) {
      return `${this.baseUrl}${cleanEndpoint}`;
    }
    return cleanEndpoint;
  }

  /**
   * Fetches records for a given resource with pagination, search, and sorting.
   */
  public async fetchResourceList(
    resourceKey: string,
    params: ResourceQueryParams = {}
  ): Promise<{ data: any[]; total?: number }> {
    const resConfig: ResourceConfig | undefined = this.config.resources[resourceKey];
    if (!resConfig) {
      throw new Error(`Resource "${resourceKey}" is not defined in configuration.`);
    }

    const resolvedEndpoint = this.resolveUrl(resConfig.endpoint);
    const hasOrigin = /^https?:\/\//i.test(resolvedEndpoint);
    const url = new URL(resolvedEndpoint, "http://localhost");

    if (params.page !== undefined) url.searchParams.set("page", String(params.page));
    if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit));
    if (params.search) url.searchParams.set("search", params.search);
    if (params.sortBy) url.searchParams.set("sortBy", params.sortBy);
    if (params.sortOrder) url.searchParams.set("sortOrder", params.sortOrder);

    if (params.filters) {
      for (const [k, v] of Object.entries(params.filters)) {
        if (v !== undefined && v !== null && v !== "") {
          url.searchParams.set(k, String(v));
        }
      }
    }

    const fullPath = hasOrigin ? url.toString() : url.pathname + url.search;
    const headers = await this.buildHeaders();

    const response = await this.fetchFn(fullPath, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => null);
      throw new AdminApiError(
        `Failed to fetch resource "${resourceKey}": HTTP ${response.status}`,
        response.status,
        response.statusText,
        fullPath,
        errorBody
      );
    }

    const json = await response.json();

    if (Array.isArray(json)) {
      return { data: json, total: json.length };
    }
    if (json && Array.isArray(json.data)) {
      return { data: json.data, total: json.total || json.data.length };
    }
    if (json && Array.isArray(json.items)) {
      return { data: json.items, total: json.total || json.items.length };
    }

    return { data: [json], total: 1 };
  }

  /**
   * Dispatches a custom RPC action workflow (e.g. approve, reject, file upload).
   * Automatically serializes to FormData when inputs contain files or action specifies multipart/form-data.
   */
  public async executeAction(
    action: ActionConfig,
    row: Record<string, any>,
    payload?: Record<string, any>
  ): Promise<any> {
    const rawEndpoint = action.api.endpoint;
    const resolvedPath = this.interpolateEndpoint(rawEndpoint, row);
    const fullUrl = this.resolveUrl(resolvedPath);

    const method = action.api.method || "POST";

    const isMultipart =
      (action.api as any)?.content_type === "multipart/form-data" ||
      action.inputs?.some((inp) => inp.type === "file") ||
      (payload && typeof payload === "object" && Object.values(payload).some((val) => typeof File !== "undefined" && (val instanceof File || val instanceof Blob)));

    let body: any = undefined;
    const customHeaders: Record<string, string> = {};

    if (method !== "GET" && payload) {
      if (isMultipart && typeof FormData !== "undefined") {
        const formData = new FormData();
        for (const [key, val] of Object.entries(payload)) {
          if (val !== undefined && val !== null) {
            if (typeof File !== "undefined" && (val instanceof File || val instanceof Blob)) {
              formData.append(key, val);
            } else if (Array.isArray(val) && val.some((v) => typeof File !== "undefined" && (v instanceof File || v instanceof Blob))) {
              for (const item of val) {
                formData.append(key, item);
              }
            } else if (typeof val === "object") {
              formData.append(key, JSON.stringify(val));
            } else {
              formData.append(key, String(val));
            }
          }
        }
        body = formData;
      } else {
        customHeaders["Content-Type"] = "application/json";
        body = JSON.stringify(payload);
      }
    }

    const headers = await this.buildHeaders(customHeaders);

    const response = await this.fetchFn(fullUrl, {
      method,
      headers,
      body,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => null);
      throw new AdminApiError(
        `Action "${action.name}" failed: HTTP ${response.status}`,
        response.status,
        response.statusText,
        fullUrl,
        errorBody
      );
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await response.json();
    }
    return await response.text();
  }

  /**
   * Fetches records for a relational sub-resource (e.g. /cases/{id}/notes).
   */
  public async fetchSubResourceList(
    resourceKey: string,
    subResourceId: string,
    parentRecordId: string,
    params: ResourceQueryParams = {}
  ): Promise<{ data: any[]; total?: number }> {
    const resConfig = this.config.resources[resourceKey];
    if (!resConfig) {
      throw new Error(`Resource "${resourceKey}" is not defined in configuration.`);
    }

    const subRes = resConfig.sub_resources?.find((sr) => sr.id === subResourceId);
    if (!subRes) {
      throw new Error(`Sub-resource "${subResourceId}" is not defined on resource "${resourceKey}".`);
    }

    const interpolated = this.interpolateEndpoint(subRes.endpoint, {
      id: parentRecordId,
      [resConfig.primary_key || "id"]: parentRecordId,
      _id: parentRecordId,
    });
    const resolved = this.resolveUrl(interpolated);
    const hasOrigin = /^https?:\/\//i.test(resolved);
    const url = new URL(resolved, "http://localhost");

    if (params.page !== undefined) url.searchParams.set("page", String(params.page));
    if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit));

    const fullPath = hasOrigin ? url.toString() : url.pathname + url.search;
    const headers = await this.buildHeaders();

    const response = await this.fetchFn(fullPath, {
      method: subRes.method || "GET",
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => null);
      throw new AdminApiError(
        `Failed to fetch sub-resource "${subResourceId}": HTTP ${response.status}`,
        response.status,
        response.statusText,
        fullPath,
        errorBody
      );
    }

    const json = await response.json();
    if (Array.isArray(json)) return { data: json, total: json.length };
    if (json && Array.isArray(json.data)) return { data: json.data, total: json.total || json.data.length };
    if (json && Array.isArray(json.items)) return { data: json.items, total: json.total || json.items.length };
    return { data: [json], total: 1 };
  }

  /**
   * Fetches the current authenticated user's profile and roles.
   */
  public async fetchMe(): Promise<any> {
    const meEndpoint = this.config.auth?.me_endpoint;
    if (!meEndpoint) {
      return null;
    }

    const fullUrl = this.resolveUrl(meEndpoint);
    const headers = await this.buildHeaders();

    const response = await this.fetchFn(fullUrl, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new AdminApiError(
        `Failed to fetch auth session: HTTP ${response.status}`,
        response.status,
        response.statusText,
        fullUrl
      );
    }

    return await response.json();
  }
}

/**
 * Factory helper to instantiate an AdminClient.
 */
export function createAdminClient(config: AdminKitConfig, options?: AdminClientOptions): AdminClient {
  return new AdminClient(config, options);
}

