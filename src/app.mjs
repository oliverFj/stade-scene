import { createComponentFactory, createIcon, mountRangeField } from '../design/runtime/components.mjs';
import { renderStadeMark } from '../design/runtime/stade-mark.mjs';
import { mountBlockLibrary } from './block-library.mjs';
import { createActNavigation } from './act-navigation.mjs';
import { decodeSceneDocument, openSceneFile, sceneFile } from './scene-file.mjs';
import { exportNativeApp, openNativeAppFile, saveNativeApp, supportsAppPatterns, supportsSceneActions, supportsArticleCollections, supportsProductCollections, supportsArticleCards } from './native-package.mjs';
import { actionDefinitions, recordTarget, resolveAction } from './scene-actions.mjs';
import { actModes, newAct, normalizeSceneActs, validateSceneActs } from './scene-acts.mjs';
import { alignment, basisRange, canMoveTo, customBlocks, entriesOf, flows, inRange, isContainer, labelFor, moveBlock, newContainer, sizingModes, widthRange } from './scene-model.mjs';
import { scenePatternBlocks, scenePatterns } from './scene-patterns.mjs';
import { createOutline } from './outline.mjs';
import { mountSceneView } from './scene-view.mjs';
import { applySceneTheme, defaultSceneTheme, mountSceneTheme } from './scene-theme.mjs';
import { newScene, templates } from './templates.mjs';
import { createHistory, createHistoryState } from '@stade/history';
import { mountQuickEdit } from './quick-edit.mjs';
import { readVisualValue, sharedSceneBlocks, visualFields, visualParts, writeVisualValue } from './visual-fields.mjs';
import { mountMediaImage } from './media-image.mjs';
import { mountProjectMedia } from './project-media.mjs';
import { findMedia } from './scene-media.mjs';
import { mountContentEditor } from './content-editor.mjs';
import { collections } from './content-schema.mjs';
import { getCollection, usesModule } from './content-data.mjs';
import { mountCommandMenus } from './command-menus.mjs';
import { articleFieldLabel, bindingFields, hasArticleCard, isArticleList, newArticleCard } from './article-card.mjs';

const component = createComponentFactory(defaultSceneTheme(), { document });
const id = value => document.getElementById(value);
const frame = id('app-view');
const selection = id('selection-frame');
const resizeHandle = id('resize-selection');
const properties = id('properties');
const dialog = id('replace-scene');
const templatePicker = id('template-picker');
const exportDialog = id('export-app');
const exportName = id('export-app-name');
const exportError = id('export-app-error');
const fileStatus = id('file-status');

const requestedTemplate = new URLSearchParams(location.search).get('scene');
let scene = newScene(Object.hasOwn(templates, requestedTemplate) ? requestedTemplate : 'overview');
let baseline = '';
let selectedId;
let selectedPart;
let view;
let widthControls;
let history;
let editing = true;
let fileBusy = false;
let resize;
let selectionFrame = 0;
let editActId = scene.acts[0].id;
let navigation;
let nativeApp;
const actSelections = new Map();

const getAct = actId => scene.acts.find(act => act.id === actId);
const currentAct = () => getAct(editActId);
const currentLayout = () => currentAct().layout;
const selected = () => entriesOf(currentLayout()).find(entry => entry.block.id === selectedId);
const announce = message => { id('scene-status').textContent = message; };
const outline = createOutline(id('outline'), { select: selectBlock, move });
const quick = mountQuickEdit(id('quick-edit'), { onChange: setVisualValue, onReflow: queueSelection });
const showLibrary = mountBlockLibrary(id('block-library'), insertLibraryBlock);
const projectMedia = mountProjectMedia(id('project-media'), {
  component, getScene: () => scene, status,
  onImport() { changed(); announce('Billedet er klar i Medier.'); },
});
const showContent = mountContentEditor(id('content-editor'), {
  component, getScene: () => scene, getCollection, canEdit: canEditCollection, projectMedia,
  onChange(key, records, label) {
    scene.collections = { ...scene.collections, [key]: records };
    if (key === 'products' && scene.collections.articles) {
      const ids = new Set(records.map(record => record.id));
      scene.collections.articles = scene.collections.articles.map(article => {
        if (!article.productId || ids.has(article.productId)) return article;
        const { productId, ...rest } = article;
        return rest;
      });
    }
    view.updateData();
    changeLayout(label);
  },
});
const fieldControls = new Map();

function button(host, options, action) {
  const control = component('button', options);
  control.addEventListener('click', action);
  host.append(control);
  return control;
}

function showTemplates() {
  quick.finishText();
  if (fileBusy || !view) return;
  templatePicker.showModal();
  templatePicker.querySelector('[data-template="blank"]').focus();
}

function openContent(key, trigger) {
  if (fileBusy || !view) return;
  quick.finishText();
  showContent(key, trigger);
}

function showBlocks() {
  if (!view || !editing || !selected()) return;
  quick.finishText();
  const { block } = selected();
  const target = hasArticleCard(block) ? block.children[0] : block;
  showLibrary((isContainer(target) ? 'Indsættes i ' : 'Indsættes efter ') + labelFor(target));
}

