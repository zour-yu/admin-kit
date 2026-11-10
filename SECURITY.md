# Security Policy

AdminKit is designed for internal operational tooling, enterprise back-offices, and customer support dashboards. We treat security and operational integrity as first-class architectural priorities.

---

## Supported Versions

| Version | Supported |
| :--- | :--- |
| `0.1.x` | Yes |

---

## Security Architecture & Guarantees

1. **Sandboxed Expression Evaluation (Zero `eval`)**:
   AdminKit supports dynamic row-action visibility rules (`visible_if`, e.g., `row.status == 'pending'`). These expressions are parsed through an AST recursive-descent token interpreter. Neither `eval()`, `new Function()`, nor external scripting runtimes are ever used, preventing arbitrary code execution vectors.

2. **Self-Contained Local Static Asset Serving**:
   The frontend single-page application is compiled into offline static assets served directly from local disk by `@admin-kit/express` and `admin-kit-fastapi`. There are zero runtime external CDN script tags, eliminating supply-chain tampering and enabling air-gapped corporate deployments.

3. **Sensitive Field Masking**:
   Schema fields marked with `sensitive: true` (e.g., API keys, tokens, PII) are masked by default in the UI and require explicit user click interaction to reveal.

4. **Presentation vs. Backend Security**:
   AdminKit's Role-Based Access Control (RBAC) gates table columns, filters, and action buttons in the user interface. Backend APIs must still validate and enforce authorization headers and tokens independently for all mutating requests.

---

## Reporting a Vulnerability

If you discover a security vulnerability in AdminKit, please do not disclose it publicly via GitHub issues.

Instead, please send a responsible disclosure email to:
**security@admin-kit.dev** (or contact the maintainers directly).

Please include:
- A description of the vulnerability and its potential impact.
- Reproducible steps or a minimal proof-of-concept.
- Any suggested mitigations or patches.

We will acknowledge receipt within 48 hours and work with you to release a patch promptly.

