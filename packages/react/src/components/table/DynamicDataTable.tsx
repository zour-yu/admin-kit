import React, { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import type { ResourceConfig, ActionConfig } from "@admin-kit/core";
import { CellRenderer } from "./CellRenderer";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";

export interface DynamicDataTableProps {
  resource: ResourceConfig;
  data?: any[];
  onExecuteAction?: (action: ActionConfig, row: any) => void;
  onNavigateRelation?: (targetResource: string, recordId: string) => void;
}

export const DynamicDataTable: React.FC<DynamicDataTableProps> = ({
  resource,
  data: customData,
  onExecuteAction,
  onNavigateRelation,
}) => {
  const tableConfig = resource.table;
  const columnsConfig = useMemo(() => tableConfig?.columns || [], [tableConfig]);

  // Generate realistic sample records if no live data is passed
  const fallbackData = useMemo(() => {
    if (customData) return customData;
    return generateSampleData(resource);
  }, [customData, resource]);

  const [sorting, setSorting] = useState<SortingState>(() => {
    if (tableConfig?.default_sort) {
      return [
        {
          id: tableConfig.default_sort.field,
          desc: tableConfig.default_sort.direction === "desc",
        },
      ];
    }
    return [];
  });

  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedFilterField, setSelectedFilterField] = useState<string>("");
  const [selectedFilterValue, setSelectedFilterValue] = useState<string>("");

  // Define TanStack Table Column Definitions
  const columns = useMemo<ColumnDef<any>[]>(() => {
    const cols: ColumnDef<any>[] = columnsConfig.map((col) => ({
      id: col.key,
      accessorKey: col.key,
      header: col.label,
      enableSorting: col.sortable ?? false,
      cell: (info) => (
        <CellRenderer
          value={info.getValue()}
          column={col}
          row={info.row.original}
          onNavigateRelation={onNavigateRelation}
        />
      ),
    }));

    // Append Row Actions Column if row-scoped actions exist
    const rowActions = (resource.actions || []).filter((a) => a.scope === "row");
    if (rowActions.length > 0) {
      cols.push({
        id: "__actions",
        header: "Actions",
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          const permittedActions = rowActions.filter((action) => {
            if (action.visible_if) {
              return evaluateVisibleIf(action.visible_if, row);
            }
            return true;
          });

          if (permittedActions.length === 0) {
            return <span style={{ color: "var(--ak-text-muted)" }}>—</span>;
          }

          return (
            <div className="ak-action-buttons">
              {permittedActions.map((action) => (
                <button
                  key={action.name}
                  type="button"
                  className={`ak-btn ak-btn-${action.style || "secondary"}`}
                  onClick={() => onExecuteAction && onExecuteAction(action, row)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          );
        },
      });
    }

    return cols;
  }, [columnsConfig, resource.actions, onExecuteAction, onNavigateRelation]);

  // Filtered rows matching selected filter dropdown
  const filteredData = useMemo(() => {
    if (!selectedFilterField || !selectedFilterValue) return fallbackData;
    return fallbackData.filter((row) => String(row[selectedFilterField]) === selectedFilterValue);
  }, [fallbackData, selectedFilterField, selectedFilterValue]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: tableConfig?.page_size || 20,
      },
    },
  });

  // Extract unique values for filter dropdown
  const filterOptions = useMemo(() => {
    if (!selectedFilterField) return [];
    const values = new Set<string>();
    for (const r of fallbackData) {
      if (r[selectedFilterField] !== undefined && r[selectedFilterField] !== null) {
        values.add(String(r[selectedFilterField]));
      }
    }
    return Array.from(values);
  }, [fallbackData, selectedFilterField]);

  return (
    <div className="ak-table-container">
      {/* Toolbar: Search & Filters */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--ak-border-subtle)" }}>
        <div className="ak-toolbar">
          <div className="ak-search-box">
            <Search className="ak-search-icon" size={16} />
            <input
              type="text"
              className="ak-search-input"
              placeholder={`Search ${resource.label.toLowerCase()}...`}
              value={globalFilter ?? ""}
              onChange={(e) => setGlobalFilter(e.target.value)}
            />
          </div>

          <div className="ak-filter-group">
            {tableConfig?.filterable_fields && tableConfig.filterable_fields.length > 0 && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Filter size={15} style={{ color: "var(--ak-text-muted)" }} />
                  <select
                    className="ak-select"
                    value={selectedFilterField}
                    onChange={(e) => {
                      setSelectedFilterField(e.target.value);
                      setSelectedFilterValue("");
                    }}
                  >
                    <option value="">Filter by...</option>
                    {tableConfig.filterable_fields.map((f) => (
                      <option key={f} value={f}>
                        {f.charAt(0).toUpperCase() + f.slice(1).replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedFilterField && (
                  <select
                    className="ak-select"
                    value={selectedFilterValue}
                    onChange={(e) => setSelectedFilterValue(e.target.value)}
                  >
                    <option value="">All values</option>
                    {filterOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="ak-table-scroll">
        <table className="ak-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const isSorted = header.column.getIsSorted();

                  return (
                    <th
                      key={header.id}
                      className={canSort ? "sortable" : ""}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="ak-th-content">
                        <span>
                          {header.isPlaceholder
                            ? null
                            : String(header.column.columnDef.header)}
                        </span>
                        {canSort && (
                          <span style={{ display: "inline-flex" }}>
                            {isSorted === "asc" ? (
                              <ArrowUp size={13} style={{ color: "var(--ak-primary)" }} />
                            ) : isSorted === "desc" ? (
                              <ArrowDown size={13} style={{ color: "var(--ak-primary)" }} />
                            ) : (
                              <ArrowUpDown size={12} style={{ opacity: 0.4 }} />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {cell.column.columnDef.cell
                        ? (cell.column.columnDef.cell as any)(cell.getContext())
                        : String(cell.getValue())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ textAlign: "center", padding: "48px 24px", color: "var(--ak-text-muted)" }}
                >
                  No records found matching criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <div className="ak-pagination">
        <div>
          Showing{" "}
          <strong>
            {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
          </strong>{" "}
          to{" "}
          <strong>
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              filteredData.length
            )}
          </strong>{" "}
          of <strong>{filteredData.length}</strong> entries
        </div>

        <div className="ak-pagination-controls">
          <button
            type="button"
            className="ak-btn ak-btn-secondary"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            style={{ opacity: !table.getCanPreviousPage() ? 0.5 : 1 }}
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span>
            Page <strong>{table.getState().pagination.pageIndex + 1}</strong> of{" "}
            <strong>{table.getPageCount() || 1}</strong>
          </span>
          <button
            type="button"
            className="ak-btn ak-btn-secondary"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            style={{ opacity: !table.getCanNextPage() ? 0.5 : 1 }}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Basic safe visible_if evaluator supporting expressions like `row.status == 'pending'`.
 */
function evaluateVisibleIf(expression: string, row: Record<string, any>): boolean {
  try {
    const match = expression.match(/row\.(\w+)\s*(===?|!==?)\s*['"]([^'"]+)['"]/);
    if (match) {
      const [, field, op, targetVal] = match;
      const actualVal = String(row[field]);
      if (op.startsWith("==")) return actualVal === targetVal;
      if (op.startsWith("!=")) return actualVal !== targetVal;
    }
    return true;
  } catch {
    return true;
  }
}

/**
 * Generates realistic sample data for immediate studio preview based on resource schema.
 */
function generateSampleData(resource: ResourceConfig): any[] {
  const isUsers = resource.endpoint.includes("user");
  const isRefunds = resource.endpoint.includes("refund");

  if (isUsers) {
    return [
      { id: "usr_101", email: "alex.turner@acme.com", role: "admin", created_at: "2024-01-15T09:30:00Z" },
      { id: "usr_102", email: "sarah.connor@acme.com", role: "user", created_at: "2024-02-20T14:15:00Z" },
      { id: "usr_103", email: "david.beck@acme.com", role: "user", created_at: "2024-03-05T11:45:00Z" },
      { id: "usr_104", email: "elena.rostova@acme.com", role: "user", created_at: "2024-03-18T16:20:00Z" },
      { id: "usr_105", email: "marcus.aurelius@acme.com", role: "admin", created_at: "2024-04-01T08:00:00Z" },
    ];
  }

  if (isRefunds) {
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
