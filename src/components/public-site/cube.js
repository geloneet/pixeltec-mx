import * as THREE from 'three';

const clamp = THREE.MathUtils.clamp;
const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

function roundedBox(w, h, d, r, sw = 16, sh = 16, sd = 16) {
  const g = new THREE.BoxGeometry(w, h, d, sw, sh, sd);
  const p = g.attributes.position, n = g.attributes.normal;
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  const v = new THREE.Vector3(), c = new THREE.Vector3(), dv = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(clamp(v.x, -hx, hx), clamp(v.y, -hy, hy), clamp(v.z, -hz, hz));
    dv.subVectors(v, c);
    if (dv.lengthSq() > 1e-9) { dv.normalize(); v.copy(c).addScaledVector(dv, r); n.setXYZ(i, dv.x, dv.y, dv.z); }
    p.setXYZ(i, v.x, v.y, v.z);
  }
  p.needsUpdate = true; n.needsUpdate = true; return g;
}

function canvasTex(draw, aniso, size = 512) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.anisotropy = aniso; return t;
}

// Metal perforado: color, rugosidad y relieve
function perforated(base, dot, aniso, n = 22) {
  const grid = (bg, fg) => canvasTex((g, s) => {
    g.fillStyle = bg; g.fillRect(0, 0, s, s); g.fillStyle = fg;
    const st = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.beginPath(); g.arc(st * (i + .5), st * (j + .5), st * 0.24, 0, Math.PI * 2); g.fill(); }
  }, aniso, 256);
  const map = grid(base, dot); map.colorSpace = THREE.SRGBColorSpace;
  return { map, roughnessMap: grid('#555555', '#bbbbbb'), bumpMap: grid('#ffffff', '#000000') };
}

// Pixeles grises con acentos lima
function speckle(aniso) {
  const t = canvasTex((g, s) => {
    // 256px basta: el patrón es de píxeles
    g.fillStyle = '#2a3f8a'; g.fillRect(0, 0, s, s);
    const n = 40, st = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const r = Math.random();
      if (r < 0.16) g.fillStyle = '#1b2a5e'; else if (r < 0.25) g.fillStyle = '#4a66b8'; else if (r < 0.30) g.fillStyle = '#eef2f9'; else continue;
      g.fillRect(i * st, j * st, st, st);
    }
  }, aniso, 256);
  t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Icono como calcomanía transparente. 'engrave' = grabado en metal
function iconTex(path, color, aniso) {
  const t = canvasTex((g, s) => {
    const draw = (col, off) => {
      g.save(); g.translate(s * 0.2 + off, s * 0.2 + off); g.scale(s * 0.6 / 48, s * 0.6 / 48);
      g.strokeStyle = col; g.lineWidth = 3.2; g.lineCap = g.lineJoin = 'round'; g.stroke(new Path2D(path)); g.restore();
    };
    if (color === 'engrave') { draw('rgba(255,255,255,0.95)', 1.6); draw('#081030', 0); } else draw(color, 0);
  }, aniso, 256);
  t.colorSpace = THREE.SRGBColorSpace; return t;
}

