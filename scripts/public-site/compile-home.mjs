import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parseHTML} from '../../design/landingpagepixel2.0/node_modules/linkedom/esm/index.js';
// Compile the approved template into ordinary React source. No runtime eval,
// template interpreter, nested React root or external script loader is shipped.
const root=new URL('../../',import.meta.url);const en=process.argv.includes('--en');
const doc=parseHTML(await readFile(new URL('design/landingpagepixel2.0/dist/'+(en?'en/':'')+'index.html',root),'utf8')).document;
const template=parseHTML('<html><body>'+JSON.parse(doc.querySelector('[data-dc-template]').textContent).html.replaceAll('/proyectos/','/casos-de-exito/')+'</body></html>').document;
let logic=doc.querySelector('script[type="text/x-dc"]').textContent.replaceAll('/proyectos/','/casos-de-exito/');
const names=new Set();
function expr(s,locals){return s.replace(/\b[A-Za-z_$][\w$]*\b/g,(name,pos,all)=>{if(all[pos-1]!=='.'&&!locals.has(name)&&!['true','false','null','undefined'].includes(name))names.add(name);return name;});}
function value(s,locals){const m=s.match(/^\{\{([^{}]*?)\}\}$/);if(m)return '('+expr(m[1].trim(),locals)+')';const parts=[];let end=0;for(const x of s.matchAll(/\{\{([\s\S]*?)\}\}/g)){parts.push(JSON.stringify(s.slice(end,x.index)), '('+expr(x[1].trim(),locals)+')');end=x.index+x[0].length;}parts.push(JSON.stringify(s.slice(end)));return parts.join('+');}
const attrs={class:'className',for:'htmlFor',srcset:'srcSet',tabindex:'tabIndex',crossorigin:'crossOrigin',fetchpriority:'fetchPriority',readonly:'readOnly',autofocus:'autoFocus',maxlength:'maxLength','stroke-width':'strokeWidth','stroke-linecap':'strokeLinecap','stroke-linejoin':'strokeLinejoin',viewbox:'viewBox'};
function node(n,locals=new Set()){
 if(n.nodeType===3)return n.textContent === '★★★★★' ? 'React.createElement(RatingStars)' : value(n.textContent,locals);
 if(n.nodeType!==1)return 'null';
 const tag=n.localName;
 if(['helmet','script','style','noscript'].includes(tag))return 'null';
 const children=[...n.childNodes].map(x=>node(x,locals));
 if(tag==='sc-for'){const as=n.getAttribute('as');const nested=new Set([...locals,as]);return '('+value(n.getAttribute('list'),locals)+'??[]).map(('+as+',index)=>React.createElement(React.Fragment,{key:index},'+[...n.childNodes].map(x=>node(x,nested)).join(',')+'))';}
 if(tag==='sc-if')return '('+value(n.getAttribute('value'),locals)+'?React.createElement(React.Fragment,null,'+children.join(',')+'):null)';
 if(n.hasAttribute('data-summary'))children.push('React.createElement(LeadFollowup,{key:"followup"})');
 const props=[];
 for(const a of n.attributes){if(a.name.startsWith('hint-')||a.name.startsWith('style-'))continue;if(a.name==='id'&&/^diagnostic.*form$/.test(a.value)){props.push('"data-diagnostic-form":true');continue;}let key=attrs[a.name]??a.name;if(/^on[a-z]/.test(key)){const event={onclick:'onClick',onmouseenter:'onMouseEnter',onmouseleave:'onMouseLeave',onfocus:'onFocus',onblur:'onBlur'};key=event[key]??key;}
 if(key==='style'){const style=[];for(const rule of a.value.split(';')){const ix=rule.indexOf(':');if(ix<0)continue;let k=rule.slice(0,ix).trim();if(!k.startsWith('--'))k=k.replace(/-([a-z])/g,(_,x)=>x.toUpperCase());style.push(JSON.stringify(k)+':'+value(rule.slice(ix+1).trim(),locals));}props.push('style:{'+style.join(',')+'}');}
 else props.push(JSON.stringify(key)+':'+(['hidden','disabled','checked','multiple','required'].includes(key)&&a.value===''?'true':value(a.value,locals)));
 }
 return 'React.createElement('+(tag==='a'?'Link':JSON.stringify(tag))+',{'+props.join(',')+'}'+(children.length?','+children.join(','):'')+')';
}
// Shared navigation/footer will be owned by the public Next layout.
template.querySelector('header')?.parentElement.remove();template.querySelector('footer')?.remove();template.querySelector('#home-menu')?.remove();
const output=[...template.body.childNodes].map(x=>node(x));
// Original dormant experimental hero variants are intentionally excluded.
logic=logic.replace(/  async initCube\(\)[\s\S]*?  initHero\(\)[^\n]*\n/,'  initHero() { this.initServiceCube(); }\n');
logic=logic.replace(/  async initGrid\(\)[\s\S]*?  componentDidUpdate/,'  componentDidUpdate');
logic=logic.replace('componentDidMount() {','componentDidMount() { this._cubeDead=false;');
logic=logic.replace('extends DCLogic','extends React.Component');
logic=logic.replace("import(new URL('/cubo.js', document.baseURI).href)","import('../cube.js')");
logic=logic.replace('async initServiceCube() {', 'async initServiceCube() {\n    const generation = this._cubeGeneration = (this._cubeGeneration || 0) + 1;');
logic=logic.replace('if (this._cubeDead) return;', 'if (this._cubeDead || generation !== this._cubeGeneration) return;');
logic=logic.replace('if (this._cubeDead || !this.cubeRef.current) return;', 'if (this._cubeDead || generation !== this._cubeGeneration || !this.cubeRef.current) return;');
logic=logic.replace('if (this._cubeDead) { c.destroy(); return; }', 'if (this._cubeDead || generation !== this._cubeGeneration) { c.destroy(); return; }');
logic=logic.replace('componentWillUnmount() {', 'componentWillUnmount() { this._cubeGeneration = (this._cubeGeneration || 0) + 1;');
logic=logic.replace('window.Matter ? this.initPhysics()', 'Matter ? this.initPhysics()');
logic=logic.replace(/posts: \[.*?\],\n/, 'posts: this.props.posts ?? [],\n');
const close=logic.lastIndexOf('}');logic=logic.slice(0,close)+'\n render(){ const {'+[...names].filter(x=>x!=='index').join(',')+'}=this.renderVals(); return React.createElement(React.Fragment,null,'+output.join(',')+'); }\n'+logic.slice(close);
await mkdir(new URL('src/components/public-site/generated/',root),{recursive:true});
await writeFile(new URL('src/components/public-site/generated/'+(en?'home-en':'home')+'.jsx',root),'"use client";\n// Generated by scripts/public-site/compile-home.mjs from approved source.\nimport React from "react";\nimport {RatingStars} from "../rating-stars";\nimport {LeadFollowup} from "../lead-followup";\nimport Link from "next/link";\nimport Matter from "matter-js";\n'+logic+'\nexport default Component;\n');
console.log('Compiled home into React; template interpreter excluded.');