const command = mountCommandMenus(id('file-actions'), component, [
  ['file', 'Fil', [
    ['new-scene', 'Ny app', showTemplates],
    ['open-scene', 'Åbn scene', open],
    ['open-native-app', 'Åbn app', openApp],
    ['save-scene', 'Gem scene', save],
    ['save-native-app', 'Gem app', saveApp],
    ['export-native-app', 'Eksportér app', showAppExport],
  ]],
  ['edit', 'Redigér', [
    ['menu-undo', 'Fortryd', () => useHistory('undo')],
    ['menu-redo', 'Gentag', () => useHistory('redo')],
    ['menu-insert', 'Indsæt blok', showBlocks],
    ['menu-container', 'Tilføj container', addContainer],
  ]],
  ['content', 'Indhold', [
    ...Object.entries(collections).map(([key, definition]) => ['open-' + key, definition.title, trigger => openContent(key, trigger)]),
    ['open-media', 'Medier', trigger => {
      if (fileBusy || !view) return;
      quick.finishText();
      projectMedia.show(trigger);
    }],
  ]],
  ['modules', 'Moduler', Object.values(scenePatterns).map(pattern => ['insert-' + pattern.id, 'Indsæt ' + pattern.name, () => {
    if (!view || !editing || !selected()) return;
    quick.finishText();
    const error = insertLibraryBlock(pattern.id, () => {}, pattern);
    if (error) status(error, true);
  }])],
]);
const saveAppButton = command('save-native-app');
const exportAppButton = command('export-native-app');
saveAppButton.hidden = true;
for (const [key, template] of Object.entries(templates)) {
  const option = document.createElement('button');
  option.type = 'button';
  option.className = 'scene-library-block';
  option.dataset.template = key;
  const name = document.createElement('strong');
  name.textContent = template.name;
  const description = document.createElement('span');
  description.textContent = template.description;
  option.append(name, description);
  option.addEventListener('click', async () => {
    templatePicker.close();
    if (await confirmReplace()) {
      setMode(true);
      load(newScene(key), key === 'blank' ? 'Ny app oprettet.' : 'Ny app fra ' + template.name + '.');
    }
  });
  id('template-options').append(option);
}
const addActButton = button(id('act-actions'), {
  text: 'Tilføj akt', iconName: 'plus', variant: 'tertiary', size: 'small', attrs: { id: 'new-act' },
}, addAct);
const libraryButton = button(id('add-block'), {
  text: 'Indsæt blok', iconName: 'plus', variant: 'secondary', size: 'small',
  attrs: { id: 'insert-block', 'aria-haspopup': 'dialog' },
}, showBlocks);
button(id('add-block'), { text: 'Tilføj container', variant: 'tertiary', size: 'small', attrs: { id: 'new-container' } }, addContainer);
id('scene-mark').innerHTML = renderStadeMark();
mountSceneTheme(id('editor-theme'), {
  key: 'stade-scene.editor-theme', label: 'Editorens tema', showMark: false,
  onChange(value) { applySceneTheme(id('stade-theme'), value); queueSelection(); },
});
const previewTheme = mountSceneTheme(id('preview-theme'), {
  key: 'stade-scene.preview-theme', label: 'Tema i appvisning', showMark: false,
  onChange(value) {
    const style = frame.contentDocument?.getElementById('stade-theme');
    if (style) applySceneTheme(style, value);
    view?.setTheme(value.theme);
    queueSelection();
  },
});

function status(message, error = false) {
  fileStatus.textContent = message;
  fileStatus.dataset.error = String(error);
}

const invalidRange = () => [...fieldControls.values()].find(item => item.range?.getState().valid === false);
const hasChanges = () => JSON.stringify(scene) !== baseline || quick.dirty || Boolean(invalidRange());
function changed() {
  updateMenus();
  status(hasChanges() ? 'Ugemte ændringer' : '');
}

function canEditCollection(key) {
  return Object.hasOwn(scene.collections ?? {}, key) || usesModule(scene, collections[key].module);
}

function updateMenus() {
  for (const key of Object.keys(collections)) command('open-' + key).hidden = !canEditCollection(key);
  for (const id of ['menu-insert', 'menu-container', ...Object.keys(scenePatterns).map(key => 'insert-' + key)]) {
    command(id).setAttribute('aria-disabled', String(!editing));
  }
}

async function confirmReplace() {
  if (!hasChanges()) return true;
  dialog.returnValue = 'cancel';
  dialog.showModal();
  return await new Promise(resolve => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'replace'), { once: true });
  });
}

async function open() {
  if (fileBusy || !view) return;
  quick.finishText();
  fileBusy = true;
  try {
    const result = await openSceneFile();
    if (result && await confirmReplace()) {
      load(result.scene, result.migrated ? 'Version 1 åbnet. Gem en kopi for at bruge blokformatet.' : 'Åbnet ' + result.name);
    }
  } catch (error) {
    status('Kunne ikke åbne scenen. ' + error.message, true);
  } finally {
    fileBusy = false;
    id('menu-file').focus({ preventScroll: true });
  }
}

async function openApp() {
  if (fileBusy || !view) return;
  quick.finishText();
  fileBusy = true;
  try {
    const opened = await openNativeAppFile({ decodeScene: decodeSceneDocument });
    if (opened && await confirmReplace()) {
      setMode(true);
      load(opened.scene, 'App åbnet.', opened);
    }
  } catch (error) {
    status('Kunne ikke åbne appen. ' + error.message, true);
  } finally {
    fileBusy = false;
    id('menu-file').focus({ preventScroll: true });
  }
}

function save() {
  if (fileBusy || !view) return;
  quick.finishText();
  const invalid = invalidRange();
  if (invalid) {
    status('Ret værdien, før du gemmer.', true);
    invalid.input.focus();
    return;
  }
  try {
    recordLayout('Redigér layout');
    sceneFile.save(templates[scene.template].filename, scene);
    if (!nativeApp) baseline = JSON.stringify(scene);
    status('Download startet. Kopien kan åbnes i Scene.');
  } catch (error) {
    status('Kunne ikke gemme kopien. ' + error.message, true);
  }
}

function showAppExport() {
  if (fileBusy || !view) return;
  quick.finishText();
  const invalid = invalidRange();
  if (invalid) {
    status('Ret værdien, før du eksporterer.', true);
    invalid.input.focus();
    return;
  }
  exportError.textContent = '';
  exportDialog.showModal();
  exportName.select();
}

id('export-app-form').addEventListener('submit', event => {
  if (event.submitter?.formMethod === 'dialog') return;
  event.preventDefault();
  exportError.textContent = '';
  try {
    recordLayout('Redigér app');
    exportNativeApp({
      name: exportName.value,
      scene,
      shell: id('native-app-shell').textContent,
      css: id('app-preview-style').content.querySelector('style').textContent,
      runtime: id('scene-runtime').textContent,
      document,
      decodeScene: decodeSceneDocument,
    });
    baseline = JSON.stringify(scene);
    exportDialog.close();
    status('Download startet. Åbn HTML-filen for at bruge appen.');
  } catch (error) {
    exportError.textContent = 'Kunne ikke eksportere appen. ' + error.message;
  }
});

