import { downloadFile } from '../design/runtime/files.mjs';
import { nativeApps } from './native-apps.mjs';
import { COMPONENT_LIBRARY } from '../design/runtime/library.mjs';
import { scenePatternByBlock } from './scene-patterns.mjs';
import { actionDefinitions, actionTargetAct, resolveAction } from './scene-actions.mjs';

// Keep the complete manifest tag out of the executable bundle, where the file reader could mistake it for a second manifest.
const opening = ['<script type="application/json"', 'id="stade-native-app">'].join(' ');
const registryOpening = ['<script type="application/json"', 'id="stade-scene-registry">'].join(' ');
const closing = '</script>';
const maxBytes = 10 * 1024 * 1024;
const customAppId = /^scene-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);
const tooLarge = () => new Error('Appfilen er for stor. Grænsen er 10 MB.');

export function validateNativeAppManifest(manifest) {
  if (!isRecord(manifest) || manifest.format !== 'stade-native-app' || manifest.version !== 1 || typeof manifest.id !== 'string') {
    throw new Error('Appformatet eller appversionen understøttes ikke.');
  }
  const builtIn = Object.hasOwn(nativeApps, manifest.id) ? nativeApps[manifest.id] : undefined;
  if (!builtIn && !customAppId.test(manifest.id)) throw new Error('Appen har et ukendt id.');
  if (typeof manifest.name !== 'string' || !manifest.name.trim() || manifest.name.length > 80) {
    throw new Error('Appens navn skal have mellem 1 og 80 tegn.');
  }
  const { scene } = manifest;
  if (!isRecord(scene) || scene.format !== 'stade-scene' || scene.version !== 2
    || !isRecord(scene.data) || typeof scene.data.template !== 'string'
    || (builtIn && scene.data.template !== builtIn.template)) {
    throw new Error('Appen har en ugyldig scenefil.');
  }
  return manifest;
}

function manifestText(manifest) {
  validateNativeAppManifest(manifest);
  return '\n' + JSON.stringify(manifest, null, 2).replace(/</g, '\\u003c') + '\n';
}

export function nativeAppMarkup(manifest) {
  return opening + manifestText(manifest) + closing;
}

export function exportNativeApp({ name, scene, shell, css, runtime, document, decodeScene }) {
  const manifest = {
    format: 'stade-native-app', version: 1, id: 'scene-' + crypto.randomUUID(), name: name.trim(),
    scene: { format: 'stade-scene', version: 2, data: scene },
  };
  const markup = nativeAppMarkup(manifest);
  decodeScene(manifest.scene);
  const replacements = {
    'native-title': manifest.name.replace(/[&<>]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character]),
    'native-package': markup,
    'native-view-style': '<style>' + css.replace(/<\/style/gi, '<\\/style') + '</style>',
    'native-runtime': '<script>' + runtime.replace(/<\/script/gi, '<\\/script') + '</script>',
  };
  const html = JSON.parse(shell).replace(/<!-- (native-title|native-package|native-view-style|native-runtime) -->/g, (_, slot) => replacements[slot]);
  if (new TextEncoder().encode(html).byteLength > maxBytes) throw tooLarge();
  const base = manifest.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '');
  const reserved = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i;
  const filename = base && !reserved.test(base) ? base : 'Scene-app';
  downloadFile(filename + '.html', html, 'text/html;charset=utf-8', { document });
}

/** Read the embedded project without parsing or loading the HTML as a document. */
export function parseNativeApp(html) {
  const tag = html.indexOf(opening);
  if (tag < 0) throw new Error('Appfilen mangler et Stade-manifest.');
  const start = tag + opening.length;
  const end = html.indexOf(closing, start);
  if (end < 0 || html.indexOf(opening, start) >= 0) throw new Error('Appfilen har et ugyldigt Stade-manifest.');
  let manifest;
  try { manifest = JSON.parse(html.slice(start, end)); }
  catch { throw new Error('Appens manifest indeholder ikke gyldig JSON.'); }
  return { manifest: validateNativeAppManifest(manifest), start, end };
}

async function readHTML(file) {
  if (file.size > maxBytes) throw tooLarge();
  const bytes = await file.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new Error('Appfilen er ikke læsbar som UTF-8.'); }
}

function openHTMLInput(document) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html,.htm,text/html';
    input.hidden = true;
    input.dataset.nativeAppFile = '';
    const finish = (file = null) => { input.remove(); resolve(file ? { file, handle: null } : null); };
    input.addEventListener('cancel', () => finish(), { once: true });
    input.addEventListener('change', () => finish(input.files[0]), { once: true });
    document.body.append(input);
    try { input.click(); }
    catch (error) { input.remove(); reject(error); }
  });
}

async function pickAppFile(window) {
  if (window.isSecureContext && typeof window.showOpenFilePicker === 'function') {
    let handle;
    try {
      [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [{ description: 'Stade-native app', accept: { 'text/html': ['.html', '.htm'] } }],
      });
      if (!handle) return null;
    } catch (error) {
      if (error.name === 'AbortError') return null;
      if (error.name !== 'SecurityError') throw error;
      return openHTMLInput(window.document);
    }
    return { file: await handle.getFile(), handle };
  }
  return openHTMLInput(window.document);
}

