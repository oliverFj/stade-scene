import { randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildStamp, offlineIssues } from '../design/tools/offline-checks.mjs';
import {TABLER_LICENSE} from '../design/runtime/icons.mjs';
import {SIGNATURE_LICENSE} from '../design/runtime/signature-assets.mjs';
import { nativeAppMarkup, parseNativeApp } from '../src/native-package.mjs';
import { nativeApps, sceneFilename } from '../src/native-apps.mjs';
import { sceneRegistryMarkup } from '../src/scene-patterns.mjs';

const style = (css, attrs = '') => '<style' + attrs + '>' + css.replace(/<\/style/gi, '<\\/style') + '</style>';
const licenses = '<script type="text/plain" id="tabler-license">' + TABLER_LICENSE + '\n\n' + SIGNATURE_LICENSE + '</script>';

async function compile(root, entry, styleInputs, { stadeRoot: systemRoot } = {}) {
  const configFile = 'design-studio.project.json';
  const config = JSON.parse(await readFile(path.join(root, configFile), 'utf8'));
  const stadeRoot = path.resolve(root, systemRoot ?? process.env.STADE_ROOT ?? config.studioRoot);
  const require = createRequire(import.meta.url);
  const { build } = require(require.resolve('esbuild', { paths: [root, stadeRoot] }));
  const overviewModule = path.join(stadeRoot, 'studio/scenes/workspaces.mjs');
  const overviewStyles = path.join(stadeRoot, 'studio/scenes/workspaces.css');
  const commerceModule = path.join(stadeRoot, 'studio/scenes/editorial-commerce.mjs');
  const commerceStyles = path.join(stadeRoot, 'studio/scenes/editorial-commerce.css');
  const patternsRoot = path.join(stadeRoot, 'patterns');
  const { dataModule } = await import(pathToFileURL(path.join(stadeRoot, 'tools/bundle-data.mjs')).href);
  const projectTheme = JSON.parse(await readFile(path.join(root, config.package), 'utf8'));
  const themeCatalog = [projectTheme];
  const { PUBLIC_THEME_IDS } = await import(pathToFileURL(path.join(stadeRoot, 'tools/public-themes.mjs')).href);
  const additional = PUBLIC_THEME_IDS.filter(id => id !== projectTheme.id);
  themeCatalog.push(...await Promise.all(additional.map(async id =>
    JSON.parse(await readFile(path.join(stadeRoot, 'packages', id + '.json'), 'utf8')))));
  for (const theme of themeCatalog) {
    if (theme.brand) theme.brand.sources = [];
    theme.history = [];
  }
  const bundle = await build({
    absWorkingDir: root,
    entryPoints: [entry],
    bundle: true, write: false, format: 'iife', target: 'es2022',
    minify: true, legalComments: 'none', metafile: true,
    plugins: [{
      name: 'stade-templates',
      setup(resolver) {
        resolver.onResolve({ filter: /^@stade\/(overview|workspaces)$/ }, () => ({ path: overviewModule }));
        resolver.onResolve({ filter: /^@stade\/editorial-commerce$/ }, () => ({ path: commerceModule }));
        resolver.onResolve({ filter: /^@stade\/history$/ }, () => ({ path: path.join(stadeRoot, 'patterns/history.mjs') }));
        resolver.onResolve({ filter: /^@stade\/pattern-catalog$/ }, () => ({ path: path.join(stadeRoot, 'patterns/catalog.mjs') }));
        resolver.onResolve({ filter: /^@stade\/compositions$/ }, () => ({ path: path.join(patternsRoot, 'compositions.mjs') }));
        resolver.onResolve({ filter: /^@stade\/theme-picker$/ }, () => ({ path: path.join(patternsRoot, 'theme-picker.mjs') }));
        resolver.onResolve({ filter: /^@stade\/demo-theme$/ }, () => ({ path: path.join(stadeRoot, 'studio/demo-theme.mjs') }));
        resolver.onResolve({ filter: /^@stade\/scene-themes$/ }, () => ({ path: 'theme-catalog', namespace: 'stade-scene' }));
        resolver.onLoad({ filter: /^theme-catalog$/, namespace: 'stade-scene' }, () => ({ contents: dataModule(themeCatalog), loader: 'js' }));
        resolver.onResolve({ filter: /^(?:\.\.\/){1,2}core\/components\.mjs$/ }, ({ importer }) => {
          if (importer === overviewModule || importer === commerceModule || importer.startsWith(patternsRoot + path.sep)) return { path: path.join(root, config.library) };
        });
        resolver.onResolve({ filter: /^\.\.\/\.\.\/core\/engine\.mjs$/ }, ({ importer }) => {
          if (importer === commerceModule) return { path: path.join(root, 'design/runtime/engine.mjs') };
        });
        resolver.onResolve({ filter: /^\.\.\/core\/scene-fields\.mjs$/ }, ({ importer }) => {
          if (importer.startsWith(patternsRoot + path.sep)) return { path: path.join(root, 'design/runtime/scene-fields.mjs') };
        });
      },
    }],
  });
  const [themeCSS, mediaCSS, ...viewCSS] = await Promise.all([
    readFile(path.join(root, config.css), 'utf8'),
    readFile(path.join(root, 'src/media.css'), 'utf8'),
    readFile(overviewStyles, 'utf8'),
    readFile(commerceStyles, 'utf8'),
    readFile(path.join(stadeRoot, 'patterns/styles.css'), 'utf8'),
    readFile(path.join(root, 'src/preview.css'), 'utf8'),
    readFile(path.join(root, 'src/practice.css'), 'utf8'),
  ]);
  const script = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const projectInputs = Object.keys(bundle.metafile.inputs)
    .filter(file => !file.startsWith('../') && !path.isAbsolute(file) && file !== 'stade-scene:theme-catalog');
  const stamp = await buildStamp(root, [...projectInputs, configFile, ...styleInputs, 'src/preview.css', 'src/practice.css', 'src/media.css', config.package, config.css, 'package.json', 'tools/build.mjs', 'design/tools/offline-checks.mjs']);
  return { themeCSS, mediaCSS, viewCSS: [mediaCSS, ...viewCSS].join('\n'), script, stamp };
}

