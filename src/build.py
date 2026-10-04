#!/usr/bin/env python3
"""Build HookCalc from the source files in this folder.

  python3 src/build.py                    writes index.html and sw.js in the repository root
  python3 src/build.py --artifact FILE    also writes a standalone one-file page (uses Google Fonts)

The app keeps every value in SI units and converts only for display.
Edit core.js, tools.js, pages.js or styles.css, then run this script again.
"""
import hashlib
import pathlib
import sys

SRC = pathlib.Path(__file__).resolve().parent
ROOT = SRC.parent

LIGHT = ("--bg:#E6EAED;--surface:#FFFFFF;--surface-2:#F1F4F6;--line:#D2D9DF;--line-2:#B6C0C8;"
         "--text:#14181C;--muted:#525D67;--faint:#87919A;"
         "--accent:#F7B500;--accent-hi:#FFC42E;--on-accent:#14181C;--steel:#3D5A73;--link:#1F5785;"
         "--ok:#16824A;--warn:#9A5700;--bad:#BF1B33;--ok-bg:#DCF1E4;--warn-bg:#FBEBCD;--bad-bg:#FADCE0;--info-bg:#E2E8ED;"
         "--sel-bg:#1C2126;--sel-text:#FFFFFF;--sel-ic:#F7B500;--focus:#1A66C9;"
         "--cab:#1C2126;--cab-2:#262D33;--cab-line:#353E46;--cab-text:#F1F3F5;--cab-dim:#A6B1BA;"
         "color-scheme:light;")
DARK = ("--bg:#101417;--surface:#191E23;--surface-2:#20262C;--line:#2B333A;--line-2:#3A444D;"
        "--text:#ECEFF2;--muted:#A3AEB8;--faint:#76818B;--steel:#8FB2D1;--link:#8DC2F2;"
        "--ok:#46CF8B;--warn:#F4AA33;--bad:#FF6577;--ok-bg:#12301F;--warn-bg:#352812;--bad-bg:#3D1720;--info-bg:#1E252B;"
        "--sel-bg:#F7B500;--sel-text:#14181C;--sel-ic:#14181C;--focus:#F7B500;"
        "--cab:#1A2025;--cab-2:#232A30;--cab-line:#323B43;--cab-text:#F1F3F5;--cab-dim:#A6B1BA;"
        "color-scheme:dark;")
FIXED = ("--ro-bg:#0F1316;--ro-line:#283037;--ro-text:#E9EDF0;--ro-dim:#8E9AA5;--ro-num:#F7B500;"
         "--ro-ok:#2FC27A;--ro-warn:#F6A21A;--ro-bad:#F2445A;--ro-stop:#D7263D;"
         "--font:\"Barlow\",\"Noto Sans Devanagari\",\"Noto Sans Tamil\",\"Segoe UI\",Roboto,\"Helvetica Neue\",Arial,system-ui,sans-serif;"
         "--font-c:\"Barlow Condensed\",\"Noto Sans Devanagari\",\"Noto Sans Tamil\",\"Roboto Condensed\",\"Arial Narrow\",sans-serif-condensed,\"Segoe UI\",Roboto,sans-serif;")

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700'
         '&amp;family=Barlow+Condensed:wght@600;700;800&amp;family=Noto+Sans+Devanagari:wght@400;600;700'
         '&amp;family=Noto+Sans+Tamil:wght@400;600;700&amp;display=swap">')
PWA_HEAD = ('<link rel="manifest" href="manifest.webmanifest">\n'
            '<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">\n'
            '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n'
            '<meta name="mobile-web-app-capable" content="yes">\n'
            '<meta name="apple-mobile-web-app-capable" content="yes">\n'
            '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
            '<meta name="apple-mobile-web-app-title" content="HookCalc">')
PWA_BODY = ("<script>if('serviceWorker' in navigator){window.addEventListener('load',function(){"
            "navigator.serviceWorker.register('sw.js').catch(function(){});});}</script>")

SW = """/* HookCalc service worker: makes the app work offline. The version changes on every build. */
const CACHE = 'hookcalc-__VERSION__';
const CORE = ['./', './index.html', './manifest.webmanifest', './privacy.html',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      if (res.ok && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html'))) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy));
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});
"""


def css():
    c = (SRC / 'styles.css').read_text(encoding='utf-8')
    return c.replace('/*TOKENS_LIGHT*/', LIGHT).replace('/*TOKENS_DARK*/', DARK).replace('/*TOKENS_FIXED*/', FIXED)


def js():
    parts = [(SRC / n).read_text(encoding='utf-8') for n in ('core.js', 'tools.js', 'i18n.js', 'pages.js')]
    code = '(function(){\n' + '\n'.join(parts) + '\n})();'
    if '</script' in code.lower():
        raise SystemExit('JavaScript must not contain a closing script tag')
    return code


def page(head, body):
    t = (SRC / 'index.template.html').read_text(encoding='utf-8')
    t = t.replace('<!--HEAD_EXTRA-->', head).replace('<!--BODY_EXTRA-->', body)
    return t.replace('/*APP_CSS*/', css()).replace('/*APP_JS*/', js())


def build(artifact=None):
    html = page(PWA_HEAD, PWA_BODY)
    (ROOT / 'index.html').write_text(html, encoding='utf-8')
    version = hashlib.sha256(html.encode('utf-8')).hexdigest()[:10]
    (ROOT / 'sw.js').write_text(SW.replace('__VERSION__', version), encoding='utf-8')
    print('index.html and sw.js written, version', version)
    if artifact:
        pathlib.Path(artifact).write_text(page(FONTS, ''), encoding='utf-8')
        print('standalone page written to', artifact)


if __name__ == '__main__':
    out = None
    if '--artifact' in sys.argv:
        out = sys.argv[sys.argv.index('--artifact') + 1]
    build(out)
