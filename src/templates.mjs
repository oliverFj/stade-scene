import overview from '../scenes/overblik.scene.json' with { type: 'json' };
import practice from '../scenes/oeverum.scene.json' with { type: 'json' };
import blog from '../scenes/blog.scene.json' with { type: 'json' };
import shop from '../scenes/webshop.scene.json' with { type: 'json' };
import editor from '../scenes/editor.scene.json' with { type: 'json' };
import blank from '../scenes/blank.scene.json' with { type: 'json' };
import magazineShop from '../scenes/magazine-shop.scene.json' with { type: 'json' };
import { sceneFilename } from './native-apps.mjs';
import { scenePatterns } from './scene-patterns.mjs';

const example = (id, appId, scene, initialBlock) => {
  const { name, description } = scenePatterns[id];
  return { name, description, filename: sceneFilename(appId), initialBlock, data: scene.data, parts: {} };
};

export const templates = {
  blank: {
    name: 'Tom app',
    description: 'Byg din egen app med mønstre, komponenter og akter.',
    filename: 'app.scene.json',
    data: blank.data,
    parts: {},
  },
  overview: {
    name: 'Overblik',
    description: 'Et projektarbejdsrum med nøgletal, liste og detaljer.',
    filename: sceneFilename('overblik'),
    initialBlock: 'workspace',
    data: overview.data,
    parts: {
      'overview-intro': 'Introduktion',
      'overview-metrics': 'Nøgletal',
      'overview-list': 'Søgning og tabel',
      'overview-detail': 'Projektdetaljer',
      'phase-breakdown': 'Fasefordeling',
    },
  },
  blog: example('blog', 'blog', blog, 'blog-list'),
  shop: example('shop', 'webshop', shop, 'shop-product'),
  'magazine-shop': {
    name: 'Magasinbutik', description: 'En artikel åbner en vare, som også findes i kataloget og kan lægges i kurven.',
    filename: 'magasinbutik.scene.json', initialBlock: 'magazine-story', data: magazineShop.data, parts: {},
  },
  editor: example('editor', 'editor', editor, 'editor-workbench'),
  practice: {
    name: 'Øverum',
    description: 'Et musikrum med gribebræt, noder og en akt til lydværktøjer.',
    filename: sceneFilename('oeverum'),
    initialActName: 'Øvelse',
    initialBlock: 'practice-controls',
    data: practice.data,
    parts: {
      'practice-intro': 'Introduktion',
      'practice-brand': 'Øverums navn',
      'practice-instrument': 'Instrumentvalg',
      'practice-modes': 'Arbejdsområde',
      'practice-tools': 'Nodeværktøjer',
      'practice-audio-instrument': 'Instrumentvalg i lydværktøjer',
      'practice-kind': 'Sange og skalaer',
      'practice-picker': 'Øvelsesvælger',
      'practice-tempo': 'Tempovalg',
      'practice-transport': 'Afspilning',
      'practice-speed': 'Tempo',
      'practice-metronome': 'Metronom',
      'practice-status': 'Øvelsesstatus',
      'practice-fretboard': 'Gribebræt',
      'practice-score': 'Noder',
    },
  },
};

export const newScene = id => structuredClone(templates[id].data);
