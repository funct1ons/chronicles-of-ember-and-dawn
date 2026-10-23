import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('public/legal',{recursive:true});
await copyFile('LICENSE','public/legal/LICENSE.txt');
// Vite injects its small modulepreload polyfill into the browser bundle.
await copyFile('node_modules/vite/LICENSE.md','public/legal/VITE_LICENSE.md');
await copyFile('docs/ASSET_LICENSES.md','public/legal/ASSET_LICENSES.md');
await copyFile('docs/ASSET_LICENSES_AUDIO.md','public/legal/AUDIO_CREDITS.md');
await copyFile('docs/ASSET_LICENSES_AUDIO.md','public/legal/ASSET_LICENSES_AUDIO.md');
console.log('Included project/Vite notices and original music attribution records in the static release.');
