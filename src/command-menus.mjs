import { mountMenuControls } from '../design/runtime/components.mjs';

export function mountCommandMenus(host, component, menus) {
  const document = host.ownerDocument;
  const bar = component('menubar', { attrs: { 'aria-label': 'Scene-menu' }, slots: { root: [] } });
  const commands = new Map();
  for (const [id, label, entries] of menus) {
    const group = document.createElement('div');
    group.className = 'scene-menu-group';
    group.setAttribute('role', 'none');
    const trigger = document.createElement('button');
    trigger.className = 'ds-menubar__item';
    trigger.type = 'button';
    trigger.textContent = label;
    trigger.id = 'menu-' + id;
    trigger.setAttribute('role', 'menuitem');
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-controls', 'commands-' + id);
    const panel = component('menu', { attrs: { id: 'commands-' + id, 'aria-label': label, hidden: true }, slots: { root: [] } });
    panel.classList.add('scene-menu-panel');
    for (const [action, name, run] of entries) {
      const item = component('menu-item', { slots: { label: name, symbol: '', shortcut: '', indicator: '' }, attrs: { id: action } });
      commands.set(action, { item, trigger, run });
      panel.append(item);
    }
    group.append(trigger, panel);
    bar.append(group);
  }
  host.append(bar);
  mountMenuControls(host, { onAction(item) {
    const command = commands.get(item.id);
    command?.run(command.trigger);
  } });
  return id => commands.get(id).item;
}
