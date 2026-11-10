import test from "node:test";
import assert from "node:assert/strict";
import { checkAccess } from "../dist/index.js";

test("checkAccess: superadmin role bypasses all restrictions", () => {
  const user = { roles: ["superadmin"] };
  const restrictiveRule = {
    roles: ["finance_director"],
    permissions: ["special:action"],
  };

  assert.equal(checkAccess(restrictiveRule, user), true);
  assert.equal(checkAccess(null, user), true);
  assert.equal(checkAccess(undefined, user), true);
});

test("checkAccess: default policies when rule is empty", () => {
  const normalUser = { roles: ["viewer"] };

  // When defaultPolicy is 'allow' (default)
  assert.equal(checkAccess(undefined, normalUser), true);
  assert.equal(checkAccess({ roles: [] }, normalUser), true);

  // When defaultPolicy is 'deny'
  assert.equal(checkAccess(undefined, normalUser, ["superadmin"], "deny"), false);
  assert.equal(checkAccess({ roles: [] }, normalUser, ["superadmin"], "deny"), false);
});

test("checkAccess: role-based matching", () => {
  const financeUser = { roles: ["finance_manager", "employee"] };
  const supportUser = { roles: ["support_tier_1"] };

  const rule = { roles: ["finance_manager", "admin"] };

  assert.equal(checkAccess(rule, financeUser), true);
  assert.equal(checkAccess(rule, supportUser), false);
});

test("checkAccess: permission-based matching", () => {
  const userWithPerm = {
    roles: ["custom_role"],
    permissions: ["refunds:approve", "refunds:view"],
  };
  const userWithoutPerm = {
    roles: ["custom_role"],
    permissions: ["refunds:view"],
  };

  const rule = { permissions: ["refunds:approve"] };

  assert.equal(checkAccess(rule, userWithPerm), true);
  assert.equal(checkAccess(rule, userWithoutPerm), false);
});
