# Carnet Recompo

Application web mono-utilisateur de suivi de **recomposition corporelle** : pesées, mensurations, nutrition, musculation et liste de courses, le tout dans une interface mobile-first, sombre, sans dépendance ni backend. Les données vivent **dans le navigateur** (IndexedDB), avec une **synchro automatique chiffrée** PC ↔ mobile via un Gist GitHub privé, et l'export JSON en filet de sécurité.

> *« Pesée le dimanche · mensurations le 1er du mois · le tour de taille dit la vérité. »*

Vanilla **JavaScript orienté objet** (modules ES), zéro framework, **zéro build, zéro dépendance à installer**. [Chart.js](https://www.chartjs.org/) est *vendoré* dans le repo (`vendor/`) — aucun appel réseau au démarrage. Installable en **PWA** et fonctionne **hors-ligne**.

---

## Fonctionnalités

L'app est découpée en 6 onglets.

### 🎯 Verdict
Un **arbre de décision** transforme tes données en une consigne unique et nette (« −150 kcal sur le riz », « +150 kcal », « RAS — Continue »…). Calcul du **rythme en kg/mois** (régression sur les moyennes hebdo glissantes) croisé avec la **tendance du tour de taille** et du **bras** : c'est la taille qui tranche entre prise de muscle et prise de gras. Le verdict est **prudent** : aucun ajustement avant 3 moyennes hebdo, et la branche « bras qui stagne » exige 2 relevés confirmés.

Sous le verdict, un read **« Cette semaine »** entre deux verdicts mensuels : tendance lissée, **adhérence protéines (jours à la cible / 7)** et **séances sur 7 j**, plus une alerte **« force en baisse »** quand le 1RM estimé décroche sur plusieurs exercices récents — signal précoce de sous-alimentation.

### 🍽️ Repas
Plan alimentaire du jour avec **objectif kcal ajustable**. Protéines/lipides fixés, glucides (riz/avoine) qui s'ajustent automatiquement pour atteindre la cible. Cases à cocher par repas (avec progression kcal/macros), **décochage automatique à minuit**, et journalisation détaillée de ce qui a réellement été mangé (avec quantités) pour l'export.

### 🏋️ Muscu
Le cœur de l'app, pensé pour la **surcharge progressive « 0 doute »** :

- **Objectif par exercice** : à partir de ta dernière perf, l'app te dit exactement quoi faire — monter la charge, gratter des reps, consolider ou faire un deload. La barre d'objectif te dit quand monter la charge.
- **Système d'XP & de niveaux** : l'XP n'est gagné **que si tu progresses**. Un exercice ne rapporte son XP (proportionnel au travail : charge × reps ; poids du corps au forfait ; unilatéral compté des deux côtés) que s'il a fait **mieux que sa dernière séance sur la globalité des séries** — c.-à-d. **plus de volume** (≥ +1 rep) **ou** un **meilleur 1RM estimé** (≥ +1 kg, même si les reps baissent un peu). Sinon : 0 XP. Un **niveau global** (titre de palier : Débutant → Légende) et un **niveau par exercice** (badge **Niv.**, courbe plus douce) en découlent, via une courbe en puissance où chaque palier coûte plus que le précédent. Le **gain d'XP** et les **montées de niveau** s'affichent dans le recap de fin de séance.
- **Double progression** correcte : distingue *3 séries droites à 40 kg* (→ on monte) de *40 / 38 / 35 dégressif* (→ consolide d'abord). Le détail **série par série** (charges variables incluses) est affiché partout, jamais collapsé sur la charge max.
- **Unilatéral** déclarable à la saisie : la charge tapée est alors comprise comme **un seul côté** (affichée « X kg/côté »), et le volume compte les deux côtés.
- **Contraction 2 s** et autres marqueurs par exercice.
- **« Comme la dernière fois »** : un tap préremplit les vraies valeurs de la séance précédente — tu n'édites que ce qui change.
- **Repos conseillé dynamique** (déduit de la fourchette de reps) + **chrono de repos in-app** (compte à rebours, +15 s / pause, bip + vibration), **proposé automatiquement** dès qu'une série est saisie. **Wake lock** : l'écran reste allumé pendant la séance.
- **1RM estimé fiable** : les reps sont plafonnées à 12 dans l'estimation Epley (au-delà la formule devient bruitée), pour des deltas de force lisibles.
- **Suppression de série**, **éditeur de programmes** complet.
- **Recap de séance** après enregistrement (deltas 1RM/charge, hausses **et** baisses) + **courbes de progression** (1RM estimé Epley + volume), points colorés selon la tendance.
- Clic sur un objectif → **détail repliable des séances précédentes**.
- **Brouillon auto** : la saisie en cours survit à la navigation et au rechargement. L'historique des séances n'est **jamais** réinitialisé.

### 📏 Mesures
Saisie des pesées et du relevé mensuel (taille contractée/relâchée, bras, cuisse, torse). Bandeau de stats (moyenne 7 j, taille, bras avec flèches de tendance), **courbes** poids + moyenne hebdo et taille vs bras, historiques supprimables.

### 🛒 Courses
Liste de courses par rayon, cases à cocher, ajout/suppression d'articles, « tout décocher » pour la semaine suivante. Les quantités des aliments du plan sont **dérivées automatiquement** (plan × nombre de jours, ajustées à ton objectif kcal) — ferme la boucle plan → conso → liste.

### 💾 Données
- **Synchro automatique (Gist GitHub)** : à chaque modif, l'état est poussé dans un Gist secret ; au démarrage il est relu et **fusionné** (par date / id). Le **token** (fine-grained, scope Gists) reste **uniquement** dans le navigateur — jamais dans le code, l'export ou le Gist de données — et le champ `<input type="password">` permet à ton gestionnaire de mots de passe (Trousseau / Google) de le retenir. Indicateur de statut (synchronisé / hors-ligne / erreur), repli local en cas de coupure.
- **Export / import JSON** (fusion intelligente par date / id) en filet de sécurité, indicateur de dernière sauvegarde, option de **téléchargement auto** après chaque séance.
- **Remise à zéro** (efface aussi la copie cloud si la synchro est active).

---

## Lancer en local

L'app utilise des **modules ES** : elle doit être servie en HTTP (l'ouverture directe `file://` ne fonctionne pas).

```bash
# depuis la racine du projet
python3 -m http.server 8000
# puis ouvrir http://127.0.0.1:8000/
```

Sur mobile (même réseau Wi-Fi) : remplace `127.0.0.1` par l'IP locale du PC (`hostname -I`).

Sur **GitHub Pages**, aucune manipulation : les modules ES sont servis en HTTP, ça fonctionne tel quel.

---

## Tests

Les moteurs purs sont couverts par des tests unitaires (**42 tests**), via le **runner natif de Node** — aucune dépendance à installer :

```bash
npm test          # ou : node --test
```

Cibles :
- `progression.js` — `recommander` (toutes les branches), `statsExo`, `parseFourchette`, `meilleurE1rm`.
- `stats.js` — `moyennesHebdo`, `rythmeMensuel`, `tendanceTaille/Bras`, `e1rm` (plafond reps), `brasStagne`.
- `nutrition.js` — `facteurFlex` (bornes & saturation), `consoQuotidienne`.
- `verdict.js` — l'arbre de décision (chaque branche + anti-réactivité).
- `bilan.js` — `adherenceHebdo`, `bilanForce`.
- `RepasModule` — moteur de comblement protéique.

---

## Architecture

POO vanilla en modules ES. Une `Store` unique détient l'état et la persistance ; chaque onglet est une classe (`bind()` attache les écouteurs une fois, `render()` reconstruit le DOM depuis l'état) ; l'`App` orchestre le routage et le rendu. La logique métier est isolée en **modules purs** (testables hors DOM). Aucun handler `onclick` inline — délégation d'évènements partout.

