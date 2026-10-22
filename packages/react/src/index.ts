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

// Styles
import "./styles/admin-studio.css";
