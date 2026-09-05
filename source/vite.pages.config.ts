import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';

const project=fileURLToPath(new URL('.',import.meta.url));
export default defineConfig({
  root:fileURLToPath(new URL('./github-pages',import.meta.url)),
  base:'./',
  publicDir:false,
  plugins:[react()],
  resolve:{alias:{'@':project}},
  build:{outDir:fileURLToPath(new URL('./dist-pages',import.meta.url)),emptyOutDir:true},
});
