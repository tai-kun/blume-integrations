import type { BlumeData } from "blume";
import { describe, expect, it, vi } from "vitest";

import { onRequest } from "../../src/route-by-browser-language/hide-placeholder.js";
import { routeByBrowserLanguage } from "../../src/route-by-browser-language/index.js";
import {
  getRedirectPaths,
  PLACEHOLDER_LOCALE_CODE,
} from "../../src/route-by-browser-language/redirect-paths.js";

const i18n = {
  defaultLocale: "und",
  fallbackLocale: null,
  hideDefaultLocalePrefix: true,
  locales: [
    { code: "ja", dir: "ltr", label: "日本語" },
    { code: "en", dir: "ltr", label: "English" },
    { code: "und", dir: "ltr", label: "UNDETERMINED" },
  ],
  routeByBrowserLanguage: false,
} as const;

const baseData = {
  config: {
    basePath: "",
    i18n,
    versions: null,
  },
  routes: [],
} as unknown as BlumeData;

/**
 * Blume のルートに近いデータを作ります。
 */
const route = (path: string, locale: string, version = "", hidden = false) => ({
  hidden,
  locale,
  path,
  version,
});

describe("PLACEHOLDER_LOCALE_CODE", () => {
  it("und である", () => {
    expect(PLACEHOLDER_LOCALE_CODE).toBe("und");
  });
});

describe("getRedirectPaths", () => {
  it("i18n がない場合は空配列を返す", () => {
    const data = {
      ...baseData,
      config: { ...baseData.config, i18n: null },
    } as unknown as BlumeData;
    expect(getRedirectPaths(data)).toEqual([]);
  });

  it("und を転送先から除外する", () => {
    const data = {
      ...baseData,
      routes: [route("/ja/guide", "ja"), route("/en/guide", "en"), route("/und/guide", "und")],
    } as unknown as BlumeData;
    const paths = getRedirectPaths(data);
    const guide = paths.find((p) => p.params.slug === "guide");
    expect(guide).toBeDefined();
    expect(guide?.props.targets.map((t) => t.code)).toEqual(["ja", "en"]);
  });

  it("プレースホルダーが配信するトップレベル URL には作成しない", () => {
    const data = {
      ...baseData,
      routes: [route("/changelog", "und"), route("/en/changelog", "en")],
    } as unknown as BlumeData;
    expect(getRedirectPaths(data)).toEqual([]);
  });

  it("非表示ページは対象外にする", () => {
    const data = {
      ...baseData,
      routes: [route("/ja/hidden", "ja", "", true)],
    } as unknown as BlumeData;
    expect(getRedirectPaths(data)).toEqual([]);
  });

  it("バージョン付きの URL を転送先に含める", () => {
    const data = {
      ...baseData,
      routes: [route("/ja/v1/guide", "ja", "v1"), route("/en/v1/guide", "en", "v1")],
    } as unknown as BlumeData;
    const paths = getRedirectPaths(data);
    const guide = paths.find((p) => p.params.slug === "v1/guide");

    expect(guide).toBeDefined();
    expect(guide?.props.targets.map((target) => target.href)).toEqual([
      "/ja/v1/guide",
      "/en/v1/guide",
    ]);
  });

  it("デプロイ先と Blume のベースパスを URL に含める", () => {
    const data = {
      ...baseData,
      config: { ...baseData.config, basePath: "/docs" },
      routes: [route("/docs/ja/guide", "ja"), route("/docs/en/guide", "en")],
    } as unknown as BlumeData;
    const paths = getRedirectPaths(data, "/repo/");
    const guide = paths.find((p) => p.params.slug === "docs/guide");

    expect(guide).toBeDefined();
    expect(guide?.props.basePath).toBe("/repo/docs");
    expect(guide?.props.targets.map((target) => target.href)).toEqual([
      "/repo/docs/ja/guide",
      "/repo/docs/en/guide",
    ]);
  });
});

describe("routeByBrowserLanguage", () => {
  it("リダイレクト経路と middleware を登録する", async () => {
    const injectRoute = vi.fn<(route: { entrypoint: string }) => void>();
    const addMiddleware = vi.fn<(middleware: { entrypoint: string }) => void>();
    const integration = routeByBrowserLanguage();
    const setup = integration.hooks?.["astro:config:setup"];
    expect(setup).toBeDefined();
    await setup?.({
      addMiddleware,
      config: {
        i18n: { defaultLocale: "und", locales: ["ja", "en", "und"], routing: {} },
      },
      injectRoute,
    } as never);
    expect(injectRoute).toHaveBeenCalledWith(
      expect.objectContaining({ pattern: "/[...slug]", prerender: true }),
    );
    expect(addMiddleware).toHaveBeenCalledWith(expect.objectContaining({ order: "post" }));
    const entrypoint = addMiddleware.mock.calls[0]?.[0]?.entrypoint as string;
    expect(entrypoint).toMatch(/route-by-browser-language[\\/]hide-placeholder\.js$/);
  });
});

describe("hide-placeholder middleware", () => {
  it("HTML の head に共通スタイルを挿入する", async () => {
    const html = "<html><head><title>t</title></head><body></body></html>";
    const next = async () => new Response(html, { headers: { "content-type": "text/html" } });
    const response = (await onRequest({} as never, next as never)) as Response;
    const body = await response.text();
    expect(body).toMatch(/<style data-locale-redirect>[\s\S]*<\/style>\s*<\/head>/);
    expect(body).toContain('[hreflang="und"][lang="und"]');
  });

  it("HTML 以外はそのまま通す", async () => {
    const next = async () =>
      new Response('{"ok":true}', { headers: { "content-type": "application/json" } });
    const response = (await onRequest({} as never, next as never)) as Response;
    expect(await response.text()).toBe('{"ok":true}');
  });
});
