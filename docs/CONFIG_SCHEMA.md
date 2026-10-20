# AdminKit Configuration Schema Specification

## 1. Overview
`admin.config.yaml` is the declarative contract for `admin-kit`. It bridges the backend API and the generated Admin UI:
* **CLI (`@admin-kit/cli`):** Introspects OpenAPI specs and generates this file.
* **Core (`@admin-kit/core`):** Validates this file at runtime.
* **UI (`@admin-kit/react`):** Reads this file to render tables, forms, workflow modals, and RBAC rules.

---

## 2. Top-Level Structure

| Key | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `version` | `string` | Yes | Schema version (currently `"1.0"`). |
| `project` | `object` | Yes | Global metadata, base API path, and UI branding. |
| `auth` | `object` | No | Authentication endpoints, token storage, and claim paths. |
| `access` | `object` | No | Global role-based access control (RBAC) defaults. |
| `resources` | `map` | Yes | Dictionary of data collections, tables, CRUD rules, and custom actions. |

---

## 3. Section Specifications

### 3.1 `project`
Defines global application settings and branding.
* `name` *(string, required)*: Title displayed in the dashboard sidebar and browser tab.
* `base_url` *(string, default: `"/api"`)*: Base prefix prepended to all relative resource endpoints.
* `branding` *(object, optional)*:
  * `logo_url` *(string)*: Path or URL to the brand logo.
  * `primary_color` *(string, default: `"#4f46e5"`)*: Hex color code for primary buttons and active states.
  * `theme` *(enum: `"light"` | `"dark"` | `"system"`, default: `"system"`)*: Color mode preference.

### 3.2 `auth`
Configures how the dashboard authenticates admins and discovers permissions.
* `strategy` *(enum: `"bearer"` | `"cookie"` | `"custom_header"`, default: `"bearer"`)*: How auth credentials are sent.
* `login_endpoint` *(string, required)*: POST endpoint accepting credentials.
* `logout_endpoint` *(string, optional)*: POST endpoint to clear session.
* `refresh_endpoint` *(string, optional)*: POST endpoint to refresh expired tokens.
* `me_endpoint` *(string, required)*: GET endpoint returning the logged-in user's profile, roles, and permissions.
* `token_storage` *(enum: `"localStorage"` | `"sessionStorage"` | `"cookie"`, default: `"sessionStorage"`)*: Where tokens are persisted client-side.
* `role_claim_path` *(string, default: `"roles"`)*: Dot-notation path to extract roles from the `me_endpoint` JSON response (e.g., `"user.roles"`).
* `permission_claim_path` *(string, default: `"permissions"`)*: Dot-notation path to extract granular permissions.

### 3.3 `access` (Global RBAC)
* `default_policy` *(enum: `"allow"` | `"deny"`, default: `"deny"`)*: Fallback behavior when a resource does not explicitly define access rules.
* `superadmin_roles` *(string[], default: `["superadmin"]`)*: Roles that bypass all resource, field, and action restrictions.

---

## 4. `resources` Specification

Each key under `resources` represents a unique entity (e.g., `users`, `refund_requests`).

* `label` *(string, required)*: Human-readable plural name shown in the sidebar.
* `icon` *(string, optional)*: Lucide icon name for navigation.
* `endpoint` *(string, required)*: Base collection path (e.g., `"/refunds"`).
* `primary_key` *(string, default: `"id"`)*: Unique identifier field for rows.
* `access` *(object, optional)*:
  * `roles` *(string[])*: Roles allowed to view this resource.
  * `permissions` *(string[])*: Permissions allowed to view this resource.

### 4.1 `table`
Controls how the collection list view renders.
* `page_size` *(number, default: `20`)*: Number of rows fetched per page.
* `default_sort` *(object)*: `{ field: string, direction: "asc" | "desc" }`.
* `searchable_fields` *(string[])*: Fields queried via the global search input.
* `filterable_fields` *(string[])*: Fields given dedicated filter dropdowns in the toolbar.
* `columns` *(array, required)*:
  * `key` *(string, required)*: JSON property name in the API response.
  * `label` *(string, required)*: Column header text.
  * `type` *(enum)*: `"string"` | `"number"` | `"boolean"` | `"currency"` | `"date"` | `"datetime"` | `"badge"` | `"relation"` | `"json"` | `"image"`.
  * `sortable` *(boolean, default: `false`)*: Enables column header sorting.
  * `copyable` *(boolean, default: `false`)*: Adds a one-click copy icon to the cell.
  * `sensitive` *(boolean, default: `false`)*: Masks value (`••••••`) until clicked.
  * `badge_map` *(map, optional)*: Maps enum values to colors (`"gray"`, `"red"`, `"yellow"`, `"green"`, `"blue"`, `"purple"`).
  * `relation` *(object, optional)*: `{ target_resource: string, value_field: string, display_field: string }`.
  * `access` *(object, optional)*: Role/permission restrictions for this specific column.

