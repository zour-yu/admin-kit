import React from "react";
import type { ResourceConfig, ActionConfig } from "@admin-kit-yu/core";
import { evaluateExpression } from "@admin-kit-yu/core";
import { CellRenderer } from "../table/CellRenderer";
import { X, Copy, Check, Code, Layers } from "lucide-react";

export interface RecordDetailDrawerProps {
  resource: ResourceConfig | null;
  record: Record<string, any> | null;
  isOpen: boolean;
  onClose: () => void;
  onExecuteAction?: (action: ActionConfig, record: Record<string, any>) => void;
  onEdit?: (record: Record<string, any>) => void;
  onDelete?: (record: Record<string, any>) => void;
  onNavigateRelation?: (targetResource: string, recordId: string) => void;
}

/**
 * Slide-over drawer displaying comprehensive record details,
 * relations, raw JSON inspector, and record-level actions.
 */
export const RecordDetailDrawer: React.FC<RecordDetailDrawerProps> = ({
  resource,
  record,
  isOpen,
  onClose,
  onExecuteAction,
  onEdit,
  onDelete,
  onNavigateRelation,
}) => {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [showRawJson, setShowRawJson] = React.useState(false);

  if (!isOpen || !resource || !record) return null;

  const primaryKey = resource.primary_key || "id";
  const recordId = record[primaryKey] ?? record.id ?? "Record Details";
  const columns = resource.table?.columns || [];

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const permittedActions = (resource.actions || []).filter((action) => {
    if (action.scope !== "row") return false;
    if (action.visible_if) {
      return evaluateExpression(action.visible_if, { row: record });
    }
    return true;
  });

  return (
    <div className="ak-drawer-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="ak-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="ak-drawer-header">
          <div className="ak-drawer-title-wrap">
            <span className="ak-drawer-badge">{resource.label}</span>
            <h2 className="ak-drawer-title">{String(recordId)}</h2>
          </div>
          <div className="ak-drawer-header-actions">
            <button
              type="button"
              className={`ak-btn ak-btn-secondary ${showRawJson ? "active" : ""}`}
              onClick={() => setShowRawJson(!showRawJson)}
              title="Toggle JSON view"
            >
              <Code size={14} />
              <span>{showRawJson ? "Fields" : "JSON"}</span>
            </button>
            <button
              type="button"
              className="ak-icon-btn"
              onClick={onClose}
              aria-label="Close drawer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="ak-drawer-body">
          {showRawJson ? (
            <div className="ak-json-view">
              <div className="ak-json-header">
                <span>Raw Record JSON</span>
                <button
                  type="button"
                  className="ak-btn ak-btn-secondary ak-btn-sm"
                  onClick={() => handleCopy(JSON.stringify(record, null, 2), "raw_json")}
                >
                  {copiedKey === "raw_json" ? <Check size={13} style={{ color: "#22c55e" }} /> : <Copy size={13} />}
                  <span>{copiedKey === "raw_json" ? "Copied" : "Copy JSON"}</span>
                </button>
              </div>
              <pre className="ak-json-code">{JSON.stringify(record, null, 2)}</pre>
            </div>
          ) : (
            <div className="ak-drawer-fields-list">
              {columns.map((col) => {
                const val = record[col.key];
                return (
                  <div key={col.key} className="ak-drawer-field-item">
                    <div className="ak-drawer-field-label">
                      <span>{col.label}</span>
                      <span className="ak-drawer-field-type">{col.type}</span>
                    </div>
                    <div className="ak-drawer-field-value">
                      <CellRenderer
                        value={val}
                        column={col}
                        row={record}
                        onNavigateRelation={onNavigateRelation}
                      />
                    </div>
                  </div>
                );
              })}

              {/* Display any extra attributes from record not defined in columns */}
              {Object.keys(record)
                .filter((k) => !columns.some((c) => c.key === k))
                .map((extraKey) => (
                  <div key={extraKey} className="ak-drawer-field-item">
                    <div className="ak-drawer-field-label">
                      <span>{extraKey}</span>
                      <span className="ak-drawer-field-type">extra</span>
                    </div>
                    <div className="ak-drawer-field-value">
                      <span style={{ fontFamily: "monospace", fontSize: 13 }}>
                        {typeof record[extraKey] === "object"
                          ? JSON.stringify(record[extraKey])
                          : String(record[extraKey])}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Drawer Footer with Actions */}
        {(permittedActions.length > 0 || onEdit || onDelete) && (
          <div className="ak-drawer-footer">
            <div className="ak-drawer-actions-label">
              <Layers size={14} />
              <span>Actions</span>
            </div>
            <div className="ak-drawer-actions-group">
              {onEdit && (
                <button
                  type="button"
                  className="ak-btn ak-btn-secondary"
                  onClick={() => onEdit(record)}
                >
                  Edit Record
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  className="ak-btn ak-btn-danger"
                  onClick={() => onDelete(record)}
                >
                  Delete
                </button>
              )}
              {permittedActions.map((action) => (
                <button
                  key={action.name}
                  type="button"
                  className={`ak-btn ak-btn-${action.style || "primary"}`}
                  onClick={() => onExecuteAction && onExecuteAction(action, record)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

