import { defineScenePattern } from './pattern-definition.mjs';

function textRegion(name, text = {}) {
  const entries = Object.entries(text);
  return {
    name,
    fields: Object.fromEntries(entries.map(([key, { label, defaultValue, maxLength }]) => [key, {
      label, defaultValue, maxLength, type: 'text',
    }])),
    parts: Object.fromEntries(entries.map(([key, { label }]) => [key, { label, textKey: key }])),
    textSelectors: Object.fromEntries(entries.map(([key, { selector }]) => [key, selector])),
  };
}

const checked = label => ({ label, type: 'checkbox', defaultValue: true });
const position = (label, defaultValue) => ({ label, type: 'number', min: 1, max: 100, step: 1, defaultValue });
const articleSource = {
  label: 'Artikler fra', type: 'enum', defaultValue: 'matching',
  options: { matching: 'Det valgte emne', all: 'Alle emner' },
};
const articleAppearance = {
  showImage: checked('Vis billede'),
  showSummary: checked('Vis manchet'),
  showLink: checked('Vis læseknap'),
};
const openArticle = { read: { label: 'Åbn artikel', defaultBlockType: 'blog-reader' } };
const openProduct = { product: { label: 'Åbn tilknyttet vare', recordCollection: 'products' } };

export const blogPattern = defineScenePattern({
  id: 'blog',
  name: 'Blog',
  description: 'Et redaktionelt magasin med emner og artikellæser.',
  parts: {
    'blog-masthead': textRegion('Magasinhoved', {
      title: { selector: '.case-blog__wordmark', label: 'Navn', defaultValue: 'Mellemrum', maxLength: 80 },
      edition: { selector: '.case-blog__edition', label: 'Udgave', defaultValue: 'Et magasin om form og hverdag · Nr. 04', maxLength: 140 },
    }),
    'blog-categories': { ...textRegion('Artikelemner'), collection: 'articles' },
    'blog-feature': {
      name: 'Fremhævet artikel',
      collection: 'articles',
      fields: {
        label: { label: 'Mærkat', type: 'text', defaultValue: 'Ugens historie', maxLength: 80 },
        startAt: position('Artikelnummer', 1),
        source: articleSource,
        ...articleAppearance,
      },
      parts: {},
      actions: openArticle,
    },
    'blog-list': {
      name: 'Artikelliste',
      collection: 'articles',
      description: 'Vis et udsnit af artikelsamlingen som kort eller liste.',
      repeatable: true,
      fields: {
        title: { label: 'Overskrift', type: 'text', defaultValue: 'Flere historier', maxLength: 80 },
        showHeading: checked('Vis overskrift'),
        startAt: position('Start ved artikel', 1),
        count: position('Antal artikler', 3),
        source: articleSource,
        layout: { label: 'Visning', type: 'enum', defaultValue: 'grid', options: { grid: 'Kort', list: 'Liste' } },
        ...articleAppearance,
      },
      parts: {},
      actions: openArticle,
    },
    'blog-reader': {
      name: 'Artikellæser', collection: 'articles', fields: {
        showImage: checked('Vis billede'), showSummary: checked('Vis manchet'), showDate: checked('Vis dato'),
      }, parts: {},
      actions: openProduct,
    },
    'blog-stories': {
      name: 'Historier og læser', library: false, collection: 'articles',
      fields: { count: position('Antal artikler', 4) }, parts: {}, actions: openProduct,
    },
    'blog-footer': textRegion('Sidefod', {
      title: { selector: 'span:first-child', label: 'Navn', defaultValue: 'Mellemrum', maxLength: 80 },
      description: { selector: 'span:nth-child(2)', label: 'Beskrivelse', defaultValue: 'Nye perspektiver på det, vi omgiver os med.', maxLength: 180 },
    }),
  },
});

export const shopPattern = defineScenePattern({
  id: 'shop',
  name: 'Webshop',
  description: 'En designbutik med produktvalg og kurv.',
  parts: {
    'shop-header': {
      ...textRegion('Butikshoved', {
        title: { selector: '.case-shop__wordmark', label: 'Butiksnavn', defaultValue: 'FORM / BUTIK', maxLength: 100 },
        description: { selector: '.case-shop__byline', label: 'Manchet', defaultValue: 'Gode ting til den nære hverdag.', maxLength: 280 },
      }),
      actions: { cart: { label: 'Kurvknap', defaultBlockType: 'shop-cart' } },
    },
    'shop-cart': textRegion('Kurv'),
    'shop-feature': { ...textRegion('Produktdetaljer'), collection: 'products', acceptsCollection: 'products' },
    'shop-collection': { ...textRegion('Produktkatalog', {
      title: { selector: '.ds-heading', label: 'Katalogets overskrift', defaultValue: 'Ting med omtanke', maxLength: 100 },
    }), collection: 'products' },
    'shop-footer': textRegion('Sidefod', {
      title: { selector: 'span:first-child', label: 'Afsender', defaultValue: 'FORM / BUTIK', maxLength: 100 },
      description: { selector: 'span:nth-child(2)', label: 'Sidefodstekst', defaultValue: 'Demobutik · produkter og priser er eksempler.', maxLength: 280 },
    }),
  },
});

export const editorPattern = defineScenePattern({
  id: 'editor',
  name: 'Editor',
  description: 'Et arbejdsrum til objektvalg og redigering af egenskaber.',
  parts: {
    'editor-intro': textRegion('Introduktion', {
      title: { selector: '.ds-heading', label: 'Overskrift', defaultValue: 'Rum til nye perspektiver', maxLength: 100 },
    }),
    'editor-workbench': textRegion('Objekteditor'),
  },
});
