import { createProjectFile, openJSONFile } from '../design/runtime/files.mjs';
import { normalizeSceneActs, validateSceneActs } from './scene-acts.mjs';
import { entriesOf, inRange, isRecord } from './scene-model.mjs';
import { validateSceneMedia } from './scene-media.mjs';
import { newScene, templates } from './templates.mjs';
import { validateCollections } from './content-schema.mjs';
import { getCollection } from './content-data.mjs';

const phases = ['planned', 'active', 'review', 'done'];
const format = 'stade-scene';
const version = 2;
const isCount = value => Number.isSafeInteger(value) && value >= 0;

function validProject(project) {
  return isRecord(project)
    && ['id', 'name', 'kind', 'owner', 'initials', 'due', 'note'].every(key => typeof project[key] === 'string')
    && /^[a-z][a-z0-9-]*$/.test(project.id) && !Object.hasOwn(Object.prototype, project.id)
    && phases.includes(project.status)
    && isCount(project.progress) && project.progress <= 100
    && isCount(project.tasks) && isCount(project.completed) && project.completed <= project.tasks;
}

function validPreview(preview) {
  if (!isRecord(preview)) return false;
  if (Object.keys(preview).length === 0) return true;
  if (!Array.isArray(preview.projects) || !preview.projects.length
      || !preview.projects.every(validProject)) return false;
  const ids = new Set(preview.projects.map(project => project.id));
  return ids.size === preview.projects.length && ids.has(preview.selected)
    && typeof preview.query === 'string' && (preview.status === 'all' || phases.includes(preview.status))
    && isRecord(preview.notes)
    && Object.entries(preview.notes).every(([id, note]) => ids.has(id) && typeof note === 'string');
}

const valid = { valid: true };
const invalid = text => ({ valid: false, errors: [text] });

function validateScene(scene, sourceVersion = version) {
  if (!isRecord(scene) || typeof scene.template !== 'string' || !Object.hasOwn(templates, scene.template)
    || (sourceVersion === 1 && scene.template !== 'overview')) return invalid('Scenen bruger en ukendt skabelon.');
  const { layout, preview = {}, template } = scene;
  if (template === 'overview' && !validPreview(preview)) return invalid('Overblikkets projekter eller valg er ugyldige.');
  if (template !== 'overview' && (!isRecord(preview) || Object.keys(preview).length)) {
    return invalid('Skabelonens app-tilstand gemmes ikke i scenefilen.');
  }
  if (sourceVersion === 1) {
    return ['left', 'right'].includes(layout?.side) && inRange(layout.width, 260, 480)
      ? valid : invalid('Placeringen eller bredden i version 1 er ugyldig.');
  }
  const layoutError = validateSceneActs(scene);
  if (layoutError) return invalid(layoutError);
  const collectionError = validateCollections(scene, getCollection);
  if (collectionError) return invalid(collectionError);
  const layouts = scene.acts?.map(act => act.layout) ?? [layout];
  const images = layouts.flatMap(root => entriesOf(root).flatMap(({ block }) =>
    ['image','overview-intro'].includes(block.type) && block.props?.imageId ? [block.props.imageId] : []));
  images.push(...Object.values(scene.collections ?? {}).flatMap(records => records.flatMap(record => record.imageId ? [record.imageId] : [])));
  const error = validateSceneMedia(scene, images);
  return error ? invalid(error) : valid;
}

export const sceneFile = createProjectFile({ format, version, validate: validateScene });

function migrateOverview(data) {
  const upgraded = newScene('overview');
  const layout = upgraded.acts[0].layout;
  layout.children = layout.children.filter(block => ['intro', 'metrics', 'workspace'].includes(block.id));
  const workspace = layout.children.find(block => block.id === 'workspace');
  const [projects, details] = workspace.children;
  details.width = Math.round(data.layout.width / 10);
  projects.width = 100 - details.width;
  if (data.layout.side === 'left') workspace.children.reverse();
  upgraded.preview = data.preview ?? {};
  return upgraded;
}

function validateSceneDocument(file) {
  if (file?.format !== format) return invalid('Filen tilhører et andet projektformat.');
  if (![1, version].includes(file.version)) return invalid('Denne version af scenefilen understøttes ikke.');
  return validateScene(file.data, file.version);
}

function normalizeSceneDocument(file) {
  const migrated = file.version === 1;
  return {
    scene: migrated ? migrateOverview(file.data) : normalizeSceneActs(file.data),
    migrated,
  };
}

export function decodeSceneDocument(file) {
  const result = validateSceneDocument(file);
  if (!result.valid) throw new Error(result.errors.join('\n'));
  return normalizeSceneDocument(file);
}

export async function openSceneFile() {
  const opened = await openJSONFile({ validate: validateSceneDocument, maxBytes: 8 * 1024 * 1024 });
  return opened ? { name: opened.name, ...normalizeSceneDocument(opened.data) } : null;
}
