// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite's web implementation ships a .wasm build (wa-sqlite) — Metro
// needs to treat .wasm as a bundleable asset. Not needed for Android/iOS,
// only for `expo export --platform web`.
config.resolver.assetExts.push('wasm');

module.exports = config;
