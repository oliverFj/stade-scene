import { mountEditorScene } from '@stade/workspaces';
import { editorPattern } from './demo-patterns.mjs';
import { mountPatternRegions } from './pattern-region.mjs';

/** Keep the workspace, tree and inspector under one controller. */
export function mountEditorView({ document, theme, state, announce, idPrefix = 'scene-editor' }) {
  return mountPatternRegions(editorPattern.parts, { document }, publish => {
    const app = mountEditorScene(theme, { document, state, announce, idPrefix });
    publish({
      'editor-intro': app.parts.intro,
      'editor-workbench': app.parts.workbench,
    });
    return app;
  });
}
