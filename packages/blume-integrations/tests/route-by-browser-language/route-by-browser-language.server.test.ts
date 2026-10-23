import { runInNewContext } from "node:vm";

import type { BlumeData } from "blume";
import { describe, expect, it, vi } from "vitest";

import { routeByBrowserLanguage } from "../../src/route-by-browser-language/index.js";
import {
  getLocaleRedirect,
  getRedirectPaths,
  renderLocaleRedirectScript,
} from "../../src/route-by-browser-language/redirect-paths.js";

const i18n = {
  defaultLocale: "ja",
  fallbackLocale: "ja",
  hideDefaultLocalePrefix: true,
  locales: [
    { code: "ja", dir: "ltr", label: "日本語" },
    { code: "en", dir: "ltr", label: "English" },
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
const route = (path: string, locale: string, hidden = false) => ({
  hidden,
  locale,
  path,
});

describe("getRedirectPaths", () => {
  it("i18n がない場合は空配列を返す", () => {
    const data = {
      ...baseData,
      config: { ...baseData.config, i18n: null },
    } as unknown as BlumeData;
    expect(getRedirectPaths(data)).toEqual([]);
  });

  it("デフォルトロケールのプレフィックスを隠していない場合は空配列を返す", () => {
    const data = {
      ...baseData,
      config: {
        ...baseData.config,
        i18n: { ...i18n, hideDefaultLocalePrefix: false },
      },
    } as unknown as BlumeData;
    expect(getRedirectPaths(data)).toEqual([]);
  });

  it("デフォルトロケールのページごとに、プレフィックス付きの別名 URL を作る", () => {
    const data = {
      ...baseData,
      routes: [
        route("/", "ja"),
        route("/guide", "ja"),
        route("/en", "en"),
        route("/en/guide", "en"),
      ],
    } as unknown as BlumeData;
    const paths = getRedirectPaths(data);

    expect(paths).toEqual([
      {
        params: { slug: undefined },
        props: {
          basePath: "",
          targets: [{ code: "ja", label: "日本語", href: "/" }],
        },
      },
      {
        params: { slug: "guide" },
        props: {
          basePath: "",
          targets: [{ code: "ja", label: "日本語", href: "/guide" }],
        },
      },
    ]);
  });

  it("デフォルトロケール以外のページと非表示ページは対象外にする", () => {
    const data = {
      ...baseData,
      routes: [route("/en/guide", "en"), route("/hidden", "ja", true)],
    } as unknown as BlumeData;
    expect(getRedirectPaths(data)).toEqual([]);
  });

  it("デプロイ先のベースパスを URL に含める", () => {
    const data = {
      ...baseData,
      routes: [route("/guide", "ja"), route("/en/guide", "en")],
    } as unknown as BlumeData;
    const paths = getRedirectPaths(data, "/repo/");

    expect(paths[0]?.props.targets[0]?.href).toBe("/repo/guide");
  });

  it("Blume のベースパスを別名 URL のパラメーターと転送先に含める", () => {
    const data = {
      ...baseData,
      config: { ...baseData.config, basePath: "/docs" },
      routes: [route("/docs/guide", "ja"), route("/docs/en/guide", "en")],
    } as unknown as BlumeData;
    const paths = getRedirectPaths(data, "/repo/");

    expect(paths[0]?.params.slug).toBe("docs/guide");
    expect(paths[0]?.props.targets[0]?.href).toBe("/repo/docs/guide");
  });
});

describe("getLocaleRedirect", () => {
  it("i18n がない場合は undefined を返す", () => {
    const data = {
      ...baseData,
      config: { ...baseData.config, i18n: null },
    } as unknown as BlumeData;
    expect(getLocaleRedirect(data, "/guide")).toBeUndefined();
  });

  it("デフォルトロケールのページから、そのページを配信するロケールへの転送先を作る", () => {
    const data = {
      ...baseData,
      routes: [route("/guide", "ja"), route("/en/guide", "en")],
    } as unknown as BlumeData;

    expect(getLocaleRedirect(data, "/guide")).toEqual({
      defaultLocale: "ja",
      fallbackLocale: "ja",
      locales: ["ja", "en"],
      targets: { en: "/en/guide" },
    });
  });

  it("サイトのルートを転送先にする", () => {
    const data = {
      ...baseData,
      routes: [route("/", "ja"), route("/en", "en")],
    } as unknown as BlumeData;

    expect(getLocaleRedirect(data, "/")?.targets).toEqual({ en: "/en" });
  });

  it("デフォルトロケール以外のページでは undefined を返す", () => {
    const data = {
      ...baseData,
      routes: [route("/guide", "ja"), route("/en/guide", "en")],
    } as unknown as BlumeData;

    expect(getLocaleRedirect(data, "/en/guide")).toBeUndefined();
  });

  it("転送先のロケールがない場合は undefined を返す", () => {
    const data = {
      ...baseData,
      routes: [route("/guide", "ja")],
    } as unknown as BlumeData;

    expect(getLocaleRedirect(data, "/guide")).toBeUndefined();
  });

  it("非表示ページでは undefined を返す", () => {
    const data = {
      ...baseData,
      routes: [route("/hidden", "ja", true), route("/en/hidden", "en")],
    } as unknown as BlumeData;

    expect(getLocaleRedirect(data, "/hidden")).toBeUndefined();
  });

  it("バージョン付きの URL を転送先に含める", () => {
    const data = {
      ...baseData,
      routes: [route("/v1/guide", "ja"), route("/en/v1/guide", "en")],
    } as unknown as BlumeData;

    expect(getLocaleRedirect(data, "/v1/guide")?.targets).toEqual({
      en: "/en/v1/guide",
    });
  });

  it("デプロイ先と Blume のベースパスを URL に含める", () => {
    const data = {
      ...baseData,
      config: { ...baseData.config, basePath: "/docs" },
      routes: [route("/docs/guide", "ja"), route("/docs/en/guide", "en")],
    } as unknown as BlumeData;

    expect(getLocaleRedirect(data, "/docs/guide", "/repo/")?.targets).toEqual({
      en: "/repo/docs/en/guide",
    });
  });

  it("末尾のスラッシュを無視する", () => {
    const data = {
      ...baseData,
      routes: [route("/guide", "ja"), route("/en/guide", "en")],
    } as unknown as BlumeData;

    expect(getLocaleRedirect(data, "/guide/")?.targets).toEqual({
      en: "/en/guide",
    });
  });
});

/**
 * 生成したスクリプトを、指定したストレージと言語設定のブラウザーで実行します。
 */
const runRedirectScript = (
  redirect: Parameters<typeof renderLocaleRedirectScript>[0],
  options: {
    languages: string[];
    stored?: string;
  },
): string | undefined => {
  const script = renderLocaleRedirectScript(redirect);
  const code = script.slice(script.indexOf(">") + 1, script.lastIndexOf("</script>"));
  const replace = vi.fn<(url: string) => void>();
  const window = {
    localStorage: {
      getItem: () => options.stored ?? null,
    },
    location: {
      hash: "#section",
      replace,
      search: "?q=1",
    },
    navigator: {
      languages: options.languages,
    },
  };

  runInNewContext(code, { window });
  return replace.mock.calls[0]?.[0];
};

describe("renderLocaleRedirectScript", () => {
  const redirect = {
    defaultLocale: "ja",
    fallbackLocale: "ja",
    locales: ["ja", "en"],
    targets: { en: "/en/guide" },
  };

  it("保存されたロケールをブラウザーの言語より優先する", () => {
    expect(runRedirectScript(redirect, { languages: ["ja-JP"], stored: "en" })).toBe(
      "/en/guide?q=1#section",
    );
  });

  it("ブラウザーの言語設定に合うロケールへ転送する", () => {
    expect(runRedirectScript(redirect, { languages: ["ja-JP", "en-US"] })).toBeUndefined();
    expect(runRedirectScript(redirect, { languages: ["en-US"] })).toBe("/en/guide?q=1#section");
  });

  it("保存されたロケールが使えない場合はブラウザーの言語設定を使う", () => {
    expect(runRedirectScript(redirect, { languages: ["en-US"], stored: "unknown" })).toBe(
      "/en/guide?q=1#section",
    );
  });

  it("一致する言語がない場合はフォールバックロケールを使う", () => {
    expect(
      runRedirectScript(
        { ...redirect, fallbackLocale: "en", locales: ["ja", "en"] },
        { languages: ["fr-FR"] },
      ),
    ).toBe("/en/guide?q=1#section");
  });
});

describe("routeByBrowserLanguage", () => {
  it("転送スクリプトと、デフォルトロケールの別名ルートを登録する", async () => {
    const injectRoute = vi.fn<(route: { entrypoint: string; pattern: string }) => void>();
    const addMiddleware = vi.fn<(middleware: { entrypoint: string }) => void>();
    const integration = routeByBrowserLanguage();
    const setup = integration.hooks?.["astro:config:setup"];
    expect(setup).toBeDefined();
    await setup?.({
      addMiddleware,
      config: {
        i18n: { defaultLocale: "ja", locales: ["ja", "en"], routing: {} },
      },
      injectRoute,
    } as never);

    expect(injectRoute).toHaveBeenCalledWith(
      expect.objectContaining({ pattern: "/ja/[...slug]", prerender: true }),
    );
    expect(addMiddleware).toHaveBeenCalledWith(expect.objectContaining({ order: "post" }));
    const entrypoint = addMiddleware.mock.calls[0]?.[0]?.entrypoint as string;
    expect(entrypoint).toMatch(/route-by-browser-language[\\/]inject-redirect\.js$/);
  });

  it("デフォルトロケールにもプレフィックスを付ける場合は別名ルートを登録しない", async () => {
    const injectRoute = vi.fn<(route: { entrypoint: string; pattern: string }) => void>();
    const addMiddleware = vi.fn<(middleware: { entrypoint: string }) => void>();
    const integration = routeByBrowserLanguage();
    const setup = integration.hooks?.["astro:config:setup"];
    await setup?.({
      addMiddleware,
      config: {
        i18n: {
          defaultLocale: "ja",
          locales: ["ja", "en"],
          routing: { prefixDefaultLocale: true },
        },
      },
      injectRoute,
    } as never);

    expect(injectRoute).not.toHaveBeenCalled();
  });
});
