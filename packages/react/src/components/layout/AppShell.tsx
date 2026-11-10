import React, { useState, useEffect, useMemo } from "react";
import { useConfig } from "../../context/ConfigContext";
import { DynamicDataTable } from "../table/DynamicDataTable";
import { ActionExecutionModal } from "../modals/ActionExecutionModal";
import { RecordDetailDrawer } from "../drawer/RecordDetailDrawer";
import { DoctorConsoleDrawer } from "../drawer/DoctorConsoleDrawer";
import type { ActionConfig } from "@admin-kit-yu/core";
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
  Activity,
} from "lucide-react";

export interface AppShellProps {
  data?: Record<string, any[]>;
  onExecuteAction?: (action: ActionConfig, row: any, payload?: Record<string, any>) => void | Promise<void>;
}

/**
 * Provides default preview records when custom data is not supplied.
 */
function getInitialSampleData(key: string): any[] {
  const k = key.toLowerCase();
  if (k.includes("user")) {
    return [
      { id: "usr_101", email: "alex.turner@acme.com", role: "admin", created_at: "2024-01-15T09:30:00Z" },
      { id: "usr_102", email: "sarah.connor@acme.com", role: "user", created_at: "2024-02-20T14:15:00Z" },
      { id: "usr_103", email: "david.beck@acme.com", role: "user", created_at: "2024-03-05T11:45:00Z" },
      { id: "usr_104", email: "elena.rostova@acme.com", role: "user", created_at: "2024-03-18T16:20:00Z" },
      { id: "usr_105", email: "marcus.aurelius@acme.com", role: "admin", created_at: "2024-04-01T08:00:00Z" },
    ];
  }
  if (k.includes("refund")) {
    return [
      { id: "ref_801", user_id: "alex.turner@acme.com", amount: 149.99, status: "pending" },
      { id: "ref_802", user_id: "sarah.connor@acme.com", amount: 49.50, status: "pending" },
      { id: "ref_803", user_id: "david.beck@acme.com", amount: 299.00, status: "approved" },
      { id: "ref_804", user_id: "elena.rostova@acme.com", amount: 89.20, status: "rejected" },
      { id: "ref_805", user_id: "marcus.aurelius@acme.com", amount: 520.00, status: "pending" },
    ];
  }
  return [
    { id: "rec_001", name: "Sample Item 1", status: "active" },
    { id: "rec_002", name: "Sample Item 2", status: "pending" },
  ];
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
    simulatedRole,
    setSimulatedRole,
    checkAccess,
    isSuperadmin,
    isDoctorOpen,
    setIsDoctorOpen,
  } = useConfig();

  // Internal reactive dataset supporting real-time mutations & actions
  const [localData, setLocalData] = useState<Record<string, any[]>>(() => data || {});

  // Custom RPC Action modal state
  const [activeAction, setActiveAction] = useState<ActionConfig | null>(null);
  const [activeRow, setActiveRow] = useState<any | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);

  // Record Detail Drawer state
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  // Sync external data changes
  useEffect(() => {
    if (data) {
      setLocalData(data);
    }
  }, [data]);

  // Pre-calculate diagnostic issue count across schema definitions
  const diagnosticCount = useMemo(() => {
    if (!config?.resources) return 0;
    let count = 0;
    for (const res of Object.values(config.resources)) {
      if (!res.endpoint || !res.endpoint.startsWith("/")) count++;
      for (const act of res.actions || []) {
        if (!act.api?.endpoint) count++;
      }
    }
    return count;
  }, [config]);

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

  // RBAC Filtering for Navigation Sidebar
  const permittedResourceKeys = resourceKeys.filter((key) => {
    const res = config.resources[key];
    if (res.access) {
      return checkAccess(res.access);
    }
    return true;
  });

  const activeResourceData = localData[activeResourceKey] ?? getInitialSampleData(activeResourceKey);

  /**
   * Action trigger handler called when a row action button is clicked.
   */
  const handleActionClick = (action: ActionConfig, row: any) => {
    const hasInputs = action.inputs && action.inputs.length > 0;
    const hasDialog = Boolean(action.confirm_dialog);

    // If inputs or confirm_dialog are defined, prompt via ActionExecutionModal
    if (hasInputs || hasDialog) {
      setActiveAction(action);
      setActiveRow(row);
      setIsActionModalOpen(true);
      return;
    }

    // Otherwise, execute immediately
    executeAction(action, row);
  };

  /**
   * Dispatches the action, logs the mock payload, and updates row state.
   */
  const executeAction = async (action: ActionConfig, row: any, payload?: Record<string, any>) => {
    const pKey = activeResource?.primary_key || "id";
    const resolvedEndpoint = action.api.endpoint
      .replace(/\{id\}/g, String(row[pKey] ?? row.id ?? ""))
      .replace(new RegExp(`\\{${pKey}\\}`, "g"), String(row[pKey] ?? row.id ?? ""));

    console.log(`[admin-kit] Action dispatched: [${action.api.method}] ${resolvedEndpoint}`, {
      actionName: action.name,
      recordId: row[pKey] ?? row.id,
      payload: payload || {},
      row,
    });

    if (onExecuteAction) {
      await onExecuteAction(action, row, payload);
    } else {
      // Optimistic local state update in preview mode
      setLocalData((prev) => {
        const currentList = prev[activeResourceKey] ?? getInitialSampleData(activeResourceKey);
        const updatedList = currentList.map((item) => {
          if (item[pKey] === row[pKey]) {
            const updated = { ...item, ...payload };
            if (action.name.toLowerCase().includes("approve")) {
              updated.status = "approved";
            } else if (action.name.toLowerCase().includes("reject")) {
              updated.status = "rejected";
            }
            return updated;
          }
          return item;
        });
        return { ...prev, [activeResourceKey]: updatedList };
      });

      // Also update selectedRecord if detail drawer is open
      if (selectedRecord && selectedRecord[pKey] === row[pKey]) {
        setSelectedRecord((prev: any) => {
          if (!prev) return prev;
          const updated = { ...prev, ...payload };
          if (action.name.toLowerCase().includes("approve")) updated.status = "approved";
          if (action.name.toLowerCase().includes("reject")) updated.status = "rejected";
          return updated;
        });
      }
    }

    const toastMsg = action.on_success?.toast || `${action.label} completed successfully.`;
    showToast(toastMsg);
  };

  const handleRowClick = (row: any) => {
    setSelectedRecord(row);
    setIsDetailDrawerOpen(true);
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
          {permittedResourceKeys.map((key) => {
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

        {/* Sidebar Footer with Simulated RBAC Role Pill */}
        <div
          className="ak-sidebar-footer"
          onClick={() => setIsDoctorOpen(true)}
          style={{ cursor: "pointer" }}
          title="Click to open RBAC Role Simulator & Doctor Console"
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#94a3b8" }}>
            <ShieldCheck size={16} style={{ color: isSuperadmin ? "#22c55e" : "var(--ak-primary)" }} />
            <span>RBAC: <strong style={{ color: "#f8fafc" }}>{simulatedRole.toUpperCase()}</strong></span>
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
            {/* Interactive Doctor Diagnostic Badge */}
            <div
              className="ak-doctor-badge"
              onClick={() => setIsDoctorOpen(true)}
              style={{ cursor: "pointer" }}
              title="Click to inspect schema drift, missing badges/routes, and simulate roles"
            >
              <Activity size={14} className={diagnosticCount > 0 ? "ak-doctor-pulse-icon" : ""} style={{ color: diagnosticCount > 0 ? "#eab308" : "#22c55e" }} />
              <span className="ak-doctor-dot" style={{ backgroundColor: diagnosticCount > 0 ? "#eab308" : "#22c55e" }} />
              <span>Doctor: {diagnosticCount === 0 ? "Healthy" : `${diagnosticCount} Issues`}</span>
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

              {/* Dynamic TanStack Data Table with RBAC and Row Click */}
              <DynamicDataTable
                resource={activeResource}
                data={activeResourceData}
                onExecuteAction={handleActionClick}
                onNavigateRelation={(targetKey) => setActiveResourceKey(targetKey)}
                onSelectRow={handleRowClick}
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

      {/* Custom Action Execution Modal */}
      <ActionExecutionModal
        action={activeAction}
        row={activeRow}
        isOpen={isActionModalOpen}
        onClose={() => {
          setIsActionModalOpen(false);
          setActiveAction(null);
          setActiveRow(null);
        }}
        onExecute={executeAction}
        primaryKey={activeResource?.primary_key || "id"}
      />

      {/* Record Detail Drawer */}
      <RecordDetailDrawer
        resource={activeResource}
        record={selectedRecord}
        isOpen={isDetailDrawerOpen}
        onClose={() => {
          setIsDetailDrawerOpen(false);
          setSelectedRecord(null);
        }}
        onExecuteAction={handleActionClick}
        onNavigateRelation={(targetKey) => {
          setIsDetailDrawerOpen(false);
          setActiveResourceKey(targetKey);
        }}
      />

      {/* In-App Diagnostic Doctor Console & RBAC Simulator Drawer */}
      <DoctorConsoleDrawer
        isOpen={isDoctorOpen}
        onClose={() => setIsDoctorOpen(false)}
        config={config}
        activeResourceKey={activeResourceKey}
        data={localData}
        simulatedRole={simulatedRole}
        onSelectSimulatedRole={setSimulatedRole}
      />

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