async function saveApp() {
  if (fileBusy || !view || !nativeApp) return;
  quick.finishText();
  const invalid = invalidRange();
  if (invalid) {
    status('Ret værdien, før du gemmer.', true);
    invalid.input.focus();
    return;
  }
  fileBusy = true;
  saveAppButton.disabled = true;
  try {
    const savedScene = structuredClone(scene);
    recordLayout('Redigér app');
    const result = await saveNativeApp(nativeApp, savedScene, { document, decodeScene: decodeSceneDocument });
    if (result === 'written') {
      baseline = JSON.stringify(savedScene);
      status(hasChanges() ? 'Appfilen er gemt. Der er nyere, ugemte ændringer.' : 'Appfilen er gemt. Genindlæs appen i browseren.');
    } else {
      status('Download startet. Erstat appfilen med den hentede kopi, og genindlæs appen.');
    }
  } catch (error) {
    status('Kunne ikke gemme appen. ' + error.message, true);
  } finally {
    fileBusy = false;
    saveAppButton.disabled = false;
  }
}

function inputField(parent, name, label, input) {
  const wrapper = document.createElement('label');
  wrapper.className = 'scene-property';
  wrapper.textContent = label;
  input.id = name;
  wrapper.append(input);
  parent.append(wrapper);
  return input;
}

function choice(parent, name, label, options, current, update) {
  const select = document.createElement('select');
  for (const [value, title] of Object.entries(options)) select.add(new Option(title, value));
  select.value = current;
  inputField(parent, name, label, select).addEventListener('change', () => update(select.value));
  return select;
}

function textField(parent, name, label, value, limit, update, { allowEmpty = false } = {}) {
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = limit;
  input.defaultValue = value;
  inputField(parent, name, label, input).addEventListener('change', () => {
    input.value = input.value.trim() || (allowEmpty ? '' : input.defaultValue);
    input.defaultValue = input.value;
    update(input.value);
  });
  return input;
}

function updateHistoryControls() {
  id('undo-edit').disabled = !history?.canUndo;
  id('redo-edit').disabled = !history?.canRedo;
  id('undo-edit').title = history?.undoLabel || '';
  id('redo-edit').title = history?.redoLabel || '';
  command('menu-undo').setAttribute('aria-disabled', String(!editing || !history?.canUndo));
  command('menu-redo').setAttribute('aria-disabled', String(!editing || !history?.canRedo));
}

const historyValue = () => ({ acts: scene.acts, appLogo: scene.appLogo ?? null, collections: scene.collections ?? null });

function recordLayout(label) {
  history.commit(label, historyValue());
  updateHistoryControls();
}

function changeLayout(label) {
  view.updateLayout();
  if (label) recordLayout(label);
  changed();
  queueSelection();
}

function setVisualValue(block, key, value, { updateControl = true, record = true } = {}) {
  if (!writeVisualValue(block, key, value)) return;
  const field = visualFields[block.type][key];
  const control = fieldControls.get(key);
  if (updateControl && selectedId === block.id && control) {
    if (control.range) control.range.update({ value });
    else if (field.type === 'checkbox') control.input.checked = value;
    else {
      control.input.value = value;
      control.input.defaultValue = value;
    }
  }
  changeLayout(record ? field.label : undefined);
}

function renderImageField(block) {
  const container = document.createElement('div');
  container.className = 'scene-media-field';
  const label = document.createElement('strong');
  const value = document.createElement('p');
  value.className = 'scene-hint';
  const preview = mountMediaImage(document);
  const controls = document.createElement('div');
  controls.className = 'scene-inline-actions';
  const logoMode = () => readVisualValue(block, 'logoMode');
  const isAppLogo = () => logoMode() === 'app';
  const selectedImageId = () => isAppLogo() ? scene.appLogo : readVisualValue(block, 'imageId');
  const assignImage = () => {
    const project = scene;
    const appLogo = isAppLogo();
    return imageId => {
      if (scene !== project) return;
      if (appLogo) {
        if (imageId) scene.appLogo = imageId;
        else delete scene.appLogo;
        changeLayout('Skift appens logo');
      } else {
        const entry = scene.acts.flatMap(act => entriesOf(act.layout)).find(({ block: item }) => item.id === block.id);
        if (entry) setVisualValue(entry.block, 'imageId', imageId);
      }
      if (container.isConnected) refresh();
    };
  };
  const choose = button(controls, { text: 'Vælg fra Medier', variant: 'secondary', size: 'small', attrs: { 'aria-haspopup': 'dialog' } }, event => {
    projectMedia.show(event.currentTarget, {
      label: isAppLogo() ? 'Vælg appens logo' : 'Vælg et billede til blokken',
      selectedId: selectedImageId(), choose: assignImage(),
    });
  });
  button(controls, { text: 'Importér billede', variant: 'tertiary', size: 'small' }, () => projectMedia.importImage(assignImage()));
  const remove = button(controls, { text: 'Fjern billede', variant: 'ghost', size: 'small' }, () => {
    assignImage()('');
    choose.focus();
  });
  function refresh() {
    const image = findMedia(scene, selectedImageId());
    container.hidden = logoMode() === 'hidden';
    label.textContent = isAppLogo() ? 'Appens logo' : 'Billede';
    value.textContent = image?.name ?? '';
    value.hidden = !image;
    remove.hidden = !image;
    preview.update(image, '');
  }
  container.append(label, preview.element, value, controls);
  properties.append(container);
  refresh();
  return refresh;
}

