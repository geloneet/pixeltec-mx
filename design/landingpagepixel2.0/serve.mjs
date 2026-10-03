import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
http.createServer(async (req,res) => {
  try {
    let path = resolve(root, '.' + decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname));
    if(path !== root && !path.startsWith(root + sep)) {res.writeHead(403).end();return;}
    if((await stat(path)).isDirectory()) path += '/index.html';
    const data = await readFile(path);
    res.writeHead(200, {'Content-Type':mime[extname(path)] ?? 'application/octet-stream','Cache-Control':'no-store'}).end(data);
  } catch {
    res.writeHead(404, {'Content-Type':'text/html; charset=utf-8'}).end(await readFile(root+'/404.html'));
  }
}).listen(4317,'127.0.0.1',()=>console.log('PixelTEC diseño: http://127.0.0.1:4317'));
