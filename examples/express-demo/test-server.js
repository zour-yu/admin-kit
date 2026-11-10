import http from "node:http";
import assert from "node:assert/strict";

process.env.PORT = "0";
const { app, server } = await import("./src/server.js");

async function runVerification() {
  console.log("[Verification] Starting Express Demo integration probe...");
  if (!server.listening) {
    await new Promise((resolve) => server.once("listening", resolve));
  }
  const address = server.address();
  const port = address.port;
  console.log(`[Verification] Server running on port ${port}`);

  try {
    // 1. Verify GET /admin (SPA UI shell)
    console.log("[Verification] Probing GET /admin...");
    const resUi = await fetch(`http://127.0.0.1:${port}/admin`);
    assert.equal(resUi.status, 200, "Expected HTTP 200 on /admin");
    const html = await resUi.text();
    assert.ok(html.includes("<title>Acme API</title>"), "Expected <title>Acme API</title> in HTML");
    assert.ok(html.includes('<div id="root">'), "Expected root mount point in HTML");
    assert.ok(html.includes("/admin/__config"), "Expected config endpoint reference");
    console.log("  ✓ GET /admin returned valid SPA HTML containing Acme API title & root element");

    // 1b. Verify static bundle assets load with HTTP 200
    const scriptMatch = html.match(/src=["'](\.?\/assets\/[^"']+)["']/);
    assert.ok(scriptMatch, "Expected script tag with bundle asset path");
    const scriptPath = scriptMatch[1].replace(/^\./, "");
    console.log(`[Verification] Probing script asset: /admin${scriptPath}...`);
    const resScript = await fetch(`http://127.0.0.1:${port}/admin${scriptPath}`);
    assert.equal(resScript.status, 200, "Expected HTTP 200 on bundled script");
    const scriptContentType = resScript.headers.get("content-type") || "";
    assert.ok(scriptContentType.includes("javascript"), "Expected JavaScript content-type");
    console.log("  ✓ SPA script bundle returned HTTP 200 with javascript content-type");

    const cssMatch = html.match(/href=["'](\.?\/assets\/[^"']+)["']/);
    assert.ok(cssMatch, "Expected css link with bundle asset path");
    const cssPath = cssMatch[1].replace(/^\./, "");
    console.log(`[Verification] Probing CSS asset: /admin${cssPath}...`);
    const resCss = await fetch(`http://127.0.0.1:${port}/admin${cssPath}`);
    assert.equal(resCss.status, 200, "Expected HTTP 200 on bundled CSS");
    console.log("  ✓ SPA CSS bundle returned HTTP 200");

    // 2. Verify GET /admin/__config (Configuration metadata JSON)
    console.log("[Verification] Probing GET /admin/__config...");
    const resConfig = await fetch(`http://127.0.0.1:${port}/admin/__config`);
    assert.equal(resConfig.status, 200, "Expected HTTP 200 on /admin/__config");
    const config = await resConfig.json();
    assert.equal(config.version, "1.0");
    assert.equal(config.project.name, "Acme API");
    assert.ok(config.resources.users, "Expected 'users' resource in config");
    assert.ok(config.resources.refunds, "Expected 'refunds' resource in config");
    assert.equal(config.resources.refunds.actions.length, 2, "Expected 2 custom actions on refunds (approve, reject)");
    console.log("  ✓ GET /admin/__config returned validated AdminKitConfig JSON");

    // 3. Verify GET /api/users (Mock REST data)
    console.log("[Verification] Probing GET /api/users...");
    const resUsers = await fetch(`http://127.0.0.1:${port}/api/users`);
    assert.equal(resUsers.status, 200);
    const users = await resUsers.json();
    assert.equal(users.length, 5);
    console.log(`  ✓ GET /api/users returned ${users.length} mock users`);

    // 4. Verify GET /api/refunds
    console.log("[Verification] Probing GET /api/refunds...");
    const resRefunds = await fetch(`http://127.0.0.1:${port}/api/refunds`);
    assert.equal(resRefunds.status, 200);
    const refunds = await resRefunds.json();
    assert.equal(refunds.length, 5);
    console.log(`  ✓ GET /api/refunds returned ${refunds.length} mock refunds`);

    // 5. Verify custom action POST /api/refunds/:id/approve
    console.log("[Verification] Probing POST /api/refunds/ref_801/approve...");
    const resApprove = await fetch(`http://127.0.0.1:${port}/api/refunds/ref_801/approve`, {
      method: "POST",
    });
    assert.equal(resApprove.status, 200);
    const approveJson = await resApprove.json();
    assert.equal(approveJson.success, true);
    console.log("  ✓ POST /api/refunds/ref_801/approve succeeded");

    // 6. Verify custom action POST /api/refunds/:id/reject with payload
    console.log("[Verification] Probing POST /api/refunds/ref_802/reject...");
    const resReject = await fetch(`http://127.0.0.1:${port}/api/refunds/ref_802/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "fraud", notes: "Suspicious charge activity" }),
    });
    assert.equal(resReject.status, 200);
    const rejectJson = await resReject.json();
    assert.equal(rejectJson.success, true);
    console.log("  ✓ POST /api/refunds/ref_802/reject succeeded");

    console.log("\n[Verification] All integration checks passed with 100% success!");
  } finally {
    server.close();
  }
}

runVerification().catch((err) => {
  console.error("[Verification] Failed:", err);
  server.close();
  process.exit(1);
});

