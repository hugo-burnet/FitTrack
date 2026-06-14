/* ================= SERVICE WORKER — PWA (specs 2.4) =================
   Met en cache la coquille de l'app pour un démarrage 100 % hors-ligne (usage cible :
   mobile à la salle, réseau instable). Stratégie « stale-while-revalidate » : on sert
   immédiatement la version en cache (rapide + offline) et on rafraîchit en fond, donc
   un correctif se propage à la visite suivante sans bump manuel de version.
   L'API GitHub (données + token) n'est JAMAIS interceptée → toujours réseau direct. */

const VERSION = 'v14';
const CACHE = `carnet-recompo-${VERSION}`;

/* coquille précachée — tout en relatif (résolu contre l'emplacement du SW, donc OK
   sous le sous-chemin /FitTrack/ de GitHub Pages) */
const SHELL = [
  './', './index.html', './styles.css', './manifest.json',
  './vendor/chart.umd.min.js',
  './js/main.js', './js/App.js', './js/Store.js', './js/Sync.js', './js/gist.js',
  './js/fusion.js', './js/ui.js', './js/idb.js', './js/sanitize.js', './js/data.js', './js/utils.js', './js/nutrition.js',
  './js/charts.js', './js/stats.js', './js/progression.js', './js/xp.js', './js/verdict.js', './js/bilan.js', './js/RestTimer.js',
  './js/modules/MesuresModule.js', './js/modules/VerdictModule.js', './js/modules/RepasModule.js',
  './js/modules/MuscuModule.js', './js/modules/CoursesModule.js', './js/modules/DonneesModule.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    /* best-effort : un fichier manquant ne doit pas faire échouer toute l'installation */
    await Promise.allSettled(SHELL.map(u => cache.add(u)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const cles = await caches.keys();
    await Promise.all(cles.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;                 /* ne touche pas aux PATCH/POST (Gist) */
  const url = new URL(req.url);

  /* API GitHub & contenu brut des gists : données privées + token → toujours réseau */
  if(url.hostname === 'api.github.com' || url.hostname === 'gist.githubusercontent.com') return;

  const memeOrigine = url.origin === location.origin;
  const policeGoogle = url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com');
  if(!memeOrigine && !policeGoogle) return;        /* autres tierces : laisse le navigateur */

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const reseau = fetch(req).then(res => {
      if(res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => null);

    /* stale-while-revalidate : cache d'abord, réseau en repli (et en fond) */
    const rep = cached || await reseau;
    if(rep) return rep;

    /* hors-ligne et rien en cache : pour une navigation, sers la coquille */
    if(req.mode === 'navigate'){
      const shell = await cache.match('./index.html');
      if(shell) return shell;
    }
    return Response.error();
  })());
});