function renderVisualFields(block) {
  const fields = visualFields[block.type] ?? {};
  let refreshImage;
  for (const [key, field] of Object.entries(fields)) {
    if (Object.hasOwn(block.bindings ?? {}, key)) continue;
    if (hasArticleCard(block) && ['showImage', 'showSummary', 'showLink'].includes(key)) continue;
    if (key === 'imageId') { refreshImage = renderImageField(block); continue; }
    if (block.type === 'act-trigger' && key === 'targetAct') continue;
    const value = readVisualValue(block, key);
    const update = next => {
      setVisualValue(block, key, next, { updateControl: false });
      if (key === 'logoMode') refreshImage?.();
    };
    if (field.type === 'number') {
      const { label, min, max, step, hint = '' } = field;
      const element = component('range-field', {
        idPrefix: 'visual-' + key, label, min, max, step, value, variant: 'with-input', hint,
      });
      properties.append(element);
      const range = mountRangeField(element, {
        onInput(next) {
          if (next.valid) setVisualValue(block, key, next.value, { updateControl: false, record: false });
          else changed();
        },
        onCommit: () => recordLayout(label),
      });
      fieldControls.set(key, { input: element.querySelector('input[type="number"]'), range });
    } else if (field.type === 'enum') {
      const input = choice(properties, 'visual-' + key, field.label, field.options, value, update);
      fieldControls.set(key, { input });
    } else if (field.type === 'checkbox') {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = value;
      inputField(properties, 'visual-' + key, field.label, input).parentElement.classList.add('scene-checkbox');
      input.addEventListener('change', () => update(input.checked));
      fieldControls.set(key, { input });
    } else {
      const input = textField(properties, 'visual-' + key, field.label, value, field.maxLength, update, { allowEmpty: field.defaultValue === '' });
      fieldControls.set(key, { input });
    }
  }
}

function renderArticleBindings(block) {
  const fields = Object.entries(bindingFields(block.type));
  if (!fields.length) return;
  const section = document.createElement('section');
  section.className = 'scene-actions';
  const title = document.createElement('h4');
  title.textContent = 'Databindinger';
  section.append(title);
  properties.append(section);
  for (const [field, options] of fields) {
    const names = Object.fromEntries([['', 'Fast værdi'], ...options.map(key => [key, articleFieldLabel(key)])]);
    const controlId = 'binding-' + field;
    choice(section, controlId, visualFields[block.type][field].label + ' fra artiklen', names, block.bindings?.[field] ?? '', key => {
      if (key) (block.bindings ??= {})[field] = key;
      else {
        delete block.bindings[field];
        if (!Object.keys(block.bindings).length) delete block.bindings;
      }
      changeLayout('Skift databinding');
      renderProperties();
      id(controlId).focus({ preventScroll: true });
    });
  }
}

function openArticleCard(block) {
  if (hasArticleCard(block)) { selectBlock(block.children[0].id, { focus: true }); return; }
  quick.finishText();
  const layout = structuredClone(currentLayout());
  const list = entriesOf(layout).find(entry => entry.block.id === block.id).block;
  const card = newArticleCard(newContainer().id, list.props);
  list.children = [card];
  commitLayout(layout, card.id, 'Kortlayout oprettet.');
}

function actionValue(target) {
  return target ? target.kind + ':' + target.id : '';
}

function renderActions(block) {
  const actions = Object.entries(actionDefinitions(block.type));
  if (!actions.length) return;
  const section = document.createElement('section');
  section.className = 'scene-actions';
  section.setAttribute('aria-labelledby', 'block-actions-title');
  const heading = document.createElement('h4');
  heading.id = 'block-actions-title';
  heading.textContent = 'Handlinger';
  section.append(heading);
  properties.append(section);

  const actTargets = scene.acts.filter(act => act.id !== editActId)
    .map(act => [act.name, { kind: 'act', id: act.id }]);
  const blockTargets = scene.acts.flatMap(act => entriesOf(act.layout)
    .filter(entry => entry.block.id !== block.id)
    .map(({ block: target }) => [labelFor(target) + ' · ' + act.name, { kind: 'block', id: target.id }]));
  for (const [actionId, { label, defaultBlockType, recordCollection }] of actions) {
    const select = document.createElement('select');
    if (defaultBlockType) {
      const standard = resolveAction(scene.acts, { ...block, actions: undefined }, actionId);
      const title = blockTargets.find(([, target]) => target.id === standard?.id)?.[0];
      select.add(new Option(title ? 'Standard · ' + title : 'Standard', 'default'));
    }
    select.add(new Option('Intet mål', ''));
    const targets = new Map();
    for (const [name, entries] of [['Akter', actTargets], ['Blokke', blockTargets]]) {
      const options = recordCollection ? entries.filter(([, target]) => recordTarget(scene.acts, target, recordCollection)) : entries;
      if (!options.length) continue;
      const group = document.createElement('optgroup');
      group.label = name;
      for (const [title, target] of options) {
        const value = actionValue(target);
        targets.set(value, target);
        group.append(new Option(title, value));
      }
      select.append(group);
    }
    select.value = defaultBlockType && !Object.hasOwn(block.actions ?? {}, actionId)
      ? 'default' : actionValue(resolveAction(scene.acts, block, actionId));
    inputField(section, 'action-' + actionId, label, select).addEventListener('change', () => {
      const values = { ...block.actions };
      if (select.value === 'default') delete values[actionId];
      else values[actionId] = targets.get(select.value) ?? null;
      if (Object.keys(values).length) block.actions = values;
      else delete block.actions;
      if (block.type === 'act-trigger' && Object.hasOwn(block.props ?? {}, 'targetAct')) {
        delete block.props.targetAct;
        if (!Object.keys(block.props).length) delete block.props;
      }
      changeLayout('Skift handlingsmål');
    });
  }
}

function widthFor(block, value, syncControl = false) {
  block.width = Math.max(widthRange.min, Math.min(widthRange.max, Math.round(value)));
  if (syncControl) widthControls?.update({ value: block.width });
  changeLayout();
}

function renderSizingFields(block) {
  const { mode = 'fit', basis = basisRange.defaultValue } = block.sizing ?? {};
  choice(properties, 'block-sizing', 'Bredde', sizingModes, mode, next => {
    if (next === 'fit') delete block.sizing;
    else block.sizing = { mode: next, basis };
    changeLayout('Skift bredde');
    renderProperties();
    id('block-sizing').focus();
  });
  if (mode === 'fit') return;
  const input = document.createElement('input');
  Object.assign(input, { type: 'number', min: basisRange.min, max: basisRange.max, step: 1, value: String(basis) });
  const label = mode === 'grow' ? 'Udgangsbredde i px' : 'Fast bredde i px';
  inputField(properties, 'block-basis', label, input).addEventListener('change', () => {
    const value = input.valueAsNumber;
    if (!inRange(value, basisRange.min, basisRange.max)) {
      input.value = String(block.sizing.basis);
      status('Vælg en bredde mellem ' + basisRange.min + ' og ' + basisRange.max + ' px.', true);
      return;
    }
    block.sizing.basis = value;
    changeLayout('Justér bredde');
  });
}

