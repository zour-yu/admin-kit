"""AdminKit FastAPI Adapter.

Mounts the pre-compiled AdminKit React Studio into any FastAPI / Starlette application.
"""

from .middleware import mount_admin_studio

__all__ = ["mount_admin_studio"]
__version__ = "0.1.0"

