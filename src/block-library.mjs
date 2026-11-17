import { libraryEntries } from './visual-fields.mjs';
import { scenePatterns } from './scene-patterns.mjs';

const groups = { app: 'Appmønstre', component: 'Komponenter', pattern: 'Mønstre', layout: 'Layout', navigation: 'Navigation', appearance: 'Udseende', part: 'Dele fra appmønstre' };
const layoutEntry = { kind: 'layout', type: 'container', definition: { name: 'Container', description: 'Sæt blokke sammen i en stak, række eller et gitter.' } };
const normalize = text => text.toLocaleLowerCase('da-DK').normalize('NFD').replace(/\p{Mark}/gu, '').trim();

export function mountBlockLibrary(dialog, insert) {
  const { ownerDocument: document } = dialog;
  const search = dialog.querySelector('#library-search');
  const kindFilter = dialog.querySelector('#library-kind');
  const results = dialog.querySelector('#library-results');
  const target = dialog.querySelector('#library-target');
  const error = dialog.querySelector('#library-error');
  const patterns = Object.values(scenePatterns);
  const appEntries = patterns.map(pattern => ({ kind: 'app', type: pattern.id, definition: pattern, pattern }));
  const partEntries = patterns.flatMap(pattern => Object.entries(pattern.parts).filter(([, part]) => part.library !== false)
    .map(([type, part]) => ({
      kind: 'part', type, definition: { ...part, name: pattern.name + ' · ' + part.name },
    })));
  const entries = [...appEntries, ...libraryEntries, layoutEntry, ...partEntries].map(({ kind, type, definition, pattern }) => {
    const { name, description, usage, parts = {}, variants = {} } = definition;
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'scene-library-block';
    if (pattern) row.dataset.insertPattern = type;
    else row.dataset.insertBlock = type;
    const label = document.createElement('strong');
    label.textContent = name;
    row.append(label);
    if (description) {
      const summary = document.createElement('span');
      summary.textContent = description;
      row.append(summary);
    }
    row.addEventListener('click', () => { error.textContent = insert(type, () => dialog.close(), pattern); });
    const keywords = [name, type, groups[kind], description, usage, ...Object.keys(variants)];
    if (kind === 'component') keywords.push(...Object.keys(parts));
    return { kind, row, names: [normalize(name), normalize(type)], searchText: normalize(keywords.join(' ')) };
  });

  function render() {
    const query = normalize(search.value);
    const terms = query.split(/\s+/);
    const filter = kindFilter.value;
    const matches = entries.filter(entry => {
      const group = ['app', 'pattern', 'part'].includes(entry.kind) ? 'patterns' : entry.kind;
      return (filter === 'all' || group === filter) && terms.every(term => entry.searchText.includes(term));
    });
    results.replaceChildren();
    for (const [kind, label] of Object.entries(groups)) {
      const group = matches.filter(entry => entry.kind === kind).sort((a, b) =>
        Number(b.names.includes(query)) - Number(a.names.includes(query)));
      if (!group.length) continue;
      const section = document.createElement('section');
      const heading = document.createElement('h3');
      heading.textContent = label;
      section.append(heading, ...group.map(entry => entry.row));
      results.append(section);
    }
    if (!matches.length) {
      const empty = document.createElement('p');
      empty.className = 'scene-hint';
      empty.setAttribute('role', 'status');
      empty.textContent = 'Ingen blokke matcher søgningen.';
      results.append(empty);
    }
    results.scrollTop = 0;
  }

  search.addEventListener('input', render);
  kindFilter.addEventListener('change', render);
  return message => {
    target.textContent = message;
    error.textContent = '';
    search.value = '';
    kindFilter.value = 'all';
    render();
    dialog.showModal();
    search.focus();
  };
}
