import { BLOG_ARTICLES, SHOP_PRODUCTS } from '@stade/editorial-commerce';
import { scenePatternByBlock } from './scene-patterns.mjs';
import { findMedia } from './scene-media.mjs';
import { mountMediaImage } from './media-image.mjs';

const defaults = { articles: scene => scene.template === 'blog' ? BLOG_ARTICLES : [], products: () => SHOP_PRODUCTS };

export function getCollection(scene, key) {
  return scene.collections?.[key] ?? defaults[key](scene);
}

export function usesModule(scene, module) {
  function includesModule(block) {
    return scenePatternByBlock[block.type] === module || block.children?.some(includesModule);
  }
  return scene.template === module || scene.acts.some(act => includesModule(act.layout));
}

export function renderRecordImage(document, scene, record) {
  if (!record.imageId && record.art) return undefined;
  const media = findMedia(scene, record.imageId);
  const image = mountMediaImage(document);
  image.update(media, record.imageAlt ?? media?.name ?? '');
  return image.element;
}
