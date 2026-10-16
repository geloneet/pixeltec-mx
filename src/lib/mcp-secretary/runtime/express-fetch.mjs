import {IncomingMessage,ServerResponse} from 'node:http';
import {Duplex} from 'node:stream';
/** Runs the SDK Express handlers on genuine Node HTTP objects within a Fetch
 * route. No listener/socket connection or proxy is created. Body is bounded;
 * cookies/Origin stay from the real request. App Router owns session context. */
export async function expressFetch(app,request,{maxBody=16384,timeoutMs=30000}={}){
 const start=Date.now(),url=new URL(request.url),reader=request.body?.getReader();const chunks=[];let size=0;
 let bodyTimer,abortBody;
 if(request.signal.aborted)return Response.json({error:'oauth_unavailable'},{status:503});
 if(reader){try{
  const stop=new Promise((_,reject)=>{bodyTimer=setTimeout(()=>reject(new Error('BODY_TIMEOUT')),timeoutMs);abortBody=()=>reject(new Error('BODY_ABORTED'));request.signal.addEventListener('abort',abortBody,{once:true});});
  for(;;){const {done,value}=await Promise.race([reader.read(),stop]);if(done)break;size+=value.byteLength;if(size>maxBody){void reader.cancel().catch(()=>{});return Response.json({error:'payload_too_large'},{status:413,headers:{'Cache-Control':'no-store'}});}chunks.push(Buffer.from(value));}
 }catch{void reader.cancel().catch(()=>{});return Response.json({error:'oauth_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
 finally{clearTimeout(bodyTimer);if(abortBody)request.signal.removeEventListener('abort',abortBody);reader.releaseLock();}}
 return new Promise(resolve=>{
  let settled=false;const output=[];let abort;
  const cleanup=()=>{clearTimeout(timer);if(abort)request.signal.removeEventListener('abort',abort);};
  const socket=new Duplex({read(){},write(_chunk,_encoding,done){done();}});
  Object.defineProperty(socket,'remoteAddress',{value:'127.0.0.1'});
  const req=new IncomingMessage(socket);req.complete=true;req.method=request.method;req.url=url.pathname+url.search;req.httpVersion='1.1';req.httpVersionMajor=1;req.httpVersionMinor=1;
  req.headers=Object.fromEntries(request.headers);req.headers.host=url.host;
  delete req.headers['transfer-encoding'];req.headers['content-length']=String(size);
  const res=new ServerResponse(req);res.assignSocket(socket);res.setHeader('Cache-Control','no-store');
  const finish=()=>{if(settled)return;settled=true;cleanup();const headers=new Headers();
   for(const [name,value] of Object.entries(res.getHeaders()))for(const v of Array.isArray(value)?value:[value])if(v!==undefined)headers.append(name,String(v));
   resolve(new Response(request.method==='HEAD'||[204,304].includes(res.statusCode)?null:Buffer.concat(output),{status:res.statusCode,headers}));socket.destroy();};
  const write=res.write.bind(res),end=res.end.bind(res);
  res.write=function(chunk,encoding,callback){if(chunk)output.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk,typeof encoding==='string'?encoding:undefined));return write(chunk,encoding,callback);};
  res.end=function(chunk,encoding,callback){if(chunk)output.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk,typeof encoding==='string'?encoding:undefined));const result=end(chunk,encoding,callback);finish();return result;};
  const fail=()=>{if(settled)return;settled=true;cleanup();resolve(Response.json({error:'oauth_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}}));req.destroy();res.destroy();socket.destroy();};
  const timer=setTimeout(fail,Math.max(1,timeoutMs-(Date.now()-start)));abort=fail;request.signal.addEventListener('abort',abort,{once:true});
  res.once('finish',finish);res.once('error',fail);
  app(req,res,error=>{if(!res.headersSent){res.statusCode=error?503:404;res.end(JSON.stringify({error:error?'oauth_unavailable':'not_found'}));}});
  for(const chunk of chunks)req.push(chunk);req.push(null);
 });
}
