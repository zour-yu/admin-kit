import React, { useState } from "react";
import type { ResourceConfig, FormField } from "@admin-kit/core";
import { DynamicForm } from "../form/DynamicForm";
import { X, PlusCircle, Edit3, Trash2, Loader2, AlertTriangle } from "lucide-react";

export type MutationMode = "create" | "edit" | "delete";

export interface MutationFormModalProps {
  mode: MutationMode | null;
  resource: ResourceConfig | null;
  record?: Record<string, any> | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (mode: MutationMode, data: Record<string, any>) => Promise<void> | void;
}

/**
 * Extracts form field definitions from resource configuration or columns.
 */
function resolveMutationFields(
  mode: "create" | "edit",
  resource: ResourceConfig
): FormField[] {
  const mutationConfig =
    mode === "create" ? resource.mutations?.creatable : resource.mutations?.editable;

  if (mutationConfig && typeof mutationConfig === "object" && mutationConfig.fields && mutationConfig.fields.length > 0) {
    return mutationConfig.fields;
  }

  // Fallback: infer form fields from editable/creatable table columns
  const primaryKey = resource.primary_key || "id";
  const columns = resource.table?.columns || [];

  return columns
    .filter((col) => {
      // Don't ask for auto-generated ID on create
      if (mode === "create" && col.key === primaryKey) return false;
      if (col.type === "json") return false;
      return true;
    })
    .map((col) => {
      let formType: any = "text";
      if (col.type === "number" || col.type === "currency") formType = "number";
      if (col.type === "boolean") formType = "boolean";
      if (col.type === "date") formType = "date";
      if (col.type === "datetime") formType = "datetime";
      if (col.type === "badge" && col.badge_map) {
        formType = "select";
      }

      const options =
        col.type === "badge" && col.badge_map
          ? Object.keys(col.badge_map).map((opt) => ({
              label: opt.charAt(0).toUpperCase() + opt.slice(1).replace("_", " "),
              value: opt,
            }))
          : undefined;

      return {
        key: col.key,
        label: col.label,
        type: formType,
        required: mode === "create",
        placeholder: `Enter ${col.label.toLowerCase()}...`,
        options,
      };
    });
}

/**
 * Modal handling standard CRUD mutations (Create, Edit, Delete).
 */
export const MutationFormModal: React.FC<MutationFormModalProps> = ({
  mode,
  resource,
  record,
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !mode || !resource) return null;

  const primaryKey = resource.primary_key || "id";
  const recordId = record ? record[primaryKey] ?? record.id : null;

  const isDelete = mode === "delete";
  const isCreate = mode === "create";
  const isEdit = mode === "edit";

  const fields = isDelete ? [] : resolveMutationFields(mode, resource);

  const getHeaderIcon = () => {
    if (isDelete) return <Trash2 className="ak-modal-icon-danger" size={22} />;
    if (isCreate) return <PlusCircle className="ak-modal-icon-primary" size={22} />;
    return <Edit3 className="ak-modal-icon-primary" size={22} />;
  };

  const getTitle = () => {
    if (isDelete) return `Delete ${resource.label}?`;
    if (isCreate) return `Create New ${resource.label.replace(/s$/, "")}`;
    return `Edit ${resource.label.replace(/s$/, "")} (${recordId})`;
  };

  const handleDeleteConfirm = async () => {
    try {
      setIsSubmitting(true);
      await onSubmit("delete", record || {});
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async (formData: Record<string, any>) => {
    try {
      setIsSubmitting(true);
      await onSubmit(mode, formData);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ak-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="ak-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ak-modal-header">
          <div className="ak-modal-title-wrap">
            {getHeaderIcon()}
            <div>
              <h3 className="ak-modal-title">{getTitle()}</h3>
              <div className="ak-modal-meta">
                <span>Resource: <strong>{resource.label}</strong></span>
                {recordId && (
                  <>
                    <span className="ak-modal-meta-sep">•</span>
                    <span>ID: <strong>{String(recordId)}</strong></span>
                  </>
                )}
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

        {/* Body */}
        <div className="ak-modal-body">
          {isDelete ? (
            <div>
              <div className="ak-delete-warning">
                <AlertTriangle size={20} className="ak-modal-icon-danger" />
                <p style={{ margin: 0, fontSize: 14 }}>
                  Are you sure you want to permanently delete this record? This action cannot be undone.
                </p>
              </div>

              <div className="ak-modal-footer" style={{ marginTop: 24 }}>
                <button
                  type="button"
                  className="ak-btn ak-btn-secondary"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="ak-btn ak-btn-danger"
                  onClick={handleDeleteConfirm}
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 size={15} className="ak-spin" />}
                  <span>Delete Record</span>
                </button>
              </div>
            </div>
          ) : (
            <DynamicForm
              fields={fields}
              defaultValues={isEdit ? record || {} : {}}
              onSubmit={handleFormSubmit}
              submitLabel={isCreate ? "Create Record" : "Save Changes"}
              cancelLabel="Cancel"
              onCancel={onClose}
              isLoading={isSubmitting}
            />
          )}
        </div>
      </div>
    </div>
  );
};

