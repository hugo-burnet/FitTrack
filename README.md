# Carnet Recompo

Application web mono-utilisateur de suivi de **recomposition corporelle** : pesées, mensurations, nutrition, musculation et liste de courses, le tout dans une interface mobile-first, sombre, sans dépendance ni backend. Tout est stocké **en local dans le navigateur** ; le JSON sert de sauvegarde et de synchro PC ↔ mobile.

> *« Pesée le dimanche · mensurations le 1er du mois · le tour de taille dit la vérité. »*

Vanilla **JavaScript orienté objet** (modules ES), zéro framework, zéro build. Seule dépendance externe : [Chart.js](https://www.chartjs.org/) chargé via CDN pour les courbes.

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

- **Objectif par exercice** : à partir de ta dernière perf, l'app te dit exactement quoi faire — monter la charge, gratter des reps, consolider ou faire un deload. Une **barre de niveau (XP)** et un **badge Niv.** matérialisent la progression (un niveau gagné à chaque PR de charge).
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
**Export / import JSON** (fusion intelligente par date / id), **sauvegarde miroir** automatique en local, indicateur de dernière sauvegarde, option de **téléchargement auto** après chaque séance, et remise à zéro.

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

Les moteurs purs (progression, stats, nutrition) sont couverts par des tests unitaires, via le **runner natif de Node** — aucune dépendance à installer :

```bash
npm test          # ou : node --test
```

Cibles : `js/progression.js` (`recommander`, `statsExo`), `js/stats.js` (`moyennesHebdo`, `rythmeMensuel`, `tendanceTaille/Bras`), `js/nutrition.js` (`facteurFlex`, bornes & saturation).

---

## Architecture

POO vanilla en modules ES. Une `Store` unique détient l'état et la persistance ; chaque onglet est une classe (`bind()` attache les écouteurs une fois, `render()` reconstruit le DOM depuis l'état) ; l'`App` orchestre le routage et le rendu. Aucun handler `onclick` inline — délégation d'évènements partout.

```
index.html            markup (aucun JS inline)
styles.css            tout le style
carnet-recompo-DEMO.json   jeu de données de démonstration (à importer)
js/
  main.js             point d'entrée → new App().init()
  App.js              routeur d'onglets + orchestration du rendu
  Store.js            état, persistance localStorage, migrations, sauvegarde miroir
  data.js             constantes & données par défaut (aliments, plan, programme, courses)
  utils.js            helpers (dates, formatage, slug, échappement…)
  stats.js            calculs purs (moyennes hebdo, rythme, tendances, 1RM)
  progression.js      moteur de surcharge progressive (reco, niveaux, repos)
  charts.js           config Chart.js partagée
  RestTimer.js        chrono de repos
  modules/
    MesuresModule.js  poids + mensurations + bandeau + courbes
    VerdictModule.js  arbre de décision
    RepasModule.js    plan repas + objectif kcal
    MuscuModule.js    programmes, séances, leveling, chrono
    CoursesModule.js  liste de courses
    DonneesModule.js  export / import / reset
```

## Données & sauvegarde

- Stockage : `localStorage` (clé `carnet-recompo-v1` + une clé miroir de secours).
- L'**export JSON** contient tout : pesées, mensurations, repas réellement mangés (avec quantités), séances (charge × reps par série), programmes et liste de courses.
- L'**import** fusionne intelligemment (par date / id, le fichier importé gagne) — pratique pour synchroniser PC et mobile, ou pour importer un programme seul (clé `programmes`).
- `carnet-recompo-DEMO.json` est un jeu de test réaliste (3 mois de recompo, progression réelle) : importe-le via **Données → Importer un JSON** pour explorer toutes les features.

> ⚠️ Sur iOS Safari notamment, le navigateur peut purger le stockage local. Pense à exporter régulièrement — c'est la seule vraie sauvegarde.

---

## Aucune dépendance à installer

Pas de `npm install`, pas de bundler. Le seul script externe est Chart.js (CDN). Pour modifier : édite les fichiers et recharge la page.
