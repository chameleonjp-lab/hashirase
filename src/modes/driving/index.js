export { createMode } from './session.js';
/** Screen URLs are fetched only after the host chooses the driving mode. */
export async function loadScreenAssets() { return import('./screen-assets.js'); }
