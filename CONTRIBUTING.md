# Contributing to AdminKit

Thank you for your interest in contributing to AdminKit! This document provides guidelines and workflows for contributing to our open-source codebase.

---

## Monorepo Architecture

AdminKit is organized as a pnpm workspace orchestrated by Turborepo:

- **`packages/core`** (`@admin-kit-yu/core`): Universal configuration schemas, AST recursive-descent expression evaluator, RBAC resolver, and HTTP client.
- **`packages/cli`** (`@admin-kit-yu/cli`): Introspection CLI, three-way merge engine, and AI synthesis.
- **`packages/react`** (`@admin-kit-yu/react`): Dynamic UI engine, TanStack tables, form builders, and diagnostic console.
- **`packages/express`** (`@admin-kit-yu/express`): Node.js Express middleware for runtime static asset and configuration delivery.
- **`adapters/fastapi`** (`admin-kit-fastapi`): Python FastAPI / Starlette adapter.
- **`examples/`**: Reference implementations for Express and FastAPI.

---

## Development Setup

### Prerequisites

- **Node.js**: v20.0.0 or later
- **pnpm**: v9.0.0 or later
- **Python**: v3.10 or later (for FastAPI adapter development)

### 1. Clone & Install

```bash
git clone https://github.com/admin-kit/admin-kit.git
cd admin-kit
pnpm install
```

### 2. Build Packages

Build all packages using Turborepo:

```bash
pnpm build
```

### 3. Run Automated Tests

Run the complete Node.js test suite:

```bash
node --experimental-strip-types --test packages/core/test/config.test.ts packages/core/test/evaluator.test.ts packages/core/test/client.test.ts packages/core/test/rbac.test.ts packages/cli/test/cli.test.ts packages/cli/test/ai.test.ts packages/express/test/express.test.ts
```

Run Python adapter tests:

```bash
cd examples/fastapi-demo
python test_fastapi.py
```

---

## Development Workflows

### Creating a Changeset

All user-facing changes (bug fixes, features, breaking changes) must be accompanied by a changeset:

```bash
pnpm changeset
```

Select the affected packages, choose the bump level (`patch`, `minor`, `major`), and provide a clear, concise summary of the change.

### Coding Standards

- **TypeScript**: Strict type checking enabled. Avoid `any` where possible.
- **Security**: Never introduce `eval()`, `new Function()`, or dynamic code execution in evaluator or runtime code paths.
- **Offline Delivery**: The `@admin-kit-yu/react` bundle served by backend adapters must be self-contained and free of external runtime CDN dependencies.
- **Non-Destructive Synchronization**: CLI operations must preserve user-customized labels, badge mappings, and visibility rules when merging upstream OpenAPI changes.

---

## Pull Request Guidelines

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Write unit tests covering your changes.
3. Ensure all tests and type checks pass.
4. Submit a Pull Request with a clear description of the problem solved and implementation strategy.

