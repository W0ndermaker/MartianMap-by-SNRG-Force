// Must be imported before anything that imports 'cesium': tells Cesium where its static assets live
// (copied to public/cesium by scripts/copy-cesium.mjs).
(window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = `${import.meta.env.BASE_URL}cesium/`;
export {};
