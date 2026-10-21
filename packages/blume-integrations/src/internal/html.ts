/**
 * HTML のタグです。
 */
export interface HtmlTag {
  /**
   * タグ名です。小文字に正規化します。
   */
  name: string;

  /**
   * タグ名より後ろの属性部分です。
   */
  attributes: string;
}

/**
 * 中身を HTML として解釈しない要素です。
 */
const RAW_TEXT_ELEMENTS: ReadonlySet<string> = new Set(["script", "style", "textarea", "title"]);

/**
 * 中身を HTML として解釈しない要素かどうかを判定します。
 */
export const isRawTextElement = (name: string): boolean => RAW_TEXT_ELEMENTS.has(name);

/**
 * 正規表現の中で特別な意味を持つ文字をエスケープします。
 */
export const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * 開始タグの終わり (`>`) を探します。
 *
 * 属性値の中にある `>` をタグの終わりと取り違えないように、引用符の中を読み飛ばします。
 */
export const findTagEnd = (html: string, from: number): number => {
  let quote: string | undefined;

  for (let index = from; index < html.length; index++) {
    const character = html[index];

    if (quote === undefined) {
      if (character === '"' || character === "'") {
        quote = character;
      } else if (character === ">") {
        return index;
      }
    } else if (character === quote) {
      quote = undefined;
    }
  }

  return -1;
};

/**
 * 開始タグを読み取ります。
 */
export const readTag = (html: string, start: number, end: number): HtmlTag | undefined => {
  const match = /^<\s*([^\s/>]+)/.exec(html.slice(start, end));
  if (!match?.[1]) {
    return undefined;
  }

  return {
    name: match[1].toLowerCase(),
    attributes: html.slice(start + match[0].length, end),
  };
};

/**
 * 終了タグを探します。
 */
export const findClosingTag = (
  html: string,
  name: string,
  from: number,
): { start: number; end: number } | undefined => {
  const pattern = new RegExp(`</\\s*${escapeRegExp(name)}\\s*>`, "gi");
  pattern.lastIndex = from;
  const match = pattern.exec(html);

  if (!match) {
    return undefined;
  }

  return {
    start: match.index,
    end: match.index + match[0].length,
  };
};

/**
 * 属性値を取得します。
 * 属性名の大文字と小文字は区別しません。
 */
export const getAttribute = (attributes: string, name: string): string | undefined => {
  const pattern = new RegExp(
    "(?:^|\\s)" + escapeRegExp(name) + "(?:\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s\"'=<>`]+)))?",
    "i",
  );
  const match = pattern.exec(attributes);

  if (!match) {
    return undefined;
  }

  return match[1] ?? match[2] ?? match[3] ?? "";
};

/**
 * クラス属性に指定したクラスが含まれているかを判定します。
 */
export const hasClass = (attributes: string, className: string): boolean =>
  (getAttribute(attributes, "class") ?? "").split(/\s+/).includes(className);

/**
 * 名前付き HTML エンティティです。
 */
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: "\u00a0",
  quot: '"',
};

/**
 * HTML エンティティをデコードします。
 */
export const decodeHtmlEntities = (value: string): string =>
  value.replace(
    /&(?:#(\d+)|#x([\da-f]+)|([a-z][\da-z]+));/gi,
    (
      entity,
      decimal: string | undefined,
      hexadecimal: string | undefined,
      named: string | undefined,
    ) => {
      if (decimal !== undefined || hexadecimal !== undefined) {
        const codePoint = Number.parseInt(
          decimal ?? hexadecimal ?? "",
          hexadecimal === undefined ? 10 : 16,
        );
        if (Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff) {
          return String.fromCodePoint(codePoint);
        }

        return entity;
      }

      return NAMED_ENTITIES[(named ?? "").toLowerCase()] ?? entity;
    },
  );

/**
 * HTML の属性値としてエスケープします。
 */
export const escapeAttribute = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
