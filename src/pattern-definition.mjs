import { validateSceneContract } from '../design/runtime/scene-fields.mjs';
import { collections } from './content-schema.mjs';

const idPattern = /^[a-z][a-z0-9-]{0,79}$/;
const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);
const isLabel = value => typeof value === 'string' && value.trim().length > 0;
const isName = value => isLabel(value) && value.length <= 80;

export function defineScenePattern(pattern) {
  const { id, name, description, parts } = pattern;
  if (typeof id !== 'string' || !idPattern.test(id) || !isName(name) || !isLabel(description)
    || !isRecord(parts) || !Object.keys(parts).length) {
    throw new Error('Et scenemønster kræver id, navn, beskrivelse og mindst én blok.');
  }
  for (const [type, { name, fields, parts, actions, collection, acceptsCollection }] of Object.entries(pattern.parts)) {
    if (!idPattern.test(type) || !isName(name) || !isRecord(fields) || !isRecord(parts)) {
      throw new Error('Ugyldig blokdefinition i scenemønstret ' + id + '.');
    }
    const error = Object.keys(fields).length || Object.keys(parts).length
      ? validateSceneContract({ fields, parts }, { parts }) : '';
    if (error) throw new Error(type + ': ' + error);
    if ([collection, acceptsCollection].some(key => key !== undefined && (typeof key !== 'string' || !Object.hasOwn(collections, key)))) {
      throw new Error('Ugyldig samling i ' + type + '.');
    }
    if (actions !== undefined && (!isRecord(actions) || Object.entries(actions).some(([key, action]) =>
      !idPattern.test(key) || !isRecord(action) || !isName(action.label)
      || Object.keys(action).some(property => !['label', 'defaultBlockType', 'recordCollection'].includes(property))
      || (action.recordCollection !== undefined && (typeof action.recordCollection !== 'string' || !Object.hasOwn(collections, action.recordCollection)))
      || (action.defaultBlockType !== undefined && !Object.hasOwn(pattern.parts, action.defaultBlockType))))) {
      throw new Error('Ugyldig handling i ' + type + '.');
    }
  }
  return pattern;
}
