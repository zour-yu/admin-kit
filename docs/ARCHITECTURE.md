# AdminKit System Architecture (`ARCHITECTURE.md`)

## 1. System Overview
`admin-kit` is an API-driven internal tool and admin dashboard generator. It inspects a backend's OpenAPI 3.0/3.1 specification, synthesizes a declarative configuration file (`admin.config.yaml`), and renders a full-featured single-page application (SPA) supporting CRUD tables, role-based access control (RBAC), custom RPC workflow actions (e.g., Approve/Reject), and an in-app diagnostic console.

---

## 2. Monorepo Structure

The repository is organized as a **pnpm + Turborepo** monorepo divided into distinct, decoupled packages:

```text
admin-kit/
├── docs/
│   ├── CONFIG_SCHEMA.md
│   ├── ARCHITECTURE.md
│   ├── CLI_SPEC.md
│   └── UI_ENGINE_SPEC.md
├── packages/
│   ├── core/               # @admin-kit/core
│   ├── cli/                # @admin-kit/cli
│   ├── react/              # @admin-kit/react
│   └── express/            # @admin-kit/express
├── adapters/
│   └── fastapi/            # admin-kit-fastapi (Python package)
├── examples/
│   ├── express-demo/       # Sample Node.js backend + mounted admin
│   └── fastapi-demo/       # Sample Python backend + mounted admin
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

---

## 3. Package Responsibilities & Boundaries

| Package | Environment | Core Responsibilities | Dependencies |
| :--- | :--- | :--- | :--- |
| **`@admin-kit/core`** | Universal (Node & Browser) | Houses the Zod schema validator for `admin.config.yaml`, TypeScript interfaces, safe AST expression evaluator (`visible_if`), RBAC permission resolver, and the HTTP fetch client with auth interceptors. | `zod`, `yaml` |
| **`@admin-kit/cli`** | Node.js CLI | Implements terminal commands (`init`, `pull`, `diff`, `doctor`, `studio`). Parses OpenAPI specs, runs AI workflow synthesis, detects schema drift, and emits `admin.config.yaml`. | `@admin-kit/core`, `commander`, `@apidevtools/swagger-parser`, `ai` |
| **`@admin-kit/react`** | Browser (React / Vite) | Renders the dynamic UI studio: data tables, forms, action confirmation modals, navigation sidebar, RBAC gates, and the Doctor diagnostic drawer. Compiles into static HTML/CSS/JS assets (`dist/`). | `@admin-kit/core`, `react`, `@tanstack/react-table`, `@tanstack/react-query`, `react-hook-form`, `tailwindcss` |
| **`@admin-kit/express`** | Node.js Backend | Express/Connect middleware that serves the pre-compiled `@admin-kit/react` static bundle and injects the project's `admin.config.yaml` at runtime. | `@admin-kit/core`, `@admin-kit/react` |
| **`admin-kit-fastapi`** | Python Backend | Starlette/FastAPI `StaticFiles` mount adapter that serves the pre-compiled UI assets and exposes `admin.config.yaml` to the browser. | `fastapi`, `pyyaml` |

---

## 4. End-to-End Data & Execution Flows

### 4.1 Schema Generation Flow (Build / Development Time)
1. **Introspection:** Developer runs `npx @admin-kit/cli pull --source=<openapi_url>`.
2. **Dereferencing:** The CLI fetches the OpenAPI JSON/YAML document and resolves all `$ref` pointers into a normalized endpoint graph.
3. **Classification & AI Synthesis:**
   * Standard REST paths (`GET`, `POST`, `PATCH`, `DELETE` on `/resource` and `/resource/{id}`) are grouped into **Resources** and **Mutations**.
   * Sub-resource POST/PUT endpoints (e.g., `/resource/{id}/approve`) are classified as **Custom Actions**.
   * If `--ai` is enabled, the normalized graph is passed to the LLM to infer badge colors, sensitive PII fields, `visible_if` conditions, and primary table columns.
4. **Output:** The CLI validates the generated object against `@admin-kit/core` and writes `admin.config.yaml` to the project root.

### 4.2 Runtime Delivery Flow (Backend Middleware Model)
1. **Mounting:** The host backend mounts the middleware at a designated route (e.g., `/admin`) and points it to `./admin.config.yaml`.
2. **Config Endpoint:** The middleware automatically exposes a read-only metadata route at `/admin/__config` that parses `admin.config.yaml` and returns it as validated JSON.
3. **SPA Serving:** Any browser request to `/admin/*` returns the pre-built `index.html` and static JS/CSS assets from `@admin-kit/react/dist`.
4. **Bootstrapping:** On load, the React SPA fetches `/admin/__config`, initializes the `@admin-kit/core` registry, checks authentication via `auth.me_endpoint`, and renders the permitted navigation and views.

### 4.3 Action & Mutation Execution Flow
1. **Trigger:** An admin clicks an action button (e.g., `Reject`) on a table row.
2. **Pre-Flight Check:** `@admin-kit/react` checks if `inputs` or `confirm_dialog` are defined in the config. If present, it opens a modal and validates user input.
3. **Dispatch:** `@admin-kit/core` interpolates URL parameters (replacing `{id}` with the row's primary key) and dispatches the HTTP request with the active auth credentials (Bearer token or session cookie).
4. **Revalidation:** Upon a `2xx` response, the UI triggers the configured toast notification and instructs TanStack Query to invalidate and refetch the target resource tables.
5. **Diagnostics:** If a `4xx` or `5xx` error occurs, or if the response payload violates the expected schema, the event is logged to the in-app **Doctor Console**.

---

## 5. Deployment Modes

`admin-kit` supports three deployment topologies using the exact same `admin.config.yaml`:

1. **Embedded Backend Middleware (Recommended):** Served directly by the backend server (Express, NestJS, FastAPI) under `/admin`. Same-origin requests eliminate CORS configurations and extra hosting infrastructure.
2. **Embedded Frontend Route:** Imported as a lazy-loaded React component (`<AdminStudio />`) inside an existing Next.js or Vite frontend repository under `/admin`.
3. **Standalone Local Studio:** Launched on-demand via `npx @admin-kit/cli studio`, spinning up a local Vite preview server that proxies API requests to the target backend.

---

## 6. Security & Isolation Principles
* **UI is Presentation Only:** All RBAC rules (`roles`, `permissions`, `visible_if`) in `admin.config.yaml` control UI visibility for user experience. The backend API remains responsible for enforcing authentication and authorization on every endpoint.
* **No `eval()` Execution:** Conditional expressions in `visible_if` are parsed by a strict, sandboxed comparator in `@admin-kit/core` that only permits basic equality and array membership checks against row and user state.
* **Zero Customer Bundle Leakage:** When deployed via backend middleware or dynamic route code-splitting, zero bytes of admin schemas or UI dependencies are shipped to public end-users.