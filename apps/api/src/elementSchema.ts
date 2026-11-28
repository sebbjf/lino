// shared-board schema: the element and board shapes a POST /boards body must match
// What a shared board may contain. Strict on purpose: another person's browser renders it.
const dataImage = { type: 'string', pattern: '^data:image/(png|jpeg|webp|gif);base64,' }
const hex = { type: 'string', pattern: '^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$' }
const strings = (maxItems: number, maxLength: number) => ({ type: 'array', maxItems, items: { type: 'string', maxLength } })
const requires = (type: string, fields: string[]) => ({ if: { properties: { type: { const: type } } }, then: { required: fields } })
export const elementSchema = {
  type: 'object',
  required: ['id', 'type', 'x', 'y', 'w', 'h', 'rotation'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', maxLength: 64 },
    type: { enum: ['frame', 'image', 'note', 'color', 'link'] },
    x: { type: 'number', minimum: -1e6, maximum: 1e6 },
    y: { type: 'number', minimum: -1e6, maximum: 1e6 },
    w: { type: 'number', minimum: 1, maximum: 10_000 },
    h: { type: 'number', minimum: 1, maximum: 10_000 },
    rotation: { type: 'number' },
    src: dataImage,
    text: { type: 'string', maxLength: 10_000 },
    hex,
    url: { type: 'string', maxLength: 2048, pattern: '^https?://[^\s/?#]+' },
    title: { type: ['string', 'null'], maxLength: 500 },
    image: { anyOf: [dataImage, { type: 'null' }] },
    fonts: strings(20, 100),
    colors: { type: 'array', maxItems: 20, items: hex },
    status: { enum: ['ok', 'error'] },
    missing: strings(10, 20),
    error: { type: 'string', maxLength: 300 },
    corner: { enum: ['square', 'soft', 'round'] },
    shadow: { type: 'boolean' },
    deco: { enum: ['tape', 'pin'] },
    opacity: { type: 'number', minimum: 0.2, maximum: 1 },
    bg: hex,
    color: hex,
    size: { enum: ['sm', 'md', 'lg', 'xl'] },
    align: { enum: ['left', 'center', 'right'] },
    bold: { type: 'boolean' },
    italic: { type: 'boolean' },
    font: { enum: ['sans', 'serif'] },
    family: { type: 'string', pattern: '^[A-Za-z0-9 _-]{1,60}$' },
    filter: { enum: ['mono', 'duotone'] },
    duo: { type: 'array', minItems: 2, maxItems: 2, items: hex },
    paletteOff: { type: 'boolean' },
    locked: { type: 'boolean' },
    groupId: { type: 'string', maxLength: 64 },
    heading: { type: 'boolean' },
    flipX: { type: 'boolean' },
    flipY: { type: 'boolean' },
    crop: {
      type: 'object',
      required: ['x', 'y', 'w', 'h'],
      additionalProperties: false,
      properties: Object.fromEntries(['x', 'y', 'w', 'h'].map((k) => [k, { type: 'number', minimum: 0, maximum: 1 }])),
    },
  },
  allOf: [
    requires('frame', ['title']),
    requires('image', ['src']),
    requires('note', ['text']),
    requires('color', ['hex']),
    requires('link', ['url', 'title', 'image', 'fonts', 'colors', 'status', 'missing']),
  ],
}
export const boardSchema = {
  type: 'object',
  required: ['elements'],
  additionalProperties: false,
  properties: {
    elements: { type: 'array', minItems: 1, maxItems: 300, items: elementSchema },
    colorMeta: {
      type: 'object',
      maxProperties: 300,
      propertyNames: { pattern: hex.pattern },
      additionalProperties: {
        type: 'object',
        additionalProperties: false,
        properties: { name: { type: 'string', maxLength: 60 }, pinned: { type: 'boolean' }, hidden: { type: 'boolean' }, order: { type: 'number' } },
      },
    },
    board: {
      type: 'object',
      additionalProperties: false,
      properties: { bg: hex, pattern: { enum: ['dots', 'grid', 'plain'] }, messy: { type: 'boolean' } },
    },
  },
}
