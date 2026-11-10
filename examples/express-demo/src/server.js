import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mountAdminStudio } from "@admin-kit-yu/express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// In-memory mock data stores
let users = [
  { id: "usr_101", email: "alex.turner@acme.com", role: "admin", created_at: "2024-01-15T09:30:00Z" },
  { id: "usr_102", email: "sarah.connor@acme.com", role: "user", created_at: "2024-02-20T14:15:00Z" },
  { id: "usr_103", email: "david.beck@acme.com", role: "user", created_at: "2024-03-05T11:45:00Z" },
  { id: "usr_104", email: "elena.rostova@acme.com", role: "user", created_at: "2024-03-18T16:20:00Z" },
  { id: "usr_105", email: "marcus.aurelius@acme.com", role: "admin", created_at: "2024-04-01T08:00:00Z" },
];

let refunds = [
  { id: "ref_801", user_id: "alex.turner@acme.com", amount: 149.99, status: "pending" },
  { id: "ref_802", user_id: "sarah.connor@acme.com", amount: 49.50, status: "pending" },
  { id: "ref_803", user_id: "david.beck@acme.com", amount: 299.00, status: "approved" },
  { id: "ref_804", user_id: "elena.rostova@acme.com", amount: 89.20, status: "rejected" },
  { id: "ref_805", user_id: "marcus.aurelius@acme.com", amount: 520.00, status: "pending" },
];

// --- Mock Backend API Endpoints ---

// Auth endpoints
app.get("/api/auth/me", (_req, res) => {
  res.json({
    id: "usr_101",
    email: "alex.turner@acme.com",
    roles: ["superadmin"],
    permissions: ["refunds:read", "refunds:write", "users:read"],
  });
});

app.post("/api/auth/login", (_req, res) => {
  res.json({ token: "demo_mock_jwt_token_xyz" });
});

// Users REST API
app.get("/api/users", (_req, res) => {
  res.json(users);
});

// Refunds REST API
app.get("/api/refunds", (_req, res) => {
  res.json(refunds);
});

// Custom RPC Workflow Action: Approve Refund
app.post("/api/refunds/:id/approve", (req, res) => {
  const { id } = req.params;
  const target = refunds.find((r) => r.id === id);
  if (target) {
    target.status = "approved";
    console.log(`[Backend API] Refund "${id}" approved successfully.`);
    return res.json({ success: true, message: `Refund ${id} approved` });
  }
  return res.status(404).json({ error: `Refund ${id} not found` });
});

// Custom RPC Workflow Action: Reject Refund (with reason and notes)
app.post("/api/refunds/:id/reject", (req, res) => {
  const { id } = req.params;
  const { reason, notes } = req.body;
  const target = refunds.find((r) => r.id === id);
  if (target) {
    target.status = "rejected";
    target.rejection_reason = reason;
    target.rejection_notes = notes;
    console.log(`[Backend API] Refund "${id}" rejected. Reason: "${reason}", Notes: "${notes || "none"}"`);
    return res.json({ success: true, message: `Refund ${id} rejected` });
  }
  return res.status(404).json({ error: `Refund ${id} not found` });
});

// --- Mount AdminKit Studio ---
const configPath = path.resolve(__dirname, "../admin.config.yaml");

app.use(
  "/admin",
  mountAdminStudio({
    configPath,
    basePath: "/admin",
    watchConfig: true,
  })
);

// Redirect root / to /admin
app.get("/", (_req, res) => {
  res.redirect("/admin");
});

const server = app.listen(PORT, () => {
  console.log(`[Express Demo] Server listening at http://localhost:${PORT}`);
  console.log(`[Express Demo] Admin dashboard: http://localhost:${PORT}/admin`);
  console.log(`[Express Demo] Admin metadata:  http://localhost:${PORT}/admin/__config`);
});

export { app, server };

