import { mountBlogScene } from '@stade/editorial-commerce';
import { blogPattern } from './demo-patterns.mjs';
import { mountPatternRegions } from './pattern-region.mjs';
import { getCollection, renderRecordImage } from './content-data.mjs';

const fixedParts = Object.fromEntries(Object.entries(blogPattern.parts).filter(([, part]) => !part.repeatable));

export function mountBlogView({ document, theme, state, scene, announce, onAction, onBackAct, renderArticleCard }) {
  const blog = mountPatternRegions(fixedParts, { document }, publish => mountBlogScene(theme, {
    document, state, announce,
    getArticles: () => getCollection(scene, 'articles'),
    renderArticleImage: article => renderRecordImage(document, scene, article),
    onOpenArticle: trigger => onAction('read', trigger),
    onCloseArticle: onBackAct,
    onOpenProduct: (id, trigger) => onAction('product', trigger, { collection: 'products', id }),
    renderParts({ masthead, categories, stories, footer, feature, reader }) {
      publish({
        'blog-masthead': masthead,
        'blog-categories': categories,
        'blog-stories': stories,
        'blog-footer': footer,
        'blog-feature': feature,
        'blog-reader': reader,
      });
    },
  }));
  for (const region of ['stories', 'feature', 'reader']) {
    const block = blog.blocks['blog-' + region];
    block.update = ({ props = {} }) => blog.configure(region, props);
  }
  return {
    ...blog,
    updateData: blog.refresh,
    mountBlock(block) {
      if (block.type !== 'blog-list') return undefined;
      const list = blog.mountList((card, article, controls) => renderArticleCard(block.id, card, article, controls));
      return { ...list, update: (settings, current) => list.update(settings, current.children?.[0]) };
    },
  };
}