export async function openNativeAppFile({ window = globalThis.window, decodeScene } = {}) {
  const opened = await pickAppFile(window);
  if (!opened) return null;
  const { file, handle } = opened;
  const html = await readHTML(file);
  const { manifest } = parseNativeApp(html);
  const { scene } = decodeScene(manifest.scene);
  return { name: file.name, scene, manifest, html, handle };
}

async function verifyUnchanged(handle, expected) {
  if (await readHTML(await handle.getFile()) !== expected) {
    throw new Error('Appfilen er ændret siden åbning. Åbn den igen, eller gem en kopi af dit arbejde.');
  }
}

function usesMedia(scene) {
  function imageBlock(block) {
    return block.type === 'image'
      || (block.type === 'overview-intro' && Object.hasOwn(block.props ?? {}, 'logoMode'))
      || block.children?.some(imageBlock);
  }
  return Boolean(scene.media?.length || scene.appLogo || scene.acts?.some(act => imageBlock(act.layout)));
}

export const supportsAppPatterns = html => html.includes(registryOpening);
export const supportsSceneActions = html => html.includes('<meta name="stade-scene-actions" content="1">');
export const supportsArticleCollections = html => html.includes('<meta name="stade-scene-articles" content="1">');
export const supportsProductCollections = html => html.includes('<meta name="stade-scene-products" content="1">');
export const supportsArticleCards = html => html.includes('<meta name="stade-scene-article-cards" content="1">');

function usesArticleCards(block) {
  const component = COMPONENT_LIBRARY[block.type];
  return (component && !component.scene && block.type !== 'image') || (block.type === 'blog-list' && Boolean(block.children))
    || block.children?.some(usesArticleCards);
}

function usesArticleCollections(scene) {
  function includesArticleBlock(block) {
    return ['blog-feature', 'blog-list', 'blog-reader'].includes(block.type)
      || (block.type === 'blog-stories' && Object.hasOwn(block.props ?? {}, 'count'))
      || block.children?.some(includesArticleBlock);
  }
  return Boolean(scene.collections || scene.acts.some(act => includesArticleBlock(act.layout)));
}

function usesForeignPatterns(scene) {
  function includesForeignPart(block) {
    const pattern = scenePatternByBlock[block.type];
    return (pattern && pattern !== scene.template) || block.children?.some(includesForeignPart);
  }
  return scene.acts.some(act => includesForeignPart(act.layout));
}

function usesSceneActions(scene) {
  const { acts } = scene;
  function within(block, act) {
    if (Object.keys(block.actions ?? {}).length) return true;
    const followsBlock = Object.keys(actionDefinitions(block.type)).some(key => {
      const target = resolveAction(acts, block, key);
      return target?.kind === 'block' && actionTargetAct(acts, target) !== act;
    });
    return followsBlock || block.children?.some(child => within(child, act));
  }
  return acts.some(act => within(act.layout, act));
}

export async function saveNativeApp(session, scene, { document = globalThis.document, decodeScene } = {}) {
  const original = session.html;
  const { manifest, start, end } = parseNativeApp(original);
  const next = { ...manifest, scene: { ...manifest.scene, data: scene } };
  const content = manifestText(next);
  decodeScene(next.scene);
  if (usesMedia(scene) && !original.includes('<meta name="stade-scene-media" content="1">')) {
    throw new Error('Appfilen skal genbygges med Medier, før billeder og logovalg kan gemmes. Gem en scenekopi imens.');
  }
  if (!supportsAppPatterns(original) && usesForeignPatterns(scene)) {
    throw new Error('Appfilen bruger en ældre Scene. Vælg Eksportér app for at få en HTML-fil med de nye mønstre.');
  }
  if (!supportsSceneActions(original) && usesSceneActions(scene)) {
    throw new Error('Appfilen bruger en ældre Scene. Vælg Eksportér app for at få en HTML-fil med de nye handlinger.');
  }
  if (!supportsArticleCollections(original) && usesArticleCollections(scene)) {
    throw new Error('Appfilen bruger en ældre Scene. Vælg Eksportér app for at få en HTML-fil med artiklerne.');
  }
  if (!supportsProductCollections(original) && (scene.collections?.products || scene.collections?.articles?.some(article => article.productId))) {
    throw new Error('Appfilen bruger en ældre Scene. Vælg Eksportér app for at få varer og varelinks med.');
  }
  if (!supportsArticleCards(original) && scene.acts.some(act => usesArticleCards(act.layout))) {
    throw new Error('Appfilen bruger en ældre Scene. Vælg Eksportér app for at få de redigerbare kort og knapper med.');
  }
  const html = original.slice(0, start) + content + original.slice(end);
  if (new TextEncoder().encode(html).byteLength > maxBytes) throw tooLarge();
  const { handle } = session;
  if (!handle) {
    downloadFile(session.name, html, 'text/html;charset=utf-8', { document });
    return 'downloaded';
  }

  if (typeof handle.requestPermission === 'function' && await handle.requestPermission({ mode: 'readwrite' }) !== 'granted') {
    throw new Error('Browseren gav ikke skriveadgang til denne appfil.');
  }
  await verifyUnchanged(handle, original);
  const writable = await handle.createWritable({ mode: 'exclusive' });
  try {
    await writable.write(html);
    await verifyUnchanged(handle, original);
    await writable.close();
  } catch (error) {
    try { await writable.abort(); } catch { /* The original write error is more informative. */ }
    throw error;
  }
  session.html = html;
  session.manifest = next;
  session.scene = scene;
  return 'written';
}
