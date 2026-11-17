import { actionTargetAct } from './scene-actions.mjs';

export function createActNavigation({ document, getScene, getView, onChange = () => {} }) {
  const history = [];
  const initial = () => getScene().acts[0];
  const find = id => getScene().acts.find(act => act.id === id);
  let sideId = initial().id;
  let panelId;

  function renderSide(act) {
    sideId = act.id;
    getView().render(act.layout, { back: history.length > 0, name: act.name });
    document.defaultView.scrollTo(0, 0);
  }

  function triggerLookup(trigger) {
    if (!trigger) return undefined;
    const blockId = trigger.closest('[data-scene-block]')?.dataset.sceneBlock;
    const actionId = trigger.dataset.sceneAction;
    const item = trigger.dataset.sceneActionItem;
    const selector = '[data-scene-block="' + blockId + '"] [data-scene-action="' + actionId + '"]'
      + (item ? '[data-scene-action-item="' + item + '"]' : '');
    return () => trigger.isConnected ? trigger : blockId && actionId
      ? document.querySelector(selector)
      : undefined;
  }

  function open(id, trigger) {
    const act = find(id);
    if (!act) return false;
    if (id === panelId) return true;
    const view = getView();
    const getTrigger = triggerLookup(trigger);
    if (view.panelOpen) view.closePanel();
    if (act.mode === 'panel') {
      panelId = id;
      onChange();
      view.showPanel(act, { getTrigger });
      return true;
    }
    if (id !== sideId) {
      if (act === initial()) history.length = 0;
      else history.push({ id: sideId, getTrigger });
      renderSide(act);
      if (trigger) document.querySelector('[data-act-back]')?.focus({ preventScroll: true });
    }
    onChange();
    return true;
  }

  return {
    get activeId() { return panelId ?? sideId; },
    reset() {
      getView().closePanel();
      panelId = undefined;
      history.length = 0;
      renderSide(initial());
      onChange();
    },
    open,
    openTarget(target, trigger) {
      const act = actionTargetAct(getScene().acts, target);
      if (!act || !open(act.id, trigger)) return false;
      if (target.kind === 'block') getView().focusBlock(target.id);
      return true;
    },
    back() {
      if (getView().panelOpen) { getView().closePanel(); return true; }
      const previous = history.pop();
      const act = find(previous?.id);
      if (!act) return false;
      renderSide(act);
      previous.getTrigger?.()?.focus({ preventScroll: true });
      onChange();
      return true;
    },
    panelClosed() {
      if (getView().panelOpen) return;
      panelId = undefined;
      onChange();
    },
  };
}
