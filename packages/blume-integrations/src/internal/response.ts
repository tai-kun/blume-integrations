/**
 * ボディを持てない HTTP ステータスです。
 */
const BODYLESS_STATUSES: ReadonlySet<number> = new Set([101, 204, 205, 304]);

/**
 * HTML のレスポンスかどうかを判定します。
 */
export const isHtmlResponse = (response: Response): boolean =>
  (response.headers.get("content-type") ?? "").includes("text/html");

/**
 * `</head>` の直前に HTML を挿入します。
 * `</head>` がない場合は元の HTML をそのまま返します。
 */
export const insertBeforeHeadEnd = (html: string, markup: string): string =>
  html.includes("</head>") ? html.replace("</head>", `${markup}</head>`) : html;

/**
 * HTML のレスポンスを書き換えます。
 *
 * HTML 以外のレスポンス、ボディを持てないレスポンス、ボディを持たないレスポンスはそのまま返します。
 * 内容が変わった場合は、古い `Content-Length` を削除します。
 */
export const rewriteHtmlResponse = async (
  response: Response,
  transform: (html: string) => string,
): Promise<Response> => {
  if (
    !isHtmlResponse(response) ||
    response.body === null ||
    BODYLESS_STATUSES.has(response.status)
  ) {
    return response;
  }

  const html = await response.text();
  const transformed = transform(html);
  const headers = new Headers(response.headers);

  if (transformed !== html) {
    headers.delete("content-length");
  }

  return new Response(transformed, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
};
