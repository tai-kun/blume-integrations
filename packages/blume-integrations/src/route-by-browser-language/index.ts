import { fileURLToPath } from "node:url";

import type { AstroIntegration } from "astro";

import { PLACEHOLDER_LOCALE_CODE } from "./redirect-paths.js";

export const FAKE_DEFAULT_LOCALE: {
  code: string;
  label: string;
} = Object.freeze({
  code: PLACEHOLDER_LOCALE_CODE,
  label: PLACEHOLDER_LOCALE_CODE,
});

export function routeByBrowserLanguage(): AstroIntegration {
  return {
    name: "blume-route-by-browser-language",
    hooks: {
      "astro:config:setup"({ injectRoute, updateConfig, addMiddleware }) {
        // 対応するロケール以外の言語コードを規定値にすることで、既定言語のページが無いコンテンツのルーティングを可能にします。
        // ここでは ISO 639-2 で定義されている特殊コードの 1 つである und（言語不明）を採用しています。
        updateConfig({
          i18n: {
            defaultLocale: PLACEHOLDER_LOCALE_CODE,
          },
        });

        addMiddleware({
          entrypoint: fileURLToPath(new URL("./hide-placeholder.js", import.meta.url)),
          order: "post",
        });

        injectRoute({
          entrypoint: fileURLToPath(new URL("./redirect.astro", import.meta.url)),
          pattern: "/[...slug]",
          prerender: true,
        });
      },
    },
  };
}
