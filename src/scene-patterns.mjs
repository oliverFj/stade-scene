import { blogPattern, shopPattern, editorPattern } from './demo-patterns.mjs';

export const scenePatterns = { blog: blogPattern, shop: shopPattern, editor: editorPattern };
export const scenePatternByBlock = Object.create(null);
export const scenePatternBlocks = Object.create(null);
for (const pattern of Object.values(scenePatterns)) {
  for (const [type, part] of Object.entries(pattern.parts)) {
    if (Object.hasOwn(scenePatternBlocks, type)) throw new Error('Dubleret bloktype i scenemønstrene: ' + type);
    scenePatternByBlock[type] = pattern.id;
    scenePatternBlocks[type] = part;
  }
}

export function sceneRegistryMarkup() {
  const patterns = Object.values(scenePatterns).map(({ id, name, description, parts }) => ({
    id, name, description,
    parts: Object.entries(parts).map(([type, { name, fields, parts, actions, repeatable, collection, acceptsCollection }]) => ({
      type, name, fields, parts, ...(actions && { actions }), ...(repeatable && { repeatable }),
      ...(collection && { collection }), ...(acceptsCollection && { acceptsCollection }),
    })),
  }));
  const json = JSON.stringify({ version: 1, patterns }).replace(/</g, '\\u003c');
  return '<script type="application/json" id="stade-scene-registry">' + json + '</script>';
}
