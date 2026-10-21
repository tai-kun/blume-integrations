import { fileURLToPath } from "node:url";

import type { AstroIntegration } from "astro";

/**
 * TypeTable の details 要素に id 属性を付ける AstroIntegration を作成します。
 *
 * Blume の `TypeTable` が描画する details 要素に、`type` の先頭へ書いた `[#id]` の id を付けます。
 * プロパティ名は、その id へのリンクで囲みます。
 * `details` 要素は折りたたみ式のプロパティ行なので、id を付けると特定の行へのリンクを作れます。
 *
 * @returns AstroIntegration です。
 *
 * @example
 * ```astro
 * <TypeTable
 *   type={{
 *     label: {
 *       type: "[#prop-label]string",
 *       required: true,
 *     },
 *   }}
 * />
 * ```
 */
export function typeTableDetailsIds(): AstroIntegration {
  return {
    name: "blume-type-table-details-ids",
    hooks: {
      "astro:config:setup"({ addMiddleware }) {
        addMiddleware({
          entrypoint: fileURLToPath(new URL("./middleware.js", import.meta.url)),
          order: "post",
        });
      },
    },
  };
}
