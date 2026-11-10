# AdminKit

> Instant, declarative, API-driven admin dashboards generated from your OpenAPI specification.

[![CI](https://github.com/admin-kit/admin-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/admin-kit/admin-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-orange.svg)](https://pnpm.io/)
[![Turborepo](https://img.shields.io/badge/built%20with-Turborepo-000.svg)](https://turbo.build/repo)

**AdminKit** inspects any OpenAPI 3.0/3.1 backend specification, synthesizes a declarative configuration file (`admin.config.yaml`), and renders a full-featured single-page application (SPA) with zero frontend boilerplate. It delivers dynamic CRUD tables, role-based access control (RBAC), custom workflow actions (e.g., Approve / Reject), and an in-app diagnostic console.

---

## Key Features

- ⚡️ **Zero Frontend Boilerplate** — Convert your OpenAPI / Swagger spec into a production-grade admin studio in seconds.
- 🤖 **AI Workflow Synthesis** — Intelligently infers badge color maps (green/yellow/red/gray), conditional action visibility (`visible_if`), sensitive field masks (`sensitive: true`), and human-friendly column labels using Gemini.
- 🔒 **Safe Expression Evaluator** — Zero `eval()` or `new Function()`. Custom AST recursive-descent parser safely evaluates conditional row action visibility (e.g., `row.status == 'pending' && user.roles.includes('admin')`).
- 🛡️ **Role-Based Access Control (RBAC)** — Granular table column, filter, and action permission enforcement with real-time UI gating.
- 🩺 **Doctor Diagnostic Console** — Detects schema drift, missing endpoints, unmapped badge enums, and allows on-the-fly role simulation.
- 🔌 **Framework Agnostic** — Native adapters for **Node.js (Express)** and **Python (FastAPI / Starlette)** with 100% offline local asset delivery.

---

## Quickstart Guide

Get your admin panel running in 3 simple steps:

### Step 1: Introspect your API & Generate Config

Install the CLI and pull your OpenAPI specification:

```bash
# Generate admin.config.yaml from local file or remote URL
npx @admin-kit/cli pull --source=./openapi.json

# Optional: Enable AI synthesis to auto-generate badges and conditional visibility rules
export GEMINI_API_KEY="your-api-key"
npx @admin-kit/cli pull --source=./openapi.json --ai
```

### Step 2: Mount the Admin Studio Middleware

#### Option A: Node.js (Express)

Install `@admin-kit/express`:

```bash
npm install @admin-kit/express express
```

Mount the router in your Express server:

```typescript
import express from "express";
import { mountAdminStudio } from "@admin-kit/express";

const app = express();
app.use(express.json());

// Mount AdminKit Studio at /admin
app.use(
  "/admin",
  mountAdminStudio({
    configPath: "./admin.config.yaml",
  })
);

app.listen(3000, () => {
  console.log("Admin dashboard ready at http://localhost:3000/admin");
});
```

#### Option B: Python (FastAPI)

Install `admin-kit-fastapi`:

```bash
pip install admin-kit-fastapi fastapi uvicorn
```

Mount the studio in your FastAPI application:

```python
from fastapi import FastAPI
from admin_kit_fastapi import mount_admin_studio

app = FastAPI()

# Mount AdminKit Studio at /admin
mount_admin_studio(
    app,
    path="/admin",
    config_path="admin.config.yaml"
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
```

### Step 3: Open the Dashboard

Open your browser and navigate to:
- **Express**: [http://localhost:3000/admin](http://localhost:3000/admin)
- **FastAPI**: [http://localhost:8000/admin](http://localhost:8000/admin)

---

## Configuration Example (`admin.config.yaml`)

AdminKit uses a declarative, version-controlled YAML configuration file:

```yaml
version: "1.0"

project:
  name: "Acme Operations"
  logo: "/logo.svg"
  api_base_url: "http://localhost:3000/api"

auth:
  type: bearer
  token_key: "acme_admin_token"
  header_name: "Authorization"

resources:
  - id: refunds
    label: "Refund Requests"
    icon: "banknote"
    endpoint: "/refunds"
    primary_key: "id"

    table:
      searchable: true
      default_sort:
        field: "created_at"
        order: "desc"
      columns:
        - field: "id"
          label: "Refund ID"
          type: "string"

        - field: "user_id"
          label: "Customer"
          type: "relation"
          relation:
            resource: "users"
            display_field: "email"
            foreign_key: "id"

        - field: "amount"
          label: "Amount (USD)"
          type: "currency"

        - field: "status"
          label: "Status"
          type: "badge"
          badge_map:
            pending: "yellow"
            approved: "green"
            rejected: "red"

        - field: "notes"
          label: "Internal Notes"
          type: "string"
          sensitive: true # Masked unless explicitly toggled

      row_actions:
        - id: "approve"
          label: "Approve"
          endpoint: "/refunds/{id}/approve"
          method: "POST"
          style: "primary"
          # Safe AST evaluation: only visible when pending
          visible_if: "row.status == 'pending'"
          confirm:
            title: "Approve Refund"
            message: "Issue a refund of ${row.amount} to this customer?"

        - id: "reject"
          label: "Reject"
          endpoint: "/refunds/{id}/reject"
          method: "POST"
          style: "danger"
          visible_if: "row.status == 'pending'"
          confirm:
            title: "Reject Refund"
            message: "Are you sure you want to decline this refund request?"

rbac:
  default_policy: "allow"
  roles:
    support_tier_1:
      permissions:
        - resource: "refunds"
          actions: ["read"]
    finance_manager:
      permissions:
        - resource: "refunds"
          actions: ["read", "approve", "reject"]
```

---

## Monorepo Architecture

The repository is built as an ultra-fast, modular **pnpm + Turborepo** monorepo:

```text
admin-kit/
├── packages/
│   ├── core/                  # @admin-kit/core: Zod schemas, safe AST evaluator, RBAC & client
│   ├── cli/                   # @admin-kit/cli: OpenAPI introspector, diff engine, AI synthesis
│   ├── react/                 # @admin-kit/react: Dynamic UI engine, TanStack tables, Doctor drawer
│   └── express/               # @admin-kit/express: Node.js Express router & static bundle middleware
├── adapters/
│   └── fastapi/               # admin-kit-fastapi: Python Starlette/FastAPI mount adapter
├── examples/
│   ├── express-demo/          # Node.js + Express reference implementation
│   ├── fastapi-demo/          # Python + FastAPI reference implementation
│   └── react-demo/            # Standalone Vite React demo harness
├── docs/                      # Architectural specifications and schemas
├── .changeset/                # Release & changelog versioning configuration
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

### Package Overview

| Package | Environment | Responsibilities | Key Dependencies |
| :--- | :--- | :--- | :--- |
| **`@admin-kit/core`** | Universal (Node & Browser) | Configuration schema validation, AST `visible_if` evaluator, RBAC resolution, HTTP client. | `zod`, `yaml` |
| **`@admin-kit/cli`** | Node.js CLI | Commands (`init`, `pull`, `diff`, `doctor`, `studio`), OpenAPI parser, three-way merge, Gemini AI synthesis. | `commander`, `ai`, `@ai-sdk/google`, `@apidevtools/swagger-parser` |
| **`@admin-kit/react`** | Browser (React) | Dynamic UI tables, search/sort, relation lookups, detail drawers, Doctor Console, RBAC gates. | `@tanstack/react-table`, `react-hook-form`, `lucide-react` |
| **`@admin-kit/express`** | Node.js Backend | Express middleware serving compiled `@admin-kit/react` assets and `GET /__config`. | `express`, `@admin-kit/core` |
| **`admin-kit-fastapi`** | Python Backend | FastAPI adapter serving static UI assets and `GET {path}/__config` JSON endpoint. | `fastapi`, `pyyaml` |

---

## CLI Reference

The `@admin-kit/cli` binary provides comprehensive introspection and lifecycle utilities:

```bash
# Initialize a starter admin.config.yaml
admin-kit init

# Introspect an OpenAPI spec and update config
admin-kit pull --source=./openapi.json

# Introspect with AI workflow synthesis (badges, visibility, labels, sensitive fields)
admin-kit pull --source=./openapi.json --ai

# Detect schema drift between your backend and admin.config.yaml
admin-kit diff --source=./openapi.json

# Validate configuration integrity and check for missing endpoints
admin-kit doctor

# Launch an instant standalone preview studio
admin-kit studio --port=3000 --config=admin.config.yaml
```

---

## Development & Contributing

### Prerequisites

- **Node.js**: v20 or later
- **pnpm**: v9 or later
- **Python**: 3.10+ (for `admin-kit-fastapi`)

### Setup Instructions

```bash
# 1. Clone repository
git clone https://github.com/admin-kit/admin-kit.git
cd admin-kit

# 2. Install dependencies
pnpm install

# 3. Build all packages
pnpm build

# 4. Run automated test suites
node --experimental-strip-types --test packages/core/test/config.test.ts packages/cli/test/cli.test.ts packages/cli/test/ai.test.ts packages/express/test/express.test.ts
```

### Versioning & Releases

This monorepo uses [Changesets](https://github.com/changesets/changesets) for automated package versioning and changelog generation:

```bash
# Add a changeset describing your changes
pnpm changeset

# Version packages and update changelogs
pnpm version-packages
```

---

## License

MIT © [AdminKit Contributors](LICENSE)
