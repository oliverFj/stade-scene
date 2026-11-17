import { mountComposition } from '@stade/compositions';
import { createComponentFactory, mountDrawer } from '../design/runtime/components.mjs';
import { resolveSceneFields } from '../design/runtime/scene-fields.mjs';
import { mountOverviewView } from './overview-view.mjs';
import { mountPractice } from './practice-view.mjs';
import { mountBlogView } from './blog-view.mjs';
import { mountShopView } from './shop-view.mjs';
import { mountEditorView } from './editor-view.mjs';
import { mountMediaImage } from './media-image.mjs';
import { findMedia } from './scene-media.mjs';
import { entriesOf, isContainer } from './scene-model.mjs';
import { actionDefinitions, actionTargetAct, findActionBlock, recordTarget, resolveAction } from './scene-actions.mjs';
import { scenePatternByBlock } from './scene-patterns.mjs';
import { sceneBlockKinds, sharedSceneBlocks } from './visual-fields.mjs';

const mountTemplate = { overview: mountOverviewView, practice: mountPractice };
const mountPattern = { blog: mountBlogView, shop: mountShopView, editor: mountEditorView };

function createLibraryNode(component, type, id, values) {
  const definition = sharedSceneBlocks[type];
  const slots = Object.fromEntries(Object.entries(definition.scene.fields)
    .filter(([, field]) => field.slot)
    .map(([key, field]) => [field.slot, values[key]]));
  const node = component(type, { variant: values.variant, slots, idPrefix: 'scene-' + id });
  for (const part of Object.keys(definition.scene.parts ?? {})) {
    const { selector } = definition.parts[part];
    const target = node.matches(selector) ? node : node.querySelector(selector);
    if (target) target.dataset.scenePart = part;
  }
  if (type === 'card') node.querySelector(definition.parts.footer.selector)?.remove();
  return node;
}

function mountLibraryComponent({ document, component }, { id, type }) {
  const definition = sharedSceneBlocks[type];
  const element = document.createElement('div');
  let previous;
  return {
    element,
    update(props) {
      const values = resolveSceneFields(definition.scene, props);
      if (previous && Object.keys(values).every(key => values[key] === previous[key])) return;
      previous = values;
      element.replaceChildren(createLibraryNode(component, type, id, values));
    },
  };
}

function mountLibraryPattern({ theme, document, announce }, { id, type, props }) {
  const { scene } = sharedSceneBlocks[type];
  let previous = resolveSceneFields(scene, props);
  const pattern = mountComposition(theme, type, {
    document, announce, idPrefix: 'scene-' + id,
    configuration: props,
  });
  pattern.element.dataset.scenePattern = type;
  return {
    element: pattern.element,
    update(props) {
      const next = resolveSceneFields(scene, props);
      const changes = Object.entries(next).filter(([key, value]) => previous[key] !== value);
      if (changes.length) pattern.setConfiguration(Object.fromEntries(changes));
      previous = next;
    },
    destroy: () => pattern.destroy(),
  };
}

function mountActTrigger({ component, scene, onAction }, { id }) {
  const element = component('button', { variant: 'tertiary' });
  element.dataset.sceneOpenAct = '';
  element.dataset.sceneAction = 'open';
  element.dataset.scenePart = 'label';
  if (id === 'practice-open-act') element.dataset.practiceOpenAct = '';
  const { scene: definition } = sharedSceneBlocks['act-trigger'];
  const open = () => onAction('open', element);
  element.addEventListener('click', open);
  return {
    element,
    update(props, block) {
      const { label } = resolveSceneFields(definition, props);
      if (element.textContent !== label) element.textContent = label;
      const target = actionTargetAct(scene.acts, resolveAction(scene.acts, block, 'open'));
      if (target) element.removeAttribute('aria-disabled');
      else element.setAttribute('aria-disabled', 'true');
      if (target?.mode === 'panel') element.setAttribute('aria-haspopup', 'dialog');
      else element.removeAttribute('aria-haspopup');
    },
    destroy() { element.removeEventListener('click', open); },
  };
}

function mountThemeControl({ document, themeControls }, { id }) {
  const element = document.createElement('div');
  const picker = themeControls.mount(element, { idPrefix: 'scene-' + id });
  return { element, destroy: picker.destroy };
}

function mountImageBlock({ document, scene }) {
  const image = mountMediaImage(document);
  return {
    element: image.element,
    update(props) {
      const media = findMedia(scene, props?.imageId);
      image.update(media, props?.imageAlt ?? media?.name ?? '');
    },
  };
}

const mountBlock = { component: mountLibraryComponent, pattern: mountLibraryPattern, navigation: mountActTrigger, appearance: mountThemeControl, media: mountImageBlock };

