import { mountFileUpload } from '../design/runtime/components.mjs';
import { addSceneImage, imageAccept, maxImageBytes, mediaURL, readSceneImage } from './scene-media.mjs';
import { mountMediaImage } from './media-image.mjs';

export function mountProjectMedia(dialog, { component, getScene, onImport, status }) {
  const document = dialog.ownerDocument;
  const target = dialog.querySelector('#media-target');
  const results = dialog.querySelector('#media-results');
  const feedback = dialog.querySelector('#media-feedback');
  const importButton = component('button', { text: 'Importér billede', variant: 'secondary', attrs: { id: 'media-import' } });
  dialog.querySelector('#media-import-host').append(importButton);
  const uploader = component('file-upload', {
    label: 'Importér billede', accept: imageAccept, maxSize: maxImageBytes, maxFiles: 1,
  });
  uploader.hidden = true;
  document.body.append(uploader);
  const input = uploader.querySelector('input');
  let session, request;

  function feedbackFor(context, message, error = false) {
    if (getScene() !== context.scene) return;
    if (context.session && session === context.session && dialog.open) {
      feedback.textContent = message;
      feedback.dataset.error = String(error);
    } else if (error && !context.session) status(message, true);
  }

  function render() {
    const media = session.scene.media ?? [];
    if (!media.length) {
      const empty = document.createElement('p');
      empty.className = 'scene-hint';
      empty.textContent = 'Projektet har endnu ingen billeder.';
      results.replaceChildren(empty);
      return;
    }
    results.replaceChildren(...media.map(image => {
      const preview = mountMediaImage(document);
      preview.update(image, '');
      const label = document.createElement('span');
      label.textContent = image.name;
      const row = session.choose
        ? component('button', { text: image.name, variant: 'tertiary', attrs: { 'data-media-id': image.id } })
        : document.createElement('div');
      row.classList.add('scene-media-item');
      row.replaceChildren(preview.element, label);
      if (image.id === session.selectedId && session.choose) row.setAttribute('aria-current', 'true');
      if (session.choose) row.addEventListener('click', () => activate(image.id));
      return row;
    }));
  }

  function activate(id) {
    if (!session || session.scene !== getScene()) return;
    session.choose(id);
    dialog.close();
  }

  function importImage(choose, fromDialog = false) {
    if (request) return;
    request = { scene: getScene(), choose, session: fromDialog ? session : undefined };
    if (fromDialog) feedback.textContent = '';
    input.value = '';
    try { input.click(); }
    catch (error) {
      const failed = request;
      request = undefined;
      feedbackFor(failed, error.message, true);
    }
  }

  const upload = mountFileUpload(uploader, {
    announce: false,
    onInvalid(errors) {
      const failed = request;
      request = undefined;
      if (failed) feedbackFor(failed, errors.map(error => error.message).join(' '), true);
    },
    async onChange([file], { source }) {
      if (source !== 'input' || !request || !file) return;
      const current = request;
      try {
        const image = await readSceneImage(file);
        const preview = document.createElement('img');
        preview.src = mediaURL(image);
        try { await preview.decode(); } catch { throw new Error('Billedet kunne ikke åbnes.'); }
        if (getScene() !== current.scene) return;
        const stored = addSceneImage(current.scene, image);
        if (!current.session || (session === current.session && dialog.open)) current.choose?.(stored.id);
        onImport();
        if (current.session && session === current.session && dialog.open) {
          render();
          feedbackFor(current, stored.name + ' er klar i Medier.');
        }
      } catch (error) { feedbackFor(current, error.message, true); }
      finally {
        if (request === current) request = undefined;
        upload.clear();
      }
    },
  });
  input.addEventListener('cancel', () => { request = undefined; });
  importButton.addEventListener('click', () => importImage(session?.choose ? activate : undefined, true));
  dialog.addEventListener('close', () => { session?.trigger.focus({ preventScroll: true }); session = undefined; });

  return {
    importImage,
    show(trigger, { label = '', selectedId, choose } = {}) {
      session = { trigger, scene: getScene(), selectedId, choose };
      target.textContent = label;
      target.hidden = !label;
      feedback.textContent = '';
      render();
      dialog.showModal();
      (results.querySelector('[aria-current="true"]') ?? importButton).focus({ preventScroll: true });
    },
  };
}
