import type { AccessRule } from "../types";

export interface UserAccessContext {
  id?: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
}

/**
 * Resolves whether a user has presentation access to a resource, column, or action
 * based on role and permission rules per docs/ARCHITECTURE.md Section 6.
 */
export function checkAccess(
  rule: AccessRule | undefined | null,
  user: UserAccessContext,
  superadminRoles: string[] = ["superadmin"],
  defaultPolicy: "allow" | "deny" = "allow"
): boolean {
  const userRoles = user.roles || [];
  const userPermissions = user.permissions || [];

  // 1. Superadmin bypass: users with any superadmin role bypass all gates
  const isSuperadmin = userRoles.some((role) => superadminRoles.includes(role));
  if (isSuperadmin) {
    return true;
  }

  // 2. If no rule is explicitly defined, follow global default policy
  if (!rule || (!rule.roles?.length && !rule.permissions?.length)) {
    return defaultPolicy === "allow";
  }

  // 3. Role check: if rule specifies roles, user must match at least one
  if (rule.roles && rule.roles.length > 0) {
    const hasMatchingRole = rule.roles.some((requiredRole) => userRoles.includes(requiredRole));
    if (hasMatchingRole) {
      return true;
    }
  }

  // 4. Permission check: if rule specifies permissions, user must possess at least one
  if (rule.permissions && rule.permissions.length > 0) {
    const hasMatchingPermission = rule.permissions.some((reqPerm) => userPermissions.includes(reqPerm));
    if (hasMatchingPermission) {
      return true;
    }
  }

  // Neither role nor permission matched
  return false;
}

