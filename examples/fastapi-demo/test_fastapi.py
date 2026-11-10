import sys
from pathlib import Path
from starlette.testclient import TestClient

from main import app

def run_tests():
    print("[FastAPI Integration Test] Starting test suite...")
    client = TestClient(app)

    # 1. Verify GET /admin (SPA UI shell)
    print("Testing GET /admin...")
    res = client.get("/admin")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    html = res.text
    assert "<title>Acme API Studio</title>" in html, "Expected title injection"
    assert '<div id="root">' in html, "Expected root mount point"
    assert "__ADMIN_KIT_INITIAL_CONFIG__" in html, "Expected config inlining"
    print("  ✓ GET /admin returned valid SPA HTML shell with inlined configuration")

    # 2. Verify GET /admin/__config (JSON metadata)
    print("Testing GET /admin/__config...")
    res_cfg = client.get("/admin/__config")
    assert res_cfg.status_code == 200
    config_json = res_cfg.json()
    assert config_json["version"] == "1.0"
    assert "users" in config_json["resources"]
    assert "refunds" in config_json["resources"]
    print("  ✓ GET /admin/__config returned validated AdminKitConfig JSON")

    # 3. Verify Static Bundle Assets
    print("Testing static asset delivery...")
    res_js = client.get("/admin/assets/index-Do1L1cBZ.js")
    assert res_js.status_code == 200
    assert "javascript" in res_js.headers.get("content-type", "")
    print(f"  ✓ GET /admin/assets/index-Do1L1cBZ.js returned HTTP 200 ({len(res_js.content)} bytes)")

    # 4. Verify Client-Side Subpath Catch-All (Deep link refresh)
    print("Testing client-side route refresh (GET /admin/refunds)...")
    res_subpath = client.get("/admin/refunds")
    assert res_subpath.status_code == 200
    assert '<div id="root">' in res_subpath.text
    print("  ✓ Client-side subpath refresh returned SPA HTML (no 404)")

    # 5. Verify Mock REST Endpoints
    print("Testing GET /api/users...")
    res_users = client.get("/api/users")
    assert res_users.status_code == 200
    users = res_users.json()
    assert len(users) == 5
    print(f"  ✓ GET /api/users returned {len(users)} users")

    print("Testing GET /api/refunds...")
    res_refunds = client.get("/api/refunds")
    assert res_refunds.status_code == 200
    assert len(res_refunds.json()) == 5
    print("  ✓ GET /api/refunds returned 5 refunds")

    # 6. Verify Custom Workflow Action: Approve
    print("Testing POST /api/refunds/ref_801/approve...")
    res_approve = client.post("/api/refunds/ref_801/approve")
    assert res_approve.status_code == 200
    assert res_approve.json()["success"] is True
    print("  ✓ POST /api/refunds/ref_801/approve succeeded")

    # 7. Verify Custom Workflow Action: Reject
    print("Testing POST /api/refunds/ref_802/reject...")
    res_reject = client.post(
        "/api/refunds/ref_802/reject",
        json={"reason": "fraud", "notes": "Suspicious login from abroad"},
    )
    assert res_reject.status_code == 200
    assert res_reject.json()["success"] is True
    print("  ✓ POST /api/refunds/ref_802/reject succeeded")

    # 8. Verify Root Redirect
    print("Testing GET / redirect...")
    res_root = client.get("/", follow_redirects=False)
    assert res_root.status_code in (302, 307)
    assert res_root.headers.get("location") == "/admin"
    print("  ✓ GET / redirected to /admin")

    print("\n[FastAPI Integration Test] All 8 tests passed successfully!")

if __name__ == "__main__":
    run_tests()

