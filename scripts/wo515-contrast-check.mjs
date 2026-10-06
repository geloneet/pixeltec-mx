// WO-2026-00515 — contraste WCAG 2.x de los tokens `.crm` (src/app/globals.css).
// Uso: node scripts/wo515-contrast-check.mjs  → imprime cada par y FALLA (exit 1) si alguno < 4.5.
function hsl(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}
const lum = ([r, g, b]) => {
  const c = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
};
const ratio = (a, b) => {
  const A = lum(hsl(...a));
  const B = lum(hsl(...b));
  return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05);
};

const pairs = {
  "claro foreground/background": [[224, 40, 8], [220, 20, 97]],
  "claro muted-fg/card": [[220, 9, 42], [0, 0, 100]],
  "claro muted-fg/background": [[220, 9, 42], [220, 20, 97]],
  "claro blanco/primary": [[0, 0, 100], [222, 80, 52]],
  "claro primary/card": [[222, 80, 52], [0, 0, 100]],
  "claro primary/sidebar-accent": [[222, 80, 52], [226, 100, 97]],
  "oscuro foreground/background": [[210, 40, 98], [222, 30, 7]],
  "oscuro muted-fg/card": [[220, 10, 66], [220, 24, 11]],
  "oscuro primary-fg/primary": [[222, 47, 11], [219, 90, 66]],
  "oscuro primary/card": [[219, 90, 66], [220, 24, 11]],
  "oscuro primary/sidebar-accent": [[219, 90, 66], [222, 40, 18]],
};

let fail = false;
for (const [name, [a, b]] of Object.entries(pairs)) {
  const r = ratio(a, b);
  if (r < 4.5) fail = true;
  console.log(`${r >= 4.5 ? "AA " : "NO "} ${r.toFixed(2)}  ${name}`);
}
process.exit(fail ? 1 : 0);
