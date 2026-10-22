import React from "react";
import { useConfig } from "../../context/ConfigContext";
import { DynamicDataTable } from "../table/DynamicDataTable";
import type { ActionConfig } from "@admin-kit/core";
import {
  Sun,
  Moon,
  Database,
  Users,
  CreditCard,
  Layers,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

export interface AppShellProps {
  data?: Record<string, any[]>;
  onExecuteAction?: (action: ActionConfig, row: any) => void;
}

export const AppShell: React.FC<AppShellProps> = ({ data, onExecuteAction }) => {
  const {
    config,
    activeResourceKey,
    setActiveResourceKey,
    activeResource,
    theme,
    setTheme,
    toast,
    showToast,
  } = useConfig();

  if (!config) {
    return (
      <div className="ak-studio" style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div className="ak-brand-icon" style={{ margin: "0 auto 16px", width: 48, height: 48 }}>
            AK
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>Loading AdminKit...</h2>
          <p style={{ color: "var(--ak-text-muted)", fontSize: 14 }}>
            Validating configuration contract
          </p>
        </div>
      </div>
    );
  }

  const resourceKeys = Object.keys(config.resources || {});
  const activeResourceData = data?.[activeResourceKey];

  const handleActionClick = (action: ActionConfig, row: any) => {
    if (onExecuteAction) {
      onExecuteAction(action, row);
      return;
    }

    // Default built-in action execution handler
    if (action.confirm_dialog) {
      const confirmed = window.confirm(
        `${action.confirm_dialog.title}\n\n${action.confirm_dialog.message}`
      );
      if (!confirmed) return;
    }

    const toastMsg = action.on_success?.toast || `${action.label} completed successfully.`;
    showToast(toastMsg);
  };

  const getResourceIcon = (key: string, customIcon?: string) => {
    const k = key.toLowerCase();
    if (k.includes("user")) return <Users size={18} />;
    if (k.includes("refund") || k.includes("payment") || k.includes("order")) return <CreditCard size={18} />;
    if (customIcon) return <Layers size={18} />;
    return <Database size={18} />;
  };

  return (
    <div className="ak-studio">
      {/* Sidebar Navigation */}
      <aside className="ak-sidebar">
        <div className="ak-sidebar-header">
          <div className="ak-brand-icon">
            {config.project.name.charAt(0)}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span className="ak-brand-title">{config.project.name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="ak-brand-badge">Studio</span>
              <span style={{ fontSize: 11, color: "#64748b" }}>v{config.version}</span>
            </div>
          </div>
        </div>

        <nav className="ak-sidebar-nav">
          <div className="ak-nav-section-title">Resources</div>
          {resourceKeys.map((key) => {
            const res = config.resources[key];
            const isActive = key === activeResourceKey;
            return (
              <button
                key={key}
                type="button"
                className={`ak-nav-item ${isActive ? "active" : ""}`}
                onClick={() => setActiveResourceKey(key)}
              >
                {getResourceIcon(key, res.icon)}
                <span>{res.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="ak-sidebar-footer">
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#94a3b8" }}>
            <ShieldCheck size={16} style={{ color: "#22c55e" }} />
            <span>RBAC: Superadmin</span>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="ak-main">
        {/* Top Header */}
        <header className="ak-header">
          <div className="ak-breadcrumbs">
            <span>Admin</span>
            <ChevronRight size={14} style={{ opacity: 0.5 }} />
            <span className="ak-breadcrumbs-active">
              {activeResource?.label || "Workspace"}
            </span>
          </div>

          <div className="ak-header-actions">
            {/* Doctor Diagnostic Badge */}
            <div className="ak-doctor-badge" title="Doctor Console: All schemas in sync">
              <span className="ak-doctor-dot" />
              <span>Doctor: Healthy</span>
            </div>

            {/* Light / Dark Mode Switcher */}
            <button
              type="button"
              className="ak-icon-btn"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="ak-workspace">
          {activeResource ? (
            <>
              <div className="ak-resource-header">
                <div className="ak-resource-title-wrap">
                  <h1 className="ak-resource-title">{activeResource.label}</h1>
                  <span className="ak-resource-endpoint">
                    {config.project.base_url}
                    {activeResource.endpoint}
                  </span>
                </div>
              </div>

              {/* Dynamic TanStack Data Table */}
              <DynamicDataTable
                resource={activeResource}
                data={activeResourceData}
                onExecuteAction={handleActionClick}
                onNavigateRelation={(targetKey) => setActiveResourceKey(targetKey)}
              />
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "64px 20px" }}>
              <Database size={36} style={{ color: "var(--ak-text-muted)", marginBottom: 12 }} />
              <h3>No Resource Selected</h3>
              <p style={{ color: "var(--ak-text-muted)" }}>
                Select a collection from the sidebar to view data tables.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Notification Toast */}
      {toast && (
        <div className="ak-toast">
          <CheckCircle2 size={18} style={{ color: "#22c55e" }} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};
