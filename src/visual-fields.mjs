import { COMPONENT_LIBRARY } from '../design/runtime/library.mjs';
import { isSceneFieldValue, validateSceneValues } from '../design/runtime/scene-fields.mjs';
import { COMPOSITIONS } from '@stade/pattern-catalog';
import { scenePatternBlocks } from './scene-patterns.mjs';

const shortText = (label, defaultValue) => ({ label, type: 'text', maxLength: 48, defaultValue });
const imageField = { label: 'Billede', type: 'text', maxLength: 80, defaultValue: '' };
const navigation = {
  'act-trigger': {
    name: 'Åbn akt',
    description: 'Knap der åbner en akt eller går til en bestemt blok.',
    scene: {
      parts: { label: { label: 'Knappens tekst', textKey: 'label' } },
      fields: {
        label: shortText('Knappens tekst', 'Åbn akt'),
        targetAct: { label: 'Åbn akt', type: 'text', maxLength: 80, defaultValue: '' },
      },
    },
  },
};

const appearance = {
  'theme-picker': {
    name: COMPOSITIONS['theme-picker'].name,
    description: COMPOSITIONS['theme-picker'].description,
    scene: { fields: {}, parts: {} },
  },
};

const media = {
  image: {
    ...COMPONENT_LIBRARY.image,
    scene: { fields: { imageId: imageField, imageAlt: { label: 'Alternativ tekst', type: 'text', maxLength: 180, defaultValue: '' } } },
  },
};

const button = {
  ...COMPONENT_LIBRARY.button,
  scene: {
    fields: {
      text: { ...shortText('Knappens tekst', 'Læs artikel'), maxLength: 100, slot: 'heading' },
      variant: {
        label: 'Variant', type: 'enum', defaultValue: 'ghost',
        options: { primary: 'Primær', secondary: 'Sekundær', tertiary: 'Tertiær', ghost: 'Diskret' },
      },
    },
    parts: { heading: { label: 'Knappens tekst', textKey: 'text' } },
  },
};

const components = Object.fromEntries(Object.entries(COMPONENT_LIBRARY).map(([type, definition]) => {
  if (definition.scene) return [type, definition];
  const options = Object.fromEntries(Object.keys(definition.variants).map(variant => [variant, variant]));
  const fields = Object.keys(options).length ? {
    variant: { label: 'Variant', type: 'enum', defaultValue: Object.keys(options)[0], options },
  } : {};
  return [type, { ...definition, scene: { fields, parts: {} } }];
}));

export const libraryEntries = [['component', { ...components, button, ...media }], ['pattern', COMPOSITIONS], ['navigation', navigation], ['appearance', appearance]]
  .flatMap(([kind, catalog]) => Object.entries(catalog)
    .filter(([, definition]) => kind === 'component' || definition.scene)
    .map(([type, definition]) => ({ kind, type, definition })));

const insertable = libraryEntries.filter(({ definition }) => definition.scene);
export const sharedSceneBlocks = Object.fromEntries(insertable.map(({ type, definition }) => [type, definition]));
export const sceneBlockKinds = Object.fromEntries(insertable.map(({ type, kind }) => [type, type === 'image' ? 'media' : kind]));

const controlFields = {
  'practice-brand': { title: shortText('Navn', 'øverum') },
  'practice-instrument': {
    label: shortText('Feltets navn', 'Vælg instrument'),
    guitarLabel: shortText('Guitar', 'Guitar'),
    violinLabel: shortText('Violin', 'Violin'),
  },
  'practice-audio-instrument': {
    label: shortText('Feltets navn', 'Instrument'),
    guitarLabel: shortText('Guitar', 'Guitar'),
    violinLabel: shortText('Violin', 'Violin'),
  },
  'practice-modes': {
    label: shortText('Gruppens navn', 'Arbejdsområde'),
    practiceLabel: shortText('Øv', 'Øv melodi og skala'),
    listenLabel: shortText('Lyt', 'Lyt til øvelsen'),
    exploreLabel: shortText('Udforsk', 'Udforsk noderne'),
  },
  'practice-tools': { noteLabels: shortText('Tonenavne', 'Tonenavne') },
  'practice-kind': {
    label: shortText('Gruppens navn', 'Vælg øvelsestype'),
    songsLabel: shortText('Sange', 'Sange'),
    scalesLabel: shortText('Skalaer', 'Skalaer'),
  },
  'practice-picker': {
    label: shortText('Sangvælgerens tekst', 'Vælg melodi'),
    scaleLabel: shortText('Skalavælgerens tekst', 'Vælg skala'),
  },
  'practice-tempo': { label: shortText('Tempofeltets tekst', 'Tempo') },
  'practice-transport': {
    playLabel: shortText('Tekst ved afspilningsstart', 'Afspil'),
    pauseLabel: shortText('Tekst under afspilning', 'Pause'),
  },
  'practice-speed': { label: shortText('Skyderens tekst', 'Tempo') },
  'practice-metronome': { label: shortText('Knappens tekst', 'Metronom') },
  'practice-status': {
    title: shortText('Overskrift', 'Øvelsesstatus'),
    progressLabel: shortText('Fremdriftens tekst', 'Fremdrift'),
  },
};