export function mountSceneView({ document, theme, themeControls, scene, announce, onActionTarget, onBackAct, onPanelClose }) {
  const rendered = new Map();
  const patterns = new Map();
  let surface = { layout: scene.acts?.[0].layout ?? scene.layout, nodes: new Map() };
  let panel;
  const context = { document, theme, themeControls, announce, scene, onAction: dispatchAction, onBackAct, renderArticleCard, component: createComponentFactory(theme, { document }) };
  const app = Object.hasOwn(mountPattern, scene.template) ? getPattern(scene.template)
    : mountTemplate[scene.template]?.({ ...context, state: {}, onUpdate: () => updateRendered(surface.layout) })
      ?? { element: document.createElement('div'), blocks: {} };
  if (!app.element.className) app.element.className = 'scene-blank-app';
  const root = document.querySelector('main');
  root.replaceChildren(app.element);

  function dispatchAction(actionId, trigger, record) {
    const sourceId = trigger?.dataset.sceneActionSource ?? trigger?.closest('[data-scene-block]')?.dataset.sceneBlock;
    const source = sourceId && findActionBlock(scene.acts, sourceId);
    const target = source && resolveAction(scene.acts, source.block, actionId);
    if (!target) return false;
    const expected = actionDefinitions(source.block.type)[actionId]?.recordCollection;
    if (expected) {
      const receiver = record?.collection === expected && recordTarget(scene.acts, target, expected);
      if (!receiver || !liveSource(receiver.type).selectRecord?.(record.id)) return false;
      return onActionTarget?.({ kind: 'block', id: receiver.id }, trigger) ?? false;
    }
    return onActionTarget?.(target, trigger) ?? false;
  }

  function getPattern(id) {
    if (!patterns.has(id)) patterns.set(id, mountPattern[id]({ ...context, state: {} }));
    return patterns.get(id);
  }

  function liveSource(type) {
    const id = scenePatternByBlock[type];
    return id ? getPattern(id) : app;
  }

  function renderArticleCard(listId, card, article, controls) {
    function renderBlock(block) {
      const item = document.createElement('div');
      item.className = 'view-item';
      item.dataset.sceneBlock = block.id;
      if (isContainer(block)) {
        const group = document.createElement('div');
        group.className = 'view-group';
        group.append(...block.children.map(renderBlock));
        item.append(group);
      } else {
        const values = resolveSceneFields(sharedSceneBlocks[block.type].scene, block.props);
        for (const [field, key] of Object.entries(block.bindings ?? {})) values[field] = article[key] ?? '';
        if (block.type === 'image') {
          if (block.bindings?.imageId) {
            const alt = block.bindings.imageAlt || values.imageAlt ? values.imageAlt : undefined;
            item.append(controls.image(alt));
          } else {
            const image = mountImageBlock(context);
            image.update(values);
            item.append(image.element);
          }
        } else {
          const node = createLibraryNode(context.component, block.type, block.id + '-' + article.id, values);
          if (block.type === 'button') controls.connectButton(node, listId, block.id);
          item.append(node);
        }
      }
      paintBlock(item, block);
      return item;
    }
    const element = renderBlock(card);
    element.classList.add('view-article-card');
    return element;
  }

  function elementFor(block, nodes, inPanel = false) {
    const element = document.createElement('div');
    element.className = 'view-item';
    element.dataset.sceneBlock = block.id;
    nodes.set(block.id, element);
    if (isContainer(block)) {
      const group = document.createElement('div');
      group.className = 'view-group';
      group.append(...block.children.map(child => elementFor(child, nodes, inPanel)));
      element.append(group);
    } else {
      const source = liveSource(block.type);
      const region = Object.hasOwn(source.blocks, block.type) ? source.blocks[block.type] : undefined;
      let host = element;
      if (scenePatternByBlock[block.type] && (source !== app || inPanel)) {
        host = document.createElement('div');
        host.classList.add(...source.element.classList, 'view-pattern-part');
        element.append(host);
      }
      if (region) {
        host.append(region.element);
        return element;
      }
      let instance = rendered.get(block.id);
      if (instance && instance.type !== block.type) {
        instance.destroy?.();
        instance = undefined;
      }
      if (!instance) {
        instance = source.mountBlock?.(block) ?? mountBlock[sceneBlockKinds[block.type]](context, block);
        instance.type = block.type;
        rendered.set(block.id, instance);
      }
      host.append(instance.element);
    }
    return element;
  }

  function updateRendered(layout) {
    for (const { block } of entriesOf(layout)) rendered.get(block.id)?.update?.(block.props, block);
  }

  function paintBlock(element, block) {
    element.style.setProperty('--view-width', (block.width ?? 100) + '%');
    element.dataset.sizing = block.sizing?.mode ?? 'fit';
    if (block.sizing?.basis !== undefined) element.style.setProperty('--view-basis', block.sizing.basis + 'px');
    else element.style.removeProperty('--view-basis');
    if (!isContainer(block)) return;
    const group = element.firstElementChild;
    const { flow, gap, align, columns } = block.layout;
    group.dataset.flow = flow;
    group.dataset.align = align;
    group.style.setProperty('--view-gap', gap + 'px');
    group.style.setProperty('--view-columns', String(columns));
    group.style.setProperty('--view-tracks', block.children.map(child => 'minmax(0,' + (child.width ?? 100) + 'fr)').join(' '));
  }

  function updateSurface({ layout, nodes } = surface) {
    for (const { block } of entriesOf(layout)) {
      const element = nodes.get(block.id);
      if (!element) continue;
      paintBlock(element, block);
      liveSource(block.type).blocks[block.type]?.update?.(block);
    }
    updateRendered(layout);
  }

  function retainLiveBlocks(nextLayout) {
    const layouts = [nextLayout, ...(scene.acts ?? []).map(act => act.layout)];
    const nextTypes = new Map(layouts.flatMap(layout => entriesOf(layout).map(({ block }) => [block.id, block.type])));
    for (const [id, instance] of rendered) {
      if (nextTypes.get(id) === instance.type) continue;
      instance.destroy?.();
      rendered.delete(id);
    }
  }

  const makeSurface = (layout) => ({ layout, nodes: new Map() });

  function render(layout, { back = false, name = '' } = {}) {
    retainLiveBlocks(layout);
    surface = makeSurface(layout);
    const element = elementFor(layout, surface.nodes);
    if (back) {
      const heading = document.createElement('header');
      heading.className = 'scene-act-heading';
      const button = context.component('button', { variant: 'tertiary', text: 'Tilbage', attrs: { 'data-act-back': '' } });
      button.addEventListener('click', () => onBackAct?.());
      heading.append(button);
      if (name) heading.append(context.component('heading', { variant: 'subtitle', text: name }));
      app.element.replaceChildren(heading, element);
    } else app.element.replaceChildren(element);
    updateSurface();
  }

  function closePanel() {
    panel?.controls.close();
  }

  function showPanel(act, { getTrigger } = {}) {
    closePanel();
    const dialog = context.component('drawer', {
      slots: { title: act.name, body: '', footer: '' },
      attrs: { id: 'scene-act-panel', 'data-scene-act-panel': '' },
      describeBody: false,
    });
    const body = dialog.querySelector('.ds-drawer__body');
    const title = dialog.querySelector('.ds-drawer__title');
    const heading = document.createElement('header');
    heading.className = 'scene-act-heading';
    const close = context.component('button', { variant: 'tertiary', text: 'Luk', attrs: { 'data-act-close': '', 'data-ds-close': '' } });
    title.before(heading);
    heading.append(title, close);
    dialog.querySelector('.ds-drawer__footer').remove();
    const view = makeSurface(act.layout);
    body.append(elementFor(act.layout, view.nodes, true));
    root.append(dialog);
    updateSurface(view);
    const controls = mountDrawer(dialog, {
      onOpenChange(open) {
        if (open) return;
        panel = undefined;
        controls.destroy();
        dialog.remove();
        getTrigger?.()?.focus({ preventScroll: true });
        onPanelClose?.(act.id);
      },
    });
    getTrigger?.()?.focus({ preventScroll: true });
    panel = { controls, view };
    controls.open();
  }

  function findElement(id, { layout, nodes } = surface) {
    return nodes.get(id) ?? nodes.get(layout.id)?.querySelector('[data-scene-block="' + id + '"]');
  }

  function focusBlock(id) {
    const block = findElement(id, panel?.view ?? surface);
    if (!block) return;
    const element = block.querySelector('[data-scene-target-focus]') ?? block;
    if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
    element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    element.focus({ preventScroll: true });
  }

  function reveal(blockId) {
    const element = findElement(blockId);
    const bounds = element?.getBoundingClientRect();
    if (bounds && (bounds.bottom < 28 || bounds.top > document.defaultView.innerHeight - 28)) {
      document.defaultView.scrollBy(0, bounds.top - 24);
    }
  }

  render(surface.layout);
  return {
    render, updateLayout: () => updateSurface(), reveal, focusBlock, showPanel, closePanel,
    updateData() { for (const pattern of patterns.values()) pattern.updateData?.(); },
    setTheme(theme) {
      context.theme = theme;
      context.component = createComponentFactory(theme, { document });
      if (!patterns.has(scene.template)) app.setTheme?.(theme);
      for (const pattern of patterns.values()) pattern.setTheme?.(theme);
    },
    get panelOpen() { return Boolean(panel); },
    element: findElement,
    destroy() {
      closePanel();
      for (const instance of rendered.values()) instance.destroy?.();
      if (!patterns.has(scene.template)) app.destroy?.();
      for (const pattern of patterns.values()) pattern.destroy?.();
    },
  };
}
