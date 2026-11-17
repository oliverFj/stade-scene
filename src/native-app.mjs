import { createActNavigation } from './act-navigation.mjs';
import { validateNativeAppManifest } from './native-package.mjs';
import { decodeSceneDocument } from './scene-file.mjs';
import { mountSceneView } from './scene-view.mjs';
import { applySceneTheme, createSceneTheme } from './scene-theme.mjs';
import { receiveDemoTheme } from '@stade/demo-theme';

function start() {
  const source = document.getElementById('stade-native-app');
  const app = validateNativeAppManifest(JSON.parse(source.textContent));
  const { scene } = decodeSceneDocument(app.scene);
  let view;
  const embedded = window.parent !== window && new URLSearchParams(location.search).get('embedded') === '1';
  const themeControls = createSceneTheme(window, {
    embedded, key: embedded ? undefined : 'stade-scene.app-theme.' + app.id,
    onChange(value) {
      applySceneTheme(document.getElementById('stade-theme'), value);
      view?.setTheme(value.theme);
    },
  });
  const stopFollowing = embedded ? receiveDemoTheme(window, themeControls.inheritTheme) : undefined;
  const status = document.getElementById('native-status');
  const navigation = createActNavigation({ document, getScene: () => scene, getView: () => view });
  document.title = app.name;
  document.querySelector('main').setAttribute('aria-label', app.name);
  view = mountSceneView({
    document, theme: themeControls.value.theme, themeControls, scene, announce: message => { status.textContent = message; },
    onActionTarget: navigation.openTarget, onBackAct: navigation.back, onPanelClose: navigation.panelClosed,
  });
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    view.destroy();
    stopFollowing?.();
    themeControls.destroy();
  });
}

try {
  start();
} catch (error) {
  const alert = document.getElementById('native-error');
  alert.textContent = 'Appen kunne ikke åbnes. ' + error.message;
  alert.hidden = false;
}
