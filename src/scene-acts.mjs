import { entriesOf, isActTrigger, isRecord, isSingletonPart, labelFor, newContainer, validateLayout } from './scene-model.mjs';
import { templates } from './templates.mjs';
import { actionDefinitions, recordTarget, validateBlockActions } from './scene-actions.mjs';

export const actModes = { side: 'Side', panel: 'Panel' };

function withActs(scene) {
  if (Object.hasOwn(scene, 'acts')) return scene;
  const { layout, ...data } = scene;
  const template = templates[scene.template];
  const start = { id: scene.template + '-main', name: template.initialActName ?? template.name, mode: 'side', layout };
  return { ...data, acts: [start] };
}

function normalizeTrigger(block) {
  if (block.type === 'practice-open-act') {
    return { ...block, type: 'act-trigger', props: { label: 'Lyd og værktøjer', ...block.props } };
  }
  if (!block.children?.length) return block;
  const children = block.children.map(normalizeTrigger);
  return children.some((child, index) => child !== block.children[index]) ? { ...block, children } : block;
}

export function normalizeSceneActs(scene) {
  const data = withActs(scene);
  const acts = data.acts.map(act => {
    const layout = normalizeTrigger(act.layout);
    return layout === act.layout ? act : { ...act, layout };
  });
  return acts.some((act, index) => act !== data.acts[index]) ? { ...data, acts } : data;
}

export function newAct() {
  const id = 'act-' + crypto.randomUUID();
  return {
    id,
    name: 'Ny akt',
    mode: 'panel',
    layout: { ...newContainer(), id: id + '-layout', name: 'Indhold' },
  };
}

export function validateSceneActs(scene) {
  if (!isRecord(scene) || typeof scene.template !== 'string' || !Object.hasOwn(templates, scene.template)) {
    return 'Scenen bruger en ukendt skabelon.';
  }
  const template = templates[scene.template];
  const data = withActs(scene);
  if (Object.hasOwn(data, 'layout') || !Array.isArray(data.acts) || !data.acts.length) {
    return 'Scenen har en ugyldig liste over akter.';
  }

  const actIds = new Set();
  const blockIds = new Set();
  const partTypes = new Set();
  const blocks = [];
  for (const act of data.acts) {
    if (!isRecord(act) || typeof act.id !== 'string' || !/^[a-z][a-z0-9-]{0,79}$/.test(act.id)) {
      return 'En akt mangler et gyldigt id.';
    }
    if (actIds.has(act.id)) return 'Flere akter bruger id’et ' + act.id + '.';
    actIds.add(act.id);
    if (typeof act.name !== 'string' || !act.name.trim() || act.name.length > 80) {
      return 'Et aktnavn skal indeholde mellem 1 og 80 tegn.';
    }
    if (typeof act.mode !== 'string' || !Object.hasOwn(actModes, act.mode)) {
      return 'Akten ' + act.name + ' skal vises som Side eller Panel.';
    }
    if (act === data.acts[0] && act.mode !== 'side') return 'Den første akt skal vises som Side.';

    const error = validateLayout(act.layout, template);
    if (error) return act.name + ' · ' + error;
    for (const { block } of entriesOf(act.layout)) {
      if (blockIds.has(block.id)) return 'Flere akter bruger blok-id’et ' + block.id + '.';
      blockIds.add(block.id);
      if (isSingletonPart(block.type, template) && !isActTrigger(block)) {
        if (partTypes.has(block.type)) return 'Der kan kun være én udgave af ' + labelFor(block) + ' på tværs af akter.';
        partTypes.add(block.type);
      }
      blocks.push({ block, actId: act.id });
    }
  }
  for (const { block, actId } of blocks) {
    const error = validateBlockActions(block, actId, actIds, blockIds);
    if (error) return labelFor(block) + ' · ' + error;
    for (const [id, target] of Object.entries(block.actions ?? {})) {
      const collection = actionDefinitions(block.type)[id].recordCollection;
      if (target && collection && !recordTarget(data.acts, target, collection)) {
        return labelFor(block) + ' · Målet kan ikke modtage posten fra samlingen.';
      }
    }
  }
  return '';
}
