import { describe, expect, it, vi } from "vitest";

import { typeTableDetailsIds } from "../../src/type-table-details-ids/index.js";
import { createTypeTableDetailsIdsMiddleware } from "../../src/type-table-details-ids/middleware.js";
import { addTypeTableDetailsIds } from "../../src/type-table-details-ids/transform.js";

interface Row {
  link?: string;
  name: string;
  required?: boolean;
  type: string;
}

/**
 * Blume の TypeTable に近い HTML を作ります。
 */
const typeTable = (rows: Row[]): string => `
<div class="not-prose my-6 rounded-blume border border-border bg-muted/30 p-1.5" data-blume-narration="skip">
  <div class="grid grid-cols-[1fr_2fr_auto] items-center gap-4 px-3 py-2 font-medium text-muted-foreground text-xs">
    <span>Prop</span>
    <span>Type</span>
    <span aria-hidden="true" class="size-3.5"></span>
  </div>
  <div class="mt-1 flex flex-col gap-1">
    ${rows
      .map(
        ({ link, name, required = false, type }) => `
    <details class="group/tt border-border border-t [[open]+&]:border-t-transparent open:rounded-blume">
      <summary class="grid cursor-pointer list-none px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <code class="break-words font-mono text-accent text-xs">
          ${name}${required ? "" : "?"}
        </code>
        ${
          link === undefined
            ? `<code class="break-words font-mono text-foreground text-xs">${type}</code>`
            : `<a class="break-words font-mono text-foreground text-xs" href="${link}">${type}</a>`
        }
        <svg aria-hidden="true"></svg>
      </summary>
      <div class="border-border border-t px-3 py-3 text-xs">
        <div>
          <span>Type</span>
          <code class="break-words font-mono text-foreground">${type}</code>
        </div>
      </div>
    </details>`,
      )
      .join("")}
  </div>
</div>
`;

describe("addTypeTableDetailsIds", () => {
  it("type の先頭の [#id] を details の id に使う", () => {
    const html = typeTable([
      { name: "label", required: true, type: "[#prop-label]string" },
      { name: "description", type: "[#prop-description]string" },
    ]);
    const result = addTypeTableDetailsIds(html);

    expect(result).toContain('id="prop-label"');
    expect(result).toContain('id="prop-description"');
    expect(result).toMatch(
      /<a class="blume-type-table-details-link" href="#prop-label">\s*label\s*<\/a>/,
    );
    expect(result).toMatch(
      /<a class="blume-type-table-details-link" href="#prop-description">\s*description\?\s*<\/a>/,
    );
    expect(result).not.toContain("[#prop-label]");
    expect(result).not.toContain("[#prop-description]");
  });

  it("マーカーの後ろの空白を type に残さない", () => {
    const result = addTypeTableDetailsIds(
      typeTable([{ name: "label", type: "[#prop-label] string | number" }]),
    );

    expect(result).toContain('id="prop-label"');
    expect(result).toContain(">string | number</code>");
  });

  it("マーカーがない type には id を付けない", () => {
    const result = addTypeTableDetailsIds(typeTable([{ name: "label", type: "string" }]));

    expect(result).not.toContain(" id=");
    expect(result).toContain(">string</code>");
  });

  it("typeDescriptionLink の属性を保ったままマーカーを取り除く", () => {
    const result = addTypeTableDetailsIds(
      typeTable([
        {
          link: "/types/string",
          name: "label",
          type: "[#prop-label]string",
        },
      ]),
    );

    expect(result).toContain('id="prop-label"');
    expect(result).toContain('href="/types/string"');
    expect(result).toContain('href="#prop-label"');
    expect(result).not.toContain("[#prop-label]");
  });

  it("すでに id がある details 要素の id は変更しない", () => {
    const html = typeTable([{ name: "label", type: "[#prop-label]string" }]).replace(
      '<details class="group/tt',
      '<details id="existing" class="group/tt',
    );
    const result = addTypeTableDetailsIds(html);

    expect(result).toContain('id="existing"');
    expect(result).not.toContain('id="prop-label"');
    expect(result).toContain('href="#existing"');
    expect(result).not.toContain("[#prop-label]");
  });

  it("プロパティ名に [#id] があっても id には使わない", () => {
    const result = addTypeTableDetailsIds(
      typeTable([{ name: "[#prop-name]", required: true, type: "string" }]),
    );

    expect(result).not.toContain(" id=");
  });

  it("TypeTable 以外の details 要素は変更しない", () => {
    const html = `<details class="other"><summary><code>label</code><code>[#other]string</code></summary></details>${typeTable(
      [{ name: "label", type: "[#prop-label]string" }],
    )}`;
    const result = addTypeTableDetailsIds(html);

    expect(result).toContain('<details class="other">');
    expect(result).toContain("[#other]");
    expect(result).toContain('id="prop-label"');
  });

  it("HTML の先頭にある details 要素も変更する", () => {
    const html =
      '<details class="group/tt"><summary><code>label</code><code>[#prop-label]string</code></summary></details>';
    const result = addTypeTableDetailsIds(html);

    expect(result).toContain('id="prop-label"');
    expect(result).toContain('href="#prop-label"');
  });

  it("script 要素の中の details は変更しない", () => {
    const html = `${typeTable([{ name: "label", type: "[#prop-label]string" }])}<script>const html = \`${typeTable(
      [{ name: "inside", type: "[#prop-inside]string" }],
    )}\`;</script>`;
    const result = addTypeTableDetailsIds(html);

    expect(result).toContain('id="prop-label"');
    expect(result).not.toContain('id="prop-inside"');
  });

  it("id 属性としてエスケープする", () => {
    const result = addTypeTableDetailsIds(typeTable([{ name: "label", type: "[#a&amp;b]string" }]));

    expect(result).toContain('id="a&amp;b"');
    expect(result).toContain('href="#a&amp;b"');
    expect(result).toContain(">string</code>");
  });

  it("TypeTable がなければそのまま返す", () => {
    const html = "<html><body><details>text</details></body></html>";
    expect(addTypeTableDetailsIds(html)).toBe(html);
  });
});

