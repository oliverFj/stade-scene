import { templates } from './templates.mjs';
import { sceneBlockKinds, sharedSceneBlocks, validateVisualProps } from './visual-fields.mjs';
import { scenePatternBlocks } from './scene-patterns.mjs';
import { bindingFields, isArticleList } from './article-card.mjs';

const partLabels = Object.assign({}, ...Object.values(templates).map(template => template.parts));
export const customBlocks = {
  'phase-breakdown': {
    fields: {
      title: { label: 'Overskrift', type: 'text', maxLength: 80 },
      showCounts: { label: 'Vis antal ved søjlerne', type: 'checkbox' },
    },
  },
};
export const flows = { stack: 'Stak', row: 'Række', grid: 'Gitter', wrap: 'Fleksibel række' };
export const alignment = { start: 'Start', center: 'Midten', end: 'Slut', stretch: 'Stræk' };
export const widthRange = { min: 15, max: 100, step: 1 };
export const sizingModes = { fit: 'Efter indhold', grow: 'Fyld ledig plads', fixed: 'Fast bredde' };
export const basisRange = { min: 56, max: 1200, defaultValue: 220 };
const maxDepth = 8;
const maxBlocks = 100;

export const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);
export const inRange = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
export const isContainer = block => block.type === 'container';
export const isActTrigger = block => block.type === 'act-trigger' || block.type === 'practice-open-act';
export const labelFor = block => block.name || scenePatternBlocks[block.type]?.name || partLabels[block.type] || sharedSceneBlocks[block.type]?.name;
export const isSingletonPart = (type, template) => (Object.hasOwn(scenePatternBlocks, type) && !scenePatternBlocks[type].repeatable)
  || (Object.hasOwn(template.parts, type) && !Object.hasOwn(customBlocks, type));

function validSizing(sizing) {
  if (!isRecord(sizing) || typeof sizing.mode !== 'string' || !Object.hasOwn(sizingModes, sizing.mode)) return false;
  return sizing.mode === 'fit' ? sizing.basis === undefined : inRange(sizing.basis, basisRange.min, basisRange.max);
}

export function entriesOf(root) {
  const entries = [];
  function visit(block, parent, index, depth) {
    entries.push({ block, parent, index, depth });
    block.children?.forEach((child, childIndex) => visit(child, block, childIndex, depth + 1));
  }
  visit(root, null, 0, 0);
  return entries;
}

export function validateLayout(root, template) {
  if (root?.type !== 'container' || root.width !== 100) return 'Scenen skal have en container i fuld bredde som rod.';
  const ids = new Set();
  const usedParts = new Set();
  function visit(block, depth, inCard = false) {
    if (!isRecord(block) || !/^[a-z][a-z0-9-]{0,79}$/.test(block.id ?? '') || typeof block.id !== 'string') return 'En blok mangler et gyldigt id.';
    if (ids.has(block.id)) return 'Flere blokke bruger id’et ' + block.id + '.';
    ids.add(block.id);
    if (ids.size > maxBlocks || depth > maxDepth) return 'Scenen må højst have 100 blokke og otte indlejrede niveauer.';
    if (block.name !== undefined && (typeof block.name !== 'string' || !block.name.trim() || block.name.length > 80)) return 'Et bloknavn skal indeholde mellem 1 og 80 tegn.';
    if (block.sizing !== undefined && !validSizing(block.sizing)) return 'Ugyldig fleksibel bredde i ' + block.id + '.';
    if (block.bindings !== undefined) {
      if (!inCard || !isRecord(block.bindings) || Object.entries(block.bindings).some(([field, source]) =>
        !Object.hasOwn(bindingFields(block.type), field) || !bindingFields(block.type)[field].includes(source))) {
        return 'Ugyldig databinding i ' + block.id + '.';
      }
    }
    if (inCard && !isContainer(block) && !['component', 'media'].includes(sceneBlockKinds[block.type])) {
      return 'Kortlayoutet bruger containere og komponenter.';
    }
    if (isContainer(block)) {
      const layout = block.layout;
      if (!block.name || !Array.isArray(block.children) || !isRecord(layout)
        || typeof layout.flow !== 'string' || !Object.hasOwn(flows, layout.flow)
        || typeof layout.align !== 'string' || !Object.hasOwn(alignment, layout.align)
        || !inRange(layout.gap, 0, 64) || !inRange(layout.columns, 1, 6)
        || !inRange(block.width, widthRange.min, widthRange.max)) return 'Ugyldigt layout for containeren ' + block.id + '.';
      for (const child of block.children) {
        const error = visit(child, depth + 1, inCard);
        if (error) return error;
      }
      return '';
    }
    if (block.children !== undefined) {
      if (!isArticleList(block) || !Array.isArray(block.children) || block.children.length !== 1 || !isContainer(block.children[0])) {
        return 'Et kortlayout skal have én container som rod.';
      }
      const error = visit(block.children[0], depth + 1, true);
      if (error) return error;
    }
    if (typeof block.type !== 'string') return 'En blok mangler sin type.';
    if (block.type === 'practice-open-act') return validateVisualProps({ ...block, type: 'act-trigger' });
    if (Object.hasOwn(sharedSceneBlocks, block.type)) return validateVisualProps(block);
    if (scenePatternBlocks[block.type]?.repeatable) return validateVisualProps(block);
    if (isSingletonPart(block.type, template)) {
      if (usedParts.has(block.type)) return 'Appen kan kun vise én udgave af ' + labelFor(block) + '.';
      usedParts.add(block.type);
      return validateVisualProps(block);
    }
    if (!Object.hasOwn(template.parts, block.type)) return 'Ukendt bloktype i ' + block.id + '.';
    if (!isRecord(block.props)) return 'Blokken ' + block.id + ' mangler sine egenskaber.';
    for (const [key, field] of Object.entries(customBlocks[block.type].fields)) {
      const value = block.props[key];
      const valid = field.type === 'checkbox' ? typeof value === 'boolean'
        : typeof value === 'string' && value.trim() && value.length <= field.maxLength;
      if (!valid) return field.label + ' har en ugyldig værdi i ' + block.id + '.';
    }
    return '';
  }
  return visit(root, 0);
}

export function canMoveTo(block, destination) {
  return isContainer(destination) && !entriesOf(block).some(entry => entry.block.id === destination.id);
}

export function moveBlock(root, blockId, targetId, index) {
  const entries = entriesOf(root);
  const entry = entries.find(item => item.block.id === blockId);
  const target = entries.find(item => item.block.id === targetId)?.block;
  if (!entry?.parent || !target || !canMoveTo(entry.block, target)) return false;
  if (entry.parent === target && entry.index < index) index--;
  if (entry.parent === target && entry.index === index) return false;
  entry.parent.children.splice(entry.index, 1);
  target.children.splice(index, 0, entry.block);
  return true;
}

export function newContainer() {
  return {
    id: 'container-' + crypto.randomUUID().slice(0, 8),
    name: 'Ny container',
    type: 'container',
    width: 100,
    layout: { flow: 'stack', gap: 16, columns: 2, align: 'stretch' },
    children: [],
  };
}
