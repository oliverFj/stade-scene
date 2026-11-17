function mountRegion(document, { fields, parts, textSelectors = {} }) {
  const element = document.createElement('div');
  let targets = [];
  let props;

  function apply() {
    for (const { target, fieldKey } of targets) {
      const value = props?.[fieldKey] ?? fields[fieldKey].defaultValue;
      if (target.textContent !== value) target.textContent = value;
    }
  }

  return {
    element,
    render(content) {
      const nodes = Array.isArray(content) ? content : content ? [content] : [];
      element.replaceChildren(...nodes);
      element.toggleAttribute('hidden', !nodes.length);
      targets = nodes.length ? Object.entries(textSelectors).map(([key, selector]) => {
        const target = element.querySelector(selector);
        if (!target) throw new Error('Mønsterdelen mangler tekstmålet ' + selector + '.');
        target.setAttribute('data-scene-part', key);
        return { target, fieldKey: parts[key].textKey };
      }) : [];
      apply();
    },
    update(block) {
      props = block.props;
      apply();
    },
  };
}

/** Mount a single controller that publishes the current content of its named regions. */
export function mountPatternRegions(parts, context, mount) {
  const blocks = Object.fromEntries(Object.entries(parts).map(([type, definition]) => [type,
    mountRegion(context.document, definition),
  ]));
  const app = mount(content => {
    for (const [type, block] of Object.entries(blocks)) block.render(content[type]);
  });
  return { ...app, blocks };
}
