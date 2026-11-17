import { mountOverviewScene } from '@stade/overview';
import { mountPhaseBreakdown } from './phase-breakdown.mjs';
import { readVisualValue } from './visual-fields.mjs';
import { mountMediaImage } from './media-image.mjs';
import { findMedia } from './scene-media.mjs';

function mountIntroParts(element, scene) {
  const identity = element.firstElementChild;
  const [eyebrow, title, description] = identity.children;
  const logo = mountMediaImage(element.ownerDocument, { placeholder: 'Intet logo valgt' });
  const brand = logo.element;
  brand.classList.add('scene-overview-brand');
  brand.dataset.scenePart = 'brand';
  title.dataset.scenePart = 'title';
  description.dataset.scenePart = 'description';
  eyebrow.before(brand);

  return block => {
    const mode = readVisualValue(block, 'logoMode');
    brand.hidden = mode === 'hidden';
    if (!brand.hidden) logo.update(findMedia(scene, mode === 'app' ? scene.appLogo : readVisualValue(block, 'imageId')), '');
    brand.style.setProperty('--scene-brand-scale', String(readVisualValue(block, 'brandSize') / 100));
    title.textContent = readVisualValue(block, 'title');
    description.textContent = readVisualValue(block, 'description');
    description.hidden = !readVisualValue(block, 'showDescription');
  };
}

/** Adapts Stade's live sections into movable blocks without recreating their controllers. */
export function mountOverviewView({ document, theme, scene, component, announce, onUpdate }) {
  const app = mountOverviewScene(theme, {
    document,
    state: scene.preview ??= {},
    idPrefix: 'scene-overview',
    announce(message) {
      onUpdate();
      announce(message);
    },
  });
  const blocks = Object.fromEntries(Object.entries({
    'overview-intro': '.case-overview__header',
    'overview-metrics': '.case-overview__metrics',
    'overview-list': '.case-overview__list',
    'overview-detail': '.case-overview__detail',
  }).map(([type, selector]) => [type, { element: app.element.querySelector(selector) }]));
  const intro = blocks['overview-intro'];
  intro.update = mountIntroParts(intro.element, scene);
  const statusFilter = blocks['overview-list'].element.querySelector('select');
  statusFilter.addEventListener('change', onUpdate);
  return {
    element: app.element,
    blocks,
    mountBlock(block) {
      if (block.type === 'phase-breakdown') {
        return mountPhaseBreakdown({ document, component, statusFilter, state: app.state });
      }
    },
    destroy() {
      statusFilter.removeEventListener('change', onUpdate);
      app.destroy();
    },
  };
}
