import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve('dist-pages');
await rm(output, { recursive: true, force: true });