### 4.2 `mutations` (Standard CRUD)
Defines Create, Update, and Delete behavior on the resource.
* `creatable` *(boolean | object, default: `false`)*
* `editable` *(boolean | object, default: `false`)*
* `deletable` *(boolean | object, default: `false`)*

When specified as an object:
* `enabled` *(boolean)*
* `endpoint` *(string)*: Supports `{id}` interpolation (e.g., `"/refunds/{id}"`).
* `method` *(enum)*: `"POST"` | `"PUT"` | `"PATCH"` | `"DELETE"`.
* `roles` / `permissions` *(string[])*: Who can trigger this mutation.
* `fields` *(array)*: List of form inputs (`key`, `label`, `type`, `required`, `options`, `placeholder`).

### 4.3 `actions` (Custom Workflows: Approve, Reject, etc.)
Defines custom RPC buttons for state transitions and business operations.
* `name` *(string, required)*: Unique identifier for the action.
* `label` *(string, required)*: Button text.
* `icon` *(string, optional)*: Lucide icon name.
* `style` *(enum)*: `"primary"` | `"secondary"` | `"success"` | `"danger"` | `"warning"`.
* `scope` *(enum, default: `"row"`)*: `"row"` (single item) | `"bulk"` (selected items) | `"global"` (top toolbar).
* `visible_if` *(string, optional)*: Conditional expression evaluated against the row data (e.g., `"row.status == 'pending'"`).
* `access` *(object, optional)*: `roles` and `permissions` required to see and execute the action.
* `confirm_dialog` *(object, optional)*: `{ title: string, message: string, confirm_text: string }`.
* `api` *(object, required)*:
  * `endpoint` *(string, required)*: Target path with `{id}` interpolation (e.g., `"/refunds/{id}/approve"`).
  * `method` *(enum, default: `"POST"`)*: `"POST"` | `"PUT"` | `"PATCH"` | `"DELETE"`.
* `inputs` *(array, optional)*: Form fields rendered inside a modal when the action requires user input (e.g., a rejection reason dropdown or notes textarea).
* `on_success` *(object, optional)*:
  * `toast` *(string)*: Success notification message.
  * `invalidate` *(string[])*: List of resource keys to re-fetch after completion.

---

## 5. Complete Example (`admin.config.yaml`)

```yaml
version: "1.0"

project:
  name: "Operations Admin"
  base_url: "/api/v1"
  branding:
    primary_color: "#4f46e5"
    theme: "system"

auth:
  strategy: "bearer"
  login_endpoint: "/auth/login"
  me_endpoint: "/auth/me"
  role_claim_path: "user.roles"

access:
  default_policy: "deny"
  superadmin_roles: ["superadmin"]

resources:
  refund_requests:
    label: "Refund Requests"
    endpoint: "/refunds"
    primary_key: "id"
    access:
      roles: ["finance", "support"]

    table:
      page_size: 25
      searchable_fields: ["customer_email"]
      filterable_fields: ["status"]
      columns:
        - key: "id"
          label: "ID"
          type: "string"
          copyable: true
        - key: "customer_email"
          label: "Customer"
          type: "string"
        - key: "amount"
          label: "Amount"
          type: "currency"
          sortable: true
        - key: "status"
          label: "Status"
          type: "badge"
          badge_map:
            pending: "yellow"
            approved: "green"
            rejected: "red"

    mutations:
      creatable: false
      editable: false
      deletable:
        enabled: true
        endpoint: "/refunds/{id}"
        method: "DELETE"
        roles: ["superadmin"]

    actions:
      - name: "approve"
        label: "Approve"
        style: "success"
        visible_if: "row.status == 'pending'"
        access:
          roles: ["finance"]
        confirm_dialog:
          title: "Approve Refund?"
          message: "This will immediately refund the customer."
        api:
          endpoint: "/refunds/{id}/approve"
          method: "POST"
        on_success:
          toast: "Refund approved."
          invalidate: ["refund_requests"]

      - name: "reject"
        label: "Reject"
        style: "danger"
        visible_if: "row.status == 'pending'"
        access:
          roles: ["finance", "support"]
        api:
          endpoint: "/refunds/{id}/reject"
          method: "POST"
        inputs:
          - key: "reason"
            label: "Rejection Reason"
            type: "select"
            required: true
            options:
              - label: "Fraudulent"
                value: "fraud"
              - label: "Out of Policy"
                value: "policy"
          - key: "notes"
            label: "Internal Notes"
            type: "textarea"
            required: false
        on_success:
          toast: "Refund rejected."
          invalidate: ["refund_requests"]