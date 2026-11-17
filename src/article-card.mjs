import { collections } from './content-schema.mjs';

const text = ['title', 'category', 'summary', 'body', 'date', 'reading', 'imageAlt'];
const componentFields = {
  heading: { text },
  text: { text },
  badge: { text },
  button: { text },
  card: { title: text, body: text },
  alert: { title: text, body: text },
  image: { imageId: ['imageId'], imageAlt: text },
};

export const isArticleList = block => block?.type === 'blog-list';
export const hasArticleCard = block => isArticleList(block) && Array.isArray(block.children);
export const bindingFields = type => Object.hasOwn(componentFields, type) ? componentFields[type] : {};

export function articleFieldLabel(key) {
  return key === 'imageId' ? 'Billede' : collections.articles.fields[key].label;
}

export function newArticleCard(id, settings = {}) {
  const piece = (key, name, type, props, bindings) => ({ id: id + '-' + key, name, type, props, ...(bindings && { bindings }) });
  return {
    id, name: 'Kortlayout', type: 'container', width: 100,
    layout: { flow: 'stack', gap: 8, columns: 1, align: 'stretch' },
    children: [
      ...(settings.showImage === false ? [] : [piece('image', 'Artikelbillede', 'image', {}, { imageId: 'imageId' })]),
      piece('title', 'Artiklens titel', 'heading', { variant: 'panel' }, { text: 'title' }),
      ...(settings.showSummary === false ? [] : [piece('summary', 'Manchet', 'text', {}, { text: 'summary' })]),
      ...(settings.showLink === false ? [] : [piece('read', 'Læs artikel', 'button', {})]),
    ],
  };
}
