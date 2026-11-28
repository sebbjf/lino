# Lino board file format

A `.lino.json` file is a JSON object. It contains the board's elements, palette edits and canvas style. Pictures are stored inline.

## Top-level fields

| Field | Type | What Lino writes and reads |
| --- | --- | --- |
| `app` | string | Lino writes `"lino"`. The reader ignores this field. |
| `version` | number | Lino writes `1`. The reader ignores this field. |
| `elements` | array | Required. The elements are stored in board order. |
| `colorMeta` | object | Palette edits keyed by hex color. Defaults to `{}`. |
| `board` | object | Canvas style. Defaults to `{}`. |

## Reading a file

The format stays at version 1. Write `"app": "lino"` and `"version": 1`. Lino applies the same parser if either field is absent or has another value. There is no version check or version-specific conversion.

Ignore unknown fields. Skip and count each element with an unknown kind, an invalid box or a missing or invalid required kind field. Lino reports the skipped count on a successful import. Invalid optional fields are dropped or replaced with the defaults below. They do not count as skipped items. Invalid palette entries and board settings do not count either.

Lino rejects invalid JSON, a missing or non-array `elements` field, and any file with no usable elements after parsing. The file importer rejects files larger than 50 MB (52,428,800 bytes). Export has no matching size check.

All numbers that Lino validates must be finite. String limits are measured in UTF-16 code units. A hex color starts with `#` followed by exactly 3, 4, 6 or 8 hexadecimal digits, case-insensitive.

## Palette edits

Lino keeps entries with hex keys and non-null object values. It lowercases the keys and reads these optional fields.

| Field | Type | Rule or default |
| --- | --- | --- |
| `name` | string | Up to 60 code units. Missing or empty names display as `color-N` in palette order. |
| `pinned` | boolean | Defaults to unpinned. Pinned colors are included in the palette and sort first. |
| `hidden` | boolean | Defaults to visible. Hidden colors are left out of the visible palette. |
| `order` | number | Sort key within the pinned or unpinned colors, lowest first. Without a key, Lino uses the number of collected colors plus the color's zero-based index in the visible list before sorting. |

## Canvas style

| Field | Type | Rule or default |
| --- | --- | --- |
| `bg` | hex string | Background color. Defaults to the theme background. |
| `pattern` | string | `dots`, `grid` or `plain`. Defaults to `dots`. |
| `messy` | boolean | Tilts newly added elements when true. Defaults to off. |

## Common element fields

| Field | Type | Rule or default |
| --- | --- | --- |
| `type` | string | Required. Must be one of the five kind names as a string: `note`, `color`, `frame`, `image` or `link`. |
| `id` | string | Lino writes the element ID and generates a fresh UUID on read, even if this field is absent. |
| `x`, `y` | number | Required. Position of the box's top-left corner before rotation, in board pixels. Clamped to −1,000,000 through 1,000,000. |
| `w`, `h` | number | Required. Width and height in board pixels. Must be positive. Clamped to 1 through 10,000. |
| `rotation` | number | Degrees. Lino takes the signed remainder after division by 360. Defaults to 0. |
| `corner` | string | `square`, `soft` or `round`. Defaults to `soft`. |
| `shadow` | boolean | Defaults to the element's usual shadow. `false` turns the shadow off. |
| `opacity` | number | Clamped to 0.2 through 1. Defaults to 1. |
| `deco` | string | `tape` or `pin`. Defaults to no decoration. |
| `locked` | boolean | Only `true` is kept. Defaults to unlocked. |
| `groupId` | string | 1 to 64 code units. Elements with the same group ID can be selected together. Defaults to no group. |

## Element kinds

### Note (`note`)

