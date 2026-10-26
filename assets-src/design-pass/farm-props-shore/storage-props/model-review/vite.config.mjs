import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
export default defineConfig({root,cacheDir:root+'.vite',server:{host:'127.0.0.1',port:5206,strictPort:true},optimizeDeps:{include:['three','three/addons/loaders/GLTFLoader.js','meshoptimizer']}});
