import { canMoveTo, customBlocks, entriesOf, isContainer, labelFor } from './scene-model.mjs';
import { hasArticleCard, isArticleList } from './article-card.mjs';

export function createOutline(host, { select, move }) {
  let root;
  let dragging;
  let highlighted;
  const buttons = new Map();
  const document = host.ownerDocument;

  function clearDrop() {
    if (highlighted) delete highlighted.dataset.drop;
    highlighted = null;
  }

  function targetFor(row, event) {
    const source = entriesOf(root).find(entry => entry.block.id === dragging)?.block;
    const target = entriesOf(root).find(entry => entry.block.id === row.dataset.blockId);
    if (!source || !target || source === target.block) return null;
    const rect = row.getBoundingClientRect();
    const offset = (event.clientY - rect.top) / rect.height;
    const inside = !target.parent || isArticleList(target.parent)
      || ((isContainer(target.block) || hasArticleCard(target.block)) && offset > .26 && offset < .74);
    const destination = inside ? hasArticleCard(target.block) ? target.block.children[0] : target.block : target.parent;
    const edge = inside ? 'inside' : offset < .5 ? 'before' : 'after';
    if (!canMoveTo(source, destination)) return null;
    const index = inside ? destination.children.length : target.index + Number(edge === 'after');
    return { destination, index, edge };
  }

  function render(layout, selectedId) {
    root = layout;
    buttons.clear();
    function list(blocks, parent) {
      const ul = document.createElement('ul');
      for (const block of blocks) {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'scene-block';
        button.dataset.blockId = block.id;
        button.dataset.kind = isContainer(block) ? 'container' : Object.hasOwn(customBlocks, block.type) ? 'custom' : 'part';
        button.draggable = block !== root && !isArticleList(parent);
        button.setAttribute('aria-pressed', String(block.id === selectedId));
        const text = document.createElement('span');
        text.textContent = labelFor(block);
        button.append(text);
        li.append(button);
        if (block.children?.length) li.append(list(block.children, block));
        buttons.set(block.id, button);
        ul.append(li);
      }
      return ul;
    }
    host.replaceChildren(list([layout]));
  }

  function selectRow(id) {
    for (const [blockId, button] of buttons) button.setAttribute('aria-pressed', String(blockId === id));
  }

  host.addEventListener('click', event => {
    const row = event.target.closest('.scene-block');
    if (row) select(row.dataset.blockId);
  });
  host.addEventListener('dragstart', event => {
    const row = event.target.closest('.scene-block');
    if (!row?.draggable) return;
    dragging = row.dataset.blockId;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', dragging);
  });
  host.addEventListener('dragover', event => {
    const row = event.target.closest('.scene-block');
    clearDrop();
    const target = row && targetFor(row, event);
    if (!target) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    row.dataset.drop = target.edge;
    highlighted = row;
  });
  host.addEventListener('dragleave', event => {
    if (!host.contains(event.relatedTarget)) clearDrop();
  });
  host.addEventListener('drop', event => {
    const row = event.target.closest('.scene-block');
    const target = row && targetFor(row, event);
    if (target) {
      event.preventDefault();
      move(dragging, target.destination.id, target.index);
    }
    dragging = null;
    clearDrop();
  });
  host.addEventListener('dragend', () => {
    dragging = null;
    clearDrop();
  });

  return { render, selectRow, focus: id => buttons.get(id)?.focus({ preventScroll: true }) };
}
