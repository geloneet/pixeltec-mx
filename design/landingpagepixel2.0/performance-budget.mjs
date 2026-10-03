import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
// Budgets cover the shipped experience, including its live 3D scene (never a stripped audit variant).
const budgets={'app-navigation.js.br':3500,'navigation.css.br':2000,'index.html.br':30000,'en/index.html.br':30000,'home-runtime.js.br':80000,'home-enhancements.js.br':30000,'cubo.js.br':150000,'assets/desarrollador-360.webp':18000,'assets/desarrollador-720.webp':32000};
for(const [file,max] of Object.entries(budgets))assert.ok((await stat('dist/'+file)).size<=max,`${file} exceeded ${max} bytes`);
for(const path of ['index.html','en/index.html']){
const home=await readFile('dist/'+path,'utf8');
assert.ok(!/<script\b[^>]*src="https?:/.test(home),'Home must not fetch third-party startup scripts');
assert.ok(!/<link\b(?=[^>]*rel="(?:stylesheet|preload|preconnect)")[^>]*href="https?:/.test(home),'Home must not depend on remote font CSS');
assert.match(home,/loading="lazy"/);
assert.match(home,/<html[^>]*data-dc-static/);
}
const original=await readFile('src/home.dc.html');
const {createHash}=await import('node:crypto');
assert.equal(createHash('sha256').update(original).digest('hex'),'b49e6c58fbe039b35e6ac5ad8685939ca8023d49d3d4d0b07657e9fb44df6e02','Original supplied design must remain intact');
console.log('Performance asset budgets and original-source identity: PASS');
