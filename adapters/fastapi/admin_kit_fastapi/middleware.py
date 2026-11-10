import json
import os
import re
from pathlib import Path
from typing import Any, Dict, Optional, Union

import yaml
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles


def find_workspace_root() -> Path:
    """Finds the monorepo root directory containing pnpm-workspace.yaml or packages/."""
    curr = Path.cwd().resolve()
    for parent in [curr] + list(curr.parents):
        if (parent / "pnpm-workspace.yaml").exists() or (parent / "packages" / "react").exists():
            return parent
    return curr


def resolve_default_assets_dir() -> Path:
    """Resolves the pre-compiled @admin-kit/react static dist directory."""
    workspace_root = find_workspace_root()

    candidates = [
        Path.cwd() / "dist",
        Path.cwd().parent / "packages" / "react" / "dist",
        workspace_root / "packages" / "react" / "dist",
        workspace_root / "node_modules" / "@admin-kit" / "react" / "dist",
        Path(__file__).resolve().parent.parent.parent.parent / "packages" / "react" / "dist",
    ]

    for candidate in candidates:
        if candidate.exists() and (candidate / "index.html").exists():
            return candidate

    return workspace_root / "packages" / "react" / "dist"


def load_yaml_config(config_path: Union[str, Path]) -> Dict[str, Any]:
    """Reads and parses an admin.config.yaml file."""
    path = Path(config_path).resolve()
    if not path.exists():
        raise FileNotFoundError(f"AdminKit configuration file not found at: {path}")

    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    if not isinstance(data, dict):
        raise ValueError(f"Invalid AdminKit configuration format in {path}")

    return data


def mount_admin_studio(
    app: FastAPI,
    path: str = "/admin",
    config_path: Union[str, Path] = "admin.config.yaml",
    assets_dir: Optional[Union[str, Path]] = None,
    title: Optional[str] = None,
) -> None:
    """Mounts the complete AdminKit Studio into a FastAPI application.

    Serves:
    - GET {path}/__config: Exposes parsed AdminKitConfig JSON.
    - Static assets under {path}/assets and {path}/__assets.
    - SPA HTML catch-all router under {path} and {path}/* with base-href and inlined config.

    Args:
        app: Target FastAPI instance.
        path: Route prefix where AdminKit should be mounted (e.g. '/admin').
        config_path: Path to admin.config.yaml file.
        assets_dir: Optional custom path to @admin-kit/react/dist assets directory.
        title: Optional custom browser title override.
    """
    normalized_path = "/" + path.strip("/")
    resolved_config_path = Path(config_path).resolve()
    resolved_assets_dir = Path(assets_dir).resolve() if assets_dir else resolve_default_assets_dir()

    # Pre-flight check on config
    try:
        current_config = load_yaml_config(resolved_config_path)
    except Exception as err:
        print(f"[admin-kit-fastapi] Initial config warning: {err}")
        current_config = {}

    # 1. Metadata Endpoint: GET {path}/__config
    @app.get(f"{normalized_path}/__config", include_in_schema=False)
    async def get_admin_config() -> JSONResponse:
        try:
            cfg = load_yaml_config(resolved_config_path)
            return JSONResponse(
                content=cfg,
                headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
            )
        except Exception as err:
            raise HTTPException(status_code=500, detail=f"Failed to load AdminKit configuration: {err}")

    # 2. Static Assets Mounts
    if resolved_assets_dir.exists():
        assets_subfolder = resolved_assets_dir / "assets"
        if assets_subfolder.exists():
            app.mount(
                f"{normalized_path}/assets",
                StaticFiles(directory=str(assets_subfolder)),
                name="admin_studio_assets",
            )

        app.mount(
            f"{normalized_path}/__assets",
            StaticFiles(directory=str(resolved_assets_dir)),
            name="admin_studio_all_assets",
        )

    # 3. HTML Shell Builder Helper
    def build_studio_html() -> str:
        html_file = resolved_assets_dir / "index.html"
        if not html_file.exists():
            # Fallback simple HTML shell
            return f"""<!doctype html>
<html>
  <head>
    <title>AdminKit Studio</title>
  </head>
  <body>
    <div style="font-family:sans-serif;padding:32px;text-align:center;">
      <h2>AdminKit Studio assets not found</h2>
      <p>Ensure @admin-kit/react is built in {resolved_assets_dir}</p>
    </div>
  </body>
</html>"""

        with open(html_file, "r", encoding="utf-8") as f:
            custom_html = f.read()

        try:
            cfg = load_yaml_config(resolved_config_path)
        except Exception:
            cfg = current_config

        studio_title = title or cfg.get("project", {}).get("name") or "AdminKit Studio"
        custom_html = re.sub(r"<title>.*?</title>", f"<title>{studio_title}</title>", custom_html, flags=re.IGNORECASE)

        config_json_str = json.dumps(cfg).replace("<", "\\u003c")
        injection = (
            f'<head>\n'
            f'  <base href="{normalized_path}/">\n'
            f'  <script>'
            f'window.__ADMIN_KIT_CONFIG_URL__ = "{normalized_path}/__config"; '
            f'window.__ADMIN_KIT_INITIAL_CONFIG__ = {config_json_str};'
            f'</script>'
        )

        custom_html = custom_html.replace("<head>", injection, 1)
        return custom_html

    # 4. SPA Catch-All Handlers
    @app.get(normalized_path, response_class=HTMLResponse, include_in_schema=False)
    @app.get(f"{normalized_path}/", response_class=HTMLResponse, include_in_schema=False)
    async def serve_admin_root(request: Request) -> HTMLResponse:
        return HTMLResponse(content=build_studio_html())

    @app.get(f"{normalized_path}/{{subpath:path}}", response_class=HTMLResponse, include_in_schema=False)
    async def serve_admin_subpath(subpath: str, request: Request) -> Any:
        # Check if direct asset was requested (e.g. style.css, favicon.svg)
        direct_asset = resolved_assets_dir / subpath
        if direct_asset.is_file():
            from fastapi.responses import FileResponse
            return FileResponse(str(direct_asset))

        # Otherwise serve the SPA HTML for client-side routing
        return HTMLResponse(content=build_studio_html())

