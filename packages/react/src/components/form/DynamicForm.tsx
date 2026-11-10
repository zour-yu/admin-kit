import React from "react";
import { useForm, type SubmitHandler, type FieldValues } from "react-hook-form";
import type { FormField, FormFieldOption } from "@admin-kit/core";
import { Loader2 } from "lucide-react";

export interface DynamicFormProps {
  fields: FormField[];
  defaultValues?: Record<string, any>;
  onSubmit: (data: Record<string, any>) => void | Promise<void>;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  isLoading?: boolean;
  className?: string;
}

/**
 * Normalizes options into standard { label, value } pairs.
 */
function normalizeOption(option: FormFieldOption): { label: string; value: string | number } {
  if (typeof option === "string") {
    return { label: option, value: option };
  }
  return {
    label: option.label,
    value: typeof option.value === "boolean" ? String(option.value) : option.value,
  };
}

/**
 * Reusable dynamic form engine powered by React Hook Form.
 * Automatically generates validated inputs based on FormField definitions.
 */
export const DynamicForm: React.FC<DynamicFormProps> = ({
  fields,
  defaultValues = {},
  onSubmit,
  submitLabel = "Submit",
  cancelLabel = "Cancel",
  onCancel,
  isLoading = false,
  className = "",
}) => {
  // Pre-populate initial form values
  const initialValues = React.useMemo(() => {
    const vals: Record<string, any> = { ...defaultValues };
    for (const field of fields) {
      if (vals[field.key] === undefined && field.default_value !== undefined) {
        vals[field.key] = field.default_value;
      }
    }
    return vals;
  }, [fields, defaultValues]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FieldValues>({
    defaultValues: initialValues,
  });

  const handleFormSubmit: SubmitHandler<FieldValues> = async (formData) => {
    // Convert numeric fields from strings to numbers
    const processed: Record<string, any> = {};
    for (const field of fields) {
      const rawVal = formData[field.key];
      if (field.type === "number") {
        processed[field.key] = rawVal === "" || rawVal === undefined ? undefined : Number(rawVal);
      } else if (field.type === "boolean") {
        processed[field.key] = Boolean(rawVal);
      } else {
        processed[field.key] = rawVal;
      }
    }
    await onSubmit(processed);
  };

  const isBusy = isLoading || isSubmitting;

  return (
    <form className={`ak-dynamic-form ${className}`} onSubmit={handleSubmit(handleFormSubmit)}>
      <div className="ak-form-fields">
        {fields.map((field) => {
          const error = errors[field.key];
          const errorMsg = error?.message as string | undefined;

          // Validation rules for react-hook-form
          const rules: Record<string, any> = {};
          if (field.required) {
            rules.required = `${field.label} is required`;
          }
          if (field.min !== undefined) {
            rules.min = {
              value: field.min,
              message: `${field.label} must be at least ${field.min}`,
            };
          }
          if (field.max !== undefined) {
            rules.max = {
              value: field.max,
              message: `${field.label} must be at most ${field.max}`,
            };
          }
          if (field.regex) {
            try {
              rules.pattern = {
                value: new RegExp(field.regex),
                message: `${field.label} has an invalid format`,
              };
            } catch {
              // Ignore invalid regex patterns safely
            }
          }

          return (
            <div key={field.key} className="ak-form-group">
              <label htmlFor={`field-${field.key}`} className="ak-form-label">
                <span>{field.label}</span>
                {field.required && <span className="ak-form-required">*</span>}
              </label>

              {/* Render input element based on field type */}
              {field.type === "select" ? (
                <select
                  id={`field-${field.key}`}
                  className={`ak-select ak-form-input ${error ? "ak-input-error" : ""}`}
                  {...register(field.key, rules)}
                  disabled={isBusy}
                >
                  <option value="">{field.placeholder || `Select ${field.label}...`}</option>
                  {(field.options || []).map((opt, i) => {
                    const normalized = normalizeOption(opt);
                    return (
                      <option key={`${normalized.value}-${i}`} value={normalized.value}>
                        {normalized.label}
                      </option>
                    );
                  })}
                </select>
              ) : field.type === "textarea" ? (
                <textarea
                  id={`field-${field.key}`}
                  rows={3}
                  className={`ak-form-textarea ${error ? "ak-input-error" : ""}`}
                  placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                  {...register(field.key, rules)}
                  disabled={isBusy}
                />
              ) : field.type === "boolean" ? (
                <div className="ak-form-checkbox-wrapper">
                  <input
                    type="checkbox"
                    id={`field-${field.key}`}
                    className="ak-form-checkbox"
                    {...register(field.key, rules)}
                    disabled={isBusy}
                  />
                  <span className="ak-form-checkbox-label">
                    {field.placeholder || `Enable ${field.label}`}
                  </span>
                </div>
              ) : (
                <input
                  id={`field-${field.key}`}
                  type={
                    field.type === "number"
                      ? "number"
                      : field.type === "date"
                      ? "date"
                      : field.type === "datetime"
                      ? "datetime-local"
                      : "text"
                  }
                  step={field.type === "number" ? "any" : undefined}
                  className={`ak-form-input ${error ? "ak-input-error" : ""}`}
                  placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                  {...register(field.key, rules)}
                  disabled={isBusy}
                />
              )}

              {errorMsg && <div className="ak-form-error">{errorMsg}</div>}
            </div>
          );
        })}
      </div>

      <div className="ak-form-actions">
        {onCancel && (
          <button
            type="button"
            className="ak-btn ak-btn-secondary"
            onClick={onCancel}
            disabled={isBusy}
          >
            {cancelLabel}
          </button>
        )}
        <button
          type="submit"
          className="ak-btn ak-btn-primary"
          disabled={isBusy}
        >
          {isBusy && <Loader2 size={15} className="ak-spin" />}
          <span>{submitLabel}</span>
        </button>
      </div>
    </form>
  );
};

