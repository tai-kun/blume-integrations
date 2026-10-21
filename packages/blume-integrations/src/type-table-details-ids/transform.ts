import {
  decodeHtmlEntities,
  escapeAttribute,
  escapeRegExp,
  findClosingTag,
  findTagEnd,
  getAttribute,
  hasClass,
  isRawTextElement,
  readTag,
} from "../internal/html.js";

/**
 * TypeTable の details 要素を識別するためのクラスです。
 *
 * Blume の TypeTable は、1 行ごとの details 要素に `group/tt` を付けます。
 */
const TYPE_TABLE_DETAILS_CLASS = "group/tt";

/**
 * プロパティ名を包むリンクに付けるクラスです。
 *
 * 利用者が追加のスタイルを当てやすいように、固有のクラス名を付けています。
 */
export const TYPE_TABLE_DETAILS_LINK_CLASS = "blume-type-table-details-link";

/**
 * `summary` 要素の中身と位置です。
 */
interface Summary {
  /**
   * `summary` 要素の中身です。
   */
  content: string;

  /**
   * `summary` 要素の中身の開始位置です。
   */
  contentStart: number;

  /**
   * `summary` 要素の中身の終了位置です。
   */
  contentEnd: number;

  /**
   * 終了タグを含む `summary` 要素の終了位置です。
   */
  end: number;
}

/**
 * `summary` 要素の中のセルです。
 */
interface Cell {
  /**
   * 開始タグの属性部分です。
   */
  attributes: string;

  /**
   * 開始タグと終了タグの間の中身です。
   */
  content: string;

  /**
   * セルの終了位置です。
   */
  end: number;

  /**
   * セルの開始位置です。
   */
  start: number;

  /**
   * タグ名です。
   */
  tag: string;
}

/**
 * `type` の先頭に書かれた id のマーカーです。
 */
interface Marker {
  /**
   * デコード前の id です。
   */
  id: string;

  /**
   * マーカー全体の長さです。
   */
  length: number;

  /**
   * `type` から取り除く文字列です。
   */
  text: string;
}

/**
 * `summary` 要素を探します。
 */
const findSummary = (detailsHtml: string): Summary | undefined => {
  const openTag = /<summary\b[^>]*>/i.exec(detailsHtml);
  if (openTag?.index === undefined) {
    return undefined;
  }

  const contentStart = openTag.index + openTag[0].length;
  const closingTag = findClosingTag(detailsHtml, "summary", contentStart);
  if (closingTag === undefined) {
    return undefined;
  }

  return {
    content: detailsHtml.slice(contentStart, closingTag.start),
    contentStart,
    contentEnd: closingTag.start,
    end: closingTag.end,
  };
};

/**
 * 1 列目のプロパティ名のセルを探します。
 *
 * プロパティ名は常に `code` 要素です。
 */
const findNameCell = (summary: string): Cell | undefined => {
  const match = /<code\b([^>]*)>([\s\S]*?)<\/code>/i.exec(summary);
  if (match?.index === undefined || match[1] === undefined || match[2] === undefined) {
    return undefined;
  }

  return {
    attributes: match[1],
    content: match[2],
    end: match.index + match[0].length,
    start: match.index,
    tag: "code",
  };
};

/**
 * 2 列目の `type` のセルを探します。
 *
 * `type` は `code` 要素、または `typeDescriptionLink` がある場合は `a` 要素です。
 */
const findTypeCell = (summary: string, from: number): Cell | undefined => {
  const match = /<(code|a)\b([^>]*)>([\s\S]*?)<\/\1>/i.exec(summary.slice(from));
  if (
    match?.index === undefined ||
    match[1] === undefined ||
    match[2] === undefined ||
    match[3] === undefined
  ) {
    return undefined;
  }

  return {
    attributes: match[2],
    content: match[3],
    end: from + match.index + match[0].length,
    start: from + match.index,
    tag: match[1],
  };
};

/**
 * `type` の先頭の `[#id]` マーカーを探します。
 */
