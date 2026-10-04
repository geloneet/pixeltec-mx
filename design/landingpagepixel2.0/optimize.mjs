import { build, transform } from 'esbuild';
import {renderHome,runtimeSource} from './home-ssr.mjs';
import sharp from 'sharp';
import { readFile, writeFile, readdir, mkdir, cp } from 'node:fs/promises';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';

export async function optimizeAssets() {
  const vendors = ['react/umd/react.production.min.js','react-dom/umd/react-dom.production.min.js','matter-js/build/matter.min.js','lenis/dist/lenis.min.js'];
  const sources = await Promise.all(vendors.map(p => readFile('node_modules/'+p,'utf8')));
  let runtime = (await runtimeSource()).replaceAll('doc.querySelector(\"x-dc\")','doc.querySelector(\"script[data-dc-template]\") ?? doc.querySelector(\"x-dc\")').replace('template: dc.innerHTML,','template: dc.matches(\"script[data-dc-template]\") ? JSON.parse(dc.textContent).html : dc.innerHTML,').replace('if (!window.__resources) {','if (!window.__resources && !doc.documentElement.hasAttribute("data-dc-static")) {');
  runtime=runtime.replace('const hostEl = doc.createElement("div");','const existing = doc.getElementById("dc-root"); const hostEl = existing || doc.createElement("div");')
    .replace('dc.replaceWith(hostEl);','if (existing) dc.remove(); else dc.replaceWith(hostEl);')
    .replace('if (ReactDOM.createRoot)','if (existing && ReactDOM.hydrateRoot) ReactDOM.hydrateRoot(hostEl, h(StandaloneRoot)); else if (ReactDOM.createRoot)');
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
  // One deterministic initial state in both environments; CSS owns responsive layout.
  home=home.replace('w: typeof window !== "undefined" ? window.innerWidth : 1440','w: 1440');
  home=home.replace("    window.addEventListener('resize', this._onResize);", "    window.addEventListener('resize', this._onResize); this.setState({w: window.innerWidth});");
  // Breakpoint-sensitive layout must work before hydration and with JS disabled.
  for(const key of ['aboutCols','navDisplay','socialDisplay','svcCols','svcImgCol','whyCols','whyPhotoSpan','whyPhotoRow','footCols','projTopCols','projBottomCols','blogCols','tBasis']){
    const name=key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
    home=home.replaceAll('{{ '+key+' }}','var(--home-'+name+')');
  }
  home=home.replace('ref="{{ pillsRef }}"','class="home-pills" ref="{{ pillsRef }}"')
    .replace('position:relative;margin-top:clamp(48px,7vw,110px)','position:relative;margin-top:clamp(32px,7vw,110px)')
    .replace('<div style="flex:1 1 380px','<div class="home-intro" style="flex:1 1 380px')
    .replace('background-color:#dedbd4','background-color:#676761')
    .replace('background-size:0% 100%','background-size:100% 100%');
  // Keep a visible static pill composition; physics starts from it without a blank drop-in.
  home=home.replace("const drop = !this._dropped && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;",'const drop = false;');
  home=home.replace("    const { Engine, Bodies, Composite, Body } = Matter;", "    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.innerWidth < 640) return;\n    const { Engine, Bodies, Composite, Body } = Matter;");
  home=home.replace('<aside aria-label=', '<aside id="home-menu" role="dialog" aria-modal="true" aria-hidden="{{ menuHidden }}" aria-label=')
    .replace('transform:{{ drawerTransform }}','visibility:{{ menuVisibility }};transform:{{ drawerTransform }}')
    .replace('onClick="{{ openMenu }}"','aria-controls="home-menu" aria-expanded="{{ menuExpanded }}" onClick="{{ openMenu }}"')
    .replace('      openMenu: () => this.setState({ menu: true }),','      menuHidden: !this.state.menu, menuExpanded: this.state.menu, menuVisibility: this.state.menu ? "visible" : "hidden",\n      openMenu: () => this.setMenu(true),')
    .replace('      closeMenu: () => this.setState({ menu: false }),','      closeMenu: () => this.setMenu(false),')
    .replace('if (e.key === "Escape") this.setState({ menu: false });','if (e.key === "Escape" && this.state.menu) this.setMenu(false); if (e.key === "Tab" && this.state.menu) { const items = [...document.querySelectorAll("#home-menu a, #home-menu button")]; const first=items[0], last=items.at(-1); if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();} else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();} }')
    .replace('  componentDidMount() {',`  setMenu(open) {
    if(open){this._menuFocus=document.activeElement;this._bodyOverflow=document.body.style.overflow;document.body.style.overflow='hidden';this._lenis?.stop();}
    this.setState({menu:open},()=>{
      if(open)document.querySelector('#home-menu button')?.focus();
      else {document.body.style.overflow=this._bodyOverflow || '';this._lenis?.start();this._menuFocus?.focus();}
    });
  }
  componentDidMount() {`);
  home=home.replace('<div onMouseEnter="{{ tPause }}"','<div class="home-testimonial-window" onFocus="{{ tPause }}" onBlur="{{ tResume }}" onMouseEnter="{{ tPause }}"')
    .replace('<div style="display:flex;gap:24px;transform:{{ tTransform }}','<div class="home-testimonial-track" style="display:flex;gap:24px;transform:{{ tTransform }}')
    .replace('width:10px;height:10px;padding:0;border:0;border-radius:50%;background:{{ d.bg }}','width:44px;height:44px;box-sizing:border-box;padding:17px;background-clip:content-box;border:0;border-radius:50%;background-color:{{ d.bg }}')
    .replace(/    this\._tTimer = setInterval[^\n]+\n/,'');
  const rendered=await renderHome(home);
  home=home.replace('</head>','<style data-home-rendered>'+rendered.css+'</style></head>');
  const noScript='<noscript><style>[aria-controls="home-menu"]{visibility:hidden}.home-testimonial-track{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));transform:none!important}.home-testimonial-window{overflow:visible!important}</style><a href="'+(/<html[^>]*lang="en"/.test(home)?'/en/mapa/':'/mapa/')+'" aria-label="'+(/<html[^>]*lang="en"/.test(home)?'All pages':'Todas las páginas')+'" style="position:fixed;right:max(calc((100vw - 1440px)/2 + 24px),calc(clamp(12px,4vw,56px) + 16px));top:24px;z-index:100000;color:#0b0b0a;background:#f2efe8;padding:4px;font-size:24px;line-height:1">☰</a></noscript>';
  home=home.replace('<body data-pixel-home>','<body data-pixel-home>'+noScript+'<div id="dc-root" data-home-ssr>'+rendered.html+'</div>');
  const navigationCSS=await readFile('public/navigation.css','utf8');
  home=home.replace('</head>','<style>'+navigationCSS+'</style><script defer src="/app-navigation.js"></script></head>');
  // Keep the runtime template inert in the initial document: one real H1, no duplicate outline.
  home=home.replace(/<x-dc>([\s\S]*?)<\/x-dc>/,(_,html)=>'<script type="application/json" data-dc-template>'+JSON.stringify({html}).replaceAll('<','\\u003c')+'</script>');
  return home;
}

export async function compressOutput(dir='dist') {
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    const path=dir+'/'+entry.name;
    if(entry.isDirectory()){await compressOutput(path);continue;}
    if(!/\.(html|js|css|svg|json)$/.test(path))continue;
    const bytes=await readFile(path);
    if(bytes.length<500)continue;
    await writeFile(path+'.br',brotliCompressSync(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:/^(?:dist\/|dist\/en\/)index\.html$/.test(path)?11:6}}));
    await writeFile(path+'.gz',gzipSync(bytes,{level:9}));
  }
}
