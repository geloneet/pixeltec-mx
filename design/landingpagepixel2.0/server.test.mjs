import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { createPreviewServer } from './serve.mjs';

test('preview negotiates compression, validates cache and protects file boundaries',async()=>{
  const server=createPreviewServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const port=server.address().port;
  const get=(path,headers={},method='GET')=>new Promise((resolve,reject)=>{
    http.request({host:'127.0.0.1',port,path,method,headers},res=>{
      const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));
    }).on('error',reject).end();
  });
  try {
    const plain=await get('/');assert.equal(plain.status,200);assert.match(plain.body.toString(),/Soluciones/);
    for(const [encoding,decode] of [['br',brotliDecompressSync],['gzip',gunzipSync]]){
      const r=await get('/',{'Accept-Encoding':encoding});assert.equal(r.headers['content-encoding'],encoding);assert.deepEqual(decode(r.body),plain.body);assert.ok(r.body.length<plain.body.length/2);
      const cached=await get('/',{'Accept-Encoding':encoding,'If-None-Match':r.headers.etag});assert.equal(cached.status,304);assert.equal(cached.body.length,0);
      assert.equal((await get('/',{'Accept-Encoding':encoding,'If-None-Match':'"old"'})).status,200);
    }
    assert.equal((await get('/',{'Accept-Encoding':'br;q=0, gzip;q=0'})).headers['content-encoding'],undefined);
    const head=await get('/',{'Accept-Encoding':'br'},'HEAD');assert.equal(head.status,200);assert.equal(head.body.length,0);
    assert.equal((await get('/assets/desarrollador-360.webp')).headers['content-type'],'image/webp');
    assert.equal((await get('/missing-test-path')).status,404);
    assert.equal((await get('/%2e%2e%2fpackage.json')).status,403);
    assert.equal((await get('/%',{})).status,400);
    assert.equal((await get('/',{},'POST')).status,405);
  } finally {await new Promise(r=>server.close(r));}
});
