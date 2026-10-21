import type { MiddlewareHandler } from "astro";

import { insertBeforeHeadEnd, rewriteHtmlResponse } from "../internal/response.js";
import { PLACEHOLDER_LOCALE_CODE } from "./redirect-paths.js";

/**
 * プレースホルダーロケールを言語セレクターから隠すための共通スタイルです。
 */
const HIDDEN_PLACEHOLDER_STYLE = `
<style data-locale-redirect>
  [data-blume-header] [hreflang="${PLACEHOLDER_LOCALE_CODE}"][lang="${PLACEHOLDER_LOCALE_CODE}"] {
    display: none;
  }
</style>
`;

/**
 * 全ページの `</head>` 直前に共通スタイルを挿入します。
 *
 * Blume の icon-sprite middleware と同じく、プリレンダー時にも実行されるため、静的ビルドの HTML にも残ります。
 * HTML 以外のレスポンスはそのまま通します。
 */
export const onRequest: MiddlewareHandler = async (_context, next) =>
  rewriteHtmlResponse(await next(), (html) => insertBeforeHeadEnd(html, HIDDEN_PLACEHOLDER_STYLE));
