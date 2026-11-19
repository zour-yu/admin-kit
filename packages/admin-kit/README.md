# admin-kit-yu

> Instant, declarative, API-driven admin dashboards generated from your OpenAPI specification.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/admin-kit-yu.svg)](https://www.npmjs.com/package/admin-kit-yu)

`admin-kit-yu` is the unified package providing the core configuration engine, OpenAPI introspector CLI, embedded React studio, and Express middleware in a single dependency with modular subpath exports.

---

## Subpath Exports

To ensure frontend bundlers (Vite, Next.js, Remix) never pull in Node-only dependencies (`fs`, `express`, `commander`), `admin-kit-yu` exposes dedicated subpath entrypoints:

| Subpath | Description | Environment |
| :--- | :--- | :--- |
| `admin-kit-yu` / `admin-kit-yu/core` | Zod schema, AST evaluator, RBAC rules, HTTP API client | Browser & Node.js |
| `admin-kit-yu/react` | Embedded React Studio SPA components (`AdminStudio`) | Browser |
| `admin-kit-yu/style.css` | AdminKit Studio stylesheet | Browser |
| `admin-kit-yu/express` | Express router middleware to mount the Studio | Node.js |

---

## Quick Start

### 1. CLI: Introspect OpenAPI & Generate Config

```bash
# Introspect an OpenAPI spec and write admin.config.yaml
npx admin-kit-yu pull --source=http://localhost:3000/openapi.json

# Optional: Enrich with AI-generated badge colors, labels, and visibility rules
npx admin-kit-yu pull --source=./openapi.json --ai
```

### 2. Express Backend Integration

```bash
npm install admin-kit-yu express
```

```typescript
import express from "express";
import { mountAdminStudio } from "admin-kit-yu/express";

const app = express();
app.use(express.json());

// Mount the Studio at /admin
app.use(
  "/admin",
  mountAdminStudio({
    configPath: "./admin.config.yaml",
    basePath: "/admin",
  })
);

app.listen(3000, () => {
  console.log("AdminKit Studio running at http://localhost:3000/admin");
});
```

### 3. Custom React Application Integration

```bash
npm install admin-kit-yu react react-dom
```

```tsx
import React from "react";
import { AdminStudio } from "admin-kit-yu/react";
import "admin-kit-yu/style.css";

export function AdminPage() {
  return (
    <AdminStudio
      configUrl="/api/admin/config"
    />
  );
}
```

---

## License

MIT © AdminKit Contributors
