# AdminKit CLI & Introspection Specification (`CLI_SPEC.md`)

## 1. Overview
`@admin-kit/cli` is the command-line tool that bridges backend API specifications and the declarative `admin.config.yaml` schema. It inspects OpenAPI 3.0/3.1 documents, classifies endpoints into data tables and custom workflows, optionally enhances configurations using LLM inference, detects schema drift, and runs a local studio server.

---

## 2. Command Reference

### 2.1 `init`
Initializes `admin-kit` in the current repository by creating a starter `admin.config.yaml` and adding `.admin-kit/` to `.gitignore`.

* **Usage:** `npx @admin-kit/cli init [options]`
* **Options:**
  * `--output <path>`: Path for the generated config file (default: `./admin.config.yaml`).
  * `--base-url <url>`: Default API base URL prefix (default: `"/api"`).

### 2.2 `pull`
Introspects a live OpenAPI URL or local JSON/YAML spec file and generates or updates `admin.config.yaml`.

* **Usage:** `npx @admin-kit/cli pull --source <url_or_path> [options]`
* **Options:**
  * `--source <string>` *(required)*: HTTP URL or local file path to the OpenAPI 3.0/3.1 specification.
  * `--output <path>`: Target configuration file path (default: `./admin.config.yaml`).
  * `--ai`: Enables LLM-assisted synthesis for workflow pairing, badge mapping, column prioritization, and PII detection.
  * `--provider <name>`: AI provider to use when `--ai` is passed (`"gemini"` | `"openai"` | `"anthropic"`, default: `"gemini"`).
  * `--force`: Overwrites the existing configuration completely without performing a three-way merge.

### 2.3 `diff`
Compares the current `admin.config.yaml` against an updated OpenAPI specification and outputs a report of added, modified, or broken endpoints without modifying the config file.

* **Usage:** `npx @admin-kit/cli diff --source <url_or_path> [options]`
* **Options:**
  * `--source <string>` *(required)*: URL or file path to the latest OpenAPI spec.
  * `--config <path>`: Path to existing `admin.config.yaml` (default: `./admin.config.yaml`).
* **Exit Codes:** Returns `0` if fully in sync, `1` if breaking drift (missing endpoints or missing required payload fields) is detected. Ideal for CI/CD pipelines.

### 2.4 `doctor`
Validates the syntax of `admin.config.yaml` against `@admin-kit/core` and optionally pings the live backend to verify endpoint reachability.

* **Usage:** `npx @admin-kit/cli doctor [options]`
* **Options:**
  * `--config <path>`: Path to `admin.config.yaml` (default: `./admin.config.yaml`).
  * `--live <base_url>`: Base URL of the running backend to test endpoint reachability and CORS headers.

### 2.5 `studio`
Spins up a standalone local web server serving `@admin-kit/react` bound to the local `admin.config.yaml`.

* **Usage:** `npx @admin-kit/cli studio [options]`
* **Options:**
  * `--config <path>`: Path to `admin.config.yaml` (default: `./admin.config.yaml`).
  * `--port <number>`: Local port to serve the UI (default: `3333`).
  * `--watch`: Watches `admin.config.yaml` for file changes and hot-reloads the UI.

---

## 3. OpenAPI Introspection Heuristics (Deterministic Engine)

Before any AI processing, the CLI runs a deterministic parser that dereferences all `$ref` pointers and groups flat API paths into structured entities.

### 3.1 Resource Grouping
Endpoints are grouped by their primary noun segment after stripping common version prefixes (`/api`, `/v1`, `/v2`):
* `/api/v1/users` and `/api/v1/users/{id}` $\rightarrow$ Resource key: `users`
* `/api/v1/refund-requests` $\rightarrow$ Resource key: `refund_requests`

### 3.2 Standard CRUD Mapping
Within each resource group, standard HTTP methods map as follows:

| HTTP Method & Path Pattern | Mapped Config Section | Behavior |
| :--- | :--- | :--- |
| `GET /<resource>` | `table` | Extracts response array item schema to generate `table.columns`. Query parameters (`search`, `page`, `limit`, enums) populate `searchable_fields` and `filterable_fields`. |
| `POST /<resource>` | `mutations.creatable` | Extracts request body properties to populate `creatable.fields`. |
| `PUT` or `PATCH /<resource>/{id}` | `mutations.editable` | Extracts request body properties to populate `editable.fields`. |
| `DELETE /<resource>/{id}` | `mutations.deletable` | Sets `deletable.enabled = true` and maps the target endpoint. |

