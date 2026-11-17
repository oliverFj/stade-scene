import { mountThemePicker } from '@stade/theme-picker';
import themeCatalog from '@stade/scene-themes';
import { generateCSS } from '../design/runtime/engine.mjs';
import { resolveThemeMode, themeModeOptions } from '../design/runtime/theme-modes.mjs';

const [themePackage] = themeCatalog;
const themes = new Map(themeCatalog.map(theme => [theme.id, theme]));
const optionsFor = theme => themeModeOptions(theme).map(({ value, label }) => [value, label]);
export const defaultSceneTheme = () => resolveThemeMode(themePackage, themePackage.defaultMode);

export function applySceneTheme(style, { css, id, mode }) {
  style.textContent = css;
  style.dataset.theme = id;
  style.dataset.mode = mode ?? '';
}

export function createSceneTheme(window, { key, embedded = false, onChange }) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let saved;
  if (key) try { saved = JSON.parse(window.localStorage.getItem(key)); } catch { /* Storage is optional. */ }
  let source = embedded ? null : themes.get(saved?.id) ?? themePackage;
  const chooseMode = (theme, mode) => optionsFor(theme).some(([id]) => id === mode) ? mode : theme.defaultMode;
  let mode = source ? chooseMode(source, saved?.mode) : undefined;
  let inherited, value;
  const pickers = new Set();
  const appearance = (theme, mode) => ({ theme, css: generateCSS(theme), id: theme.id, mode });

  function apply() {
    const selected = source ?? themePackage;
    const color = source ? mode : selected.defaultMode;
    value = !source && inherited
      ? inherited
      : appearance(resolveThemeMode(selected, color, media.matches ? 'dark' : 'light'), color);
    onChange(value);
    for (const picker of pickers) picker.refresh();
  }

  const preferences = {
    themeOptions: [...(embedded ? [['', 'Følg Stade']] : []), ...[...themes.values()].map(theme => [theme.id, theme.name])],
    get id() { return source?.id ?? ''; },
    get mode() { return mode; },
    modes: () => source ? optionsFor(source) : [],
    set(id, requestedMode) {
      const next = embedded && id === '' ? null : themes.get(id);
      if (next === undefined) return;
      const nextMode = next ? chooseMode(next, requestedMode) : undefined;
      if (next === source && nextMode === mode) return;
      source = next;
      mode = nextMode;
      apply();
      if (key) try { window.localStorage.setItem(key, JSON.stringify({ id, mode })); } catch { /* Storage is optional. */ }
    },
  };
  const followSystem = () => { if (mode === 'system') apply(); };
  apply();
  media.addEventListener('change', followSystem);
  return {
    get value() { return value; },
    inheritTheme(theme, mode) {
      inherited = appearance(theme, mode);
      if (!source) apply();
    },
    mount(host, { idPrefix = host.id, ...options } = {}) {
      const picker = mountThemePicker(value.theme, { document: host.ownerDocument, preferences, idPrefix, ...options });
      host.append(picker.element);
      pickers.add(picker);
      return { destroy() {
        picker.destroy();
        pickers.delete(picker);
        picker.element.remove();
      } };
    },
    destroy() {
      media.removeEventListener('change', followSystem);
      for (const picker of pickers) picker.destroy();
      pickers.clear();
    },
  };
}

export function mountSceneTheme(host, { key, onChange, ...options }) {
  const theme = createSceneTheme(host.ownerDocument.defaultView, { key, onChange });
  theme.mount(host, options);
  return theme;
}
