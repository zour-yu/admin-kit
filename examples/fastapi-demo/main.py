from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from admin_kit_fastapi import mount_admin_studio

app = FastAPI(
    title="Acme API (FastAPI)",
    version="1.0.0",
    description="Sample FastAPI backend integrated with AdminKit Studio",
)

# In-memory mock data
users_db = [
    {"id": "usr_101", "email": "alex.turner@acme.com", "role": "admin", "created_at": "2024-01-15T09:30:00Z"},
    {"id": "usr_102", "email": "sarah.connor@acme.com", "role": "user", "created_at": "2024-02-20T14:15:00Z"},
    {"id": "usr_103", "email": "david.beck@acme.com", "role": "user", "created_at": "2024-03-05T11:45:00Z"},
    {"id": "usr_104", "email": "elena.rostova@acme.com", "role": "user", "created_at": "2024-03-18T16:20:00Z"},
    {"id": "usr_105", "email": "marcus.aurelius@acme.com", "role": "admin", "created_at": "2024-04-01T08:00:00Z"},
]

refunds_db = [
    {"id": "ref_801", "user_id": "alex.turner@acme.com", "amount": 149.99, "status": "pending"},
    {"id": "ref_802", "user_id": "sarah.connor@acme.com", "amount": 49.50, "status": "pending"},
    {"id": "ref_803", "user_id": "david.beck@acme.com", "amount": 299.00, "status": "approved"},
    {"id": "ref_804", "user_id": "elena.rostova@acme.com", "amount": 89.20, "status": "rejected"},
    {"id": "ref_805", "user_id": "marcus.aurelius@acme.com", "amount": 520.00, "status": "pending"},
]


class RejectPayload(BaseModel):
    reason: str
    notes: Optional[str] = None


# --- REST API Endpoints ---

@app.get("/api/auth/me")
def get_current_user():
    return {
        "id": "usr_101",
        "email": "alex.turner@acme.com",
        "roles": ["superadmin"],
        "permissions": ["refunds:read", "refunds:write", "users:read"],
    }


@app.get("/api/users")
def list_users():
    return users_db


@app.get("/api/refunds")
def list_refunds():
    return refunds_db


@app.post("/api/refunds/{refund_id}/approve")
def approve_refund(refund_id: str):
    target = next((r for r in refunds_db if r["id"] == refund_id), None)
    if not target:
        raise HTTPException(status_code=404, detail=f"Refund {refund_id} not found")

    target["status"] = "approved"
    print(f"[FastAPI API] Refund {refund_id} approved.")
    return {"success": True, "message": f"Refund {refund_id} approved successfully"}


@app.post("/api/refunds/{refund_id}/reject")
def reject_refund(refund_id: str, payload: RejectPayload):
    target = next((r for r in refunds_db if r["id"] == refund_id), None)
    if not target:
        raise HTTPException(status_code=404, detail=f"Refund {refund_id} not found")

    target["status"] = "rejected"
    target["rejection_reason"] = payload.reason
    target["rejection_notes"] = payload.notes
    print(f"[FastAPI API] Refund {refund_id} rejected. Reason: {payload.reason}")
    return {"success": True, "message": f"Refund {refund_id} rejected"}


# --- Mount AdminKit Studio ---
CONFIG_PATH = Path(__file__).parent / "admin.config.yaml"

mount_admin_studio(
    app,
    path="/admin",
    config_path=CONFIG_PATH,
    title="Acme API Studio",
)


@app.get("/", include_in_schema=False)
def root_redirect():
    return RedirectResponse(url="/admin")


if __name__ == "__main__":
    import uvicorn

    print("[FastAPI Demo] Starting on http://127.0.0.1:8000")
    print("[FastAPI Demo] Admin Studio: http://127.0.0.1:8000/admin")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

