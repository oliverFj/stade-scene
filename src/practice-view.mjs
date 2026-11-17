import { mountPracticeControls } from './practice-controls.mjs';
import { mountPracticeFretboard } from './practice-fretboard.mjs';
import { bpmFor, mountPracticePlayback, presetFor } from './practice-playback.mjs';
import { mountPracticeToolbar } from './practice-toolbar.mjs';
import { entriesOf } from './scene-model.mjs';
import { readVisualValue } from './visual-fields.mjs';

const catalogue = {
  songs: {
    'op-og-ned': { title: 'Op og ned', beat: 520, notes: [64, 65, 67, 69, 71, 69, 67, 65] },
    treklang: { title: 'Treklang', beat: 570, notes: [60, 64, 67, 72, 67, 64, 60, 64] },
    'lille-vending': { title: 'Lille vending', beat: 490, notes: [69, 71, 72, 71, 69, 67, 65, 64] },
  },
  scales: {
    'c-dur': { title: 'C-dur', beat: 480, notes: [60, 62, 64, 65, 67, 69, 71, 72] },
    'a-mol': { title: 'A-mol', beat: 480, notes: [69, 71, 72, 74, 76, 77, 79, 81] },
  },
};
const pitchLetters = { 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B' };
const letterSteps = 'CDEFGAB';
const svgNamespace = 'http://www.w3.org/2000/svg';
const letterOf = pitch => pitchLetters[pitch % 12];
const octaveOf = pitch => Math.floor(pitch / 12) - 1;

function mountNotes(document) {
  const svg = (tag, attrs) => {
    const node = document.createElementNS(svgNamespace, tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
    return node;
  };
  const element = svg('svg', { viewBox: '0 0 640 150', role: 'img' });
  const staff = svg('g', { class: 'practice-staff__lines' });
  for (const y of [48, 60, 72, 84, 96]) staff.append(svg('line', { x1: 12, x2: 625, y1: y, y2: y }));
  const clef = svg('text', { x: 23, y: 96, class: 'practice-staff__clef' });
  clef.textContent = '𝄞';
  staff.append(clef);
  const notation = svg('g', {});
  element.append(staff, notation);
  let notes = [];
  return {
    element,
    setExercise({ title, notes: pitches }) {
      const pitchNames = [];
      notes = pitches.map((pitch, index) => {
        const letter = letterOf(pitch);
        const octave = octaveOf(pitch);
        pitchNames.push(letter + octave);
        const x = 94 + index * 68;
        const y = 108 - (letterSteps.indexOf(letter) + (octave - 4) * 7) * 6;
        const stemDown = y <= 72;
        const group = svg('g', { class: 'practice-staff__note', 'data-note-index': index });
        const band = svg('rect', { x: x - 23, y: 14, width: 46, height: 118, rx: 8, class: 'practice-staff__highlight' });
        for (const ledgerY of [24, 36, 108]) {
          if (ledgerY === 108 ? y >= ledgerY : y <= ledgerY) {
            group.append(svg('line', { x1: x - 12, x2: x + 12, y1: ledgerY, y2: ledgerY }));
          }
        }
        const stemX = x + (stemDown ? -6 : 6);
        const stem = svg('line', { x1: stemX, x2: stemX, y1: y, y2: y + (stemDown ? 32 : -32) });
        const notehead = svg('ellipse', { cx: x, cy: y, rx: 7.2, ry: 4.8, transform: `rotate(-18 ${x} ${y})` });
        const name = svg('text', { x, y: 124, class: 'practice-staff__letter', 'text-anchor': 'middle' });
        name.textContent = letter;
        group.prepend(band);
        group.append(stem, notehead, name);
        return group;
      });
      notation.replaceChildren(...notes);
      element.setAttribute('aria-label', `Noder for ${title}. ${pitchNames.join(', ')}.`);
    },
    showStep(step) {
      notes.forEach((note, index) => {
        if (index === step) note.setAttribute('aria-current', 'step');
        else note.removeAttribute('aria-current');
      });
    },
  };
}

export function mountPractice({ document, component, state, scene }) {
  const window = document.defaultView;
  const selected = { songs: 'op-og-ned', scales: 'c-dur' };
  Object.assign(state, {
    kind: 'songs', exercise: selected.songs, instrument: 'guitar', bpm: bpmFor(catalogue.songs[selected.songs], 'normal'),
    mode: 'practice', noteLabels: true, metronome: false, playing: false, step: 0,
  });
  const exercise = () => catalogue[state.kind][state.exercise];
  const playback = mountPracticePlayback({ window, state, exercise, render });
  let previewStep = null;

  function node(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function setText(element, text) {
    if (element.textContent !== text) element.textContent = text;
  }

  function card(dataName, heading, body) {
    const card = component('card', { slots: { header: '', body: '', footer: '' } });
    card.dataset[dataName] = '';
    card.querySelector('.ds-card__header').append(heading);
    card.querySelector('.ds-card__body').append(body);
    card.querySelector('.ds-card__footer').remove();
    card.setAttribute('aria-labelledby', heading.id);
    return card;
  }

  const element = node('div', 'ds-layout practice-app');
  const layouts = scene.acts?.map(act => act.layout) ?? [scene.layout];
  const blockTypes = new Set(layouts.flatMap(layout => entriesOf(layout).map(({ block }) => block.type)));
  const hasToolbar = blockTypes.has('practice-brand') || blockTypes.has('practice-kind');
  element.dataset.layout = hasToolbar ? 'fluid' : 'workspace';
  const intro = node('header', 'practice-intro');
  const title = component('heading', { variant: 'display', slots: { root: { tag: 'h1' } } });
  title.dataset.scenePart = 'title';
  const description = component('text', { text: '' });
  description.dataset.scenePart = 'description';
  intro.append(title, description);

  const toolbar = mountPracticeToolbar({
    document, component, state, catalogue,
    commands: {
      exercise: selectExercise,
      kind(kind) {
        if (state.kind !== kind) selectExercise(selected[kind], kind);
      },
      instrument(instrument) { state.instrument = instrument; render(); },
      tempo(preset) { playback.setTempo(bpmFor(exercise(), preset)); },
      mode: selectMode,
      noteLabels() { state.noteLabels = !state.noteLabels; render(); },
    },
  });

  const controls = mountPracticeControls({
    document, component,
    commands: { togglePlayback, setTempo: playback.setTempo, toggleMetronome: playback.toggleMetronome },
  });
  const fretboard = blockTypes.has('practice-fretboard') ? mountPracticeFretboard({ document, component }) : null;

  const scoreHeading = component('heading', { text: '', variant: 'subtitle', attrs: { id: 'practice-score-name' } });
  scoreHeading.dataset.scenePart = 'title';
  const staff = mountNotes(document);
  const score = card('practiceScore', scoreHeading, staff.element);
  const preview = node('div', 'practice-note-preview');
  preview.dataset.practicePreview = '';
  preview.setAttribute('role', 'group');
  preview.setAttribute('aria-label', 'Hør en tone');
  score.querySelector('.ds-card__body').append(preview);

  function showExercise() {
    const current = exercise();
    staff.setExercise(current);
    preview.replaceChildren(...current.notes.map((pitch, index) => {
      const name = letterOf(pitch) + octaveOf(pitch);
      return component('button', {
        variant: 'secondary', size: 'small', text: name,
        attrs: { 'aria-label': 'Hør tone ' + (index + 1) + ', ' + name, 'data-preview-index': index },
      });
    }));
  }

  function render() {
    const current = exercise();
    const count = current.notes.length;
    const phase = state.playing ? 'playing' : state.step === count ? 'finished' : playback.started ? 'paused' : 'ready';
    const played = playback.started ? Math.min(state.step + 1, count) : 0;
    const tempo = Math.round(state.bpm * current.beat / 600);
    const tempoMode = presetFor(current, state.bpm);
    const displayedStep = state.playing || previewStep === null ? state.step : previewStep;
    const pitch = current.notes[displayedStep];
    controls.render({
      exercise: state.exercise, title: current.title, playing: state.playing, phase, step: state.step,
      count, played, tempo, bpm: state.bpm, tempoMode, instrument: state.instrument,
      metronome: state.metronome, beat: playback.clickStep,
      note: pitch === undefined ? null : letterOf(pitch) + octaveOf(pitch),
    });
    score.dataset.exercise = state.exercise;
    score.toggleAttribute('data-hide-note-labels', !state.noteLabels);
    preview.hidden = state.mode !== 'explore';
    staff.showStep(displayedStep);
    fretboard?.render({ pitch, instrument: state.instrument });
    toolbar.refresh({ tempoMode, tempo });
  }

  function togglePlayback() {
    previewStep = null;
    playback.toggle();
  }

  function selectExercise(id, kind = state.kind) {
    const preset = presetFor(exercise(), state.bpm);
    playback.reset();
    state.kind = kind;
    state.exercise = selected[kind] = id;
    if (preset !== 'custom') state.bpm = bpmFor(exercise(), preset);
    previewStep = null;
    showExercise();
    render();
  }

  function selectMode(mode) {
    if (mode === state.mode && mode !== 'listen') return;
    state.mode = mode;
    previewStep = null;
    if (mode === 'listen') {
      if (state.playing) render();
      else togglePlayback();
    } else playback.pause();
  }

  function audition(event) {
    const choice = event.target.closest('[data-preview-index]');
    if (!choice) return;
    playback.pause();
    previewStep = Number(choice.dataset.previewIndex);
    playback.audition(previewStep);
    render();
  }

  function handleVisibility() {
    if (document.hidden) playback.pause();
  }

  preview.addEventListener('click', audition);
  document.addEventListener('visibilitychange', handleVisibility);
  showExercise();
  render();

  return {
    element,
    blocks: {
      'practice-intro': { element: intro, update(block) {
        setText(title, readVisualValue(block, 'title'));
        setText(description, readVisualValue(block, 'description'));
      } },
      ...toolbar.blocks,
      ...controls.blocks,
      ...(fretboard ? { 'practice-fretboard': fretboard } : {}),
      'practice-score': { element: score, update(block) { setText(scoreHeading, readVisualValue(block, 'title')); } },
    },
    destroy() {
      playback.destroy();
      toolbar.destroy();
      controls.destroy();
      fretboard?.destroy?.();
      preview.removeEventListener('click', audition);
      document.removeEventListener('visibilitychange', handleVisibility);
    },
  };
}
