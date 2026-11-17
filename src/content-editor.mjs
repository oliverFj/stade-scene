import { collections, recordLimit, validateRecord } from './content-schema.mjs';
import { mountMediaImage } from './media-image.mjs';
import { findMedia } from './scene-media.mjs';

export function mountContentEditor(dialog, { component, getScene, getCollection, canEdit, projectMedia, onChange }) {
  const document = dialog.ownerDocument;
  const find = id => dialog.querySelector('#content-' + id);
  const select = find('select');
  const form = find('form');
  const error = find('error');
  const feedback = find('feedback');
  const image = mountMediaImage(document);
  const draftsByType = new Map(), selections = new Map();
  let fields, type, definition, drafts, project, opener, selected, picture, dirty;

  function button(host, text, variant, action, options = {}) {
    const control = component('button', { text, variant, ...options, attrs: { ...options.attrs, type: 'button' } });
    control.addEventListener('click', action);
    host.append(control);
    return control;
  }

  const add = button(find('actions'), 'Ny post', 'secondary', () => openRecord('', true));
  form.addEventListener('input', () => { dirty = true; error.textContent = ''; });
  form.addEventListener('change', () => { dirty = true; });
  find('image-preview').append(image.element);
  const choose = button(find('image-actions'), 'Vælg fra Medier', 'secondary', event => {
    const record = selected, collection = type;
    projectMedia.show(event.currentTarget, {
      label: 'Vælg billede', selectedId: picture.imageId,
      choose(imageId) {
        if (project !== getScene() || selected !== record || type !== collection) return;
        picture = { imageId };
        dirty = true;
        renderPicture();
      },
    });
  }, { attrs: { 'aria-haspopup': 'dialog' } });
  const removeImage = button(find('image-actions'), 'Fjern billede', 'ghost', () => {
    picture = {};
    dirty = true;
    renderPicture();
    choose.focus();
  });
  const remove = button(find('form-actions'), 'Fjern post', 'ghost', () => {
    const records = getCollection(project, type).filter(record => record.id !== selected);
    drafts.delete(selected);
    dirty = false;
    onChange(type, records, definition.singular + ' fjernet');
    openRecord(records[0]?.id ?? '');
    feedback.textContent = definition.singular + ' fjernet.';
    select.focus();
  }, { intent: 'danger' });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const record = read();
    record.id = selected || definition.prefix + '-' + crypto.randomUUID();
    const problem = validateRecord(type, record);
    if (problem) { error.textContent = problem; fields.title.focus(); return; }
    const current = getCollection(project, type);
    if (!selected && current.length >= recordLimit) {
      error.textContent = 'Samlingen kan højst indeholde ' + recordLimit + ' poster.';
      return;
    }
    const records = selected ? current.map(item => item.id === selected ? record : item) : [record, ...current];
    drafts.delete(selected);
    dirty = false;
    onChange(type, records, definition.singular + (selected ? ' redigeret' : ' oprettet'));
    openRecord(record.id);
    feedback.textContent = definition.singular + ' gemt i scenen.';
  });

  function renderFields() {
    fields = {};
    find('fields').replaceChildren(...Object.entries(definition.fields).map(([key, field]) => {
      const label = document.createElement('label');
      label.className = 'scene-property';
      label.textContent = field.label;
      const control = document.createElement(field.reference ? 'select' : field.multiline ? 'textarea' : 'input');
      control.id = 'content-' + key;
      label.htmlFor = control.id;
      control.required = Boolean(field.required);
      if (field.type === 'number') Object.assign(control, { type: 'number', min: field.min, max: field.max, step: field.step });
      if (field.maxLength) control.maxLength = field.maxLength;
      if (field.multiline) control.rows = field.rows ?? 2;
      if (field.reference) {
        control.append(new Option('Ingen', ''), ...getCollection(project, field.reference).map(record => new Option(record.title, record.id)));
        label.hidden = !canEdit(field.reference);
      }
      label.append(control);
      fields[key] = control;
      return label;
    }));
  }

  function read() {
    const record = { ...picture };
    for (const [key, control] of Object.entries(fields)) {
      const field = definition.fields[key];
      const value = field.type === 'number' ? control.valueAsNumber : control.value.trim();
      if (value !== '' || field.required) record[key] = value;
    }
    return record;
  }

  function stash() {
    if (dirty) drafts.set(selected, read());
  }

  function renderPicture() {
    const media = findMedia(project, picture.imageId);
    find('image-name').textContent = media?.name ?? (picture.art ? 'Illustration fra demoen' : '');
    find('image-preview').hidden = Boolean(picture.art && !media);
    image.update(media, fields.imageAlt.value);
    removeImage.hidden = !picture.art && !media;
  }

  function openRecord(id, focusTitle = false) {
    stash();
    const records = getCollection(project, type);
    if (id && !records.some(record => record.id === id)) id = records[0]?.id ?? '';
    selected = id;
    selections.set(type, selected);
    select.replaceChildren(new Option(definition.create, ''), ...records.map(record => new Option(record.title, record.id)));
    select.value = id;
    const record = drafts.get(id) ?? records.find(item => item.id === id) ?? {};
    for (const [key, control] of Object.entries(fields)) control.value = record[key] ?? '';
    picture = record.imageId ? { imageId: record.imageId } : record.art ? { art: record.art } : {};
    dirty = false;
    error.textContent = '';
    feedback.textContent = '';
    remove.hidden = !id;
    add.disabled = records.length >= recordLimit;
    renderPicture();
    if (focusTitle) fields.title.focus();
  }

  select.addEventListener('change', () => openRecord(select.value));
  dialog.addEventListener('close', () => { stash(); dirty = false; opener?.focus({ preventScroll: true }); });
  return (key, trigger) => {
    if (project !== getScene()) {
      draftsByType.clear();
      selections.clear();
      project = getScene();
    }
    opener = trigger;
    type = key;
    definition = collections[key];
    if (!draftsByType.has(key)) draftsByType.set(key, new Map());
    drafts = draftsByType.get(key);
    dirty = false;
    find('title-label').textContent = definition.title;
    find('select-label').textContent = definition.singular;
    find('save').textContent = 'Gem ' + definition.singular.toLowerCase();
    add.textContent = definition.create;
    remove.textContent = 'Fjern ' + definition.singular.toLowerCase();
    renderFields();
    openRecord(selections.get(key) ?? getCollection(project, key)[0]?.id ?? '');
    dialog.showModal();
    select.focus();
  };
}
