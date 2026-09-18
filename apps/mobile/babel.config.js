module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo mein Expo Router, Reanimated aur RN ka saara
    // transform setup shamil hai — alag se plugins add karne ki zaroorat nahi.
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
  };
};