export async function mountCube(stage, { variant = 'A', services, autoOpen = 0, bg = 0x0a0d1a, half = 2.9, gap = 0.12, ink = '#eef2ff', inkSoft = '#aab4cc', concept = null }) {
  const compact = matchMedia('(max-width: 700px), (pointer: coarse)').matches;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const frameInterval = 1000 / (compact ? 30 : 45);
  // Conceptos: 'hover' (A) tocar un cubo lo eleva y adelanta su etiqueta · 'parallax' (B) capas por profundidad que siguen al mouse
  // 'focus' (C) los servicios giran para mirarte y los decorativos se apartan · 'cascade' (D) apertura en cascada, uno tras otro
  concept = concept || { A: 'hover', B: 'parallax', C: 'focus', D: 'cascade' }[variant];
  if (getComputedStyle(stage).position === 'static') stage.style.position = 'relative';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  stage.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !compact, alpha: bg === null, powerPreference: 'low-power', preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, compact ? 1 : 1.25));
  renderer.shadowMap.enabled = false; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
  const aniso = Math.min(renderer.capabilities.getMaxAnisotropy(), compact ? 2 : 4);

  const scene = new THREE.Scene(); if (bg !== null) scene.background = new THREE.Color(bg);
  // Cámara isométrica (como el logo): vemos la cara superior, la +z (izquierda) y la +x (derecha)
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.set(1, 0.95, 1).normalize().multiplyScalar(20); camera.lookAt(0, 0, 0);

  // Estudio: paneles blancos + un toque azul
  const env = new THREE.Scene();
  const panel = (hex, k, w, h, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m);
  };
  env.background = new THREE.Color(0x0a1230);
  panel(0xffffff, 3.5, 5, 5, [0, 8, 0]);
  panel(0xffffff, 2.4, 1.0, 10, [-2, 6, 6]);
  panel(0x9db9ff, 2.2, 8, 4, [-3, 2, 7]);
  panel(0x7fa3ff, 2, 8, 4, [7, 1, -3]);
  panel(0x2f5bd9, 2.5, 6, 3, [-5, -3, -5]);
  panel(0x1e3fb0, 3, 4, 4, [5, -4, 4]);
  await new Promise(resolve => requestAnimationFrame(resolve));
  const pm = new THREE.PMREMGenerator(renderer);
  const environment = pm.fromScene(env, 0.04, .1, 100, {size: compact ? 64 : 128});
  scene.environment = environment.texture; pm.dispose();
  env.traverse(obj => {obj.geometry?.dispose(); obj.material?.dispose();});

  scene.add(new THREE.AmbientLight(0x6f8fff, 0.35));
  const key = new THREE.DirectionalLight(0xe8f0ff, 2.6); key.position.set(2, 7, 4); scene.add(key);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 6; key.shadow.bias = -0.0005;
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
  const fill = new THREE.DirectionalLight(0x4f7bff, 1.4); fill.position.set(5, 1, -2); scene.add(fill);

  // Materiales
  const silver = new THREE.MeshPhysicalMaterial({ ...perforated('#5a8cff', '#1f3a9e', aniso), roughness: 1, metalness: 0.9, bumpScale: 0.14, clearcoat: 0.6, clearcoatRoughness: 0.1, envMapIntensity: 2.0 });
  const gun = new THREE.MeshPhysicalMaterial({ ...perforated('#3a56b8', '#1a2c70', aniso), roughness: 1, metalness: 0.9, bumpScale: 0.25, clearcoat: 0.4, clearcoatRoughness: 0.15, envMapIntensity: 1.4 });
  const speck = new THREE.MeshStandardMaterial({ map: speckle(aniso), roughness: 0.55, metalness: 0.1 });
  // Vidrio esmerilado barato: sin transmission (evita un segundo render de la escena)
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x8fa6e6, transparent: true, opacity: 0.4, roughness: 0.28, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.4, depthWrite: false });
  const solid = hex => new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.32, metalness: 0.05, clearcoat: 0.5, clearcoatRoughness: 0.2 });
  const glowCore = hex => new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.35, roughness: 0.4 });
  const slatMats = ['#3a56a8', '#1b2a5e', '#3a56a8', '#1b2a5e'].map(solid);

  const S = 0.98, R = 0.045;
  const cubeGeo = roundedBox(S, S, S, 0.06, compact ? 5 : 8, compact ? 5 : 8, compact ? 5 : 8);
  const coreGeo = roundedBox(0.64, 0.64, 0.64, 0.05, 4, 4, 4);
  const slatGeo = roundedBox(S / 4 - 0.025, S, S, 0.03, 2, 8, 8);
  const navy = new THREE.MeshPhysicalMaterial({ color: 0x2f66f0, roughness: 0.2, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.6 });
  const shadowed = m => { m.castShadow = true; m.receiveShadow = true; return m; };
  const mk = {
    navy: () => shadowed(new THREE.Mesh(cubeGeo, navy)),
    silver: () => shadowed(new THREE.Mesh(cubeGeo, silver)),
    gun: () => new THREE.Mesh(cubeGeo, gun),
    speck: () => new THREE.Mesh(cubeGeo, speck),
    glass: core => { const g = new THREE.Group(); g.add(new THREE.Mesh(coreGeo, glowCore(core))); const m = new THREE.Mesh(cubeGeo, glass); m.renderOrder = 2; g.add(m); return g; },
    slats: () => { const g = new THREE.Group(); for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(slatGeo, slatMats[i]); m.position.x = -S / 2 + S / 8 + i * S / 4; g.add(m); } return g; },
  };
  const decal = (tex, face) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.84), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    if (face === 'x') { m.position.x = S / 2 + 0.004; m.rotation.y = Math.PI / 2; } else m.position.z = S / 2 + 0.004;
    m.renderOrder = 3; return m;
  };

  // Disposición del logo: 7 cubos visibles, falta el superior-frontal.
  // Servicios: arriba-izq, arriba-der, abajo-frente, abajo-der. Decorativos: láminas, plata perforada atrás, oculto.
  const V3 = (...a) => new THREE.Vector3(...a);
  const serviceSlots = [
    { pos: V3(-.5, .5, .5), face: 'z', out: V3(-.8, .5, .8), side: 'left', anchor: V3(-.72, 0, .72) },
    { pos: V3(.5, .5, -.5), face: 'x', out: V3(.8, .6, -.8), side: 'right', anchor: V3(.72, 0, -.72) },
    { pos: V3(.5, -.5, .5), face: 'z', out: V3(.55, -.5, .55), side: 'below', anchor: V3(.45, -.78, .45) },
    { pos: V3(.5, -.5, -.5), face: 'x', out: V3(.8, -.6, -.8), side: 'right', anchor: V3(.72, 0, -.72) },
  ];
  // Dos acabados: azul perforado (icono grabado) o marino liso (icono blanco)
  const P = ['silver', null, '#ffffff'], N = ['navy', null, '#ffffff'];
  const two = () => Math.random() < 0.5 ? P : N;
  // Patrones fijos: 'C' = servicios perforados, decorativos marino; 'D' = tablero alterno
  const pattern = { C: { skins: [P, P, P, P], deco: ['navy', 'navy', 'navy'] }, D: { skins: [P, N, N, P], deco: ['silver', 'navy', 'silver'] } }[variant];
  let skins = pattern ? pattern.skins : [two(), two(), two(), two()];
  if (!pattern && skins.every(k => k[0] === skins[0][0])) skins[Math.floor(Math.random() * 4)] = skins[0][0] === 'navy' ? P : N;
  const pick = i => pattern ? pattern.deco[i] : (Math.random() < 0.5 ? 'silver' : 'navy');
  const decoSlots = [
    { kind: pick(0), pos: V3(-.5, -.5, .5), out: V3(-.55, -.3, .55) },
    { kind: pick(1), pos: V3(-.5, .5, -.5), out: V3(-.5, .55, -.5) },
    { kind: pick(2), pos: V3(-.5, -.5, -.5), out: V3(-.45, -.55, -.45) },
  ];

  const root = new THREE.Group(); scene.add(root);
  const parts = serviceSlots.map((slot, i) => {
    const [kind, core, iconColor] = skins[i];
    const obj = mk[kind](core);
    obj.add(decal(iconTex(services[i].icon, iconColor, aniso), slot.face));
    root.add(obj);
    const align = slot.side === 'left' ? 'right' : slot.side === 'right' ? 'left' : 'center';
    const label = document.createElement('div');
    label.style.cssText = `position:absolute;z-index:5;left:0;top:0;width:150px;box-sizing:border-box;padding:10px 12px;border-radius:8px;background:rgba(11,11,10,.92);box-shadow:0 0 0 1px rgba(242,239,232,.08);pointer-events:none;opacity:0;color:${ink};text-align:${align};will-change:transform,opacity`;
    label.innerHTML = `<p style="margin:0;font-size:11px;line-height:1.3;letter-spacing:.14em;text-transform:uppercase;font-weight:600">${services[i].title}</p><p style="margin:6px 0 0;font-size:12px;line-height:1.45;color:${inkSoft}">${services[i].caption}</p>`;
    stage.appendChild(label);
    const rest = slot.pos.clone().multiplyScalar(1 + gap);
    return { ...slot, obj, label, rest, opened: rest.clone().add(slot.out), lift: 0, turn: 0, oi: 0 };
  });
  const decos = decoSlots.map(d => { const o = mk[d.kind](); root.add(o); const rest = d.pos.clone().multiplyScalar(1 + gap); return { ...d, obj: o, rest, opened: rest.clone().add(d.out) }; });

  // Cables de vidrio que conectan los cubos al abrirse, con pulsos de luz viajando
  const all = [...parts, ...decos];
  // Cada cubo se une a sus 2 vecinos más cercanos (sin duplicados)
  const links = [], seen = new Set();
  // Un cable es válido si no pasa por dentro de un tercer cubo (distancia al segmento > radio del cubo)
  const segV = new THREE.Vector3(), ptV = new THREE.Vector3();
  const blocked = (a, b) => all.some(c => {
    if (c === a || c === b) return false;
    segV.subVectors(b.opened, a.opened); ptV.subVectors(c.opened, a.opened);
    const tt = clamp(ptV.dot(segV) / segV.lengthSq(), 0, 1);
    return ptV.sub(segV.multiplyScalar(tt)).length() < 0.8;
  });
  all.forEach((a, i) => {
    all.map((b, j) => ({ j, d: a.opened.distanceTo(b.opened) })).filter(x => x.j !== i && !blocked(a, all[x.j])).sort((x, y) => x.d - y.d).slice(0, 2)
      .forEach(({ j }) => { const k = i < j ? i + '-' + j : j + '-' + i; if (!seen.has(k)) { seen.add(k); links.push({ a, b: all[j] }); } });
  });
  // Tubo de vidrio azulado + hilo interior luminoso
  const glassWire = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: compact ? 0 : 1, transparent: true, opacity: 1, roughness: 0.12, metalness: 0, thickness: 0.35, ior: 1.52, attenuationColor: new THREE.Color(0xdfe9ff), attenuationDistance: 1.2, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.6, side: THREE.FrontSide });
  // Sombra de contacto: borde oscuro suave para separar el vidrio del fondo blanco
  const rimWire = new THREE.MeshBasicMaterial({ color: 0x1b2a5e, transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false });
  const coreWire = rimWire; // alias para el fundido
  const wireGeo = new THREE.CylinderGeometry(0.04, 0.04, 1, compact ? 8 : 16, 1, false); wireGeo.rotateX(Math.PI / 2);
  const coreGeoW = new THREE.CylinderGeometry(0.05, 0.05, 1, compact ? 8 : 16, 1, false); coreGeoW.rotateX(Math.PI / 2);
  const wireGroup = new THREE.Group(); wireGroup.visible = false; root.add(wireGroup);
  links.forEach(l => {
    l.mesh = new THREE.Group();
    const tube = new THREE.Mesh(wireGeo, glassWire); tube.renderOrder = 4;
    const core = new THREE.Mesh(coreGeoW, rimWire); core.renderOrder = 0;
    l.mesh.add(core, tube); wireGroup.add(l.mesh);
  });
  const zAxis = new THREE.Vector3(0, 0, 1), dirV = new THREE.Vector3();
  const pulseTex = canvasTex((g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(190,215,255,0.9)'); gr.addColorStop(0.6, 'rgba(80,130,255,0.35)'); gr.addColorStop(1, 'rgba(80,130,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }, aniso, 64);
  const PULSES = compact ? 1 : 3; // cada pulso lleva una luz real; 3 mantiene el coste bajo
  const pulseGeo = new THREE.SphereGeometry(0.034, 12, 10);
  const pulses = Array.from({ length: PULSES }, () => {
    const g = new THREE.Group(); wireGroup.add(g);
    const bulb = new THREE.Mesh(pulseGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, toneMapped: false })); bulb.renderOrder = 2; g.add(bulb);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: pulseTex, color: 0x5b86ff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })); halo.scale.setScalar(0.42); halo.renderOrder = 3; g.add(halo);
    const light = { intensity: 0 };
    return { sp: g, bulb, halo, light, link: null, u: 0, speed: 1, dir: 1, wait: Math.random() * 1.2 };
  });
  const launch = p => { p.link = links[Math.floor(Math.random() * links.length)]; p.u = 0; p.dir = Math.random() < 0.5 ? 1 : -1; p.speed = 0.5 + Math.random() * 0.6; p.wait = 0.2 + Math.random() * 1.4; };
  const wa = new THREE.Vector3(), wb = new THREE.Vector3();

  // Interacción
  const mouse = { x: 0, y: 0 }, sm = { x: 0, y: 0 };
  let open = 0, target = 0, lastInput = performance.now(), visible = true, hovered = -1, needsPaint = true;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  parts.forEach((p, i) => p.obj.traverse(ch => { ch.userData.part = i; }));
  let overCube = false, cursorEl = null;
  const pickCube = (e, r) => { ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.intersectObjects([...parts, ...decos].map(p => p.obj), true).length > 0; };
  const onMove = e => {
    if (!visible || document.hidden || reduced.matches) return;
    lastInput = performance.now();
    wake();
    const r = stage.getBoundingClientRect();
    if (concept === 'hover' || concept === 'focus') {
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(parts.map(p => p.obj), true)[0];
      hovered = hit ? hit.object.userData.part : -1;
    }
    overCube = pickCube(e, r);
    stage.style.cursor = overCube ? 'pointer' : '';
    if (cursorEl !== e.target) { if (cursorEl) cursorEl.style.cursor = ''; cursorEl = null; }
    if (overCube && !stage.contains(e.target) && !e.target.closest('a,button')) { cursorEl = e.target; cursorEl.style.cursor = 'pointer'; }
    mouse.x = clamp((e.clientX - (r.left + r.width / 2)) / (innerWidth * 0.5), -1, 1);
    mouse.y = clamp((e.clientY - (r.top + r.height / 2)) / (innerHeight * 0.5), -1, 1);
  };
  stage.addEventListener('pointermove', onMove, {passive:true});
  const onClick = e => { const r = stage.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom || e.target.closest('a,button')) return; if (!pickCube(e, r)) return; target = target ? 0 : 1; lastInput = performance.now(); needsPaint = true; wake(); };
  stage.addEventListener('click', onClick);
  const autoTimer = autoOpen ? setTimeout(() => { target = 1; lastInput = performance.now(); needsPaint = true; wake(); }, autoOpen) : null;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if(visible) {needsPaint = true; wake();} else sleep(); }); io.observe(stage);
  const onVisibility = () => { if (!document.hidden) {lastInput = performance.now(); needsPaint = true; wake();} else sleep(); };
  document.addEventListener('visibilitychange', onVisibility);

  let w = 1, h = 1;
  const ro = new ResizeObserver(() => {
    const r = stage.getBoundingClientRect(); if(!r.width || !r.height) return; w = r.width; h = r.height;
    renderer.setSize(w, h, false);
    // El clúster abierto mide ~3 unidades desde el centro; las etiquetas necesitan 150px libres a cada lado
    const hw = Math.max(half, Math.min(half * 1.25, 3.0 * (w / 2) / Math.max(60, w / 2 - 110)));
    camera.left = -hw; camera.right = hw; camera.top = hw * h / w; camera.bottom = -hw * h / w;
    camera.updateProjectionMatrix();
    // setSize clears the drawing buffer even while the scene is idle.
    needsPaint = true; wake();
  });
  ro.observe(stage);

  const faceCam = { z: camera.quaternion.clone(), x: camera.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2)) };
  const qRest = new THREE.Quaternion(), tmpV = new THREE.Vector3();
  const v = new THREE.Vector3(), topOff = new THREE.Vector3(0, 0.62, 0), botOff = new THREE.Vector3(0, -0.62, 0);
  const shift = { left: 'translate(-100%,-50%)', right: 'translate(0,-50%)', below: 'translate(-50%,0)' };
  let t = 0, prev = performance.now(), frame = 0, timer = 0, destroyed = false;
  function sleep() {cancelAnimationFrame(frame); clearTimeout(timer); frame = 0; timer = 0;}
  function wake() {if (!destroyed && visible && !document.hidden && !frame && !timer) {prev = performance.now(); frame = requestAnimationFrame(paint);}}
  function paint(now) {
    frame = 0;
    const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
    // Sin mouse reciente, sin transición y fuera de pantalla: no se renderiza nada
    const settling = Math.abs(target - open) > 0.002 || Math.abs(mouse.x - sm.x) + Math.abs(mouse.y - sm.y) > 0.002;
    const active = needsPaint || settling || (!reduced.matches && (now - lastInput < 2500 || open > 0.5)); // abierto: los pulsos siguen animando
    if (!visible || document.hidden || !active) return;
    t += dt;
    sm.x += (mouse.x - sm.x) * (1 - Math.exp(-dt * 3)); sm.y += (mouse.y - sm.y) * (1 - Math.exp(-dt * 3));
    open = reduced.matches ? target : open + (target - open) * (1 - Math.exp(-dt * 2.5));
    const o = ease(clamp(open, 0, 1));
    const cascade = concept === 'cascade', par = concept === 'parallax';

    root.rotation.y = Math.sin(t * 0.35) * 0.05 + sm.x * (par ? 0.1 : 0.26);
    root.rotation.x = sm.y * (par ? 0.04 : 0.1);
    root.position.y = Math.sin(t * 0.9) * 0.03;
    parts.forEach((p, i) => {
      // Cascada: cada cubo arranca 14% más tarde que el anterior
      p.oi = cascade ? ease(clamp((open - i * 0.14) / (1 - 3 * 0.14), 0, 1)) : o;
      p.obj.position.lerpVectors(p.rest, p.opened, p.oi);
      const wantLift = (concept === 'hover' && hovered === i && open < 0.5) ? 1 : 0;
      p.lift = reduced.matches ? 0 : p.lift + (wantLift - p.lift) * (1 - Math.exp(-dt * 7.5));
      if (concept === 'hover') { tmpV.copy(p.pos).normalize().multiplyScalar(0.22 * p.lift); tmpV.y += 0.1 * p.lift; p.obj.position.add(tmpV); }
      if (par) { tmpV.set(sm.x, -sm.y, 0).multiplyScalar(0.18 * (p.opened.z + 1.2)); p.obj.position.add(tmpV); }
      if (concept === 'focus') {
        const wantTurn = open > 0.5 || hovered === i ? 1 : 0;
        p.turn = reduced.matches ? wantTurn : p.turn + (wantTurn - p.turn) * (1 - Math.exp(-dt * 5));
        qRest.identity(); p.obj.quaternion.copy(qRest).slerp(faceCam[p.face], ease(clamp(p.turn, 0, 1)));
        p.obj.scale.setScalar(1 + 0.06 * p.turn);
      }
    });
    decos.forEach((d, i) => {
      const oi = cascade ? ease(clamp((open - (4 + i) * 0.1) / (1 - 6 * 0.1), 0, 1)) : o;
      d.obj.position.lerpVectors(d.rest, d.opened, oi);
      if (par) { tmpV.set(sm.x, -sm.y, 0).multiplyScalar(0.18 * (d.opened.z + 1.2)); d.obj.position.add(tmpV); }
      if (concept === 'focus') d.obj.scale.setScalar(1 - 0.22 * o);
    });

    // Cables: aparecen al 40% de apertura, se estiran entre los centros
    const wo = cascade ? clamp((open - 0.8) / 0.2, 0, 1) : clamp((o - 0.4) / 0.6, 0, 1);
    wireGroup.visible = wo > 0.001;
    glassWire.opacity = wo; rimWire.opacity = 0.16 * wo;
    if (wireGroup.visible) {
      links.forEach(l => {
        wa.copy(l.a.obj.position); wb.copy(l.b.obj.position);
        l.mesh.position.lerpVectors(wa, wb, 0.5);
        dirV.subVectors(wb, wa); const len = dirV.length(); dirV.normalize();
        l.mesh.quaternion.setFromUnitVectors(zAxis, dirV);
        l.mesh.scale.set(1, 1, Math.max(0.001, (len - 0.9) * wo)); // no entra en los cubos
      });
      pulses.forEach(p => {
        const off = () => { p.bulb.material.opacity = 0; p.halo.material.opacity = 0; p.light.intensity = 0; };
        if (!p.link) { p.wait -= dt; if (p.wait <= 0 && wo > 0.9) launch(p); off(); return; }
        p.u += dt * p.speed;
        if (p.u >= 1) { p.link = null; off(); return; }
        // Recorre solo el tramo visible del cable (entre las caras, no dentro de los cubos)
        wa.copy(p.link.a.obj.position); wb.copy(p.link.b.obj.position);
        const L = wa.distanceTo(wb), m = Math.min(0.45, L * 0.2), k = (p.dir > 0 ? p.u : 1 - p.u);
        p.sp.position.lerpVectors(wa, wb, m / L + k * (1 - 2 * m / L));
        const a = Math.sin(p.u * Math.PI) * wo;
        p.bulb.material.opacity = a; p.halo.material.opacity = a; p.light.intensity = 10 * a;
      });
    }

    renderer.render(scene, camera);
    stage.dataset.cubeReady = "true";
    needsPaint = false;

    const sr = stage.getBoundingClientRect();
    parts.forEach(p => {
      if (p.oi < .001 && p.lift < .001) {p.label.style.opacity = "0"; return;}
      // Etiqueta siempre fuera del cubo: arriba (o abajo si es la fila inferior frontal), sin tapar su icono
      const below = p.side === 'below' && p.oi > 0.5;
      v.copy(p.obj.position).add(below ? botOff : topOff).applyMatrix4(root.matrixWorld).project(camera);
      const lh = p.label.offsetHeight;
      const x = clamp((v.x * 0.5 + 0.5) * w, Math.max(77, 85 - sr.left), Math.min(w, document.documentElement.clientWidth - sr.left - 12) - 77);
      let y = (-v.y * 0.5 + 0.5) * h;
      const lo = Math.max(p.oi, p.lift);
      y = below ? Math.min(y + 32 + (1 - lo) * 10, h - lh - 8) : Math.max(y + 22 - (1 - lo) * 10, lh + 8);
      p.label.style.textAlign = 'center';
      p.label.style.transform = `translate(-50%,${below ? '0' : '-100%'}) translate(${x}px,${y}px)`;
      p.label.style.opacity = Math.max(0, (p.oi - 0.55) / 0.45, p.lift * 0.95);
    });
    if (!reduced.matches) timer = setTimeout(() => {timer = 0; frame = requestAnimationFrame(paint);}, frameInterval);
  }
  const onReduced = () => {needsPaint = true; wake();};
  reduced.addEventListener('change', onReduced);
  wake();

  const destroy = () => { destroyed = true; sleep(); clearTimeout(autoTimer); reduced.removeEventListener('change', onReduced); stage.removeEventListener('pointermove', onMove); stage.removeEventListener('click', onClick); document.removeEventListener('visibilitychange',onVisibility); io.disconnect(); ro.disconnect(); const geometries = new Set(), materials = new Set(), textures = new Set(); scene.traverse(obj => {if(obj.geometry) geometries.add(obj.geometry); for(const material of (Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [])) materials.add(material);}); for(const material of materials) {for(const value of Object.values(material)) if(value?.isTexture) textures.add(value); material.dispose();} geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); environment.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); parts.forEach(p => p.label.remove()); stage.style.cursor = ''; };
  return { destroy, open: () => { target = 1; needsPaint = true; wake(); }, close: () => { target = 0; needsPaint = true; wake(); }, toggle: () => { target = target ? 0 : 1; needsPaint = true; wake(); }, get isOpen() { return !!target; } };
}
