import React, { useMemo } from "react";
import type { AdminKitConfig } from "@admin-kit/core";
import {
  X,
  Shield,
  Activity,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Sparkles,
} from "lucide-react";

export interface DoctorConsoleDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  config: AdminKitConfig;
  activeResourceKey: string;
  data: Record<string, any[]>;
  simulatedRole: string;
  onSelectSimulatedRole: (role: string) => void;
}

export interface DiagnosticIssue {
  id: string;
  type: "warning" | "error" | "info";
  category: "Contract Drift" | "Unmapped Badge" | "RBAC Simulation";
  message: string;
  detail?: string;
}

/**
 * Slide-over developer diagnostic drawer providing real-time contract inspection,
 * badge map verification, and interactive RBAC role simulation.
 */
export const DoctorConsoleDrawer: React.FC<DoctorConsoleDrawerProps> = ({
  isOpen,
  onClose,
  config,
  activeResourceKey,
  data,
  simulatedRole,
  onSelectSimulatedRole,
}) => {
  const activeResource = config.resources[activeResourceKey];
  const activeRows = data[activeResourceKey] || [];

  // Extract all distinct roles referenced across the entire configuration
  const availableRoles = useMemo(() => {
    const rolesSet = new Set<string>();
    for (const r of config.access?.superadmin_roles || ["superadmin"]) {
      rolesSet.add(r);
    }
    rolesSet.add("admin");
    rolesSet.add("user");
    rolesSet.add("support");
    rolesSet.add("viewer");

    for (const res of Object.values(config.resources || {})) {
      if (res.access?.roles) {
        for (const role of res.access.roles) rolesSet.add(role);
      }
      for (const act of res.actions || []) {
        if (act.access?.roles) {
          for (const role of act.access.roles) rolesSet.add(role);
        }
      }
    }
    return Array.from(rolesSet);
  }, [config]);

  // Run real-time diagnostic checks on active resource
  const diagnosticIssues = useMemo<DiagnosticIssue[]>(() => {
    const issues: DiagnosticIssue[] = [];
    if (!activeResource) return issues;

    const columns = activeResource.table?.columns || [];
    const firstRow = activeRows[0];

    // 1. Contract & Schema Drift Check
    if (firstRow && columns.length > 0) {
      for (const col of columns) {
        if (!(col.key in firstRow)) {
          issues.push({
            id: `missing-key-${col.key}`,
            type: "warning",
            category: "Contract Drift",
            message: `Column "${col.key}" is declared in schema but missing in API data.`,
            detail: `Endpoint: ${activeResource.endpoint}`,
          });
        }
      }
    }

    // 2. Unmapped Badge Check
    const badgeCols = columns.filter((c) => c.type === "badge" && c.badge_map);
    for (const col of badgeCols) {
      const badgeMap = col.badge_map || {};
      for (const row of activeRows) {
        const val = row[col.key];
        if (val !== undefined && val !== null && !(val in badgeMap)) {
          issues.push({
            id: `unmapped-badge-${col.key}-${val}`,
            type: "warning",
            category: "Unmapped Badge",
            message: `Value "${val}" in column "${col.key}" has no color in badge_map.`,
            detail: `Rendering fallback gray pill.`,
          });
          break; // Avoid spamming duplicates
        }
      }
    }

    return issues;
  }, [activeResource, activeRows]);

  if (!isOpen) return null;

  return (
    <div className="ak-drawer-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="ak-drawer ak-doctor-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ak-drawer-header">
          <div className="ak-drawer-title-wrap">
            <div className="ak-doctor-header-pill">
              <Activity size={16} className="ak-doctor-pulse-icon" />
              <span>Diagnostic Console</span>
            </div>
            <h2 className="ak-drawer-title">Doctor</h2>
          </div>
          <button
            type="button"
            className="ak-icon-btn"
            onClick={onClose}
            aria-label="Close Doctor"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="ak-drawer-body">
          {/* Section 1: RBAC Role Simulator */}
          <div className="ak-doctor-card">
            <div className="ak-doctor-card-header">
              <Shield size={16} style={{ color: "var(--ak-primary)" }} />
              <span className="ak-doctor-card-title">RBAC Role Simulator</span>
            </div>
            <p className="ak-doctor-card-desc">
              Test presentation gates without re-authenticating. Dynamically tests visibility for
              sidebar navigation, action buttons, and sensitive columns.
            </p>

            <div className="ak-form-group" style={{ marginTop: 12 }}>
              <label className="ak-form-label" htmlFor="role-simulator-select">
                Active Simulated Role:
              </label>
              <select
                id="role-simulator-select"
                className="ak-select ak-form-input"
                value={simulatedRole}
                onChange={(e) => onSelectSimulatedRole(e.target.value)}
              >
                {availableRoles.map((role) => (
                  <option key={role} value={role}>
                    {role.toUpperCase()} {config.access?.superadmin_roles?.includes(role) ? "(Superadmin)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 2: Real-Time Diagnostic Health */}
          <div className="ak-doctor-card" style={{ marginTop: 16 }}>
            <div className="ak-doctor-card-header">
              {diagnosticIssues.length === 0 ? (
                <CheckCircle2 size={16} style={{ color: "#22c55e" }} />
              ) : (
                <AlertTriangle size={16} style={{ color: "#eab308" }} />
              )}
              <span className="ak-doctor-card-title">
                Contract Health ({activeResource?.label || activeResourceKey})
              </span>
            </div>

            {diagnosticIssues.length === 0 ? (
              <div className="ak-doctor-healthy-state">
                <Sparkles size={20} style={{ color: "#22c55e", marginBottom: 8 }} />
                <strong>All Contracts in Sync</strong>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ak-text-secondary)" }}>
                  All table columns match payload data keys, badge enums are fully mapped, and routes are reachable.
                </p>
              </div>
            ) : (
              <div className="ak-doctor-issues-list">
                {diagnosticIssues.map((issue) => (
                  <div key={issue.id} className="ak-doctor-issue-item">
                    <div className="ak-doctor-issue-header">
                      <span className="ak-doctor-issue-tag">{issue.category}</span>
                      <span className="ak-doctor-issue-level">{issue.type}</span>
                    </div>
                    <p className="ak-doctor-issue-message">{issue.message}</p>
                    {issue.detail && (
                      <span className="ak-doctor-issue-detail">{issue.detail}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Active Resource Contract Metadata */}
          {activeResource && (
            <div className="ak-doctor-card" style={{ marginTop: 16 }}>
              <div className="ak-doctor-card-header">
                <FileCode size={16} style={{ color: "var(--ak-primary)" }} />
                <span className="ak-doctor-card-title">Resource Contract Metadata</span>
              </div>
              <div className="ak-doctor-meta-grid">
                <div className="ak-doctor-meta-item">
                  <span className="ak-doctor-meta-k">Endpoint:</span>
                  <span className="ak-doctor-meta-v">{activeResource.endpoint}</span>
                </div>
                <div className="ak-doctor-meta-item">
                  <span className="ak-doctor-meta-k">Primary Key:</span>
                  <span className="ak-doctor-meta-v">{activeResource.primary_key || "id"}</span>
                </div>
                <div className="ak-doctor-meta-item">
                  <span className="ak-doctor-meta-k">Columns Count:</span>
                  <span className="ak-doctor-meta-v">{activeResource.table?.columns.length || 0}</span>
                </div>
                <div className="ak-doctor-meta-item">
                  <span className="ak-doctor-meta-k">Custom Actions:</span>
                  <span className="ak-doctor-meta-v">{activeResource.actions?.length || 0}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

