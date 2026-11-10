import React, { useState } from "react";
import type { ActionConfig } from "@admin-kit-yu/core";
import { DynamicForm } from "../form/DynamicForm";
import { X, AlertTriangle, CheckCircle, Info, Loader2 } from "lucide-react";

export interface ActionExecutionModalProps {
  action: ActionConfig | null;
  row: Record<string, any> | null;
  isOpen: boolean;
  onClose: () => void;
  onExecute: (action: ActionConfig, row: Record<string, any>, payload?: Record<string, any>) => Promise<void> | void;
  primaryKey?: string;
}

/**
 * Replaces route parameters like `{id}` with values from the row record.
 */
function interpolateEndpoint(endpoint: string, row: Record<string, any>, primaryKey: string = "id"): string {
  let url = endpoint;
  const pKeyVal = row[primaryKey] ?? row.id ?? "";
  url = url.replace(/\{id\}/g, String(pKeyVal));
  url = url.replace(new RegExp(`\\{${primaryKey}\\}`, "g"), String(pKeyVal));

  // Also replace any other {field} placeholders present in row
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === "string" || typeof v === "number") {
      url = url.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return url;
}

/**
 * Modal dialog for executing custom RPC actions.
 * Supports both simple confirmation dialogs and dynamic input forms.
 */
export const ActionExecutionModal: React.FC<ActionExecutionModalProps> = ({
  action,
  row,
  isOpen,
  onClose,
  onExecute,
  primaryKey = "id",
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !action || !row) return null;

  const hasInputs = action.inputs && action.inputs.length > 0;
  const targetId = row[primaryKey] ?? row.id ?? "selected record";
  const resolvedEndpoint = interpolateEndpoint(action.api.endpoint, row, primaryKey);

  const getModalIcon = () => {
    if (action.style === "danger") return <AlertTriangle className="ak-modal-icon-danger" size={24} />;
    if (action.style === "success") return <CheckCircle className="ak-modal-icon-success" size={24} />;
    return <Info className="ak-modal-icon-primary" size={24} />;
  };

  const handleSimpleConfirm = async () => {
    try {
      setIsSubmitting(true);
      await onExecute(action, row, {});
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async (formData: Record<string, any>) => {
    try {
      setIsSubmitting(true);
      await onExecute(action, row, formData);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = action.confirm_dialog?.title || `${action.label} Action`;
  const message = action.confirm_dialog?.message;

  return (
    <div className="ak-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="ak-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="ak-modal-header">
          <div className="ak-modal-title-wrap">
            {getModalIcon()}
            <div>
              <h3 className="ak-modal-title">{title}</h3>
              <div className="ak-modal-meta">
                <span>Record: <strong>{String(targetId)}</strong></span>
                <span className="ak-modal-meta-sep">•</span>
                <span className="ak-modal-endpoint-pill">
                  {action.api.method} {resolvedEndpoint}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="ak-icon-btn ak-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="ak-modal-body">
          {message && (
            <p className="ak-modal-description">{message}</p>
          )}

          {hasInputs ? (
            <DynamicForm
              fields={action.inputs || []}
              onSubmit={handleFormSubmit}
              submitLabel={action.confirm_dialog?.confirm_text || action.label}
              cancelLabel={action.confirm_dialog?.cancel_text || "Cancel"}
              onCancel={onClose}
              isLoading={isSubmitting}
            />
          ) : (
            <div className="ak-modal-footer">
              <button
                type="button"
                className="ak-btn ak-btn-secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                {action.confirm_dialog?.cancel_text || "Cancel"}
              </button>
              <button
                type="button"
                className={`ak-btn ak-btn-${action.style || "primary"}`}
                onClick={handleSimpleConfirm}
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 size={15} className="ak-spin" />}
                <span>{action.confirm_dialog?.confirm_text || action.label}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

