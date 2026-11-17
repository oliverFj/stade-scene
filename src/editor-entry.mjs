if (document.getElementById('stade-native-app')) {
  import('./native-app.mjs');
} else {
  import('./app.mjs');
}
