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
   * デフォルトのベースパスと Blume のベースパスを連結した値です。
   */
  basePath: string;

  /**
   * 転送先の候補です。
   * 設定順に並びます。
   */
  targets: RedirectTarget[];
}

/**
 * デフォルトロケールのプレフィックス付き URL から、プレフィックスなしの URL へ転送するページです。
 */
export interface RedirectPath {
  params: {
    /**
     * ベースパスを含むルートパラメーターです。
     * 未定義の場合はデフォルトロケールのルートを表します。
     */
    slug: string | undefined;
  };
  props: RedirectPathProps;
}

/**
 * デフォルトロケールのページを、訪問者の言語に合わせた URL へ転送するための情報です。
 */
export interface LocaleRedirect {
  /**
   * デフォルトロケールのコードです。
   */
  defaultLocale: string;

  /**
   * このページを配信しているロケールのコードです。
   * 設定順に並び、デフォルトロケールを含みます。
   */
  locales: string[];

  /**
   * デフォルト以外のロケールの転送先です。
   * キーはロケールコード、値はサイトのルートからのパスです。
   */
  targets: Record<string, string>;

  /**
   * 言語設定に合うロケールがなかった場合のロケールです。
   */
  fallbackLocale: string | null;
}

/**
 * ロケール付きのルートから、ロケールとロケールなしの URL の slug を取り出します。
 */
const parseRoute = (
  route: BlumeRoute,
  data: BlumeData,
): { locale: string; slug: string } | undefined => {
  const { basePath, i18n } = data.config;
  if (!i18n) {
    return undefined;
  }

  // サイドバー非表示のページにはリダイレクトページを作りません。
  // `indexable` は検索の有効・無効にも左右されるため、判定には使いません。
  if (route.hidden || !i18n.locales.some((locale) => locale.code === route.locale)) {
    return undefined;
  }

  if (route.path !== basePath && !route.path.startsWith(`${basePath}/`)) {
    return undefined;
  }

  const segments = route.path.slice(basePath.length).split("/").filter(Boolean);
  // デフォルトロケールは、プレフィックスを隠している場合は URL に現れません。
  const prefixed = !(route.locale === i18n.defaultLocale && i18n.hideDefaultLocalePrefix);
  if (prefixed) {
    if (segments[0] !== route.locale) {
      return undefined;
    }
    segments.shift();
  }

  return {
    locale: route.locale,
    slug: segments.join("/"),
  };
};

/**
 * サイトのデータごとに、同じページを配信しているロケールの一覧をキャッシュします。
 */
const routesBySlugCache = new WeakMap<BlumeData, Map<string, Map<string, string>>>();

/**
 * 同じページを配信しているロケールを slug ごとに集約します。
 */
const collectRoutes = (data: BlumeData): Map<string, Map<string, string>> => {
  const cached = routesBySlugCache.get(data);
  if (cached !== undefined) {
    return cached;
  }

  const routesBySlug = new Map<string, Map<string, string>>();

  for (const route of data.routes) {
    const parsed = parseRoute(route, data);
    if (parsed === undefined) {
      continue;
    }

    const routesForLocale = routesBySlug.get(parsed.slug) ?? new Map<string, string>();
    routesForLocale.set(parsed.locale, route.path);
    routesBySlug.set(parsed.slug, routesForLocale);
  }

  routesBySlugCache.set(data, routesBySlug);
  return routesBySlug;
};

/**
 * 末尾のスラッシュを除いたパスにします。
 * サイトのルートはそのまま `/` で表します。
 */
const normalizePath = (path: string): string => (path === "/" ? path : path.replace(/\/+$/, ""));

/**
 * デプロイ先のベースパスと Blume のベースパスを、末尾のスラッシュなしで連結します。
 */
const getSiteBase = (data: BlumeData, deployBase: string): string =>
  `${deployBase.replace(/\/+$/, "")}${data.config.basePath}`;

/**
 * サイトのルートからのパスを、ブラウザーで使える URL に変換します。
 */
const toHref = (deployBase: string, path: string): string => {
  const base = deployBase.replace(/\/+$/, "");
  return path === "/" ? `${base}/` : `${base}${path}`;
};

/**
 * Blume が生成するデフォルトロケールの URL (`/rest`、`/version/rest`) を、プレフィックス付きの URL (`/locale/rest`、`/locale/version/rest`) から転送するリダイレクトページの一覧を作成します。
 *
 * Blume はデフォルトロケールのページをプレフィックスなしで配信します。このページは、古いリンクや手入力されたプレフィックス付きの URL を、正規のプレフィックスなしの URL へ転送します。
 *
 * - サイドバー非表示のページは対象外です。
 * - デフォルトロケールのプレフィックスを隠していない場合は、プレフィックス付きの URL が正規の URL なので作成しません。
 *
 * @param data Blume がビルド時に生成する、サイト全体のデータです。
 * @param deployBase デプロイ先のベースパスです。
 * Astro の `BASE_URL` (`deployment.base`) に対応し、URL の組み立てでは `data.config.basePath` の前に付きます。
 * @returns プレフィックス付きの URL ごとのリダイレクトページの定義です。
 * i18n が設定されていない場合は空の配列です。
 */
