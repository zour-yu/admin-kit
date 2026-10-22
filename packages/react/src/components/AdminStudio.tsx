import React from "react";
import type { AdminKitConfig, ActionConfig } from "@admin-kit/core";
import { ConfigProvider } from "../context/ConfigContext";
import { AppShell } from "./layout/AppShell";
import "../styles/admin-studio.css";

export interface AdminStudioProps {
  config?: AdminKitConfig | string;
  configUrl?: string;
  initialResourceKey?: string;
  data?: Record<string, any[]>;
  onExecuteAction?: (action: ActionConfig, row: any) => void;
}

/**
 * AdminStudio entry component rendering the complete API-driven dashboard.
 * Consumes validated admin.config.yaml and renders dynamic tables, forms, and workflows.
 */
export const AdminStudio: React.FC<AdminStudioProps> = ({
  config,
  configUrl,
  initialResourceKey,
  data,
  onExecuteAction,
}) => {
  return (
    <ConfigProvider
      config={config}
      configUrl={configUrl}
      initialResourceKey={initialResourceKey}
    >
      <AppShell data={data} onExecuteAction={onExecuteAction} />
    </ConfigProvider>
  );
};
