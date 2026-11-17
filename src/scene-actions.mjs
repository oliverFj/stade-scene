import { scenePatternBlocks } from './scene-patterns.mjs';

const identifier = /^[a-z][a-z0-9-]{0,79}$/;
const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);
const actTrigger = { open: { label: 'Åbn mål' } };

export function actionDefinitions(type) {
  if (type === 'act-trigger' || type === 'practice-open-act') return actTrigger;
  return scenePatternBlocks[type]?.actions ?? {};
}

function matchingBlock(layout, key, value) {
  if (layout[key] === value) return layout;
  for (const child of layout.children ?? []) {
    const match = matchingBlock(child, key, value);
    if (match) return match;
  }
}

export function findActionBlock(acts, id) {
  for (const act of acts) {
    const block = matchingBlock(act.layout, 'id', id);
    if (block) return { act, block };
  }
}

export function actionTargetAct(acts, target) {
  if (target?.kind === 'act') return acts.find(act => act.id === target.id);
  if (target?.kind === 'block') return findActionBlock(acts, target.id)?.act;
}

export function recordTarget(acts, target, collection) {
  const accepts = block => scenePatternBlocks[block.type]?.acceptsCollection === collection;
  if (target.kind === 'block') {
    const entry = findActionBlock(acts, target.id);
    return entry && accepts(entry.block) ? entry.block : undefined;
  }
  const root = actionTargetAct(acts, target)?.layout;
  function find(block) {
    if (accepts(block)) return block;
    for (const child of block.children ?? []) {
      const included = find(child);
      if (included) return included;
    }
  }
  return root ? find(root) : undefined;
}

export function resolveAction(acts, block, actionId) {
  const definitions = actionDefinitions(block.type);
  if (!Object.hasOwn(definitions, actionId)) return undefined;
  if (Object.hasOwn(block.actions ?? {}, actionId)) return block.actions[actionId] ?? undefined;
  if (definitions === actTrigger && block.props?.targetAct) return { kind: 'act', id: block.props.targetAct };
  const defaultType = definitions[actionId].defaultBlockType;
  if (!defaultType) return undefined;
  for (const act of acts) {
    const target = matchingBlock(act.layout, 'type', defaultType);
    if (target && target.id !== block.id) return { kind: 'block', id: target.id };
  }
}

export function validateBlockActions(block, sourceActId, actIds, blockIds) {
  const definitions = actionDefinitions(block.type);
  const actions = block.actions ?? {};
  if (block.actions !== undefined && !isRecord(block.actions)) return 'Handlingerne skal være et objekt.';
  for (const [key, target] of Object.entries(actions)) {
    if (!Object.hasOwn(definitions, key)) return 'Ukendt handling ' + key + '.';
    if (target === null) continue;
    if (!isRecord(target) || Object.keys(target).length !== 2 || typeof target.id !== 'string' || !identifier.test(target.id)) {
      return 'Handlingen har et ugyldigt mål.';
    }
    if (target.kind === 'act') {
      if (target.id === sourceActId || !actIds.has(target.id)) return 'Vælg en anden akt som mål.';
    } else if (target.kind === 'block') {
      if (target.id === block.id || !blockIds.has(target.id)) return 'Vælg en anden eksisterende blok som mål.';
    } else return 'Handlingen skal pege på en akt eller en blok.';
  }
  if (definitions === actTrigger && !Object.hasOwn(actions, 'open') && block.props?.targetAct !== undefined
    && (block.props.targetAct === sourceActId || !actIds.has(block.props.targetAct))) {
    return 'En knap skal åbne en anden akt i scenen.';
  }
  return '';
}
