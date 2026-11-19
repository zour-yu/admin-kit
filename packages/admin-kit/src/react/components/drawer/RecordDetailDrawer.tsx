import React, { useState, useEffect } from "react";
import type { ResourceConfig, ActionConfig, SubResourceConfig } from "../../../core";
import { evaluateExpression } from "../../../core";
import { useConfig } from "../../context/ConfigContext";
import { CellRenderer } from "../table/CellRenderer";
import { X, Copy, Check, Code, Layers, FileText, Plus, Loader2 } from "lucide-react";

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
 * relational sub-resources (e.g. notes, evidence), raw JSON inspector, and record-level actions.
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
  const { adminClient, activeResourceKey, showToast } = useConfig();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("fields"); // "fields" | "json" | subResourceId

  // Sub-resource state
  const [subResourceData, setSubResourceData] = useState<Record<string, any[]>>({});
  const [isLoadingSubResource, setIsLoadingSubResource] = useState<boolean>(false);
  const [newSubItemText, setNewSubItemText] = useState<string>("");
  const [isAddingSubItem, setIsAddingSubItem] = useState<boolean>(false);

  // Reset tab and draft state when record changes
  useEffect(() => {
    setActiveTab("fields");
    setSubResourceData({});
    setNewSubItemText("");
  }, [record]);

  if (!isOpen || !resource || !record) return null;

  const primaryKey = resource.primary_key || "id";
  const recordId = record[primaryKey] ?? record.id ?? record._id ?? "Record Details";
  const columns = resource.table?.columns || [];
  const subResources: SubResourceConfig[] = resource.sub_resources || [];

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

  // Fetch sub-resource records when sub-resource tab is active
  useEffect(() => {
    if (activeTab === "fields" || activeTab === "json" || !recordId || !adminClient) return;
    const subRes = subResources.find((sr) => sr.id === activeTab);
    if (!subRes) return;

    let isMounted = true;
    setIsLoadingSubResource(true);

    adminClient
      .fetchSubResourceList(activeResourceKey, subRes.id, String(recordId))
      .then((res) => {
        if (isMounted) {
          setSubResourceData((prev) => ({ ...prev, [subRes.id]: res.data || [] }));
        }
      })
      .catch((err) => {
        console.warn(`[admin-kit] Failed to load sub-resource ${subRes.id}:`, err);
        if (isMounted) {
          setSubResourceData((prev) => {
            if (prev[subRes.id]?.length) return prev;
            return {
              ...prev,
              [subRes.id]: [
                {
                  id: `${subRes.id}_01`,
                  content: `Initial sample ${subRes.label.toLowerCase()} record.`,
                  created_at: new Date().toISOString(),
                },
              ],
            };
          });
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingSubResource(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab, recordId, adminClient, activeResourceKey, subResources]);

  const activeSubResource = subResources.find((sr) => sr.id === activeTab);
  const activeSubItems = activeSubResource ? subResourceData[activeSubResource.id] || [] : [];

  const handleAddSubItem = async () => {
    if (!activeSubResource || !newSubItemText.trim() || !adminClient) return;
    setIsAddingSubItem(true);
    try {
      const endpointTemplate = activeSubResource.create_endpoint || activeSubResource.endpoint;
      const targetEndpoint = adminClient.interpolateEndpoint(endpointTemplate, {
        id: recordId,
        [primaryKey]: recordId,
        _id: recordId,
      });
      const fullUrl = adminClient.resolveUrl(targetEndpoint);

      await (adminClient as any).fetchFn(fullUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newSubItemText.trim(),
          note: newSubItemText.trim(),
          description: newSubItemText.trim(),
        }),
      });

      showToast(`${activeSubResource.label} item added successfully.`);
      setNewSubItemText("");

      const refreshed = await adminClient.fetchSubResourceList(activeResourceKey, activeSubResource.id, String(recordId));
      setSubResourceData((prev) => ({ ...prev, [activeSubResource.id]: refreshed.data || [] }));
    } catch (err: any) {
      console.warn(`[admin-kit] Action to add sub-resource item failed:`, err);
      // Fallback local optimistic add
      setSubResourceData((prev) => ({
        ...prev,
        [activeSubResource.id]: [
          ...(prev[activeSubResource.id] || []),
          {
            id: `local_${Date.now()}`,
            content: newSubItemText.trim(),
            created_at: new Date().toISOString(),
          },
        ],
      }));
      setNewSubItemText("");
      showToast(`Added to local preview: ${err.message || "Offline"}`);
    } finally {
      setIsAddingSubItem(false);
    }
  };

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
              className={`ak-btn ak-btn-secondary ${activeTab === "json" ? "active" : ""}`}
              onClick={() => setActiveTab(activeTab === "json" ? "fields" : "json")}
              title="Toggle JSON view"
            >
              <Code size={14} />
              <span>{activeTab === "json" ? "Fields" : "JSON"}</span>
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

        {/* Tab Navigation for Relational Sub-Resources */}
        {subResources.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "10px 20px",
              borderBottom: "1px solid var(--ak-border)",
              backgroundColor: "var(--ak-surface-alt)",
              overflowX: "auto",
            }}
          >
            <button
              type="button"
              className={`ak-btn ${activeTab === "fields" ? "ak-btn-primary" : "ak-btn-secondary"}`}
              style={{ fontSize: 12, padding: "5px 12px" }}
              onClick={() => setActiveTab("fields")}
            >
              Fields
            </button>
            {subResources.map((subRes) => (
              <button
                key={subRes.id}
                type="button"
                className={`ak-btn ${activeTab === subRes.id ? "ak-btn-primary" : "ak-btn-secondary"}`}
                style={{ fontSize: 12, padding: "5px 12px" }}
                onClick={() => setActiveTab(subRes.id)}
              >
                {subRes.label}
              </button>
            ))}
            <button
              type="button"
              className={`ak-btn ${activeTab === "json" ? "ak-btn-primary" : "ak-btn-secondary"}`}
              style={{ fontSize: 12, padding: "5px 12px" }}
              onClick={() => setActiveTab("json")}
            >
              Raw JSON
            </button>
          </div>
        )}

        {/* Drawer Body */}
        <div className="ak-drawer-body">
          {activeTab === "json" ? (
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
          ) : activeTab === "fields" ? (
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
          ) : (
            /* Relational Sub-Resource Detail Tab */
            <div className="ak-subresource-view">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600 }}>
                  {activeSubResource?.label} for #{String(recordId)}
                </h3>
                <span style={{ fontSize: 12, color: "var(--ak-text-muted)" }}>
                  {activeSubItems.length} {activeSubItems.length === 1 ? "entry" : "entries"}
                </span>
              </div>

              {isLoadingSubResource ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--ak-text-muted)" }}>
                  <Loader2 size={24} className="ak-spin" style={{ margin: "0 auto 8px" }} />
                  <p style={{ fontSize: 13 }}>Loading {activeSubResource?.label.toLowerCase()}...</p>
                </div>
              ) : activeSubItems.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 16px", background: "var(--ak-surface-alt)", borderRadius: 8 }}>
                  <FileText size={28} style={{ color: "var(--ak-text-muted)", margin: "0 auto 8px" }} />
                  <p style={{ fontSize: 13, color: "var(--ak-text-muted)", margin: 0 }}>
                    No {activeSubResource?.label.toLowerCase()} recorded yet for this item.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {activeSubItems.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      style={{
                        padding: "12px 14px",
                        borderRadius: 8,
                        background: "var(--ak-surface-alt)",
                        border: "1px solid var(--ak-border)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ak-primary)" }}>
                          #{item.id || item._id || idx + 1}
                        </span>
                        {item.created_at && (
                          <span style={{ fontSize: 11, color: "var(--ak-text-muted)" }}>
                            {new Date(item.created_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 13, margin: 0, whiteSpace: "pre-wrap" }}>
                        {item.content || item.note || item.text || item.description || item.title || JSON.stringify(item)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Sub-Resource Item Input */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--ak-border)" }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Add {activeSubResource?.label}
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    className="ak-form-input"
                    placeholder={`Enter new ${activeSubResource?.label.toLowerCase()} note or entry...`}
                    value={newSubItemText}
                    onChange={(e) => setNewSubItemText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAddSubItem();
                      }
                    }}
                    disabled={isAddingSubItem}
                  />
                  <button
                    type="button"
                    className="ak-btn ak-btn-primary"
                    disabled={isAddingSubItem || !newSubItemText.trim()}
                    onClick={handleAddSubItem}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}
                  >
                    {isAddingSubItem ? <Loader2 size={14} className="ak-spin" /> : <Plus size={14} />}
                    <span>Add</span>
                  </button>
                </div>
              </div>
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