function renderProperties() {
  for (const item of fieldControls.values()) item.range?.destroy();
  fieldControls.clear();
  widthControls = null;
  properties.replaceChildren();
  const { block, parent, index } = selected();
  const heading = document.createElement('h3');
  heading.textContent = labelFor(block);
  const blockId = document.createElement('p');
  blockId.className = 'scene-block-id';
  blockId.textContent = block.id;
  properties.append(heading, blockId);
  const entries = entriesOf(currentLayout());
  const parentOf = item => entries.find(entry => entry.block.id === item.id)?.parent;
  let insideArticleCard = false;
  for (let ancestor = parent; ancestor; ancestor = parentOf(ancestor)) {
    if (isArticleList(ancestor)) { insideArticleCard = true; break; }
  }

  if (isContainer(block)) {
    textField(properties, 'block-name', 'Navn', block.name, 80, value => {
      block.name = value;
      heading.textContent = value;
      outline.render(currentLayout(), selectedId);
      changeLayout('Omdøb container');
    });
    choice(properties, 'block-flow', 'Fordeling', flows, block.layout.flow, value => {
      block.layout.flow = value;
      changeLayout('Skift fordeling');
      renderProperties();
      id('block-flow').focus();
    });
    if (block.layout.flow === 'grid') {
      choice(properties, 'block-columns', 'Kolonner', { 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6' }, block.layout.columns, value => {
        block.layout.columns = Number(value);
        changeLayout('Skift antal kolonner');
      });
    }
    choice(properties, 'block-align', 'Justering', alignment, block.layout.align, value => {
      block.layout.align = value;
      changeLayout('Skift justering');
    });
    const gap = document.createElement('input');
    Object.assign(gap, { type: 'number', min: '0', max: '64', value: String(block.layout.gap) });
    inputField(properties, 'block-gap', 'Afstand i px', gap).addEventListener('change', () => {
      const value = gap.valueAsNumber;
      if (Number.isInteger(value) && gap.validity.valid) block.layout.gap = value;
      gap.value = String(block.layout.gap);
      changeLayout('Justér afstand');
    });
    if (parent?.layout && parent.layout.flow !== 'wrap') {
      const width = component('range-field', {
        idPrefix: 'scene-width', label: parent.layout.flow === 'row' ? 'Relativ bredde' : 'Bredde i %',
        variant: 'with-input', hint: parent.layout.flow === 'row' ? 'Fordeler pladsen, når rækken vises side om side.' : '',
        value: block.width, ...widthRange,
      });
      width.id = 'block-width';
      properties.append(width);
      widthControls = mountRangeField(width, {
        onInput({ value, valid }) {
          if (valid) widthFor(block, value);
          else changed();
        },
        onCommit: () => recordLayout('Skalér container'),
      });
      fieldControls.set('containerWidth', { input: width.querySelector('input[type="number"]'), range: widthControls });
    }
  } else if (Object.hasOwn(customBlocks, block.type)) {
    for (const [name, field] of Object.entries(customBlocks[block.type].fields)) {
      const change = value => { block.props[name] = value; changeLayout(field.label); };
      if (field.type === 'text') {
        textField(properties, 'prop-' + name, field.label, block.props[name], field.maxLength, change);
      } else {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = block.props[name];
        const wrapper = inputField(properties, 'prop-' + name, field.label, input).parentElement;
        wrapper.classList.add('scene-checkbox');
        input.addEventListener('change', () => change(input.checked));
      }
    }
  }
  if (parent?.layout?.flow === 'wrap') renderSizingFields(block);
  if (insideArticleCard) renderArticleBindings(block);
  if (isArticleList(block)) {
    button(properties, {
      text: hasArticleCard(block) ? 'Vælg kortlayout' : 'Opret kortlayout', variant: 'secondary',
    }, () => openArticleCard(block));
  }
  renderVisualFields(block);
  renderActions(block);
  const collection = scenePatternBlocks[block.type]?.collection;
  if (collection) {
    button(properties, {
      text: 'Redigér ' + collections[collection].title.toLowerCase(), variant: 'tertiary', attrs: { 'aria-haspopup': 'dialog' },
    }, event => openContent(collection, event.currentTarget));
  }

  if (parent && !isArticleList(parent)) {
    const moves = document.createElement('div');
    moves.className = 'scene-moves';
    properties.append(moves);
    const destinations = Object.fromEntries(entriesOf(currentLayout()).filter(({ block: target }) => canMoveTo(block, target))
      .map(({ block: target, depth }) => [target.id, '  '.repeat(depth) + labelFor(target)]));
    choice(moves, 'block-parent', 'Flyt til container', destinations, parent.id, destination => {
      const target = entriesOf(currentLayout()).find(entry => entry.block.id === destination).block;
      move(block.id, destination, target.children.length);
    });
    const otherActs = scene.acts.filter(act => act.id !== editActId);
    if (otherActs.length) {
      const options = Object.fromEntries([['', 'Vælg akt'], ...otherActs.map(act => [act.id, act.name])]);
      const destination = choice(moves, 'block-act', 'Flyt til akt', options, '', actId => {
        if (actId) moveToAct(block.id, actId);
        destination.value = '';
      });
    }
    const actions = document.createElement('div');
    actions.className = 'scene-inline-actions';
    moves.append(actions);
    button(actions, { text: 'Flyt op', variant: 'tertiary', attrs: { id: 'block-up' } }, () => move(block.id, parent.id, index - 1)).disabled = index === 0;
    button(actions, { text: 'Flyt ned', variant: 'tertiary', attrs: { id: 'block-down' } }, () => move(block.id, parent.id, index + 2)).disabled = index === parent.children.length - 1;
    const emptyContainer = isContainer(block) && !block.children.length;
    if (emptyContainer || Object.hasOwn(sharedSceneBlocks, block.type) || Object.hasOwn(scenePatternBlocks, block.type)) {
      button(moves, { text: emptyContainer ? 'Fjern tom container' : 'Fjern blok', variant: 'ghost', intent: 'danger' }, () => removeBlock(block.id));
    }
  }
}

