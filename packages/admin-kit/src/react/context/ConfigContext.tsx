import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import {
  parseConfig,
  parseYamlConfig,
  createAdminClient,
  type AdminClient,
  type AdminKitConfig,
  type ResourceConfig,
  type AccessRule,
} from "../../core";

export interface ConfigContextValue {
  config: AdminKitConfig | null;
  adminClient: AdminClient | null;
  authToken: string | null;
  setAuthToken: (token: string | null) => void;
  activeResourceKey: string;
  setActiveResourceKey: (key: string) => void;
  activeResource: ResourceConfig | null;
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  isLoading: boolean;
  error: Error | null;
  toast: string | null;
  showToast: (msg: string) => void;

  // RBAC & Role Simulation
  simulatedRole: string;
  setSimulatedRole: (role: string) => void;
  checkAccess: (access?: AccessRule | { roles?: string[]; permissions?: string[] }) => boolean;
  isSuperadmin: boolean;

  // In-App Diagnostic Doctor
  isDoctorOpen: boolean;
  setIsDoctorOpen: (open: boolean) => void;
}

const ConfigContext = createContext<ConfigContextValue | undefined>(undefined);

export interface ConfigProviderProps {
  children: React.ReactNode;
  config?: AdminKitConfig | string;
  configUrl?: string;
  initialResourceKey?: string;
  initialRole?: string;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({
  children,
  config: initialConfig,
  configUrl,
  initialResourceKey,
  initialRole,
}) => {
  const [config, setConfig] = useState<AdminKitConfig | null>(() => {
    if (!initialConfig) return null;
    try {
      if (typeof initialConfig === "string") {
        return parseYamlConfig(initialConfig);
      }
      return parseConfig(initialConfig);
    } catch (err) {
      console.error("[admin-kit] Failed to parse initial configuration:", err);
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(!initialConfig && Boolean(configUrl));
  const [error, setError] = useState<Error | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [toast, setToast] = useState<string | null>(null);

  // RBAC Simulation state
  const [simulatedRole, setSimulatedRole] = useState<string>(
    initialRole || config?.access?.superadmin_roles?.[0] || "superadmin"
  );

  // Doctor Drawer open state
  const [isDoctorOpen, setIsDoctorOpen] = useState(false);

  // Auth Token state for Bearer Token authorization
  const [authToken, setAuthTokenState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const storageKey = "admin_kit_token";
      return window.sessionStorage.getItem(storageKey) || window.localStorage.getItem(storageKey) || null;
    } catch {
      return null;
    }
  });

  const setAuthToken = useCallback((token: string | null) => {
    setAuthTokenState(token);
    if (typeof window === "undefined") return;
    try {
      const storageKey = "admin_kit_token";
      if (token) {
        window.sessionStorage.setItem(storageKey, token);
      } else {
        window.sessionStorage.removeItem(storageKey);
        window.localStorage.removeItem(storageKey);
      }
    } catch (e) {
      console.warn("[admin-kit] Failed to access storage for token:", e);
    }
  }, []);

  // Universal AdminClient instance
  const adminClient = useMemo(() => {
    if (!config) return null;
    return createAdminClient(config, {
      baseUrl: config.project?.base_url || "",
      getToken: () => authToken,
    });
  }, [config, authToken]);

  // Sync default simulated role when config loads
  useEffect(() => {
    if (!initialRole && config?.access?.superadmin_roles?.[0]) {
      setSimulatedRole((prev) => prev || config.access!.superadmin_roles![0]);
    }
  }, [config, initialRole]);

  // Sync theme attribute with document body
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Fetch dynamic config if configUrl provided and no static config supplied
  useEffect(() => {
    if (initialConfig) {
      try {
        const parsed =
          typeof initialConfig === "string" ? parseYamlConfig(initialConfig) : parseConfig(initialConfig);
        setConfig(parsed);
        setIsLoading(false);
      } catch (err: any) {
        setError(err);
        setIsLoading(false);
      }
      return;
    }

    if (!configUrl) return;

    let isMounted = true;
    setIsLoading(true);

    fetch(configUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch config from ${configUrl}`);
        const contentType = res.headers.get("content-type") || "";
        if (
          contentType.includes("yaml") ||
          contentType.includes("yml") ||
          configUrl.endsWith(".yaml") ||
          configUrl.endsWith(".yml")
        ) {
          return res.text().then((text) => parseYamlConfig(text));
        }
        return res.json().then((json) => parseConfig(json));
      })
      .then((validated) => {
        if (isMounted) {
          setConfig(validated);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [initialConfig, configUrl]);

  // First resource key default
  const resourceKeys = useMemo(() => {
    return config?.resources ? Object.keys(config.resources) : [];
  }, [config]);

  const [activeResourceKey, setActiveResourceKey] = useState<string>(
    initialResourceKey || resourceKeys[0] || ""
  );

  useEffect(() => {
    if (!activeResourceKey && resourceKeys.length > 0) {
      setActiveResourceKey(resourceKeys[0]);
    }
  }, [resourceKeys, activeResourceKey]);

  const activeResource = useMemo(() => {
    if (!config || !activeResourceKey) return null;
    return config.resources[activeResourceKey] || null;
  }, [config, activeResourceKey]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3500);
  };

  const superadminRoles = useMemo(() => {
    return config?.access?.superadmin_roles || ["superadmin"];
  }, [config]);

  const isSuperadmin = useMemo(() => {
    return superadminRoles.includes(simulatedRole);
  }, [superadminRoles, simulatedRole]);

  /**
   * Evaluates if the current simulated user has access to a protected resource, action, or column.
   */
  const checkAccess = useCallback(
    (access?: AccessRule | { roles?: string[]; permissions?: string[] }): boolean => {
      // Superadmins bypass all presentation gates
      if (isSuperadmin) {
        return true;
      }

      // If no access restrictions exist, grant presentation access
      if (!access || (!access.roles?.length && !access.permissions?.length)) {
        return true;
      }

      // Role check: simulated role must be explicitly allowed
      if (access.roles && access.roles.length > 0) {
        if (!access.roles.includes(simulatedRole)) {
          return false;
        }
      }

      return true;
    },
    [isSuperadmin, simulatedRole]
  );

  const value: ConfigContextValue = {
    config,
    adminClient,
    authToken,
    setAuthToken,
    activeResourceKey,
    setActiveResourceKey,
    activeResource,
    theme,
    setTheme,
    isLoading,
    error,
    toast,
    showToast,
    simulatedRole,
    setSimulatedRole,
    checkAccess,
    isSuperadmin,
    isDoctorOpen,
    setIsDoctorOpen,
  };

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
};

export function useConfig(): ConfigContextValue {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error("useConfig must be used within a <ConfigProvider>");
  }
  return context;
}
