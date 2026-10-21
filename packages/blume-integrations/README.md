# @tai-kun/blume-integrations

[Document](https://tai-kun.github.io/blume-integrations/)

## `typeTableDetailsIds`

Adds an arbitrary `id` attribute to every `<details>` row rendered by Blume's `TypeTable`.

```ts
import { typeTableDetailsIds } from "@tai-kun/blume-integrations";
import { defineConfig } from "blume";

export default defineConfig({
  integrations: [typeTableDetailsIds()],
});
```

Write the id at the beginning of a row's `type`, wrapped in `[#...]`:

```astro
<TypeTable
  type={{
    label: {
      type: "[#prop-label]string",
      required: true,
    },
  }}
/>
```

This renders the type as `string`, adds `id="prop-label"` to the row's `<details>` element, and wraps the property name in a link to `#prop-label`:

```html
<details ... id="prop-label">
  <summary>
    <code><a class="blume-type-table-details-link" href="#prop-label">label</a></code>
    <code>string</code>
    ...
  </summary>
  ...
</details>
```

The link has the class `blume-type-table-details-link` and inherits its color, font, cursor, and text decoration from the surrounding element. Rows without a marker get no id, and an existing `id` attribute is never overwritten.
