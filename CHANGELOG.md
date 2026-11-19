# Changelog

All notable changes to the AdminKit project will be documented in this file.

## 0.3.0

### Major Changes

- **Monorepo Package Consolidation**: Consolidated four previously separate packages (`@admin-kit-yu/core`, `@admin-kit-yu/cli`, `@admin-kit-yu/react`, `@admin-kit-yu/express`) into a single unified package named `admin-kit-yu`.
- **Modular Subpath Exports**:
  - `admin-kit-yu` and `admin-kit-yu/core`: Browser-safe core configuration schemas, safe AST evaluator, RBAC permission checker, and `AdminClient`.
  - `admin-kit-yu/react`: Embedded React Studio SPA components (`AdminStudio`) with zero Node standard library dependencies.
  - `admin-kit-yu/express`: Express middleware (`mountAdminStudio`) providing live config endpoints, subpath catch-all routing, and offline static asset delivery from bundled `dist/public`.
  - `admin-kit-yu/style.css`: Unified stylesheet for AdminKit Studio.
- **CLI Binary**:
  - Ships `admin-kit-yu` and `admin-kit` executables for `init`, `pull`, `diff`, `doctor`, and `studio` commands.
- **OpenAPI Introspection Enhancements**:
  - Filter out auxiliary `GET` endpoints from being incorrectly classified as row actions.
  - Extract child sub-resources into dedicated sub-resource views rather than flat row action buttons.
  - Detect multipart file uploads and map them to file inputs with `multipart/form-data` encoding.
  - Graceful fallback columns (`id`, `status`, `created_at`, `updated_at`) for schemas with empty properties.
- **Optional Peer Dependencies**:
  - Moved `express`, `react`, and `react-dom` to optional peer dependencies.
- **FastAPI Adapter Update**:
  - Updated `admin-kit-fastapi` middleware to resolve bundled assets from `packages/admin-kit/dist/public` or `node_modules/admin-kit-yu/dist/public`.

## 0.2.1

### Patch Changes

- OpenAPI parser fixes: GET endpoint filtering, detail endpoint classification, and fallback table columns.
- Relaxed action schema validation to allow explicit GET actions where configured.

## 0.2.0

### Minor Changes

- Added live `AdminClient` integration for bearer tokens, collection fetching, and RPC action execution.
- Added doctor console drawer and configuration diff tools.

## 0.1.0

### Initial Release

- Core schema parsing and validation.
- Basic React studio table components and Express mount router.
