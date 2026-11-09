import { copyFile } from 'node:fs/promises';
await copyFile(new URL('../../web/index.html', import.meta.url), new URL('../dist/wall.html', import.meta.url));
