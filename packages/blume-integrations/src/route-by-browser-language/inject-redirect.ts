import type { MiddlewareHandler } from "astro";
import data from "blume:data";

import { insertBeforeHeadEnd, rewriteHtmlResponse } from "../internal/response.js";
import { getLocaleRedirect, renderLocaleRedirectScript } from "./redirect-paths.js";

/**
 * Astro の `BASE_URL` から、デプロイ先のベースパスを取り出します。
 */
const getDeployBase = (): string => {
  const env = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env;
  return env?.BASE_URL ?? "";
};

/**
 * URL からデプロイ先のベースパスを取り除き、Blume のルートのパスにします。
 */
const stripDeployBase = (pathname: string, deployBase: string): string => {
  const base = deployBase.replace(/\/+$/, "");
  if (base === "") {
    return pathname;
  }
  if (pathname === base) {
    return "/";
  }
  return pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname;
};

/**
 * デフォルトロケールのページに、ブラウザーの言語設定に合わせて転送するスクリプトを挿入します。
 *
 * スクリプトは HTML の描画前に実行されるため、転送先がある場合はページが表示される前に移動します。
 * HTML 以外のレスポンスはそのまま通します。
 */
export const onRequest: MiddlewareHandler = async (context, next) => {
  const response = await next();
  const deployBase = getDeployBase();
  const pathname = stripDeployBase(context.url.pathname, deployBase);
  const redirect = getLocaleRedirect(data, pathname, deployBase);

  if (redirect === undefined) {
    return response;
  }

  const script = renderLocaleRedirectScript(redirect);
  return rewriteHtmlResponse(response, (html) => insertBeforeHeadEnd(html, script));
};
