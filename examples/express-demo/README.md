# Express Demo (@admin-kit-yu/express)

This example demonstrates the complete embedded backend middleware model for AdminKit using Express.

## Overview
* Mounts `@admin-kit-yu/express` under `/admin`.
* Exposes `GET /admin/__config` returning validated declarative configuration from `admin.config.yaml`.
* Serves the pre-compiled SPA dashboard at `http://localhost:3000/admin`.
* Provides mock REST endpoints matching `mocks/dummy-openapi.json`:
  * `GET /api/users`
  * `GET /api/refunds`
  * `POST /api/refunds/:id/approve`
  * `POST /api/refunds/:id/reject`

## Running the Server

```bash
# From the repository root
pnpm --filter express-demo start
```

Or from this directory:
```bash
node src/server.js
```

Open your browser at:
* **Admin Dashboard:** [http://localhost:3000/admin](http://localhost:3000/admin)
* **Config Metadata:** [http://localhost:3000/admin/__config](http://localhost:3000/admin/__config)