function selectBlock(blockId, { reveal = true, focus = false, part = null } = {}) {
  if (selectedId !== blockId || selectedPart !== part) quick.finishText();
  selectedId = blockId;
  selectedPart = part;
  outline.selectRow(blockId);
  renderProperties();
  if (reveal) view.reveal(blockId);
  if (focus) outline.focus(blockId);
  queueSelection();
}

function commitLayout(layout, blockId, message, beforeApply = () => {}) {
  const acts = scene.acts.map(act => act.id === editActId ? { ...act, layout } : act);
  return commitActs(acts, message, () => applyDocumentLayout(layout, blockId), beforeApply);
}

function applyDocumentLayout(layout, blockId) {
  view.render(layout);
  outline.render(layout, blockId);
  updateLayoutHelp(layout);
  selectBlock(blockId, { focus: true });
}

function commitActs(acts, message, apply, beforeApply = () => {}) {
  const error = validateSceneActs({ ...scene, acts });
  if (error) { status(error, true); return error; }
  beforeApply();
  scene.acts = acts;
  apply();
  recordLayout(message);
  changed();
  announce(message);
  return '';
}

function useHistory(action) {
  if (!history || !editing || fileBusy) return;
  quick.finishText(false);
  if (!history[action]()) return;
  const { acts, appLogo, collections } = history.value;
  scene.acts = acts;
  if (appLogo) scene.appLogo = appLogo;
  else delete scene.appLogo;
  if (collections) scene.collections = collections;
  else delete scene.collections;
  view.updateData();
  selectAct(currentAct() ?? scene.acts[0]);
  updateHistoryControls();
  changed();
  announce(action === 'undo' ? 'Seneste layoutændring fortrudt.' : 'Layoutændring gentaget.');
}
id('undo-edit').addEventListener('click', () => useHistory('undo'));
id('redo-edit').addEventListener('click', () => useHistory('redo'));
document.addEventListener('keydown', event => {
  if (!editing || document.querySelector('dialog[open]') || !(event.ctrlKey || event.metaKey) || event.altKey
    || event.target.closest('input, textarea, select, [contenteditable]')) return;
  const key = event.key.toLowerCase();
  if (key !== 'z' && key !== 'y') return;
  event.preventDefault();
  useHistory(key === 'y' || event.shiftKey ? 'redo' : 'undo');
});

function move(blockId, destination, index) {
  quick.finishText();
  const layout = structuredClone(currentLayout());
  if (moveBlock(layout, blockId, destination, index)) {
    const block = entriesOf(layout).find(entry => entry.block.id === blockId).block;
    commitLayout(layout, blockId, labelFor(block) + ' flyttet.');
  }
}

function moveToAct(blockId, actId) {
  quick.finishText();
  const acts = structuredClone(scene.acts);
  const source = acts.find(act => act.id === editActId);
  const target = acts.find(act => act.id === actId);
  const { block, parent, index } = entriesOf(source.layout).find(entry => entry.block.id === blockId);
  parent.children.splice(index, 1);
  target.layout.children.push(block);
  commitActs(acts, labelFor(block) + ' flyttet til ' + target.name + '.', () => {
    actSelections.set(actId, { blockId, part: selectedPart });
    selectAct(target);
    view.reveal(blockId);
    outline.focus(blockId);
  });
}

function removeBlock(blockId) {
  quick.finishText();
  const acts = structuredClone(scene.acts);
  const { layout } = acts.find(act => act.id === editActId);
  const { block, parent, index } = entriesOf(layout).find(entry => entry.block.id === blockId);
  const removed = new Set(entriesOf(block).map(entry => entry.block.id));
  parent.children.splice(index, 1);
  const cleared = [];
  for (const act of acts) {
    for (const { block: source } of entriesOf(act.layout)) {
      for (const [actionId, target] of Object.entries(source.actions ?? {})) {
        if (target?.kind !== 'block' || !removed.has(target.id)) continue;
        source.actions[actionId] = null;
        cleared.push(actionDefinitions(source.type)[actionId].label);
      }
    }
  }
  const message = labelFor(block) + ' fjernet.' + (cleared.length ? ' Mål fjernet for ' + cleared.join(', ') + '.' : '');
  const error = commitActs(acts, message, () => applyDocumentLayout(layout, parent.id));
  if (!error && cleared.length) status(message + ' Ugemte ændringer.');
}

function addContainer() {
  if (!view || !editing) return;
  quick.finishText();
  const layout = structuredClone(currentLayout());
  const { block, parent } = entriesOf(layout).find(entry => entry.block.id === selectedId);
  const container = newContainer();
  (hasArticleCard(block) ? block.children[0] : isContainer(block) ? block : parent).children.push(container);
  commitLayout(layout, container.id, 'Container tilføjet.');
}

function insertLibraryBlock(type, close, pattern) {
  const layout = structuredClone(currentLayout());
  const { block, parent, index } = entriesOf(layout).find(entry => entry.block.id === selectedId);
  function newBlock(type) {
    if (type === 'container') return newContainer();
    const entry = { id: type + '-' + crypto.randomUUID(), type };
    if (type === 'blog-list') entry.children = [newArticleCard(newContainer().id)];
    return entry;
  }
  let entry;
  if (pattern) {
    const placed = new Set(scene.acts.flatMap(act => entriesOf(act.layout).map(({ block }) => block.type)));
    const available = Object.keys(pattern.parts).filter(part => pattern.parts[part].library !== false && !placed.has(part));
    if (!available.length) return pattern.name + ' er allerede indsat.';
    entry = { ...newContainer(), name: pattern.name, children: available.map(newBlock) };
  } else entry = newBlock(type);
  if (hasArticleCard(block)) block.children[0].children.push(entry);
  else if (isContainer(block)) block.children.push(entry);
  else parent.children.splice(index + 1, 0, entry);
  return commitLayout(layout, entry.id, labelFor(entry) + ' indsat.', close);
}

