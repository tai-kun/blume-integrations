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
      "astro:config:setup"({ injectRoute, addMiddleware }) {
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
