import React from "react";
import ReactDOM from "react-dom/client";
import { AdminStudio } from "../src/react";
import "../src/react/styles/admin-studio.css";

const rootEl = document.getElementById("root");
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <AdminStudio
        configUrl={(window as any).__ADMIN_KIT_CONFIG_URL__ || "/admin/__config"}
        config={(window as any).__ADMIN_KIT_INITIAL_CONFIG__}
      />
    </React.StrictMode>
  );
}