| Field | Type | Rule or default |
| --- | --- | --- |
| `text` | string | Required. May be empty. Lino trims it to the first 10,000 code units. |
| `bg` | hex string | Defaults to the theme card color. A heading without a background sits directly on the board. |
| `color` | hex string | Defaults to automatic text color based on the card or board. |
| `size` | string | `sm`, `md`, `lg` or `xl`. Defaults to `md`. Headings use a fixed size. |
| `font` | string | `sans` or `serif`. Defaults to `sans`. |
| `family` | string | 1 to 60 ASCII letters, digits, spaces, underscores or hyphens. If set, Lino tries this family before the font set by `font`. Otherwise it uses `font` alone. |
| `align` | string | `left`, `center` or `right`. Defaults to `left`. |
| `bold`, `italic`, `heading` | boolean | Each defaults to off. |

### Color (`color`)

| Field | Type | Rule or default |
| --- | --- | --- |
| `hex` | hex string | Required. The swatch color. |

### Frame (`frame`)

| Field | Type | Rule or default |
| --- | --- | --- |
| `title` | string | Required. Up to 500 code units. May be empty. |

### Image (`image`)

| Field | Type | Rule or default |
| --- | --- | --- |
| `src` | string | Required. Inline image data URL. See [Embedded images](#embedded-images). |
| `colors` | array of hex strings | Keeps the first 20 valid entries. A missing or non-array value is omitted. An empty array records that there are no sampled colors. |
| `filter` | string | `mono` or `duotone`. Defaults to no filter. |
| `duo` | array of two hex strings | Shadow and highlight colors, in that order. Duotone defaults to `["#2f4858", "#f4efe6"]`. |
| `paletteOff` | boolean | Only `true` is kept. When set, the image contributes no colors to the palette. |
| `flipX`, `flipY` | boolean | Only `true` is kept. Flip horizontally or vertically. Both default to off. |
| `crop` | object | Visible rectangle as fractions of the source image. All four numbers below are required for an explicit crop. Without one, the picture fills its box using a cover fit. |

| Crop field | Type | Range after clamping |
| --- | --- | --- |
| `w`, `h` | number | 0.05 through 1. |
| `x` | number | 0 through `1 - w`. |
| `y` | number | 0 through `1 - h`. |

### Link (`link`)

| Field | Type | Rule or default |
| --- | --- | --- |
| `url` | string | Required. Up to 2,048 code units. Must parse as a URL with an `http:` or `https:` protocol. |
| `title` | string or null | Up to 500 code units. Defaults to `null`. |
| `image` | string or null | Inline cover image data URL. Defaults to `null`. |
| `fonts`, `missing` | array of strings | Each keeps the first 20 valid strings, up to 200 code units per string. Defaults to `[]`. `missing` lists metadata the link reader could not find. |
| `colors` | array of hex strings | Keeps the first 20 valid entries. Defaults to `[]`. |
| `status` | string | `ok` stays `ok`. All other values, including `loading` and an absent status, become `error`. |
| `error` | string | Omitted for `ok`. A saved `loading` status becomes `Reading was interrupted.` For other errors, Lino keeps a string up to 300 code units or uses `Not read.` |

## Embedded images

Lino stores new images as WebP data URLs with a maximum of 1,600 pixels on the longest side. Board files carry the base64 data in `image.src` or a link's `image` field. Export resolves local image IDs to data URLs. If a blob is missing, export drops the image element or sets the link cover to `null`.

The board file parser accepts the prefixes `data:image/webp;base64,`, `data:image/png;base64,`, `data:image/jpeg;base64,` and `data:image/gif;base64,`. It checks the prefix only. The 1,600-pixel limit applies when adding images, and file import does not check pixel dimensions. Remote image URLs and local `img:` IDs fail the picture check. A failed check skips an image element or clears a link cover.

## Example

```json
{
  "app": "lino",
  "version": 1,
  "elements": [
    {
      "id": "d055e195-8a49-49ae-bd14-0eeb6f44fb09",
      "type": "color",
      "x": 0,
      "y": 0,
      "w": 160,
      "h": 120,
      "rotation": 0,
      "hex": "#ef7d12"
    }
  ],
  "colorMeta": {
    "#ef7d12": { "name": "orange", "pinned": true }
  },
  "board": { "pattern": "dots" }
}
```
