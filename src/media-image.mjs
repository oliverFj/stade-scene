import { createIcon } from '../design/runtime/components.mjs';
import { mediaURL } from './scene-media.mjs';

/** Retain the image node during unrelated property changes. */
export function mountMediaImage(document, { placeholder = 'Intet billede valgt' } = {}) {
  const element = document.createElement('div');
  element.className = 'scene-media-image';
  const empty = document.createElement('div');
  empty.className = 'scene-image-placeholder';
  const icon = createIcon('photo', { document, size: 'large' });
  const label = document.createElement('span');
  label.textContent = placeholder;
  empty.append(icon, label);
  element.append(empty);
  let current, description;
  return {
    element,
    update(image, alt = image?.name ?? '') {
      if (current === image && description === alt) return;
      current = image;
      description = alt;
      if (!image) { element.replaceChildren(empty); return; }
      const img = document.createElement('img');
      img.alt = alt;
      img.addEventListener('error', () => {
        if (img.parentNode === element) element.replaceChildren(empty);
      }, { once: true });
      img.src = mediaURL(image);
      element.replaceChildren(img);
    },
  };
}
