import { readVisualValue } from './visual-fields.mjs';

const pitchNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B'];
const pitchName = pitch => pitchNames[pitch % 12] + (Math.floor(pitch / 12) - 1);
const instruments = {
  guitar: { tuning: [64, 59, 55, 50, 45, 40], stops: Array.from({ length: 20 }, (_, fret) => String(fret)), inlays: [3, 5, 7, 9, 12, 15, 17] },
  violin: { tuning: [76, 69, 62, 55], stops: ['0', 'Lav 1', '1', 'Lav 2', 'Høj 2', '3', 'Høj 3', '4'], inlays: [] },
};

function positionsFor({ tuning, stops }, pitch) {
  return tuning.map((open, index) => ({ string: index + 1, offset: pitch - open }))
    .filter(({ offset }) => offset >= 0 && offset < stops.length)
    .sort((left, right) => left.offset - right.offset);
}

export function mountPracticeFretboard({ document, component }) {
  const window = document.defaultView;
  function node(tag, part, text) {
    const element = document.createElement(tag);
    if (part) element.className = 'practice-fretboard__' + part;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  const element = node('section');
  element.className = 'practice-fretboard';
  element.dataset.practiceFretboard = '';
  element.setAttribute('aria-labelledby', 'practice-fretboard-name');
  const title = component('heading', { variant: 'subtitle', attrs: { id: 'practice-fretboard-name' } });
  title.dataset.scenePart = 'title';
  const header = node('div', 'header');
  const position = node('p', 'position');
  position.id = 'practice-fretboard-position';
  header.append(title, position);

  const frame = node('div', 'frame');
  const strings = node('div', 'strings');
  strings.setAttribute('aria-hidden', 'true');
  const viewport = node('div', 'viewport');
  viewport.setAttribute('role', 'region');
  viewport.setAttribute('aria-describedby', position.id);
  const board = node('div', 'board');
  viewport.append(board);
  frame.append(strings, viewport);
  element.append(header, frame);

  let instrument;
  let pitch;
  let activeMarker;
  let surface;
  let ruler;
  let markers = [];
  let showNoteNames = true;
  let showAlternates = true;

  function reveal() {
    const width = viewport.clientWidth;
    if (!width) return;
    const scrollable = viewport.scrollWidth > width + 1;
    viewport.tabIndex = scrollable ? 0 : -1;
    const name = instrument === 'violin' ? 'Violinens gribebræt i første position' : 'Guitarens gribebræt';
    viewport.setAttribute('aria-label', scrollable ? name + '. Rul vandret med piletasterne.' : name);
    if (!activeMarker) return;
    const bounds = viewport.getBoundingClientRect();
    const mark = activeMarker.getBoundingClientRect();
    const left = mark.left - bounds.left;
    const right = mark.right - bounds.left;
    if (left < 12) viewport.scrollLeft -= 12 - left;
    else if (right > width - 12) viewport.scrollLeft += right - width + 12;
  }

  // Scrolling stays in this block when its current note, container or instrument changes.
  const observer = new window.ResizeObserver(reveal);
  observer.observe(viewport);

  function buildBoard(layout) {
    const isGuitar = instrument === 'guitar';
    viewport.scrollLeft = 0;
    element.style.setProperty('--fretboard-strings', layout.tuning.length);
    const columns = layout.stops.map((_, index) =>
      index === 0 ? 'minmax(32px, .65fr)' : `minmax(0, ${(2 ** (-(index - 1) / 12)).toFixed(3)}fr)`);
    board.style.setProperty('--fretboard-columns', columns.join(' '));
    strings.replaceChildren(node('span', 'axis-label', isGuitar ? 'Bånd' : 'Finger'), ...layout.tuning.map((open, row) => {
      const string = node('span', 'string-label', pitchNames[open % 12]);
      string.append(node('small', 'string-number', row + 1));
      return string;
    }));
    ruler = node('div', 'ruler');
    ruler.setAttribute('aria-hidden', 'true');
    ruler.append(...layout.stops.map(stop => node('span', 'stop-label', stop)));
    surface = node('div', 'surface');
    surface.setAttribute('aria-hidden', 'true');
    for (const [index] of layout.stops.entries()) {
      const column = node('div', 'column');
      column.style.gridColumn = index + 1;
      if (layout.inlays.includes(index)) {
        column.append(node('span', 'inlay'));
        if (index === 12) column.append(node('span', 'inlay'));
      }
      surface.append(column);
    }
    for (const [row] of layout.tuning.entries()) {
      const string = node('span', 'string');
      string.style.gridRow = row + 1;
      string.style.setProperty('--fretboard-string-width', .9 + row * .24 + 'px');
      surface.append(string);
    }
    board.replaceChildren(ruler, surface);
  }

  function renderMarkers() {
    markers.forEach(marker => marker.remove());
    markers = [];
    activeMarker = null;
    ruler.querySelector('[data-current]')?.removeAttribute('data-current');
    if (pitch === undefined) {
      position.textContent = 'Ingen aktuel tone';
      position.removeAttribute('title');
      return;
    }
    const layout = instruments[instrument];
    const name = pitchName(pitch);
    const positions = positionsFor(layout, pitch);
    if (!positions.length) {
      position.textContent = name + ' · Uden for gribebrættet';
      position.removeAttribute('title');
      return;
    }
    const describe = ({ string, offset }) => {
      if (!offset) return 'Åben ' + pitchNames[layout.tuning[string - 1] % 12] + '-streng';
      if (instrument === 'guitar') return `${string}. streng · Bånd ${offset}`;
      return `${pitchNames[layout.tuning[string - 1] % 12]}-streng · Finger ${layout.stops[offset].toLowerCase()}`;
    };
    position.textContent = name + ' · ' + describe(positions[0]);
    if (showAlternates && positions.length > 1) {
      position.title = 'Andre placeringer: ' + positions.slice(1).map(describe).join('; ');
    } else position.removeAttribute('title');

    for (const [index, entry] of (showAlternates ? positions : positions.slice(0, 1)).entries()) {
      const { string, offset } = entry;
      const marker = node('span', 'marker');
      marker.dataset.active = String(index === 0);
      marker.dataset.string = string;
      marker.dataset.position = offset;
      if (instrument === 'guitar') marker.dataset.fret = offset;
      marker.title = name + ' · ' + describe(entry);
      marker.style.gridRow = string;
      marker.style.gridColumn = offset + 1;
      const label = node('span', 'note-name', pitchNames[pitch % 12]);
      label.dataset.noteName = '';
      label.hidden = !showNoteNames;
      marker.append(label);
      surface.append(marker);
      markers.push(marker);
      if (index === 0) {
        activeMarker = marker;
        ruler.children[offset].dataset.current = '';
      }
    }
    reveal();
  }

  return {
    element,
    update(block) {
      const name = readVisualValue(block, 'title');
      if (title.textContent !== name) title.textContent = name;
      const names = readVisualValue(block, 'showNoteNames');
      const alternates = readVisualValue(block, 'showAlternates');
      if (showNoteNames === names && showAlternates === alternates) return;
      showNoteNames = names;
      showAlternates = alternates;
      if (surface) renderMarkers();
    },
    render({ pitch: nextPitch, instrument: nextInstrument }) {
      const boardType = nextInstrument === 'violin' ? 'violin' : 'guitar';
      const note = Number.isInteger(nextPitch) && nextPitch >= 0 && nextPitch <= 127 ? nextPitch : undefined;
      if (instrument === boardType && pitch === note) return;
      if (instrument !== boardType) {
        instrument = element.dataset.instrument = boardType;
        buildBoard(instruments[instrument]);
      }
      pitch = note;
      if (pitch === undefined) delete element.dataset.pitch;
      else element.dataset.pitch = pitch;
      renderMarkers();
    },
    destroy() { observer.disconnect(); },
  };
}
