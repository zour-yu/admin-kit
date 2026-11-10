import test from "node:test";
import assert from "node:assert/strict";
import { evaluateExpression } from "../dist/index.js";

test("evaluateExpression: basic truthiness and empty handling", () => {
  assert.equal(evaluateExpression(""), true);
  assert.equal(evaluateExpression("   "), true);
  assert.equal(evaluateExpression(undefined), true);
  assert.equal(evaluateExpression(null), true);
  assert.equal(evaluateExpression("true"), true);
  assert.equal(evaluateExpression("false"), false);
});

test("evaluateExpression: field equality and comparisons", () => {
  const context = {
    row: {
      status: "pending",
      amount: 150,
      verified: true,
      user_id: "usr_123",
    },
    user: {
      role: "admin",
      tier: 2,
    },
  };

  assert.equal(evaluateExpression("row.status == 'pending'", context), true);
  assert.equal(evaluateExpression("row.status == 'approved'", context), false);
  assert.equal(evaluateExpression("row.status != 'rejected'", context), true);
  assert.equal(evaluateExpression("row.amount > 100", context), true);
  assert.equal(evaluateExpression("row.amount >= 150", context), true);
  assert.equal(evaluateExpression("row.amount < 150", context), false);
  assert.equal(evaluateExpression("row.amount <= 150", context), true);
  assert.equal(evaluateExpression("row.verified == true", context), true);
});

test("evaluateExpression: logical operators (&&, ||, !)", () => {
  const context = {
    row: {
      status: "pending",
      amount: 250,
    },
    user: {
      role: "finance",
    },
  };

  assert.equal(
    evaluateExpression("row.status == 'pending' && row.amount > 200", context),
    true
  );
  assert.equal(
    evaluateExpression("row.status == 'pending' && row.amount > 500", context),
    false
  );
  assert.equal(
    evaluateExpression("row.status == 'approved' || user.role == 'finance'", context),
    true
  );
  assert.equal(
    evaluateExpression("!(row.status == 'approved')", context),
    true
  );
});

test("evaluateExpression: set membership (in)", () => {
  const context = {
    row: {
      status: "pending",
      category: "electronics",
    },
    user: {
      roles: ["support", "moderator"],
    },
  };

  assert.equal(
    evaluateExpression("row.status in ['pending', 'in_review']", context),
    true
  );
  assert.equal(
    evaluateExpression("row.status in ['approved', 'rejected']", context),
    false
  );
  assert.equal(
    evaluateExpression("'support' in user.roles", context),
    true
  );
  assert.equal(
    evaluateExpression("'admin' in user.roles", context),
    false
  );
});

test("evaluateExpression: error resilience and invalid syntax fallback", () => {
  // Invalid syntax should fail gracefully to false without throwing or crashing
  assert.equal(evaluateExpression("row.status = = = 'broken"), false);
  assert.equal(evaluateExpression("((((( unclosed"), false);
});

