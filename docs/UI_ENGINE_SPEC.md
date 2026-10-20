# AdminKit UI Engine Specification (`UI_ENGINE_SPEC.md`)

## 1. Overview
`@admin-kit/react` is the frontend rendering engine for `admin-kit`. It consumes a validated `admin.config.yaml` schema object, enforces role-based access control (RBAC) at the presentation layer, renders dynamic data tables, forms, and custom workflow modals, and provides an integrated diagnostic console (**Doctor**).

---

## 2. Component Hierarchy

The UI follows a modular, context-driven component tree:

```text
<AdminStudio>
 ├── <ConfigProvider>                  # Parses & provides validated admin.config.yaml
 ├── <DoctorProvider>                  # Captures network errors, schema drift & role simulation
 ├── <AuthProvider>                    # Manages session state, tokens & /auth/me profile
 │    ├── <LoginView/>                # Rendered when unauthenticated
 │    └── <RBACGuard>                  # Evaluates global & route-level permissions
 │         └── <AppShell>
 │              ├── <SidebarNav/>     # Renders permitted resource links & branding
 │              ├── <TopHeader>
 │              │    ├── <Breadcrumbs/>
 │              │    ├── <DoctorStatusBadge/>
 │              │    └── <UserProfileMenu/>
 │              ├── <ResourceWorkspace>
 │              │    ├── <ResourceHeader>
 │              │    │    ├── <GlobalActionsToolbar/>
 │              │    │    └── <CreateResourceButton/>
 │              │    ├── <TableFilterBar>
 │              │    │    ├── <SearchInput/>
 │              │    │    ├── <ColumnFilterDropdowns/>
 │              │    │    └── <BulkActionsBar/>
 │              │    ├── <DynamicDataTable>
 │              │    │    ├── <SortableColumnHeader/>
 │              │    │    ├── <CellRenderer/>
 │              │    │    └── <RowActionsCell/>
 │              │    └── <PaginationBar/>
 │              ├── <Overlays>
 │              │    ├── <RecordDetailDrawer/>
 │              │    ├── <MutationFormModal/>
 │              │    └── <ActionExecutionModal/>
 │              └── <DoctorConsoleDrawer/>
```

---

## 3. State Management & Data Fetching

### 3.1 Server State (`@tanstack/react-query`)
All API interactions are managed through standardized query keys to enable predictable caching and automatic invalidation:
* **Collection List:** `['resource', resourceKey, 'list', { page, pageSize, sort, search, filters }]`
* **Single Record Detail:** `['resource', resourceKey, 'detail', recordId]`
* **Relation Lookup Cache:** `['relation', targetResource, displayField]`
* **User Identity:** `['auth', 'me']`

### 3.2 Client State (React Context)
* **`ConfigContext`:** Holds the immutable, parsed `AdminKitConfig` object and theme tokens.
* **`AuthContext`:** Stores authentication status, active user profile, extracted roles (`user.roles`), permissions (`user.permissions`), and simulated role overrides from the Doctor console.
* **`OverlayContext`:** Controls the active open/closed state and target row payload for the detail drawer, CRUD modals, and custom action modals.
* **`DoctorContext`:** Maintains a ring buffer of recent network requests, schema validation warnings, and missing badge mappings.

---

## 4. Dynamic Table Engine (`<DynamicDataTable />`)

Built on **TanStack Table v8**, the table engine adapts to each resource's `table` specification:

### 4.1 Cell Type Rendering (`<CellRenderer />`)
Each column's `type` dictates its visual formatting:
* **`string` / `number`:** Standard text rendering; supports optional one-click copy button if `copyable: true`.
* **`currency`:** Formatted via `Intl.NumberFormat` using the column's `currency_code`.
* **`date` / `datetime`:** Formatted into localized human-readable timestamps with full ISO string tooltips on hover.
* **`boolean`:** Rendered as semantic status icons (check/cross) or pill tags.
* **`badge`:** Looks up the raw cell value in `badge_map` and renders a colored pill. If a runtime value is missing from `badge_map`, renders a neutral gray badge and dispatches a warning to the Doctor Console.
* **`sensitive`:** Masks the value (`••••••••`) by default with an eye-toggle icon to reveal in place.
* **`relation`:** Batches and deduplicates foreign key IDs visible on the current page, resolves their `display_field` from `target_resource`, and renders a clickable link that opens the related record's detail drawer.
* **`json`:** Renders a truncated preview pill that expands into a syntax-highlighted JSON viewer inside the detail drawer.