export const getRedirectPaths = (data: BlumeData, deployBase: string = ""): RedirectPath[] => {
  const { i18n } = data.config;
  if (!i18n || !i18n.hideDefaultLocalePrefix) {
    return [];
  }

  const localeLabels = new Map(i18n.locales.map((locale) => [locale.code, locale.label]));
  const siteBase = getSiteBase(data, deployBase);
  const redirects: RedirectPath[] = [];

  for (const route of data.routes) {
    const parsed = parseRoute(route, data);
    if (parsed === undefined || parsed.locale !== i18n.defaultLocale) {
      continue;
    }

    // ルートパラメーターはデフォルトロケールの後に続きます。
    // Blume のベースパスもパラメーターに含めることで、ベースパス付きでも URL が組み立てられます。
    const param = normalizePath(route.path).replace(/^\/+/, "") || undefined;
    redirects.push({
      params: {
        slug: param,
      },
      props: {
        basePath: siteBase,
        targets: [
          {
            code: i18n.defaultLocale,
            label: localeLabels.get(i18n.defaultLocale) ?? i18n.defaultLocale,
            href: toHref(deployBase, route.path),
          },
        ],
      },
    });
  }

  return redirects;
};

/**
 * デフォルトロケールのページを、訪問者の言語に合わせた URL へ転送するための情報を作成します。
 *
 * 言語スイッチャーが保存したロケールを優先し、次にブラウザーの言語設定を使います。
 * デフォルトロケール以外のページと、リダイレクトの必要がないページでは `undefined` を返します。
 *
 * @param data Blume がビルド時に生成する、サイト全体のデータです。
 * @param pathname デプロイ先のベースパスを除いた、現在のページのパスです。
 * @param deployBase デプロイ先のベースパスです。
 * @returns クライアント側の転送に使う情報です。
 * 転送先がない場合や、i18n が設定されていない場合は `undefined` です。
 */
export const getLocaleRedirect = (
  data: BlumeData,
  pathname: string,
  deployBase: string = "",
): LocaleRedirect | undefined => {
  const { i18n } = data.config;
  if (!i18n) {
    return undefined;
  }

  const path = normalizePath(pathname);
  let current: { locale: string; slug: string; route: BlumeRoute } | undefined;
  for (const route of data.routes) {
    const parsed = parseRoute(route, data);
    if (parsed !== undefined && normalizePath(route.path) === path) {
      current = { ...parsed, route };
      break;
    }
  }

  if (current === undefined || current.route.hidden || current.locale !== i18n.defaultLocale) {
    return undefined;
  }

  const { slug } = current;
  const routesBySlug = collectRoutes(data);
  const routesForPage = routesBySlug.get(slug);
  if (routesForPage === undefined) {
    return undefined;
  }

  const targets: Record<string, string> = {};
  const locales: string[] = [];
  for (const locale of i18n.locales) {
    const path = routesForPage.get(locale.code);
    if (path === undefined) {
      continue;
    }

    locales.push(locale.code);
    if (locale.code !== i18n.defaultLocale) {
      targets[locale.code] = toHref(deployBase, path);
    }
  }

  // デフォルトロケールしか配信していない場合は、転送する必要がありません。
  if (Object.keys(targets).length === 0) {
    return undefined;
  }

  return {
    defaultLocale: i18n.defaultLocale,
    fallbackLocale: i18n.fallbackLocale,
    locales,
    targets,
  };
};

/**
 * クライアント側で転送先のロケールを選ぶスクリプトの本体です。
 *
 * 言語スイッチャーが保存したロケールを優先し、次にブラウザーの言語設定を先頭から調べます。
 * どちらにも一致するロケールがない場合は、フォールバックロケール、`en`、配信しているロケールの先頭の順に選びます。
 */
const LOCALE_REDIRECT_CLIENT = `(redirect) => {
  const findLocale = (language) => {
    const tag = language.toLowerCase();
    return redirect.locales.find(locale => {
      const code = locale.toLowerCase();
      return tag === code || tag.startsWith(code + "-");
    });
  };

  const matchLocale = () => {
    try {
      const stored = window.localStorage.getItem("blume-locale");
      const matched = stored ? findLocale(stored) : undefined;

      if (matched) {
        return matched;
      }
    } catch {
      // ストレージへのアクセスが拒否された場合は、ブラウザーの言語設定に従います。
    }

    for (const language of window.navigator.languages ?? []) {
      const matched = findLocale(language);

      if (matched) {
        return matched;
      }
    }

    if (redirect.fallbackLocale && redirect.locales.includes(redirect.fallbackLocale)) {
      return redirect.fallbackLocale;
    }

    if (redirect.locales.includes("en")) {
      return "en";
    }

    return redirect.locales[0] ?? redirect.defaultLocale;
  };

  const locale = matchLocale();
  if (!locale || locale === redirect.defaultLocale) {
    return;
  }

  const target = redirect.targets[locale];
  if (!target) {
    return;
  }

  window.location.replace(target + window.location.search + window.location.hash);
}`;

/**
 * デフォルトロケールのページに挿入する、クライアント側の転送スクリプトを作成します。
 */
export const renderLocaleRedirectScript = (redirect: LocaleRedirect): string => {
  // `</script>` などで HTML を壊さないように、`<` をエスケープします。
  const data = JSON.stringify(redirect).replaceAll("<", "\\u003c");
  return `<script data-locale-redirect>(${LOCALE_REDIRECT_CLIENT})(${data});</script>`;
};
