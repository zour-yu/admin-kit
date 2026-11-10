import { AdminStudio } from "@admin-kit/react";
import "@admin-kit/react/styles.css";
import adminConfigYaml from "./admin.config.yaml?raw";

export function App() {
  return (
    <AdminStudio
      config={adminConfigYaml}
    />
  );
}

export default App;