const findMarker = (typeContent: string): Marker | undefined => {
  const match = /^\s*\[#([^\]\s]+)\]\s*/.exec(typeContent);
  if (match?.[1] === undefined) {
    return undefined;
  }

  return {
    id: match[1],
    length: match[0].length,
    text: `[#${match[1]}]`,
  };
};

/**
 * プロパティ名を details 要素の id へのリンクで囲みます。
 *
 * 前後の空白はリンクの外に残します。
 */
const linkPropertyName = (name: string, id: string): string => {
  const label = name.trim();
  if (label === "") {
    return name;
  }

  const leading = name.slice(0, name.length - name.trimStart().length);
  const trailing = name.slice(name.trimEnd().length);

  return `${leading}<a class="${TYPE_TABLE_DETAILS_LINK_CLASS}" href="${escapeAttribute(`#${id}`)}">${label}</a>${trailing}`;
};

/**
 * 展開後の Type 行にも同じマーカーが表示されるため、`code` 要素の先頭からも取り除きます。
 */
const removeMarkerFromBody = (body: string, marker: string): string => {
  const pattern = new RegExp(`(<(?:code|a)\\b[^>]*>\\s*)${escapeRegExp(marker)}\\s*`, "gi");
  return body.replace(pattern, "$1");
};

/**
 * details 要素に id 属性を付け、type の先頭の `[#id]` を取り除いた HTML を返します。
 *
 * プロパティ名は、details 要素の id へのリンクで囲みます。
 * マーカーがない場合は元の HTML をそのまま返します。
 */
const transformDetails = (detailsHtml: string): string => {
  const openTagEnd = findTagEnd(detailsHtml, 1);
  if (openTagEnd === -1) {
    return detailsHtml;
  }

  const openTag = readTag(detailsHtml, 0, openTagEnd);
  if (openTag?.name !== "details") {
    return detailsHtml;
  }

  const summary = findSummary(detailsHtml);
  if (summary === undefined) {
    return detailsHtml;
  }

  const nameCell = findNameCell(summary.content);
  if (nameCell === undefined) {
    return detailsHtml;
  }

  const typeCell = findTypeCell(summary.content, nameCell.end);
  if (typeCell === undefined) {
    return detailsHtml;
  }

  const marker = findMarker(typeCell.content);
  if (marker === undefined) {
    return detailsHtml;
  }

  const id = decodeHtmlEntities(marker.id);
  const existingId = getAttribute(openTag.attributes, "id");
  const detailsId = existingId === undefined ? id : decodeHtmlEntities(existingId);
  const summaryHtml =
    summary.content.slice(0, nameCell.start) +
    `<code${nameCell.attributes}>${linkPropertyName(nameCell.content, detailsId)}</code>` +
    summary.content.slice(nameCell.end, typeCell.start) +
    `<${typeCell.tag}${typeCell.attributes}>${typeCell.content.slice(marker.length)}</${typeCell.tag}>` +
    summary.content.slice(typeCell.end);
  const body = removeMarkerFromBody(detailsHtml.slice(summary.end), marker.text);

  let result =
    detailsHtml.slice(0, summary.contentStart) +
    summaryHtml +
    detailsHtml.slice(summary.contentEnd, summary.end) +
    body;

  if (existingId === undefined) {
    result =
      result.slice(0, openTagEnd) +
      ` id="${escapeAttribute(detailsId)}"` +
      result.slice(openTagEnd);
  }

  return result;
};

/**
 * TypeTable の details 要素に id 属性を付けます。
 *
 * `type` の先頭に `[#example]` のように書くと、`example` が details 要素の id になります。
 * マーカーは表示される type からは取り除き、プロパティ名は id へのリンクにします。
 * リンクには `blume-type-table-details-link` クラスが付き、親要素のスタイルを引き継ぎます。
 * すでに id 属性を持つ details 要素の id は変更しません。
 *
 * @param html 変換する HTML です。
 * @returns 変換後の HTML です。
 */
export const addTypeTableDetailsIds = (html: string): string => {
  if (!html.includes(TYPE_TABLE_DETAILS_CLASS)) {
    return html;
  }

  const chunks: string[] = [];
  let cursor = 0;
  let position = 0;
  let changed = false;

  while (position < html.length) {
    const start = html.indexOf("<", position);
    if (start === -1) {
      break;
    }

    if (html.startsWith("<!--", start)) {
      const end = html.indexOf("-->", start + 4);
      position = end === -1 ? html.length : end + 3;
      continue;
    }

    const end = findTagEnd(html, start + 1);
    if (end === -1) {
      break;
    }

    const tag = readTag(html, start, end);
    if (tag === undefined) {
      position = end + 1;
      continue;
    }

    if (isRawTextElement(tag.name)) {
      position = findClosingTag(html, tag.name, end + 1)?.start ?? html.length;
      continue;
    }

    if (tag.name === "details" && hasClass(tag.attributes, TYPE_TABLE_DETAILS_CLASS)) {
      const closingTag = findClosingTag(html, "details", end + 1);
      if (closingTag === undefined) {
        position = end + 1;
        continue;
      }

      const detailsHtml = html.slice(start, closingTag.end);
      const transformed = transformDetails(detailsHtml);
      if (transformed !== detailsHtml) {
        chunks.push(html.slice(cursor, start), transformed);
        cursor = closingTag.end;
        changed = true;
      }

      position = closingTag.end;
      continue;
    }

    position = end + 1;
  }

  if (!changed) {
    return html;
  }

  chunks.push(html.slice(cursor));
  return chunks.join("");
};
