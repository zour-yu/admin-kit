import type {
  AdminKitConfig,
  ResourceConfig,
} from "@admin-kit/core";

export interface ParsedEndpoint {
  originalPath: string;
  normalizedPath: string;
  method: string;
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: Array<{
    name: string;
    in: string;
    required?: boolean;
    schema?: any;
    description?: string;
  }>;
  requestBodySchema?: any;
  responseSchema?: any;
}

export interface IntrospectionOptions {
  source: string;
  baseUrl?: string;
  projectName?: string;
}

export interface IntrospectResult {
  config: AdminKitConfig;
  detectedResources: Record<string, ResourceConfig>;
  stats: {
    resourceCount: number;
    actionCount: number;
    tableColumnCount: number;
  };
}
