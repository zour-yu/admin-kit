# admin-kit-fastapi

Python / FastAPI adapter for [AdminKit](https://github.com/admin-kit/admin-kit).
Mounts the pre-compiled AdminKit React Studio directly into any FastAPI or Starlette application.

## Installation

```bash
pip install admin-kit-fastapi
```

## Quick Start

```python
from fastapi import FastAPI
from admin_kit_fastapi import mount_admin_studio

app = FastAPI(title="My Backend API")

# Mount AdminKit Studio at /admin
mount_admin_studio(
    app,
    path="/admin",
    config_path="./admin.config.yaml"
)

# Your normal API endpoints...
@app.get("/api/users")
def get_users():
    return [{"id": "usr_1", "email": "admin@example.com"}]
```