function renderActs() {
  const { acts } = scene;
  const active = editing ? currentAct() : getAct(navigation.activeId);
  const running = !editing;
  const section = id('acts');
  const list = id('act-list');
  const settings = id('act-settings');
  const focused = document.activeElement;
  const focusedAct = list.contains(focused) ? focused.dataset.actId : undefined;
  const focusedSetting = settings.contains(focused) ? focused.id : undefined;
  section.hidden = false;
  section.parentElement.setAttribute('aria-labelledby', running ? 'acts-title' : 'blocks-title');
  addActButton.hidden = !editing;
  id('block-editor').hidden = running;
  id('properties-sidebar').hidden = running;
  section.closest('.scene-workbench').toggleAttribute('data-acts-preview', running);
  id('preview-title').textContent = active ? 'Appvisning · ' + active.name : 'Appvisning';

  const rows = acts.map(act => {
    const row = document.createElement('li');
    const control = document.createElement('button');
    control.className = 'scene-act';
    control.type = 'button';
    control.dataset.actId = act.id;
    control.setAttribute('aria-pressed', String(act === active));
    const name = document.createElement('span');
    name.textContent = act.name;
    const mode = document.createElement('small');
    mode.textContent = actModes[act.mode];
    control.append(name, mode);
    control.addEventListener('click', () => editing ? selectAct(act) : navigation.open(act.id));
    row.append(control);
    return row;
  });
  list.replaceChildren(...rows);
  settings.replaceChildren();
  if (editing && active) {
    function changeAct(field, value, label) {
      if (active[field] === value) return;
      active[field] = value;
      recordLayout(label);
      changed();
      renderActs();
    }
    textField(settings, 'act-name', 'Aktens navn', active.name, 80, value => changeAct('name', value, 'Omdøb akt'));
    choice(settings, 'act-mode', 'Vis som', actModes, active.mode, value => changeAct('mode', value, 'Skift aktens visning'))
      .disabled = active === acts[0];
  }
  const nextFocus = focusedAct ? list.querySelector('[data-act-id="' + focusedAct + '"]') : focusedSetting && id(focusedSetting);
  nextFocus?.focus({ preventScroll: true });
}

function updateLayoutHelp(layout) {
  id('layout-help').textContent = layout.children.length
    ? 'Træk en blok for at flytte den, eller brug Flyt under Egenskaber.'
    : 'Vælg Indsæt blok for at bygge appen.';
}

function showCurrentLayout({ scroll = false } = {}) {
  const layout = currentLayout();
  const wanted = actSelections.get(editActId);
  const entry = entriesOf(layout).find(({ block }) => block.id === wanted?.blockId)
    ?? entriesOf(layout).find(({ block }) => block.id === templates[scene.template].initialBlock);
  const initial = entry?.block.id ?? layout.id;
  view.render(layout);
  if (scroll) frame.contentWindow.scrollTo(0, 0);
  outline.render(layout, initial);
  updateLayoutHelp(layout);
  selectBlock(initial, { reveal: false, part: initial === wanted?.blockId ? wanted.part : null });
}

function selectAct(act) {
  quick.finishText();
  quick.setTarget(null);
  const switched = editActId !== act.id;
  if (editActId && selectedId) actSelections.set(editActId, { blockId: selectedId, part: selectedPart });
  editActId = act.id;
  showCurrentLayout({ scroll: switched });
  renderActs();
}

function addAct() {
  if (!view || !editing || fileBusy) return;
  quick.finishText();
  const act = newAct();
  scene.acts.push(act);
  recordLayout('Tilføj akt');
  selectAct(act);
  changed();
  id('act-name').select();
  announce('Akt tilføjet.');
}

function queueSelection() {
  if (!selectionFrame) selectionFrame = requestAnimationFrame(paintSelection);
}

function paintSelection() {
  selectionFrame = 0;
  const blockElement = view?.element(selectedId);
  if (!editing || !blockElement) {
    selection.hidden = true;
    quick.setTarget(null);
    return;
  }
  const { block, parent } = selected();
  const part = visualParts[block.type]?.[selectedPart];
  const partElement = part && blockElement.querySelector('[data-scene-part="' + selectedPart + '"]');
  const element = partElement && !partElement.hidden ? partElement : blockElement;
  const bounds = element.getBoundingClientRect();
  const left = Math.max(0, bounds.left);
  const top = Math.max(0, bounds.top);
  const width = Math.min(bounds.right, frame.clientWidth) - left;
  const height = Math.min(bounds.bottom, frame.clientHeight) - top;
  selection.hidden = width <= 0 || height <= 0;
  if (selection.hidden) {
    quick.setTarget(null);
    return;
  }
  Object.assign(selection.style, { left: left + 'px', top: top + 'px', width: width + 'px', height: height + 'px' });
  selection.dataset.labelInside = String(top < 21);
  id('selection-label').hidden = Boolean(part);
  id('selection-label').textContent = labelFor(block);
  quick.setTarget(block, part?.textKey && Object.hasOwn(block.bindings ?? {}, part.textKey) ? null : selectedPart);
  const context = partElement?.parentElement.getBoundingClientRect();
  quick.position(partElement?.hidden ? context : bounds, frame, context);
  const group = element.parentElement;
  const columns = frame.contentWindow.getComputedStyle(group).gridTemplateColumns.split(' ').length;
  resizeHandle.hidden = !parent?.layout || !isContainer(block) || parent.layout.flow === 'wrap' || (parent.layout.flow === 'row' && columns === 1);
  const leftEdge = parent?.layout?.flow === 'row' && columns > 1 && block === parent.children.at(-1);
  selection.dataset.edge = leftEdge ? 'left' : 'right';
  resizeHandle.setAttribute('aria-label', 'Skalér ' + labelFor(block));
}

