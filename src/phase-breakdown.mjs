const phases = { planned: 'Planlagt', active: 'I gang', review: 'Til review', done: 'Afsluttet' };

export function mountPhaseBreakdown({ document, component, state, statusFilter }) {
  const card = component('card', { slots: { header: '', body: '', footer: '' } });
  card.classList.add('phase-breakdown');
  card.querySelector('.ds-card__footer').remove();
  const title = document.createElement('h2');
  card.querySelector('.ds-card__header').append(title);
  const bars = [];
  const body = card.querySelector('.ds-card__body');
  for (const [phase, label] of Object.entries(phases)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'phase-bar';
    button.dataset.phase = phase;
    const name = document.createElement('span');
    name.textContent = label;
    const track = document.createElement('span');
    track.className = 'phase-track';
    track.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('span');
    track.append(fill);
    const count = document.createElement('span');
    count.className = 'phase-count';
    count.setAttribute('aria-hidden', 'true');
    button.append(name, track, count);
    button.addEventListener('click', () => {
      statusFilter.value = state.status === phase ? 'all' : phase;
      statusFilter.dispatchEvent(new document.defaultView.Event('change', { bubbles: true }));
    });
    body.append(button);
    bars.push({ phase, label, button, fill, count });
  }

  return {
    element: card,
    update({ title: heading, showCounts }) {
      title.textContent = heading;
      const counts = Object.fromEntries(Object.keys(phases).map(phase => [phase, 0]));
      for (const project of state.projects) counts[project.status]++;
      for (const { phase, label, button, fill, count } of bars) {
        const value = counts[phase];
        fill.style.inlineSize = (value / state.projects.length * 100) + '%';
        count.hidden = !showCounts;
        count.textContent = String(value);
        button.setAttribute('aria-label', label + ', ' + value + (value === 1 ? ' projekt' : ' projekter'));
        button.setAttribute('aria-pressed', String(state.status === phase));
      }
    },
  };
}
