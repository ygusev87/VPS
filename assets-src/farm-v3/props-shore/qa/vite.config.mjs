import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export default {root,publicDir:false,server:{host:'127.0.0.1',port:5198,strictPort:true,fs:{allow:[root,path.resolve(root,'../../../node_modules')]}}};