### 3.3 Custom Action (RPC) Detection
Any route under a resource that includes an additional verb or sub-segment after `{id}` (or operates as a non-standard POST/PUT command) is classified as an entry under `actions`:
* **Pattern:** `POST | PUT | PATCH /<resource>/{id}/<action_verb>`
* **Examples:**
  * `POST /refunds/{id}/approve` $\rightarrow$ Action `name: "approve"`, `scope: "row"`
  * `POST /refunds/{id}/reject` $\rightarrow$ Action `name: "reject"`, `scope: "row"`
  * `POST /users/{id}/ban` $\rightarrow$ Action `name: "ban"`, `scope: "row"`
* **Action Inputs:** If the endpoint defines a `requestBody` schema in OpenAPI, each property in the schema is converted into an entry inside `action.inputs` (mapping types, required flags, and enum options).

### 3.4 Type & Format Inference
OpenAPI property types and formats map deterministically to `admin-kit` column and input types:

| OpenAPI Type + Format | `admin-kit` Column / Input Type |
| :--- | :--- |
| `type: string`, `format: date-time` | `datetime` |
| `type: string`, `format: date` | `date` |
| `type: string`, `enum: [...]` | `badge` (in tables) / `select` (in forms) |
| `type: boolean` | `boolean` |
| `type: integer` or `number` | `number` (or `currency` if key matches `*amount*`, `*price*`, `*cost*`, `*balance*`) |
| `type: object` or `array` | `json` |
| Property ending in `_id` or `Id` | `relation` (if a matching plural resource exists in the spec) |

---

## 4. AI Synthesis Layer (`--ai` Flag)

When `--ai` is enabled during `pull`, the CLI passes the deterministically parsed configuration stub to the configured LLM (`GEMINI_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY`) to enrich operational context that raw OpenAPI specs lack.

### 4.1 AI Enrichment Responsibilities
1. **State & Workflow Pairing (`visible_if`):**
   * Analyzes resource `status` or `state` enums alongside detected `actions`.
   * Writes conditional visibility expressions (e.g., setting `visible_if: "row.status == 'pending'"` on both `approve` and `reject` actions).
2. **Action Styling & Confirmation Prompts:**
   * Assigns semantic button styles (`"success"` for approve/verify/activate, `"danger"` for reject/delete/ban/revoke, `"warning"` for suspend/escalate).
   * Generates human-readable `confirm_dialog` titles and warning messages for state-mutating or destructive actions.
3. **Badge Color Assignment:**
   * Maps enum values in status columns to semantic colors (`pending`/`processing` $\rightarrow$ `yellow`, `approved`/`active`/`completed` $\rightarrow$ `green`, `rejected`/`failed`/`banned` $\rightarrow$ `red`).
4. **Column Prioritization:**
   * If a resource contains more than 8 fields, selects the 5 to 7 highest-signal operational columns for the main table and sets `hidden_by_default: true` on secondary metadata columns (so they only appear in the detail slide-over).
5. **Sensitive Data & PII Masking:**
   * Identifies sensitive keys (`ssn`, `tax_id`, `password_hash`, `secret`, `token`, `bank_account`, `routing_number`) and sets `sensitive: true` on columns or omits them from public table views.

### 4.2 AI Guardrails
* **Structured Output Enforcement:** The LLM response is constrained using the Zod `AdminKitConfigSchema` via structured JSON output mode.
* **No Hallucinated Endpoints:** A post-processing validation step verifies that every `endpoint` and `method` returned by the AI exists verbatim in the source OpenAPI document. Any hallucinated path is rejected.

---

## 5. Three-Way Merge & Schema Drift Resolution

Re-running `npx @admin-kit/cli pull` on an existing project must never overwrite manual developer customizations (such as custom RBAC roles, tweaked labels, or custom widget names).

1. **Snapshot Storage:** Every successful `pull` saves a normalized hash of the OpenAPI spec inside `.admin-kit/snapshot.json`.
2. **Merge Rules on Subsequent Pulls:**
   * **New Endpoints/Fields:** Appended to `admin.config.yaml`.
   * **User-Modified Properties:** Preserved (existing `label`, `access`, `visible_if`, `badge_map`, and `style` settings are never overwritten).
   * **Removed Endpoints:** Flagged in terminal output with a `[WARN]` notice rather than silently deleting the block, allowing the developer to update the path or remove it intentionally.