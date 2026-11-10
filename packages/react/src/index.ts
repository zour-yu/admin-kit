// Main studio entrypoint
export { AdminStudio, type AdminStudioProps } from "./components/AdminStudio";

// Configuration context & provider
export {
  ConfigProvider,
  useConfig,
  type ConfigProviderProps,
  type ConfigContextValue,
} from "./context/ConfigContext";

// Table engine components
export {
  DynamicDataTable,
  type DynamicDataTableProps,
} from "./components/table/DynamicDataTable";

export {
  CellRenderer,
  type CellRendererProps,
} from "./components/table/CellRenderer";

// Layout components
export {
  AppShell,
  type AppShellProps,
} from "./components/layout/AppShell";

// Form and Modal components
export {
  DynamicForm,
  type DynamicFormProps,
} from "./components/form/DynamicForm";

export {
  ActionExecutionModal,
  type ActionExecutionModalProps,
} from "./components/modals/ActionExecutionModal";

// Styles
import "./styles/admin-studio.css";
