import { readVisualValue } from './visual-fields.mjs';

export function mountPracticeToolbar({ document, component, state, catalogue, commands }) {
  const cleanups = [];
  function listen(element, type, handler) {
    element.addEventListener(type, handler);
    cleanups.push(() => element.removeEventListener(type, handler));
  }

  function mark(element, part) {
    element.dataset.scenePart = part;
    return element;
  }

  function editText(element, block, key) {
    const text = readVisualValue(block, key);
    if (text !== undefined && element.textContent !== text) element.textContent = text;
  }

  function field(key, hideLabel, command) {
    const element = component('field', {
      idPrefix: 'practice-' + key, label: '', hint: '', slots: { control: { tag: 'select' } },
    });
    const label = element.querySelector('label');
    const control = element.querySelector('select');
    if (hideLabel) label.classList.add('practice-sr-only');
    listen(control, 'change', () => command(control.value));
    return {
      element, label, control,
      options(items) {
        control.replaceChildren(...items.map(([value, title]) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = title;
          return option;
        }));
      },
    };
  }

  function segmented(selector, entries, command) {
    const element = component('segmented-control', { variant: 'wrap' });
    element.setAttribute('role', 'group');
    const options = entries.map(([value, key]) => {
      const button = mark(component('segmented-option', { variant: 'desktop', pressed: false, text: '' }), key);
      button.dataset[selector] = value;
      listen(button, 'click', () => command(value));
      return { value, key, button };
    });
    element.replaceChildren(...options.map(({ button }) => button));
    return {
      element,
      active(value) {
        for (const option of options) option.button.setAttribute('aria-pressed', String(option.value === value));
      },
      update(block) {
        element.setAttribute('aria-label', readVisualValue(block, 'label'));
        for (const { key, button } of options) editText(button, block, key);
      },
    };
  }

  const brand = document.createElement('div');
  brand.className = 'practice-wordmark';
  brand.dataset.practiceBrand = '';
  const brandNote = document.createElement('span');
  brandNote.className = 'practice-wordmark__mark';
  brandNote.textContent = '♪';
  brandNote.setAttribute('aria-hidden', 'true');
  const brandName = mark(document.createElement('span'), 'title');
  brandName.className = 'practice-wordmark__name';
  brand.append(brandNote, brandName);

  const instrument = field('instrument', true, commands.instrument);
  instrument.element.dataset.practiceInstrument = '';
  const audioInstrument = field('audio-instrument', false, commands.instrument);
  audioInstrument.element.dataset.practiceAudioInstrument = '';
  mark(audioInstrument.label, 'label');
  const instrumentOptions = [['guitar', 'Guitar'], ['violin', 'Violin']];
  instrument.options(instrumentOptions);
  audioInstrument.options(instrumentOptions);

  function editInstrument(picker, block) {
    editText(picker.label, block, 'label');
    editText(picker.control.options[0], block, 'guitarLabel');
    editText(picker.control.options[1], block, 'violinLabel');
  }

  const modes = segmented('mode', [['practice', 'practiceLabel'], ['listen', 'listenLabel'], ['explore', 'exploreLabel']], commands.mode);
  modes.element.dataset.practiceModes = '';

  const tools = mark(component('button', { variant: 'tertiary', pressed: false, text: '' }), 'noteLabels');
  tools.dataset.practiceTools = '';
  listen(tools, 'click', commands.noteLabels);

  const kinds = segmented('kind', [['songs', 'songsLabel'], ['scales', 'scalesLabel']], commands.kind);
  kinds.element.dataset.practiceKind = '';

  const picker = field('exercise', false, commands.exercise);
  picker.element.classList.add('practice-picker');
  picker.element.dataset.practicePicker = '';
  const pickerIcon = document.createElement('span');
  pickerIcon.className = 'practice-picker__icon';
  pickerIcon.setAttribute('aria-hidden', 'true');
  pickerIcon.textContent = '♫';
  const pickerCount = document.createElement('span');
  pickerCount.className = 'practice-picker__count';
  pickerCount.setAttribute('aria-hidden', 'true');
  picker.element.append(pickerIcon, pickerCount);

  const tempo = field('tempo', false, commands.tempo);
  tempo.element.dataset.practiceTempo = '';
  mark(tempo.label, 'label');
  tempo.options([['slow', 'Roligt · 75 %'], ['normal', 'Normalt · 100 %'], ['fast', 'Hurtigt · 125 %']]);
  const customTempo = document.createElement('option');
  customTempo.value = 'custom';
  customTempo.disabled = customTempo.hidden = true;
  tempo.control.append(customTempo);

  let pickerBlock;
  let previousKind;
  function updatePickerLabel() {
    if (!pickerBlock) return;
    const key = state.kind === 'songs' ? 'label' : 'scaleLabel';
    mark(picker.label, key);
    editText(picker.label, pickerBlock, key);
  }

  return {
    blocks: {
      'practice-brand': { element: brand, update(block) { editText(brandName, block, 'title'); } },
      'practice-instrument': { element: instrument.element, update(block) { editInstrument(instrument, block); } },
      'practice-audio-instrument': { element: audioInstrument.element, update(block) { editInstrument(audioInstrument, block); } },
      'practice-modes': modes,
      'practice-tools': { element: tools, update(block) { editText(tools, block, 'noteLabels'); } },
      'practice-kind': kinds,
      'practice-picker': { element: picker.element, update(block) { pickerBlock = block; updatePickerLabel(); } },
      'practice-tempo': { element: tempo.element, update(block) { editText(tempo.label, block, 'label'); } },
    },
    refresh({ tempoMode, tempo: percentage }) {
      if (state.kind !== previousKind) {
        const entries = Object.entries(catalogue[state.kind]);
        picker.options(entries.map(([id, { title }]) => [id, title]));
        pickerCount.textContent = entries.length + (state.kind === 'songs' ? ' sange' : ' skalaer');
        previousKind = state.kind;
        updatePickerLabel();
      }
      if (picker.control.value !== state.exercise) picker.control.value = state.exercise;
      if (instrument.control.value !== state.instrument) instrument.control.value = state.instrument;
      if (audioInstrument.control.value !== state.instrument) audioInstrument.control.value = state.instrument;
      customTempo.hidden = tempoMode !== 'custom';
      if (tempoMode === 'custom') {
        const label = 'Tilpasset · ' + percentage + ' %';
        if (customTempo.textContent !== label) customTempo.textContent = label;
      }
      if (tempo.control.value !== tempoMode) tempo.control.value = tempoMode;
      kinds.active(state.kind);
      modes.active(state.mode);
      tools.setAttribute('aria-pressed', String(state.noteLabels));
    },
    destroy() { for (const cleanup of cleanups) cleanup(); },
  };
}
