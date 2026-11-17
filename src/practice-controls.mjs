import { mountRangeField, updateProgress } from '../design/runtime/components.mjs';
import { practiceTempo } from './practice-playback.mjs';
import { readVisualValue } from './visual-fields.mjs';

const phaseLabels = { ready: 'Klar', playing: 'Spiller', paused: 'På pause', finished: 'Færdig' };

function setText(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

export function mountPracticeControls({ document, component, commands }) {
  function node(tag, className) {
    const element = document.createElement(tag);
    element.className = className;
    return element;
  }

  const transport = node('div', 'practice-transport');
  transport.dataset.practiceTransport = '';
  const playbackButton = component('button', { variant: 'primary' });
  const playbackIcon = node('span', 'practice-transport__icon');
  playbackIcon.setAttribute('aria-hidden', 'true');
  const playbackLabel = node('span', 'practice-transport__label');
  playbackButton.replaceChildren(playbackIcon, playbackLabel);
  playbackButton.addEventListener('click', commands.togglePlayback);
  transport.append(playbackButton);
  let transportBlock = { type: 'practice-transport' };

  function paintTransport(playing) {
    const key = playing ? 'pauseLabel' : 'playLabel';
    transport.dataset.playing = String(playing);
    playbackLabel.dataset.scenePart = key;
    setText(playbackLabel, readVisualValue(transportBlock, key));
  }

  const metronome = node('div', 'practice-metronome');
  metronome.dataset.practiceMetronome = '';
  const metronomeButton = component('button', { variant: 'tertiary', pressed: false });
  const beatMark = node('span', 'practice-metronome__dot');
  beatMark.setAttribute('aria-hidden', 'true');
  const metronomeLabel = node('span', 'practice-metronome__label');
  metronomeLabel.dataset.scenePart = 'label';
  metronomeButton.replaceChildren(beatMark, metronomeLabel);
  metronomeButton.addEventListener('click', commands.toggleMetronome);
  metronome.append(metronomeButton);
  let activeBeat = null;
  let pulse;

  function paintMetronome(on, beat) {
    const nextBeat = on ? beat ?? null : null;
    metronomeButton.setAttribute('aria-pressed', String(on));
    metronome.dataset.beat = nextBeat ?? '';
    if (nextBeat === activeBeat) return;
    activeBeat = nextBeat;
    pulse?.cancel();
    pulse = null;
    if (nextBeat !== null && !document.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      pulse = beatMark.animate([{ transform: 'scale(1.7)' }, { transform: 'scale(1)' }], { duration: 180 });
    }
  }

  const speed = component('range-field', {
    variant: 'with-input', idPrefix: 'practice-speed', label: readVisualValue({ type: 'practice-speed' }, 'label'),
    value: practiceTempo.min, hint: '', ...practiceTempo,
  });
  speed.classList.add('practice-speed');
  speed.dataset.practiceSpeed = '';
  const speedLabel = speed.querySelector('.ds-range-field__label');
  speedLabel.dataset.scenePart = 'label';
  const speedCaption = node('div', 'practice-speed__caption');
  const speedPercent = node('span', 'practice-speed__percent');
  speedCaption.append(speedLabel, speedPercent);
  speed.prepend(speedCaption);
  const speedUnit = node('span', 'practice-speed__unit');
  speedUnit.id = 'practice-speed-unit';
  speedUnit.textContent = 'BPM';
  speed.querySelector('.ds-range-field__row').append(speedUnit);
  for (const control of speed.querySelectorAll('input')) {
    control.setAttribute('aria-describedby', [control.getAttribute('aria-describedby'), speedUnit.id].filter(Boolean).join(' '));
  }
  let bpm = practiceTempo.min;
  const range = mountRangeField(speed, {
    onInput({ valid, value }) {
      if (document.body.hasAttribute('data-scene-editing')) range.update({ value: bpm });
      else if (valid) commands.setTempo(value);
    },
  });

  const status = node('section', 'practice-status');
  status.dataset.practiceStatus = '';
  status.setAttribute('aria-labelledby', 'practice-status-name');
  const currentNote = component('badge', { text: '–', attrs: { role: 'img', 'aria-label': 'Aktuel tone' } });
  currentNote.classList.add('practice-status__note');
  const statusHeading = component('heading', { variant: 'subtitle', attrs: { id: 'practice-status-name' } });
  statusHeading.classList.add('practice-status__heading');
  statusHeading.dataset.scenePart = 'title';
  const statusText = node('p', 'practice-status__phase');
  statusText.setAttribute('role', 'status');
  statusText.setAttribute('aria-atomic', 'true');
  const summary = node('div', 'practice-status__summary');
  summary.append(statusHeading, statusText);
  const progress = component('progress', {
    idPrefix: 'practice-progress', label: readVisualValue({ type: 'practice-status' }, 'progressLabel'), value: 0,
  });
  const progressLabel = progress.querySelector('.ds-progress__label');
  progressLabel.dataset.scenePart = 'progressLabel';
  status.append(currentNote, summary, progress);

  let playing = false;
  let previousProgress = '';

  return {
    blocks: {
      'practice-transport': { element: transport, update(block) {
        transportBlock = block;
        paintTransport(playing);
      } },
      'practice-speed': { element: speed, update(block) { setText(speedLabel, readVisualValue(block, 'label')); } },
      'practice-metronome': { element: metronome, update(block) { setText(metronomeLabel, readVisualValue(block, 'label')); } },
      'practice-status': { element: status, update(block) {
        setText(statusHeading, readVisualValue(block, 'title'));
        setText(progressLabel, readVisualValue(block, 'progressLabel'));
      } },
    },
    render(view) {
      playing = view.playing;
      paintTransport(playing);
      paintMetronome(view.metronome, view.beat);
      bpm = view.bpm;
      if (range.getState().value !== bpm) range.update({ value: bpm });
      setText(speedPercent, view.tempo + ' %');

      setText(currentNote, view.note ?? '–');
      currentNote.setAttribute('aria-label', view.note ? 'Aktuel tone ' + view.note : 'Ingen aktuel tone');
      setText(statusText, phaseLabels[view.phase] + ' · ' + view.title);
      const valueText = view.played + ' af ' + view.count + ' toner';
      if (valueText !== previousProgress) {
        updateProgress(progress, { value: view.played, max: view.count, valueText });
        previousProgress = valueText;
      }
      Object.assign(status.dataset, {
        exercise: view.exercise, playing, step: view.step, instrument: view.instrument, tempo: view.tempoMode,
        bpm: view.bpm, tempoPercent: view.tempo, metronome: view.metronome, beat: activeBeat ?? '',
      });
    },
    destroy() {
      range.destroy();
      pulse?.cancel();
      playbackButton.removeEventListener('click', commands.togglePlayback);
      metronomeButton.removeEventListener('click', commands.toggleMetronome);
    },
  };
}