describe("createTypeTableDetailsIdsMiddleware", () => {
  it("HTML の TypeTable に id を付け、リンク用のスタイルを追加する", async () => {
    const html = `<html><head></head><body>${typeTable([{ name: "label", type: "[#prop-label]string" }])}</body></html>`;
    const next = async () =>
      new Response(html, {
        headers: {
          "content-length": String(html.length),
          "content-type": "text/html; charset=utf-8",
        },
      });
    const response = (await createTypeTableDetailsIdsMiddleware()(
      {} as never,
      next as never,
    )) as Response;
    const body = await response.text();

    expect(body).toContain('id="prop-label"');
    expect(body).toContain('class="blume-type-table-details-link"');
    expect(body).toContain("<style data-blume-type-table-details-ids>");
    expect(body).toContain(".blume-type-table-details-link {");
    expect(body).toContain("text-decoration: inherit;");
    expect(response.headers.get("content-length")).toBeNull();
  });

  it("マーカーがない場合はリンク用のスタイルを追加しない", async () => {
    const html = `<html><head></head><body>${typeTable([{ name: "label", type: "string" }])}</body></html>`;
    const next = async () =>
      new Response(html, {
        headers: {
          "content-length": String(html.length),
          "content-type": "text/html; charset=utf-8",
        },
      });
    const response = (await createTypeTableDetailsIdsMiddleware()(
      {} as never,
      next as never,
    )) as Response;
    const body = await response.text();

    expect(body).not.toContain("<style data-blume-type-table-details-ids>");
    expect(response.headers.get("content-length")).toBe(String(html.length));
  });

  it("HTML 以外はそのまま通す", async () => {
    const next = async () =>
      new Response('{"ok":true}', { headers: { "content-type": "application/json" } });
    const response = (await createTypeTableDetailsIdsMiddleware()(
      {} as never,
      next as never,
    )) as Response;

    expect(await response.text()).toBe('{"ok":true}');
  });
});

describe("typeTableDetailsIds", () => {
  it("middleware を登録する", async () => {
    const addMiddleware = vi.fn<(middleware: { entrypoint: string }) => void>();
    const integration = typeTableDetailsIds();
    const setup = integration.hooks?.["astro:config:setup"];

    expect(setup).toBeDefined();
    await setup?.({
      addMiddleware,
    } as never);

    expect(addMiddleware).toHaveBeenCalledWith(expect.objectContaining({ order: "post" }));
    const entrypoint = addMiddleware.mock.calls[0]?.[0]?.entrypoint as string;
    expect(entrypoint).toMatch(/type-table-details-ids[\\/]middleware\.js$/);
  });
});
