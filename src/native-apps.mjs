/** Public builds take their starter scenes from these files, never from a saved app. */
export const nativeApps = {
  overblik: { template: 'overview', name: 'Overblik', filename: 'Overblik.html', gallery: true },
  blog: { template: 'blog', name: 'Blog', filename: 'Blog.html', gallery: true },
  webshop: { template: 'shop', name: 'Webshop', filename: 'Webshop.html', gallery: true },
  editor: { template: 'editor', name: 'Editor', filename: 'Editor.html', gallery: true },
  oeverum: { template: 'practice', name: 'Øverum', filename: 'Øverum.html' },
};

export const sceneFilename = id => id + '.scene.json';
