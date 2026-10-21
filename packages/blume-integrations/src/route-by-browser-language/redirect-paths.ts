import type { BlumeData, BlumeRoute } from "blume";

/**
 * リダイレクトページが転送先として提示するロケールの情報です。
 */
export interface RedirectTarget {
  /**
   * 転送先のロケールコードです。
   */
  code: string;

  /**
   * 言語の表示名です。
   *
   * JavaScript が動かない環境で表示する転送先リンクのラベルに使います。
   */
  label: string;

  /**
   * サイトのルートからの転送先のパスです。
   *
   * デプロイ先のベースパスと Blume のベースパスを含みます。
   */
  href: string;
}

/**
 * リダイレクトページが受け取る props です。
 */
export interface RedirectPathProps {
  /**
   * クライアント側で転送先の URL を組み立てるためのプレフィックスです。
   *
   * デプロイ先のベースパスと Blume のベースパスを連結した値です。
   */
  basePath: string;

  /**
   * 転送先の候補です。
   * 設定順に並びます。
   */
  targets: RedirectTarget[];
}

/**
 * ロケールなしの URL からロケール付きの URL へ転送するページです。
 */
export interface RedirectPath {
  params: {
    /**
     * ベースパスを含むルートパラメーターです。
     * 未定義の場合はサイトのルートを表します。
     */
    slug: string | undefined;
  };
  props: RedirectPathProps;
}

/**
 * トップレベルのコンテンツをルーティングするためのプレースホルダーロケールのコードです。
 *
 * ISO 639-2 で定義されている特殊コードの 1 つである und（言語不明）を採用しています。
 */
export const PLACEHOLDER_LOCALE_CODE = "und";

/**
 * Blume がトップレベルのコンテンツをルーティングするために設定するプレースホルダーロケールかどうかを判定します。
 */
const isPlaceholderLocale = (code: string): boolean => code === PLACEHOLDER_LOCALE_CODE;

/**
 * ロケール付きのルートから、ロケールとロケールなしの URL の slug を取り出します。
 */
const parseRoute = (
  route: BlumeRoute,
  basePath: string,
  locales: ReadonlySet<string>,
): { locale: string; slug: string } | undefined => {
  // サイドバー非表示のページにはリダイレクトページを作りません。
  // `indexable` は検索の有効・無効にも左右されるため、判定には使いません。
  if (route.hidden || !locales.has(route.locale) || !route.path.startsWith(basePath)) {
    return undefined;
  }

  const segments = route.path.slice(basePath.length).split("/").filter(Boolean);
  if (segments[0] !== route.locale) {
    return undefined;
  }
  segments.shift();

  // バージョンはロケールの直後に付きます。
  // Blume が解決したバージョンを使い、`videos` のようなページ名と取り違えないようにします。
  let version = "";
  if (route.version !== "") {
    if (segments[0] !== route.version) {
      return undefined;
    }
    version = segments.shift() ?? "";
  }

  return {
    locale: route.locale,
    slug: [version, ...segments].filter(Boolean).join("/"),
  };
};

/**
 * Blume が生成するロケールなしの URL (`/rest`、`/version/rest`) を、ロケール付きの URL (`/locale/rest`、`/locale/version/rest`) へ転送するリダイレクトページの一覧を作成します。
 *
 * 各ページの `targets` には、その URL に対応するページを配信しているロケールだけを設定順で渡します。
 * これにより、クライアント側は訪問者の言語に合うロケールを選んでから転送できます。
 *
 * - サイドバー非表示のページと、どのロケールも配信していない URL は対象外です。
 * - 実在するページと同じ URL にはリダイレクトページを作成しません。
 * - JavaScript が動かない場合に備えて、転送先はページ上に一覧でも表示します。
 *
 * @param data Blume がビルド時に生成する、サイト全体のデータです。
 * @param deployBase デプロイ先のベースパスです。
 * Astro の `BASE_URL` (`deployment.base`) に対応し、URL の組み立てでは `data.config.basePath` の前に付きます。
 * @returns ロケールなしの URL ごとのリダイレクトページの定義です。
 * i18n が設定されていない場合は空の配列です。
 */
export const getRedirectPaths = (data: BlumeData, deployBase: string = ""): RedirectPath[] => {
  const { basePath, i18n } = data.config;
  if (!i18n) {
    return [];
  }

  const siteBase = `${deployBase.replace(/\/+$/, "")}${basePath}`;
  const locales = i18n.locales
    .map((locale) => locale.code)
    .filter((code) => !isPlaceholderLocale(code));
  const localeSet = new Set(locales);
  const localeLabels = new Map(i18n.locales.map((locale) => [locale.code, locale.label]));

  // 同じロケールなし URL が複数のロケールから参照されるため、slug ごとにロケールを集約します。
  const localesBySlug = new Map<string, Set<string>>();
  for (const route of data.routes) {
    const location = parseRoute(route, basePath, localeSet);
    if (location === undefined) {
      continue;
    }

    const slugLocales = localesBySlug.get(location.slug) ?? new Set<string>();
    slugLocales.add(location.locale);
    localesBySlug.set(location.slug, slugLocales);
  }

  const baseSegment = basePath.replace(/^\/+/, "");
  const toParam = (slug: string): string | undefined =>
    [baseSegment, slug].filter(Boolean).join("/") || undefined;
  const toPath = (slug: string): string => {
    const path = toParam(slug);
    return path === undefined ? "/" : `/${path}`;
  };
  // サイトのルートはディレクトリーの URL になるため末尾にスラッシュを付け、それ以外はルートのパスに合わせます。
  const toHref = (slug: string, code: string): string =>
    slug === "" ? `${siteBase}/${code}/` : `${siteBase}/${code}/${slug}`;

  // 実在するページと同じ URL にはリダイレクトページを作りません。
  // プレースホルダーロケールがトップレベルのコンテンツを配信している場合、その URL はロケールなしの URL と一致します。
  const taken = new Set(data.routes.map((route) => route.path));

  return [...localesBySlug]
    .filter(([slug]) => !taken.has(toPath(slug)))
    .map(([slug, slugLocales]) => ({
      params: {
        slug: toParam(slug),
      },
      props: {
        basePath: siteBase,
        targets: locales
          .filter((code) => slugLocales.has(code))
          .map((code) => ({
            code,
            label: localeLabels.get(code) ?? code,
            href: toHref(slug, code),
          })),
      },
    }));
};
