import { readVisualValue, visualFields, visualParts } from './visual-fields.mjs';

export function mountQuickEdit(form, { onChange, onReflow }) {
  const get = id => form.querySelector('#' + id);
  const label = get('quick-label');
  const sizeTools = get('quick-size');
  const smaller = get('quick-smaller');
  const larger = get('quick-larger');
  const value = get('quick-value');
  const actions = get('quick-actions');
  const editText = get('quick-text');
  const visibility = get('quick-hide');
  const inputTools = get('quick-input');
  const input = get('quick-draft');
  let block;
  let part;
  let typing = false;

  function refresh() {
    if (!part) return;
    const { sizeKey, textKey, visibleKey } = part;
    label.textContent = part.label;
    sizeTools.hidden = !sizeKey;
    actions.hidden = !textKey || typing;
    inputTools.hidden = !typing;
    if (sizeKey) {
      const field = visualFields[block.type][sizeKey];
      const size = readVisualValue(block, sizeKey);
      value.textContent = size + ' %';
      smaller.disabled = size <= field.min;
      larger.disabled = size >= field.max;
    }
    const shown = !visibleKey || readVisualValue(block, visibleKey);
    visibility.hidden = !visibleKey;
    visibility.textContent = shown ? 'Skjul tekst' : 'Vis tekst';
    editText.disabled = !shown;
  }

  function step(direction) {
    if (!part?.sizeKey) return;
    const key = part.sizeKey;
    const { min, max, step } = visualFields[block.type][key];
    const current = readVisualValue(block, key);
    onChange(block, key, Math.max(min, Math.min(max, current + step * direction)));
    refresh();
  }

  function beginText() {
    if (!part?.textKey || editText.disabled) return;
    input.value = readVisualValue(block, part.textKey);
    input.maxLength = visualFields[block.type][part.textKey].maxLength;
    input.setAttribute('aria-label', part.label);
    typing = true;
    refresh();
    input.focus({ preventScroll: true });
    input.select();
    onReflow();
  }

  function finishText(commit = true, focus = false) {
    if (!typing) return;
    typing = false;
    if (commit) {
      const value = input.value.trim();
      if (value) onChange(block, part.textKey, value);
      else if (part.visibleKey) onChange(block, part.visibleKey, false);
    }
    refresh();
    if (focus) (editText.disabled ? visibility : editText).focus({ preventScroll: true });
    onReflow();
  }

  smaller.addEventListener('click', () => step(-1));
  larger.addEventListener('click', () => step(1));
  editText.addEventListener('click', beginText);
  visibility.addEventListener('click', () => {
    if (!part?.visibleKey) return;
    const key = part.visibleKey;
    onChange(block, key, !readVisualValue(block, key));
    refresh();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    finishText(true, true);
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      finishText(false, true);
    }
  });
  input.addEventListener('blur', event => {
    if (!inputTools.contains(event.relatedTarget)) finishText();
  });

  return {
    setTarget(next, key) {
      const nextPart = visualParts[next?.type]?.[key];
      if (block !== next || part !== nextPart) finishText();
      block = next;
      part = nextPart;
      form.hidden = !part;
      refresh();
    },
    position(bounds, frame, context = bounds) {
      if (form.hidden) return;
      const gutter = 8;
      const above = context.top - form.offsetHeight - gutter;
      const below = context.bottom + gutter;
      const side = context.right + gutter;
      const fitsBeside = side + form.offsetWidth + gutter <= frame.clientWidth
        && bounds.top >= gutter && bounds.top + form.offsetHeight <= frame.clientHeight;
      const top = fitsBeside ? bounds.top : below + form.offsetHeight <= frame.clientHeight
        ? below : Math.max(gutter, above);
      const left = fitsBeside ? side : Math.max(gutter, Math.min(bounds.left, frame.clientWidth - form.offsetWidth - gutter));
      Object.assign(form.style, { top: top + 'px', left: left + 'px' });
    },
    beginText, finishText, refresh,
    get dirty() { return typing && input.value !== readVisualValue(block, part.textKey); },
  };
}