```
index.html            markup (aucun JS inline)
styles.css            tout le style
manifest.json         PWA (installable)
sw.js                 service worker (cache de la coquille → démarrage hors-ligne)
vendor/chart.umd.min.js  Chart.js vendoré (zéro CDN)
icons/                icônes PWA (192/512/maskable + apple-touch)
carnet-recompo-DEMO.json   jeu de données de démonstration (à importer)
js/
  main.js             point d'entrée → new App().init()
  App.js              routeur d'onglets + orchestration du rendu
  Store.js            état, persistance IndexedDB (+ miroir localStorage), migrations
  idb.js              mini-wrapper IndexedDB (clé/valeur, zéro dépendance)
  Sync.js             synchro Gist : pull/fusion/push, statut, sécurité du token
  gist.js             client API GitHub Gist (lecture/écriture/création, troncature)
  fusion.js           fusion d'état par date / id (import manuel ET synchro)
  sanitize.js         assainissement des données (ne jamais crasher au rendu)
  ui.js               toasts + dialogues inline (remplace alert/confirm/prompt)
  data.js             constantes & données par défaut (aliments, plan, programme, courses)
  utils.js            helpers (dates, formatage, slug, échappement…)
  — moteurs purs (testés) —
  stats.js            moyennes hebdo, rythme, tendances, 1RM (Epley borné), brasStagne
  progression.js      surcharge progressive (reco, repos, e1RM)
  xp.js               système d'XP & de niveaux (volume → XP, courbe, paliers)
  nutrition.js        facteur flex, cibles, conso quotidienne, comblement
  verdict.js          arbre de décision recompo
  bilan.js            reads hebdo (adhérence, signal de force)
  charts.js           config Chart.js partagée
  RestTimer.js        chrono de repos
  modules/            classes d'onglets (bind/render)
    MesuresModule.js · VerdictModule.js · RepasModule.js
    MuscuModule.js · CoursesModule.js · DonneesModule.js
tests/                tests unitaires (node --test)
```

## Données & sauvegarde

- **Persistance locale : IndexedDB** (clé `carnet-recompo-v1`), bien plus résistante à l'éviction iOS que `localStorage` — qui reste en miroir de secours. `navigator.storage.persist()` est demandé au démarrage. Migration transparente depuis l'ancien `localStorage` au premier lancement.
- **Synchro cloud : Gist GitHub privé** via token fine-grained (scope Gists). 100 % côté navigateur, fusion par date / id (pas un *last-write-wins* brut), gestion de la troncature > 1 Mo. Le token n'est **jamais** dans le code, le repo, l'export ni le Gist de données.
- L'**export JSON** contient tout : pesées, mensurations, repas réellement mangés (avec quantités), séances (charge × reps par série), programmes et liste de courses. L'**import** fusionne par date / id (le fichier gagne) — y compris un fichier ne contenant que la clé `programmes`.
- `carnet-recompo-DEMO.json` est un jeu de test réaliste (3 mois de recompo) : importe-le via **Données → Importer un JSON**.

> ⚠️ iOS Safari peut tout de même purger le stockage. La synchro Gist (ou un export régulier) reste le vrai filet de sécurité.

---

## Zéro dépendance, zéro build

Pas de `npm install`, pas de bundler. Chart.js est vendoré dans `vendor/`. Pour modifier : édite les fichiers et recharge la page. `package.json` ne sert qu'à `npm test` (runner natif de Node, aucune dépendance).
