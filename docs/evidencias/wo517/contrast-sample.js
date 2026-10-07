// WO-2026-00517 — muestreo de contraste WCAG 2.x en el DOM vivo.
// Uso: pegar en la consola (o javascript_tool) de la página ya cargada.
// Devuelve { theme, total, fails, rows } donde cada fila es un nodo de texto
// visible con su color, el fondo efectivo (fondos translúcidos de ancestros
// compuestos sobre el fondo opaco más cercano) y el ratio.
// Umbral: 4.5:1 texto normal; 3:1 solo si es texto grande (>=24px o >=18.66px y bold).
// Controles deshabilitados (WCAG 1.4.3 los exime) se reportan aparte, no cuentan.
(() => {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const parse = (c) => {
    if (!c || c === "transparent") return [0, 0, 0, 0];
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = "#000";
    cx.fillStyle = c;
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    // getImageData premultiplica; recuperar alfa por separado
    const m = /rgba?\(([^)]+)\)/.exec(c);
    let a = d[3] / 255;
    if (m) {
      const p = m[1].split(/[ ,/]+/).filter(Boolean);
      if (p.length === 4) a = p[3].endsWith("%") ? parseFloat(p[3]) / 100 : parseFloat(p[3]);
      else a = 1;
      return [parseFloat(p[0]), parseFloat(p[1]), parseFloat(p[2]), a];
    }
    return [d[0], d[1], d[2], a];
  };
  const over = (top, bot) => {
    const a = top[3];
    return [0, 1, 2].map((i) => top[i] * a + bot[i] * (1 - a)).concat(1);
  };
  const lum = (c) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const effBg = (el) => {
    const stack = [];
    let gradient = false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== "none" && /gradient/.test(cs.backgroundImage)) gradient = true;
      const bg = parse(cs.backgroundColor);
      if (bg[3] > 0) stack.push(bg);
      if (bg[3] >= 1) break;
    }
    let base = [255, 255, 255, 1];
    for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base);
    return { bg: base, gradient };
  };
  const hex = (c) => "#" + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const rows = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (!t.textContent.trim()) continue;
    const el = t.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    if (el.closest("script,style,noscript,[aria-hidden=true],nextjs-portal")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    let op = 1;
    let hiddenByOpacity = false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const o = parseFloat(getComputedStyle(n).opacity);
      op *= o;
      if (o === 0) hiddenByOpacity = true;
    }
    if (hiddenByOpacity) continue;
    // clip por ancestros con overflow hidden / sr-only
    if (cs.clip === "rect(0px, 0px, 0px, 0px)" || cs.clipPath === "inset(50%)") continue;
    const disabled = !!el.closest(":disabled,[aria-disabled=true]");
    const { bg, gradient } = effBg(el);
    let fg = parse(cs.color);
    fg = over([fg[0], fg[1], fg[2], fg[3] * op], bg);
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    const cr = ratio(fg, bg);
    rows.push({
      text: t.textContent.trim().slice(0, 40),
      tag: el.tagName.toLowerCase(),
      cls: (el.className && el.className.baseVal === undefined ? el.className : "").toString().split(/\s+/).filter((c) => /^(dark:)?(text|bg)-|opacity/.test(c)).join(" "),
      color: cs.color,
      fg: hex(fg),
      bg: hex(bg),
      ratio: Math.round(cr * 100) / 100,
      need,
      size,
      disabled,
      gradient,
      fail: !disabled && cr < need,
    });
  }
  const fails = rows.filter((r) => r.fail);
  return {
    theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
    path: location.pathname,
    total: rows.length,
    failCount: fails.length,
    fails,
    rows,
  };
})();
