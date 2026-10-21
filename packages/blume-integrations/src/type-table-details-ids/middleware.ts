import type { MiddlewareHandler } from "astro";

import { insertBeforeHeadEnd, rewriteHtmlResponse } from "../internal/response.js";
import { addTypeTableDetailsIds, TYPE_TABLE_DETAILS_LINK_CLASS } from "./transform.js";

/**
 * プロパティ名のリンクが親要素のスタイルを引き継ぐための CSS です。
 */
const TYPE_TABLE_DETAILS_LINK_STYLE = `
<style data-blume-type-table-details-ids>
  .${TYPE_TABLE_DETAILS_LINK_CLASS} {
    color: inherit;
    cursor: inherit;
    font: inherit;
    text-decoration: inherit;
  }
</style>
`;

/**
 * TypeTable の details 要素に id 属性を付ける middleware を作成します。
 */
export const createTypeTableDetailsIdsMiddleware = (): MiddlewareHandler => {
  return async (_context, next) => {
    return rewriteHtmlResponse(await next(), (html) => {
      const transformed = addTypeTableDetailsIds(html);

      return transformed.includes(TYPE_TABLE_DETAILS_LINK_CLASS)
        ? insertBeforeHeadEnd(transformed, TYPE_TABLE_DETAILS_LINK_STYLE)
        : transformed;
    });
  };
};

/**
 * TypeTable の details 要素に id 属性を付けます。
 *
 * Blume の icon-sprite middleware と同じく、プリレンダー時にも実行されるため、静的ビルドの HTML にも残ります。
 */
export const onRequest: MiddlewareHandler = createTypeTableDetailsIdsMiddleware();
