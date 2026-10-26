import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../../../..');
const manifest=JSON.parse(await readFile(path.join(here,'manifest.json')));
const files=new Map([['/',[path.join(here,'qa.html'),'text/html']],['/index.html',[path.join(here,'qa.html'),'text/html']],['/viewport.html',[path.join(here,'viewport.html'),'text/html']],['/manifest.json',[path.join(here,'manifest.json'),'application/json']],['/farm-a.png',[path.join(root,'assets-src/design-pass/variants/farm-a.png'),'image/png']],...manifest.images.map(r=>['/textures/'+r.name+'.webp',[path.join(root,r.output),'image/webp']])]);
const server=http.createServer(async(req,res)=>{const item=files.get(new URL(req.url,'http://localhost').pathname);if(!item){res.writeHead(404);res.end();return;}try{const bytes=await readFile(item[0]);res.writeHead(200,{'Content-Type':item[1],'Cache-Control':'no-store'});res.end(bytes);}catch{res.writeHead(500);res.end('Missing review asset');}});
server.listen(Number(process.argv[2]||5297),'127.0.0.1',()=>console.log('Farm kit QA: http://127.0.0.1:'+server.address().port+'/viewport.html'));