### 4.2 Row & Bulk Actions
* **Row Actions (`scope: "row"`):** Rendered inline in the rightmost column (up to 2 primary buttons, with additional actions tucked into a `•••` dropdown menu).
* **Visibility Evaluation:** Before rendering any action button for a row, the engine evaluates:
  1. **RBAC Check:** Does the active user satisfy `action.access.roles` and `action.access.permissions`?
  2. **State Check:** Does `action.visible_if` evaluate to `true` against the current `row` data object?
  If either check fails, the button is omitted from the DOM.

---

## 5. Dynamic Form & Action Modal Engine

Both standard CRUD mutations (`creatable`, `editable`) and custom workflow actions (`actions` with `inputs`) share a unified `<DynamicForm />` engine powered by **React Hook Form** and **Zod**.

### 5.1 Action Execution Lifecycle (`<ActionExecutionModal />`)
When an admin clicks a custom action (e.g., `Approve` or `Reject`):

1. **Immediate Execution vs. Modal Prompt:**
   * If the action has neither `confirm_dialog` nor `inputs`, the request fires immediately with a loading spinner on the button.
   * If `confirm_dialog` is defined (e.g., `Approve`), a confirmation alert modal opens displaying `title`, `message`, and styled confirm/cancel buttons.
   * If `inputs` are defined (e.g., `Reject` requiring a `reason` select and `explanation` textarea), a form modal opens and dynamically renders the specified inputs.
2. **Validation:** Client-side validation enforces `required`, `min`, `max`, and `regex` rules defined in the schema before enabling submission.
3. **Request Dispatch:**
   * Interpolates URL parameters (replacing `{id}` with the row's `primary_key` value).
   * Sends the form input values as a JSON body using the specified HTTP method (`POST`, `PUT`, `PATCH`, `DELETE`).
4. **Post-Execution Handling (`on_success`):**
   * Displays the configured toast notification.
   * Closes the active modal.
   * Invalidates all TanStack Query keys listed in `on_success.invalidate` (plus the current resource table), triggering a seamless background refetch so row statuses and action buttons update immediately.

---

## 6. In-App Diagnostic Console (`<DoctorConsoleDrawer />`)

The Doctor Console is a slide-over developer panel accessible in development mode (or by users with `superadmin` roles) via a floating status badge in the top header.

### 6.1 Real-Time Diagnostic Checks
The console passively monitors runtime traffic between the UI and backend API and flags four categories of issues:

1. **Contract & Schema Drift:**
   * Detects when a column key defined in `admin.config.yaml` is missing (`undefined`) in the actual JSON response returned by the collection endpoint.
   * Detects type mismatches (e.g., config expects `number` for `amount`, but API returns an object or non-numeric string).
2. **Unmapped Enum / Badge States:**
   * Alerts when a `badge` column receives a status string from the backend (e.g., `"under_investigation"`) that has no color assigned in `badge_map`.
3. **Broken Endpoints & HTTP Errors:**
   * Captures `404 Not Found`, `405 Method Not Allowed`, `422 Unprocessable Entity`, and `500 Internal Server Error` responses during table fetches or action executions, displaying the exact request URL, payload sent, and raw server response body.
4. **Auth & CORS Diagnostics:**
   * Warns if `/auth/me` fails to return the expected `role_claim_path` or if cross-origin headers block credentialed requests.

### 6.2 Interactive RBAC Role Simulator
Inside the Doctor Console, developers can test permission rules without logging out:
* Provides a **Simulate Role / Permission** dropdown populated with all roles referenced across `admin.config.yaml`.
* Selecting a simulated role (e.g., switching from `superadmin` to `support_tier_2`) immediately updates `AuthContext` in memory, allowing the developer to visually verify which sidebar links, sensitive columns, and action buttons hide or appear.