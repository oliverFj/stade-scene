export const practiceTempo = { min: 40, max: 240, step: 1 };
const presetSpeed = { slow: .75, normal: 1, fast: 1.25 };

export const bpmFor = (exercise, preset) => Math.round(60000 * presetSpeed[preset] / exercise.beat);
export const presetFor = (exercise, bpm) => Object.keys(presetSpeed).find(preset => bpmFor(exercise, preset) === bpm) ?? 'custom';

function createTonePlayer(window) {
  let audio;
  const voices = new Map();

  function stopVoice(kind) {
    const voice = voices.get(kind);
    if (!voice) return;
    voices.delete(kind);
    voice.stop();
  }

  function stop() {
    for (const kind of voices.keys()) stopVoice(kind);
  }

  function addVoice(kind, at, { frequency, type, duration, gain, attack }) {
    const voice = audio.createOscillator();
    const envelope = audio.createGain();
    voice.type = type;
    voice.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(gain, at + attack);
    envelope.gain.exponentialRampToValueAtTime(.001, at + duration);
    voice.connect(envelope).connect(audio.destination);
    voice.onended = () => {
      voice.disconnect();
      envelope.disconnect();
      if (voices.get(kind) === voice) voices.delete(kind);
    };
    voice.start(at);
    voice.stop(at + duration);
    voices.set(kind, voice);
  }

  return {
    play(pitch, duration, instrument, { click = false, accent = false } = {}) {
      if (!window.AudioContext) return;
      stop();
      try {
        audio ??= new window.AudioContext();
        if (audio.state === 'suspended') void audio.resume().catch(() => {});
        const at = audio.currentTime;
        const violin = instrument === 'violin';
        if (duration >= .07) addVoice('note', at, {
          frequency: 440 * 2 ** ((pitch - 69) / 12), duration,
          type: violin ? 'sawtooth' : 'triangle', gain: violin ? .065 : .15, attack: violin ? .055 : .025,
        });
        if (click) addVoice('click', at, {
          frequency: accent ? 1500 : 1050, type: 'square', duration: .045, gain: .075, attack: .004,
        });
      } catch {
        // The visual exercise can continue on devices without working audio output.
      }
    },
    stop,
    stopClick() { stopVoice('click'); },
    destroy() {
      stop();
      if (audio && audio.state !== 'closed') void audio.close().catch(() => {});
    },
  };
}

/** Keep the note, visible progress and metronome on the same beat clock. */
export function mountPracticePlayback({ window, state, exercise, render }) {
  const tone = createTonePlayer(window);
  let started = false;
  let timer;
  let beatStart;
  let pausedFraction = 0;
  let clickStep = null;

  const beatLength = () => 60000 / state.bpm;
  const now = () => window.performance.now();
  const fractionAt = at => Math.min(1, Math.max(0, (at - beatStart) / beatLength()));
  const clearBeat = () => window.clearTimeout(timer);

  function playCurrentBeat(fraction = 0) {
    const duration = Math.max(0, .8 - fraction) * beatLength() / 1000;
    const click = state.metronome && fraction === 0;
    if (click) clickStep = state.step;
    tone.play(exercise().notes[state.step], duration, state.instrument, {
      click, accent: state.step % 4 === 0,
    });
  }

  function scheduleBeat() {
    timer = window.setTimeout(nextBeat, Math.max(1, Math.ceil(beatStart + beatLength() - now())));
  }

  function nextBeat() {
    if (!state.playing) return;
    const at = now();
    const expected = beatStart + beatLength();
    if (at < expected) {
      scheduleBeat();
      return;
    }
    state.step++;
    if (state.step === exercise().notes.length) {
      stop();
      render();
      return;
    }
    // Preserve the cadence under short delays. Re-anchor after a stalled frame to avoid a burst.
    beatStart = at - expected > beatLength() / 2 ? at : expected;
    playCurrentBeat();
    render();
    scheduleBeat();
  }

  function stop() {
    state.playing = false;
    pausedFraction = 0;
    clickStep = null;
    clearBeat();
    tone.stop();
  }

  function pause() {
    const fraction = state.playing ? fractionAt(now()) : pausedFraction;
    stop();
    pausedFraction = fraction;
    render();
  }

  return {
    get started() { return started; },
    get clickStep() { return clickStep; },
    toggle() {
      if (state.playing) {
        pause();
        return;
      }
      if (state.step === exercise().notes.length) state.step = 0;
      state.playing = started = true;
      beatStart = now() - pausedFraction * beatLength();
      playCurrentBeat(pausedFraction);
      render();
      scheduleBeat();
    },
    pause,
    reset() {
      stop();
      state.step = 0;
      started = false;
    },
    setTempo(bpm) {
      if (!Number.isInteger(bpm) || bpm < practiceTempo.min || bpm > practiceTempo.max || bpm === state.bpm) return;
      const at = now();
      const fraction = state.playing ? fractionAt(at) : pausedFraction;
      state.bpm = bpm;
      if (state.playing) {
        beatStart = at - fraction * beatLength();
        clearBeat();
        scheduleBeat();
      }
      render();
    },
    toggleMetronome() {
      state.metronome = !state.metronome;
      if (!state.metronome) {
        clickStep = null;
        tone.stopClick();
      }
      render();
    },
    audition(index) { tone.play(exercise().notes[index], .4, state.instrument); },
    destroy() {
      clearBeat();
      tone.destroy();
    },
  };
}
