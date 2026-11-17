export const recordLimit = 100;
export const collections = {
  articles: {
    module: 'blog', title: 'Artikler', singular: 'Artikel', create: 'Ny artikel', prefix: 'artikel',
    fields: {
      title: { label: 'Titel', maxLength: 160, required: true },
      category: { label: 'Emne', maxLength: 60 },
      summary: { label: 'Manchet', maxLength: 600, multiline: true },
      body: { label: 'Artikeltekst', maxLength: 16000, multiline: true, rows: 7 },
      date: { label: 'Dato', maxLength: 60 },
      reading: { label: 'Læsetid', maxLength: 40 },
      productId: { label: 'Tilknyttet vare', reference: 'products' },
      imageAlt: { label: 'Alternativ tekst til billedet', maxLength: 180 },
    },
  },
  products: {
    module: 'shop', title: 'Varer', singular: 'Vare', create: 'Ny vare', prefix: 'vare',
    fields: {
      title: { label: 'Varenavn', maxLength: 160, required: true },
      price: { label: 'Pris (kr.)', type: 'number', min: 0, max: 1000000, step: 0.01, required: true },
      category: { label: 'Kategori', maxLength: 60 },
      description: { label: 'Beskrivelse', maxLength: 2000, multiline: true, rows: 4 },
      material: { label: 'Materiale eller specifikation', maxLength: 180 },
      imageAlt: { label: 'Alternativ tekst til billedet', maxLength: 180 },
    },
  },
};

const idPattern = /^[a-z][a-z0-9-]{0,79}$/;
const exampleArt = new Set(['room', 'paper', 'lamp', 'vase', 'print']);
const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);
const validId = value => typeof value === 'string' && idPattern.test(value);

export function validateRecord(key, record) {
  const { fields, singular } = collections[key];
  if (!isRecord(record) || !validId(record.id)) return singular + ' mangler et gyldigt id.';
  for (const [id, field] of Object.entries(fields)) {
    const value = record[id];
    if (value === undefined && !field.required) continue;
    let valid;
    if (field.reference) valid = validId(value);
    else if (field.type === 'number') {
      valid = Number.isFinite(value) && value >= field.min && value <= field.max
        && Math.abs(value / field.step - Math.round(value / field.step)) < 1e-6;
    } else valid = typeof value === 'string' && value.length <= field.maxLength && (!field.required || Boolean(value.trim()));
    if (!valid) return field.label + ' har en ugyldig værdi.';
  }
  if ((record.imageId !== undefined && !validId(record.imageId)) || (record.art !== undefined && !exampleArt.has(record.art))) {
    return 'Billedet er ugyldigt.';
  }
  if (Object.keys(record).some(id => !Object.hasOwn(fields, id) && !['id', 'imageId', 'art'].includes(id))) {
    return 'Indholdet indeholder et ukendt felt.';
  }
  return '';
}

export function validateCollections(scene, getCollection) {
  if (scene.collections === undefined) return '';
  if (!isRecord(scene.collections) || Object.keys(scene.collections).some(key => !Object.hasOwn(collections, key))) {
    return 'Scenen indeholder en ukendt indholdssamling.';
  }
  for (const [key, records] of Object.entries(scene.collections)) {
    if (!Array.isArray(records) || records.length > recordLimit) return collections[key].title + ' må højst indeholde ' + recordLimit + ' poster.';
    const ids = new Set();
    for (const record of records) {
      const error = validateRecord(key, record);
      if (error) return error;
      if (ids.has(record.id)) return 'Flere poster har samme id.';
      ids.add(record.id);
    }
  }
  for (const [key, { fields }] of Object.entries(collections)) {
    const refs = Object.entries(fields).filter(([, field]) => field.reference);
    for (const [field, { reference, label }] of refs) {
      const targetIds = new Set(getCollection(scene, reference).map(record => record.id));
      if (getCollection(scene, key).some(record => record[field] && !targetIds.has(record[field]))) return label + ' mangler i ' + collections[reference].title + '.';
    }
  }
  return '';
}
