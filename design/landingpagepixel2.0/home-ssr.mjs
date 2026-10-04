import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {parseHTML,Node,DOMParser} from 'linkedom';

export async function runtimeSource(){
  return (await readFile('public/support.js','utf8')).replace('if (key === "class") key = "className";',
    'key = ({srcset:"srcSet",hreflang:"hrefLang","stroke-width":"strokeWidth","stroke-linecap":"strokeLinecap","stroke-linejoin":"strokeLinejoin"})[key] || key; if (key === "class") key = "className";');
}

// Render the SAME authored DC template and logic at build time. No second copy
// of the content, browser capture, lifecycle effects, network or viewport sniffing.
export async function renderHome(home) {
  const {document}=parseHTML(home);
  const errors=[];
  const window={React,addEventListener(){}};
  window.parent=window;
  const sandbox={window,document,Node,DOMParser,URL,URLSearchParams,
    console:{error:(...args)=>errors.push(args.join(' ')),warn:(...args)=>errors.push(args.join(' '))},
    fetch:()=>{throw new Error('Network is forbidden during home rendering');}};
  const source=await runtimeSource();
  const anchor=source.lastIndexOf('  hideRawTemplate();');
  if(anchor<0)throw new Error('DC server adapter anchor missing');
  runInNewContext(source.slice(0,anchor)+`\nwindow.serverRuntime=createRuntime(document); window.serverParsed=parseDcDocument(document);\n})();`,sandbox,{timeout:5000});
  const runtime=window.serverRuntime;
  runtime.markFetched('Root');runtime.setRootName('Root');runtime.adoptParsed('Root',window.serverParsed);
  const html=renderToString(React.createElement(runtime.getDC('Root'),{heroVisual:'Cubo servicios'}));
  if(errors.length||/sc-has-error|sc-placeholder|sc-missing/.test(html))throw new Error('Incomplete home render: '+errors.join('; '));
  const css=[...document.querySelectorAll('style')].map(s=>[...s.sheet.cssRules].map(r=>r.cssText).join('\n')).join('\n');
  return {html,css};
}
