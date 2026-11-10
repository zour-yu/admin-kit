import React from "react";
import type { AccessRule } from "@admin-kit-yu/core";
import { useConfig } from "../../context/ConfigContext";

export interface RBACGuardProps {
  access?: AccessRule;
  roles?: string[];
  permissions?: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Presentation-layer RBAC gate.
 * Conditionally renders children if the active user satisfies schema access rules
 * (or if the user has an active superadmin role). Otherwise renders the fallback.
 */
export const RBACGuard: React.FC<RBACGuardProps> = ({
  access,
  roles,
  permissions,
  fallback = null,
  children,
}) => {
  const { checkAccess } = useConfig();

  const rule: AccessRule = {
    roles: access?.roles || roles || [],
    permissions: access?.permissions || permissions || [],
  };

  const permitted = checkAccess(rule);

  if (!permitted) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
