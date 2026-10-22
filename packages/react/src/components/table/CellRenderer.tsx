import React, { useState } from "react";
import type { TableColumn } from "@admin-kit/core";
import { Copy, Check, Eye, EyeOff, ExternalLink } from "lucide-react";

export interface CellRendererProps {
  value: any;
  column: TableColumn;
  row?: Record<string, any>;
  onNavigateRelation?: (targetResource: string, recordId: string) => void;
}

export const CellRenderer: React.FC<CellRendererProps> = ({
  value,
  column,
  row,
  onNavigateRelation,
}) => {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  if (value === null || value === undefined || value === "") {
    return <span style={{ color: "var(--ak-text-muted)" }}>—</span>;
  }

  // Handle sensitive masking
  if (column.sensitive && !revealed) {
    return (
      <div className="ak-sensitive-cell">
        <span style={{ letterSpacing: "2px", fontWeight: 700 }}>••••••••</span>
        <button
          type="button"
          className="ak-copy-btn"
          onClick={() => setRevealed(true)}
          title="Click to reveal"
        >
          <Eye size={14} />
        </button>
      </div>
    );
  }

  // If sensitive and revealed
  if (column.sensitive && revealed) {
    return (
      <div className="ak-sensitive-cell">
        <span>{String(value)}</span>
        <button
          type="button"
          className="ak-copy-btn"
          onClick={() => setRevealed(false)}
          title="Click to mask"
        >
          <EyeOff size={14} />
        </button>
      </div>
    );
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const renderContent = () => {
    switch (column.type) {
      case "badge": {
        const strVal = String(value);
        const color = column.badge_map?.[strVal] || column.badge_map?.[strVal.toLowerCase()] || "gray";
        return (
          <span className={`ak-badge ak-badge-${color}`}>
            {strVal}
          </span>
        );
      }

      case "currency": {
        const num = typeof value === "number" ? value : parseFloat(value);
        if (isNaN(num)) return <span>{String(value)}</span>;
        const formatted = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: column.currency_code || "USD",
        }).format(num);
        return <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{formatted}</span>;
      }

      case "date": {
        const d = new Date(value);
        if (isNaN(d.getTime())) return <span>{String(value)}</span>;
        return <span title={d.toISOString()}>{d.toLocaleDateString()}</span>;
      }

      case "datetime": {
        const d = new Date(value);
        if (isNaN(d.getTime())) return <span>{String(value)}</span>;
        return (
          <span title={d.toISOString()} style={{ whiteSpace: "nowrap" }}>
            {d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        );
      }

      case "boolean": {
        const bool = Boolean(value);
        return (
          <span className={`ak-badge ak-badge-${bool ? "green" : "gray"}`}>
            {bool ? "Yes" : "No"}
          </span>
        );
      }

      case "relation": {
        const targetRes = column.relation?.target_resource;
        const displayVal = (row && column.relation?.display_field && row[column.relation.display_field]) || String(value);
        return (
          <span
            className="ak-relation-pill"
            style={{ cursor: onNavigateRelation ? "pointer" : "default" }}
            onClick={() => targetRes && onNavigateRelation && onNavigateRelation(targetRes, String(value))}
          >
            <span>{displayVal}</span>
            {targetRes && <ExternalLink size={11} style={{ opacity: 0.6 }} />}
          </span>
        );
      }

      case "json": {
        const str = typeof value === "object" ? JSON.stringify(value) : String(value);
        const truncated = str.length > 25 ? str.slice(0, 25) + "…" : str;
        return (
          <span className="ak-badge ak-badge-gray" title={str} style={{ fontFamily: "monospace" }}>
            {truncated}
          </span>
        );
      }

      case "image": {
        return (
          <img
            src={String(value)}
            alt={column.label}
            style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }}
          />
        );
      }

      case "number": {
        const num = typeof value === "number" ? value : parseFloat(value);
        return <span style={{ fontVariantNumeric: "tabular-nums" }}>{isNaN(num) ? String(value) : num.toLocaleString()}</span>;
      }

      case "string":
      default:
        return <span>{String(value)}</span>;
    }
  };

  if (column.copyable) {
    return (
      <div className="ak-copyable-cell">
        {renderContent()}
        <button
          type="button"
          className="ak-copy-btn"
          onClick={handleCopy}
          title={copied ? "Copied!" : "Copy to clipboard"}
        >
          {copied ? <Check size={13} style={{ color: "#16a34a" }} /> : <Copy size={13} />}
        </button>
      </div>
    );
  }

  return renderContent();
};