function assertOffline(html) {
  const issues = offlineIssues(html);
  if (issues.length) throw new Error(issues.join('\n'));
}

export async function buildHTML(root, options) {
  const [assets, template, appCSS, nativeTemplate, nativeCSS] = await Promise.all([
    compile(root, 'src/editor-entry.mjs', ['src/index.html', 'src/styles.css', 'src/native-app.html', 'src/native-app.css'], options),
    readFile(path.join(root, 'src/index.html'), 'utf8'),
    readFile(path.join(root, 'src/styles.css'), 'utf8'),
    readFile(path.join(root, 'src/native-app.html'), 'utf8'),
    readFile(path.join(root, 'src/native-app.css'), 'utf8'),
  ]);
  const nativeShell = nativeTemplate
    .replace('</head>', () => licenses + '\n</head>')
    .replace('<!-- native-styles -->', () => style('', ' id="stade-theme"') + '<!-- native-view-style -->' + style(nativeCSS))
    .replace('<!-- scene-registry -->', () => sceneRegistryMarkup())
    .replace('<script type="module" src="./native-app.mjs"></script>', '<!-- native-runtime -->');
  const encodedShell = JSON.stringify(nativeShell).replace(/</g, '\\u003c');
  const html = template
    .replace('</head>', () => assets.stamp + '\n' + licenses + '\n</head>')
    .replace('<link rel="stylesheet" href="./styles.css">', () => style(assets.themeCSS, ' id="stade-theme"') + style(assets.mediaCSS + '\n' + appCSS))
    .replace('<!-- app-preview-style -->', () => style(assets.viewCSS))
    .replace('<!-- native-export-shell -->', () => '<script type="application/json" id="native-app-shell">' + encodedShell + '</script>')
    .replace('<script type="module" src="./app.mjs"></script>', () => '<script id="scene-runtime">' + assets.script + '</script>');
  assertOffline(html);
  return html;
}

async function prepareNativeBuild(root, options) {
  const [assets, template, appCSS] = await Promise.all([
    compile(root, 'src/native-app.mjs', ['src/native-app.html', 'src/native-app.css'], options),
    readFile(path.join(root, 'src/native-app.html'), 'utf8'),
    readFile(path.join(root, 'src/native-app.css'), 'utf8'),
  ]);
  const shell = template
    .replace('</head>', () => assets.stamp + '\n' + licenses + '\n</head>')
    .replace('<!-- native-styles -->', () => style(assets.themeCSS, ' id="stade-theme"') + style(assets.viewCSS + '\n' + appCSS))
    .replace('<!-- scene-registry -->', () => sceneRegistryMarkup())
    .replace('<script type="module" src="./native-app.mjs"></script>', () => '<script>' + assets.script + '</script>');
  assertOffline(shell);
  return async (id, previous) => {
    const app = nativeApps[id];
    const manifest = previous === undefined
      ? {
        format: 'stade-native-app', version: 1, id, name: app.name,
        scene: JSON.parse(await readFile(path.join(root, 'scenes', sceneFilename(id)), 'utf8')),
      }
      : parseNativeApp(previous).manifest;
    if (manifest.id !== id) throw new Error('App-id stemmer ikke med ' + app.filename + '.');
    return shell.replace('<!-- native-title -->', app.name)
      .replace('<!-- native-package -->', () => nativeAppMarkup(manifest));
  };
}

export async function buildNativeHTML(root, previous, options) {
  return (await prepareNativeBuild(root, options))('oeverum', previous);
}

export async function buildOverviewHTML(root, { previous, ...options } = {}) {
  return (await prepareNativeBuild(root, options))('overblik', previous);
}

export async function buildSceneDemos(root, options) {
  const buildApp = await prepareNativeBuild(root, options);
  return Promise.all(Object.entries(nativeApps).filter(([, app]) => app.gallery).map(async ([id, app]) => ({
    template: app.template, name: app.name, filename: id + '.html', html: await buildApp(id),
  })));
}

async function existingFile(file) {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function writeNativeFile(file, html, previous) {
  const temporary = file + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temporary, html, { flag: 'wx' });
    if (previous !== await existingFile(file)) {
      throw new Error(path.basename(file) + ' er ændret under buildet. Kør npm run build igen.');
    }
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const apps = await Promise.all(Object.entries(nativeApps).map(async ([id, { filename }]) => {
    const file = path.join(root, filename);
    return { id, file, previous: await existingFile(file) };
  }));
  const [editor, buildApp] = await Promise.all([buildHTML(root), prepareNativeBuild(root)]);
  const pages = await Promise.all(apps.map(async app => ({ ...app, html: await buildApp(app.id, app.previous) })));
  for (const { file, html, previous } of pages) await writeNativeFile(file, html, previous);
  await writeFile(path.join(root, 'index.html'), editor);
  console.log('Stade Scene, ' + Object.values(nativeApps).map(app => app.name).join(', ') + ' bygget.');
}
