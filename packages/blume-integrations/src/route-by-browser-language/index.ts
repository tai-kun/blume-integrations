import { fileURLToPath } from "node:url";

import type { AstroIntegration } from "astro";

export function routeByBrowserLanguage(): AstroIntegration {
  return {
    name: "blume-route-by-browser-language",
    hooks: {
      "astro:config:setup"({ addMiddleware, config, injectRoute }) {
        addMiddleware({
          entrypoint: fileURLToPath(new URL("./inject-redirect.js", import.meta.url)),
          order: "post",
        });

        // デフォルトロケールのプレフィックスを隠している場合だけ、プレフィックス付きの URL を転送します。
        // すべてのロケールにプレフィックスを付けている場合は、Blume が正規の URL を配信します。
        const i18n = config.i18n;
        const defaultLocale = i18n?.defaultLocale;
        const prefixDefaultLocale =
          typeof i18n?.routing === "object" && i18n.routing.prefixDefaultLocale === true;

        if (defaultLocale && !prefixDefaultLocale) {
          injectRoute({
            entrypoint: fileURLToPath(new URL("./redirect.astro", import.meta.url)),
            pattern: `/${defaultLocale}/[...slug]`,
            prerender: true,
          });
        }
      },
    },
  };
}
