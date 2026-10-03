import { build, transform } from 'esbuild';
import sharp from 'sharp';
import { readFile, writeFile, readdir, mkdir, cp } from 'node:fs/promises';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';

export async function optimizeAssets() {
  const vendors = ['react/umd/react.production.min.js','react-dom/umd/react-dom.production.min.js','matter-js/build/matter.min.js','lenis/dist/lenis.min.js'];
  const sources = await Promise.all(vendors.map(p => readFile('node_modules/'+p,'utf8')));
  const runtime = (await readFile('public/support.js','utf8')).replace('if (!window.__resources) {','if (!window.__resources && !doc.documentElement.hasAttribute("data-dc-static")) {');
  const bundled = await transform([...sources.slice(0,2),runtime].join('\n;\n'),{minify:true,target:'es2022',legalComments:'inline'});
  await writeFile('dist/home-runtime.js',bundled.code);
  const enhancements=await transform(sources.slice(2).join('\n;\n'),{minify:true,target:'es2022',legalComments:'inline'});
  await writeFile('dist/home-enhancements.js',enhancements.code);
  await build({entryPoints:['public/cubo.js'],bundle:true,format:'esm',target:'es2022',minify:true,outfile:'dist/cubo.js',legalComments:'linked'});
  await mkdir('dist/licenses',{recursive:true});
  for (const pkg of ['react','react-dom','three','matter-js','lenis']) {
    const candidates=['LICENSE','LICENSE.md','LICENSE.txt'];
    for(const name of candidates) { try {await cp(`node_modules/${pkg}/${name}`,`dist/licenses/${pkg}.txt`);break;}catch(e){if(e.code!=='ENOENT')throw e;} }
  }
  for (const width of [360,720]) {
    await sharp('public/assets/desarrollador-codigo-sinfondo.png').resize({width}).webp({quality:85,alphaQuality:100,effort:5}).toFile(`dist/assets/desarrollador-${width}.webp`);
  }
}

export async function optimizeHome(home) {
  const fontCSS=await readFile('public/fonts.css','utf8');
  const motionCSS=await readFile('public/motion.css','utf8');
  const homeCSS=await readFile('public/home.css','utf8');
  home=home.replace(/<html lang="(es|en)">/,'<html lang="$1" data-dc-static>');
  home=home.replace('<script src="./support.js"></script>',`<link rel="preload" href="/fonts/bricolage.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/jetbrains.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/outfit.woff2" as="font" type="font/woff2" crossorigin>
<style>${fontCSS}\n${homeCSS}</style>
<style>x-dc{display:none}body{margin:0;background:#0b0b0a}</style>
<script defer src="/home-runtime.js"></script>
<script defer src="/home-enhancements.js" fetchpriority="low"></script>`);
  home=home.replace(/<link[^>]+href="https:\/\/fonts\.[^>]+>/g,'').replace(/<script src="https:\/\/(cdnjs\.cloudflare\.com|unpkg\.com)[^"]+"><\/script>/g,'');
  home=home.replace('src="assets/desarrollador-codigo-sinfondo.png"','src="/assets/desarrollador-360.webp" srcset="/assets/desarrollador-360.webp 360w, /assets/desarrollador-720.webp 720w" sizes="(max-width: 916px) 220px, (max-width: 1500px) 24vw, 360px" width="1254" height="1254" loading="lazy" decoding="async"');
  home=home.replace('<link rel="stylesheet" href="/motion.css">', `<style>${motionCSS}</style>`);
  // Paint text before creating GPU resources; no score-specific timers or UA branches.
  home=home.replace('let mod; try { mod = await import',`if (host.getBoundingClientRect().top > innerHeight + 200) {
      await new Promise(resolve => {
        this._cubeHostObserver = new IntersectionObserver(entries => {
          if (entries.some(e => e.isIntersecting)) { this._cubeHostObserver.disconnect(); resolve(); }
        }, { rootMargin: '200px' });
        this._cubeHostObserver.observe(host);
      });
    }
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (this._cubeDead) return;
    let mod; try { mod = await import`);
  home=home.replace('const c = mod.mountCube(host,','const c = await mod.mountCube(host,');
  home=home.replace('this._cubeCleanup = () => c.destroy();','if (this._cubeDead) { c.destroy(); return; }\n    this._cubeCleanup = () => c.destroy();');
  home=home.replace('componentWillUnmount() {', 'componentWillUnmount() { this._cubeHostObserver?.disconnect();');
  // First paint is derived from the final localized template, never a second copy of its content.
  const helmetEnd=home.indexOf('</helmet>');
  const heroEnd=home.indexOf('</section>',helmetEnd)+10;
  if(helmetEnd<0||heroEnd<10)throw new Error('Home first-paint anchors missing');
  let firstPaint=home.slice(helmetEnd+9,heroEnd)+'</div>';
  firstPaint=firstPaint.replace(/\s(?:ref|onClick|style-hover)="[^"]*"/g,'').replace(/\{\{[^}]+\}\}/g,'flex');
  firstPaint=firstPaint.replace(/<button aria-label="(?:Menú|Menu)"([^>]*)>([\s\S]*?)<\/button>/, '<a aria-label="'+(home.includes('lang="en"')?'All pages':'Todas las páginas')+'" href="'+(home.includes('lang="en"')?'/en/mapa/':'/mapa/')+'"$1>$2</a>');
  home=home.replace('<body data-pixel-home>','<body data-pixel-home><div id="home-first-paint">'+firstPaint+'</div>');
  const navigationCSS=await readFile('public/navigation.css','utf8');
  home=home.replace('</head>','<style>'+navigationCSS+'</style><script defer src="/app-navigation.js"></script></head>');
  return home;
}

export async function compressOutput(dir='dist') {
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    const path=dir+'/'+entry.name;
    if(entry.isDirectory()){await compressOutput(path);continue;}
    if(!/\.(html|js|css|svg|json)$/.test(path))continue;
    const bytes=await readFile(path);
    if(bytes.length<500)continue;
    await writeFile(path+'.br',brotliCompressSync(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:6}}));
    await writeFile(path+'.gz',gzipSync(bytes,{level:9}));
  }
}
