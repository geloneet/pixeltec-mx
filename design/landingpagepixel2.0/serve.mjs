import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.svg':'image/svg+xml','.json':'application/json','.txt':'text/plain; charset=utf-8'};
function encodings(header='') {
  const values=new Map(header.split(',').map(part=>{
    const [name,...params]=part.trim().toLowerCase().split(';');
    const q=params.find(p=>p.trim().startsWith('q='));
    return [name,q?Number(q.trim().slice(2)):1];
  }));
  return ['br','gzip'].filter(name=>(values.get(name)??values.get('*')??0)>0).sort((a,b)=>(values.get(b)??values.get('*')??0)-(values.get(a)??values.get('*')??0));
}
export function createPreviewServer(directory='dist') {
  const root=resolve(directory);
  return http.createServer(async(req,res)=>{
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{Allow:'GET, HEAD'}).end();return;}
    try {
      let path=resolve(root,'.'+decodeURIComponent(new URL(req.url??'/','http://localhost').pathname));
      if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end();return;}
      if((await stat(path)).isDirectory())path+='/index.html';
      let data;let encoding;
      for(const option of encodings(req.headers['accept-encoding'])) {
        try{data=await readFile(path+(option==='br'?'.br':'.gz'));encoding=option;break;}
        catch(error){if(error.code!=='ENOENT')throw error;}
      }
      data??=await readFile(path);
      const etag='"'+createHash('sha256').update(data).digest('hex').slice(0,24)+'"';
      const headers={'Content-Type':mime[extname(path)]??'application/octet-stream','Cache-Control':'public, max-age=0, must-revalidate','ETag':etag,'Vary':'Accept-Encoding','X-Content-Type-Options':'nosniff'};
      if(encoding)headers['Content-Encoding']=encoding;
      if(req.headers['if-none-match']?.split(',').map(t=>t.trim()).includes(etag)){res.writeHead(304,headers).end();return;}
      res.writeHead(200,{...headers,'Content-Length':data.length}).end(req.method==='HEAD'?undefined:data);
    }catch(error){
      const status=error instanceof URIError?400:404;
      const data=await readFile(root+'/404.html');
      res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}).end(req.method==='HEAD'?undefined:data);
    }
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  createPreviewServer().listen(4317,'127.0.0.1',()=>console.log('PixelTEC diseño: http://127.0.0.1:4317'));
}
