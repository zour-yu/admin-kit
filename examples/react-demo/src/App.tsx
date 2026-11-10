import { AdminStudio } from "@admin-kit-yu/react";
import "@admin-kit-yu/react/styles.css";
import adminConfigYaml from "./admin.config.yaml?raw";

export function App() {
  const globalWin = typeof window !== "undefined" ? (window as any) : {};
  const initialConfig = globalWin.__ADMIN_KIT_INITIAL_CONFIG__ || adminConfigYaml;
  const configUrl = globalWin.__ADMIN_KIT_CONFIG_URL__;

  return (
    <AdminStudio
      config={initialConfig}
      configUrl={configUrl}
    />
  );
}

export default App;