resizeHandle.addEventListener('pointerdown', event => {
  const { block, parent } = selected();
  if (event.button !== 0 || !parent) return;
  const element = view.element(block.id);
  const group = element.parentElement;
  const width = element.getBoundingClientRect().width;
  const total = group.getBoundingClientRect().width;
  const row = parent.layout.flow === 'row' && frame.contentWindow.getComputedStyle(group).gridTemplateColumns.split(' ').length > 1;
  const available = row ? total - parent.layout.gap * (parent.children.length - 1) : total;
  const others = parent.children.filter(child => child !== block).reduce((sum, child) => sum + (child.width ?? 100), 0);
  if (available <= 0) return;
  resize = { block, original: block.width, row, available, others, width, x: event.clientX, pointerId: event.pointerId, direction: selection.dataset.edge === 'left' ? -1 : 1 };
  resizeHandle.focus({ preventScroll: true });
  resizeHandle.setPointerCapture(event.pointerId);
});
resizeHandle.addEventListener('pointermove', event => {
  if (!resize || event.pointerId !== resize.pointerId) return;
  const width = resize.width + (event.clientX - resize.x) * resize.direction;
  const bounded = Math.max(1, Math.min(resize.available - 1, width));
  const value = resize.row ? bounded / (resize.available - bounded) * resize.others : width / resize.available * 100;
  widthFor(resize.block, value, true);
});
resizeHandle.addEventListener('lostpointercapture', () => {
  if (resize) recordLayout('Skalér container');
  resize = null;
});
resizeHandle.addEventListener('pointercancel', () => {
  if (resize) widthFor(resize.block, resize.original, true);
});
resizeHandle.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  const { block } = selected();
  event.preventDefault();
  widthFor(block, block.width + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 5 : 1), true);
  recordLayout('Skalér container');
});

function setMode(next) {
  if (editing === next) return;
  quick.finishText();
  editing = next;
  updateMenus();
  updateHistoryControls();
  libraryButton.disabled = !next;
  id('edit-mode').setAttribute('aria-pressed', String(next));
  id('run-mode').setAttribute('aria-pressed', String(!next));
  frame.tabIndex = next ? -1 : 0;
  frame.contentDocument?.body?.toggleAttribute('data-scene-editing', next);
  id('scene-history').hidden = !next;
  if (!next) {
    selection.hidden = true;
    quick.setTarget(null);
  }
  if (view) {
    if (next) {
      if (view.panelOpen) view.closePanel();
      selectAct(currentAct());
    } else {
      navigation.reset();
    }
  }
  queueSelection();
}
id('edit-mode').addEventListener('click', () => setMode(true));
id('run-mode').addEventListener('click', () => setMode(false));
for (const mode of ['wide', 'narrow']) {
  id(mode + '-mode').addEventListener('click', () => {
    id('frame-shell').dataset.viewport = mode;
    for (const other of ['wide', 'narrow']) id(other + '-mode').setAttribute('aria-pressed', String(mode === other));
    queueSelection();
  });
}

function load(next, message = '', appFile) {
  quick.finishText(false);
  quick.setTarget(null);
  view?.destroy();
  scene = normalizeSceneActs(next);
  editActId = scene.acts[0].id;
  nativeApp = appFile;
  actSelections.clear();
  const template = templates[scene.template];
  document.title = 'Stade Scene – ' + template.name;
  const source = id('native-app-name');
  source.hidden = !nativeApp;
  source.textContent = nativeApp ? nativeApp.name : '';
  saveAppButton.hidden = !nativeApp;
  exportAppButton.hidden = Boolean(nativeApp && supportsAppPatterns(nativeApp.html)
    && supportsSceneActions(nativeApp.html) && supportsArticleCollections(nativeApp.html)
    && supportsProductCollections(nativeApp.html) && supportsArticleCards(nativeApp.html));
  exportName.value = nativeApp?.manifest.name ?? (scene.template === 'blank' ? 'Min app' : template.name);
  frame.title = template.name + ' · appvisning';
  history = createHistory(createHistoryState(historyValue()));
  updateHistoryControls();
  const mountedScene = scene;
  const viewDocument = frame.contentDocument;
  navigation = createActNavigation({ document: viewDocument, getScene: () => mountedScene, getView: () => view, onChange: renderActs });
  view = mountSceneView({
    document: viewDocument, theme: previewTheme.value.theme, themeControls: previewTheme, scene, announce,
    onActionTarget(target, trigger) { return !editing && navigation.openTarget(target, trigger); },
    onBackAct() { return !editing && navigation.back(); },
    onPanelClose() { if (scene === mountedScene) navigation.panelClosed(); },
  });
  baseline = JSON.stringify(scene);
  showCurrentLayout({ scroll: true });
  renderActs();
  updateMenus();
  status(message);
}

new ResizeObserver(queueSelection).observe(frame);
window.addEventListener('beforeunload', event => {
  if (view && hasChanges()) { event.preventDefault(); event.returnValue = ''; }
});
frame.addEventListener('load', () => {
  const viewDocument = frame.contentDocument;
  if (view || !viewDocument?.querySelector('main')) return;
  applySceneTheme(viewDocument.getElementById('stade-theme'), previewTheme.value);
  viewDocument.body.toggleAttribute('data-scene-editing', editing);
  viewDocument.addEventListener('pointerdown', event => {
    if (editing && event.target.closest('[data-scene-pattern]')) event.stopPropagation();
  }, true);
  viewDocument.addEventListener('click', event => {
    if (editing) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const blockId = event.target.closest('[data-scene-block]')?.dataset.sceneBlock;
      const part = event.target.closest('[data-scene-part]')?.dataset.scenePart ?? null;
      if (blockId) selectBlock(blockId, { part, focus: !part, reveal: false });
    } else {
      queueMicrotask(() => { changed(); queueSelection(); });
    }
  }, true);
  viewDocument.addEventListener('dblclick', event => {
    if (!editing) return;
    const blockId = event.target.closest('[data-scene-block]')?.dataset.sceneBlock;
    const part = event.target.closest('[data-scene-part]')?.dataset.scenePart;
    if (!blockId || !part) return;
    event.preventDefault();
    selectBlock(blockId, { part, reveal: false });
    paintSelection();
    quick.beginText();
  }, true);
  for (const type of ['input', 'change']) viewDocument.addEventListener(type, () => { changed(); queueSelection(); });
  frame.contentWindow.addEventListener('scroll', queueSelection);
  load(scene);
});
const previewStyles = '<style id="stade-theme"></style>' + id('app-preview-style').innerHTML;
frame.srcdoc = '<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Overblik</title>' +
  previewStyles + '</head><body class="ds-scope"><main></main></body></html>';