export const visualParts = {
  ...Object.fromEntries(Object.entries(scenePatternBlocks).map(([type, { parts }]) => [type, parts])),
  'overview-intro': {
    brand: { label: 'Logo', sizeKey: 'brandSize' },
    title: { label: 'Overskrift', textKey: 'title' },
    description: { label: 'Forklaringstekst', textKey: 'description', visibleKey: 'showDescription' },
  },
  'practice-intro': {
    title: { label: 'Overskrift', textKey: 'title' },
    description: { label: 'Hjælpetekst', textKey: 'description' },
  },
  'practice-score': {
    title: { label: 'Overskrift', textKey: 'title' },
  },
  'practice-fretboard': {
    title: { label: 'Overskrift', textKey: 'title' },
  },
  ...Object.fromEntries(Object.entries(controlFields).map(([type, fields]) => [type,
    Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, { label: field.label, textKey: key }])),
  ])),
  ...Object.fromEntries(Object.entries(sharedSceneBlocks).map(([id, definition]) => [id, definition.scene.parts])),
};

const practiceFields = {
  ...controlFields,
  'practice-intro': {
    title: { label: 'Overskrift', type: 'text', maxLength: 100, defaultValue: 'Øverum' },
    description: {
      label: 'Hjælpetekst', type: 'text', maxLength: 280,
      defaultValue: 'Vælg en øvelse, og følg de fremhævede noder.',
    },
  },
  'practice-score': {
    title: { label: 'Overskrift', type: 'text', maxLength: 80, defaultValue: 'Noder' },
  },
  'practice-fretboard': {
    title: { label: 'Overskrift', type: 'text', maxLength: 80, defaultValue: 'Gribebræt' },
    showNoteNames: { label: 'Vis tonenavne på brættet', type: 'checkbox', defaultValue: true },
    showAlternates: { label: 'Vis alternative placeringer', type: 'checkbox', defaultValue: true },
  },
};

export const visualFields = {
  ...practiceFields,
  ...Object.fromEntries(Object.entries(scenePatternBlocks).map(([type, { fields }]) => [type, fields])),
  'overview-intro': {
    logoMode: { label: 'Logo', type: 'enum', defaultValue: 'app', options: { app: 'Brug appens logo', image: 'Vælg billede', hidden: 'Skjul logo' } },
    imageId: imageField,
    brandSize: { label: 'Logostørrelse', type: 'number', min: 80, max: 160, step: 5, defaultValue: 100, hint: 'Procent af logoets standardstørrelse.' },
    title: { label: 'Overskrift', type: 'text', maxLength: 100, defaultValue: 'Plads til det næste.' },
    description: {
      label: 'Forklaringstekst', type: 'text', maxLength: 280,
      defaultValue: 'Et fælles overblik over projekter, fremskridt og næste skridt.',
    },
    showDescription: { label: 'Vis forklaringstekst', type: 'checkbox', defaultValue: true },
  },
  ...Object.fromEntries(Object.entries(sharedSceneBlocks).map(([id, definition]) => [id, definition.scene.fields])),
};

function fieldFor(block, key) {
  const fields = visualFields[block.type];
  return fields && Object.hasOwn(fields, key) ? fields[key] : undefined;
}

export function readVisualValue(block, key) {
  const field = fieldFor(block, key);
  if (!field) return undefined;
  return Object.hasOwn(block.props ?? {}, key) ? block.props[key] : field.defaultValue;
}

export function writeVisualValue(block, key, value) {
  const field = fieldFor(block, key);
  const normalized = typeof value === 'string' ? value.trim() : value;
  if (!field) return false;
  if (normalized === field.defaultValue) {
    if (!Object.hasOwn(block.props ?? {}, key)) return false;
    delete block.props[key];
    if (!Object.keys(block.props).length) delete block.props;
    return true;
  }
  if (!isSceneFieldValue(field, normalized)) return false;
  if (normalized === readVisualValue(block, key)) return false;
  (block.props ??= {})[key] = normalized;
  return true;
}

export function validateVisualProps(block) {
  if (Object.hasOwn(scenePatternBlocks, block.type)) return validateSceneValues(scenePatternBlocks[block.type], block.props);
  if (Object.hasOwn(sharedSceneBlocks, block.type)) return validateSceneValues(sharedSceneBlocks[block.type].scene, block.props);
  if (Object.hasOwn(practiceFields, block.type)) return validateSceneValues({ fields: practiceFields[block.type] }, block.props);
  const fields = visualFields[block.type];
  if (!fields || block.props === undefined) return '';
  if (!block.props || typeof block.props !== 'object' || Array.isArray(block.props)) {
    return 'Ugyldige visuelle egenskaber i ' + block.id + '.';
  }
  for (const [key, field] of Object.entries(fields)) {
    if (Object.hasOwn(block.props, key) && !isSceneFieldValue(field, block.props[key])) {
      return field.label + ' har en ugyldig værdi i ' + block.id + '.';
    }
  }
  return '';
}
