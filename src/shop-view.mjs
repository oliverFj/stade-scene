import { mountShopScene } from '@stade/editorial-commerce';
import { shopPattern } from './demo-patterns.mjs';
import { mountPatternRegions } from './pattern-region.mjs';
import { getCollection, renderRecordImage } from './content-data.mjs';

export function mountShopView({ document, theme, state, scene, announce, onAction, idPrefix = 'scene-shop' }) {
  const shop = mountPatternRegions(shopPattern.parts, { document }, publish => mountShopScene(theme, {
    document, state, idPrefix, announce,
    getProducts: () => getCollection(scene, 'products'),
    renderProductImage: product => renderRecordImage(document, scene, product),
    onOpenCart: onAction && (trigger => onAction('cart', trigger)),
    renderParts({ header, cart, feature, collection, footer }) {
      publish({
        'shop-header': header,
        'shop-cart': cart,
        'shop-feature': feature,
        'shop-collection': collection,
        'shop-footer': footer,
      });
    },
  }));
  return { ...shop, updateData: shop.refresh, selectRecord: shop.selectProduct };
}
