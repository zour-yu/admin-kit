import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import {
  parseConfig,
  parseYamlConfig,
  type AdminKitConfig,
  type ResourceConfig,
} from "@admin-kit/core";

export interface ConfigContextValue {
  config: AdminKitConfig | null;
  activeResourceKey: string;
  setActiveResourceKey: (key: string) => void;
  activeResource: ResourceConfig | null;
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  isLoading: boolean;
  error: Error | null;
  toast: string | null;
  showToast: (msg: string) => void;
}

const ConfigContext = createContext<ConfigContextValue | undefined>(undefined);

export interface ConfigProviderProps {
  children: React.ReactNode;
  config?: AdminKitConfig | string;
  configUrl?: string;
  initialResourceKey?: string;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({
  children,
  config: initialConfig,
  configUrl,
  initialResourceKey,
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

  // Sync theme attribute with document body
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Fetch dynamic config if configUrl provided and no static config supplied
  useEffect(() => {
    if (initialConfig) {
      try {
        const parsed = typeof initialConfig === "string" ? parseYamlConfig(initialConfig) : parseConfig(initialConfig);
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
        if (contentType.includes("yaml") || contentType.includes("yml") || configUrl.endsWith(".yaml") || configUrl.endsWith(".yml")) {
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

  const value: ConfigContextValue = {
    config,
    activeResourceKey,
    setActiveResourceKey,
    activeResource,
    theme,
    setTheme,
    isLoading,
    error,
    toast,
    showToast,
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
