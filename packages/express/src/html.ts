export interface RenderStudioHtmlOptions {
  title: string;
  basePath: string;
  configUrl: string;
  assetPrefix: string;
  initialConfigJson?: string;
}

/**
 * Escapes unsafe characters for HTML inclusion.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Generates the self-contained SPA HTML document that bootstraps
 * the AdminKit React Studio in the user's browser.
 */
export function renderStudioHtml({
  title,
  basePath,
  configUrl,
  assetPrefix,
  initialConfigJson,
}: RenderStudioHtmlOptions): string {
  const safeTitle = escapeHtml(title);
  const safeConfigUrl = escapeHtml(configUrl);
  const safeAssetPrefix = escapeHtml(assetPrefix);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <link rel="stylesheet" href="${safeAssetPrefix}/style.css" />
  <script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@18.3.1",
      "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
      "react-dom": "https://esm.sh/react-dom@18.3.1",
      "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
      "@admin-kit/core": "${safeAssetPrefix}/index.js",
      "@admin-kit/react": "${safeAssetPrefix}/index.js"
    }
  }
  </script>
</head>
<body style="margin: 0; padding: 0; overflow: hidden; background: #090d16;">
  <div id="root">
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; height: 100vh; align-items: center; justify-content: center; background: #090d16; color: #f9fafb;">
      <div style="text-align: center;">
        <div style="width: 44px; height: 44px; border-radius: 10px; background: #4f46e5; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; margin: 0 auto 16px; font-size: 18px;">AK</div>
        <h2 style="font-size: 18px; margin: 0 0 6px; font-weight: 600;">Loading AdminKit Studio...</h2>
        <p style="font-size: 13px; color: #9ca3af; margin: 0;">Connecting to ${safeConfigUrl}</p>
      </div>
    </div>
  </div>

  <script type="module">
    import React from "react";
    import { createRoot } from "react-dom/client";
    import { AdminStudio } from "@admin-kit/react";

    window.__ADMIN_KIT_CONFIG_URL__ = "${safeConfigUrl}";
    ${initialConfigJson ? `window.__ADMIN_KIT_INITIAL_CONFIG__ = ${initialConfigJson};` : ""}

    const rootElement = document.getElementById("root");
    if (rootElement) {
      const root = createRoot(rootElement);
      root.render(
        React.createElement(AdminStudio, {
          configUrl: "${safeConfigUrl}",
          config: ${initialConfigJson ? "window.__ADMIN_KIT_INITIAL_CONFIG__" : "undefined"}
        })
      );
    }
  </script>
</body>
</html>`;
}

