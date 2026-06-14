import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  xpSerie, xpSerieGainage, xpDeSerie, xpExercice, xpSeance, xpTotal, xpExerciceTotal,
  xpCumulNiveau, niveauPourXp, titreNiveau, infosNiveau,
  seanceAmelioree, xpGagneExercice,
  XP_REP_POIDS_CORPS, XP_SEC_GAINAGE, XP_BASE_EXO,
} from '../js/xp.js';

test('xpSerie : volume charge×reps, forfait au poids du corps, séries invalides nulles', () => {
  assert.equal(xpSerie(50, 10), 500);
  assert.equal(xpSerie(null, 12), 12 * XP_REP_POIDS_CORPS);   // poids du corps
  assert.equal(xpSerie(0, 12), 12 * XP_REP_POIDS_CORPS);      // charge 0 = poids du corps
  assert.equal(xpSerie(50, 0), 0);
  assert.equal(xpSerie(50, NaN), 0);
  assert.equal(xpSerie(50, -3), 0);
});

test('gainage : XP = temps sous tension (durée × reps), pas de charge', () => {
  assert.equal(xpSerieGainage(30, 3), 30 * 3 * XP_SEC_GAINAGE);
  assert.equal(xpSerieGainage(0, 3), 0);
  assert.equal(xpSerieGainage(30, 0), 0);
  assert.equal(xpSerieGainage(NaN, 3), 0);
  // xpDeSerie aiguille sur la nature de la série
  assert.equal(xpDeSerie({ duree:30, reps:3 }), 30 * 3 * XP_SEC_GAINAGE);
  assert.equal(xpDeSerie({ charge:50, reps:10 }), 500);
  // un exercice de gainage agrège ses temps sous tension, ×2 si unilatéral
  const series = [{ duree:30, reps:3 }, { duree:20, reps:3 }];   // (90+60)×2 = 300
  assert.equal(xpExercice({ series }), 300);
  assert.equal(xpExercice({ series, unilateral:true }), 600);
});

test('gainage : progression jugée sur le temps sous tension', () => {
  const prev = { series:[{ duree:30, reps:3 }] };               // TUT 90
  const plusLong = { series:[{ duree:35, reps:3 }] };           // TUT 105 → mieux
  const plusDeReps = { series:[{ duree:30, reps:4 }] };         // TUT 120 → mieux
  const pareil = { series:[{ duree:30, reps:3 }] };             // identique
  assert.equal(seanceAmelioree(plusLong.series, prev.series), true);
  assert.equal(seanceAmelioree(plusDeReps.series, prev.series), true);
  assert.equal(seanceAmelioree(pareil.series, prev.series), false);
  assert.equal(xpGagneExercice(plusLong, prev), xpExercice(plusLong));
  assert.equal(xpGagneExercice(pareil, prev), 0);
});

test('xpExercice : somme des séries, unilatéral compté des deux côtés', () => {
  const series = [{ charge:40, reps:10 }, { charge:40, reps:8 }];   // 400 + 320 = 720
  assert.equal(xpExercice({ series }), 720);
  assert.equal(xpExercice({ series, unilateral:true }), 1440);      // ×2
  assert.equal(xpExercice(null), 0);
  assert.equal(xpExercice({}), 0);
});

test('xpSeance / xpTotal : agrégation sur exercices et séances', () => {
  const seances = [
    { exercices:[{ nom:'A', series:[{ charge:50, reps:10 }] }, { nom:'B', series:[{ charge:20, reps:10 }] }] }, // 500+200
    { exercices:[{ nom:'A', series:[{ charge:60, reps:10 }] }] },                                              // 600
  ];
  assert.equal(xpSeance(seances[0].exercices), 700);
  assert.equal(xpTotal(seances), 1300);
  assert.equal(xpExerciceTotal(seances, 'A'), 1100);   // 500 + 600
  assert.equal(xpExerciceTotal(seances, 'B'), 200);
  assert.equal(xpExerciceTotal(seances, 'Z'), 0);
});

test('seanceAmelioree : +1 rep, +1 kg, charge en hausse même reps en baisse, plateau, régression', () => {
  // pas de référence → on valide (amorçage)
  assert.equal(seanceAmelioree([{charge:40,reps:10}], null), true);
  // +1 rep → volume en hausse
  assert.equal(seanceAmelioree([{charge:40,reps:11}], [{charge:40,reps:10}]), true);
  // +1 kg, mêmes reps → 1RM en hausse
  assert.equal(seanceAmelioree([{charge:41,reps:10}], [{charge:40,reps:10}]), true);
  // plus lourd mais moins de reps : 45×8 vs 40×10 → 1RM en hausse ⇒ compte (le « +1 kg »)
  assert.equal(seanceAmelioree([{charge:45,reps:8}], [{charge:40,reps:10}]), true);
  // strictement identique → pas de progrès
  assert.equal(seanceAmelioree([{charge:40,reps:10}], [{charge:40,reps:10}]), false);
  // régression franche (moins de charge ET moins de reps) → pas de progrès
  assert.equal(seanceAmelioree([{charge:35,reps:8}], [{charge:40,reps:10}]), false);
});

test('xpGagneExercice : plein volume si progrès, 0 sinon', () => {
  const prev = { series:[{charge:40,reps:10},{charge:40,reps:10}] };   // vol 800
  const mieux = { series:[{charge:40,reps:11},{charge:40,reps:10}] };  // +1 rep → 840
  const pareil = { series:[{charge:40,reps:10},{charge:40,reps:10}] }; // identique
  assert.equal(xpGagneExercice(mieux, prev), xpExercice(mieux));
  assert.equal(xpGagneExercice(pareil, prev), 0);
  assert.equal(xpGagneExercice(mieux, null), xpExercice(mieux));       // première fois
});

test('xpTotal / xpExerciceTotal : les séances sans progrès ne rapportent rien', () => {
  const seances = [
    { date:'2026-01-01', exercices:[{ nom:'A', series:[{charge:50,reps:10}] }] },  // 500 (1re)
    { date:'2026-01-08', exercices:[{ nom:'A', series:[{charge:50,reps:10}] }] },  // identique → 0
    { date:'2026-01-15', exercices:[{ nom:'A', series:[{charge:50,reps:11}] }] },  // +1 rep → 550
  ];
  assert.equal(xpExerciceTotal(seances, 'A'), 500 + 0 + 550);
  assert.equal(xpTotal(seances), 1050);
});

test('niveau 1 au démarrage, monte avec l\'XP', () => {
  assert.equal(niveauPourXp(0), 1);
  assert.equal(niveauPourXp(-5), 1);
  assert.equal(xpCumulNiveau(1), 0);
  // atteindre le seuil cumulé d'un niveau donne ce niveau
  assert.equal(niveauPourXp(xpCumulNiveau(2)), 2);
  assert.equal(niveauPourXp(xpCumulNiveau(5)), 5);
  assert.equal(niveauPourXp(xpCumulNiveau(10)), 10);
});

test('courbe croissante : chaque palier coûte plus que le précédent', () => {
  for(let l = 2; l <= 30; l++){
    const cout = xpCumulNiveau(l + 1) - xpCumulNiveau(l);
    const coutPrec = xpCumulNiveau(l) - xpCumulNiveau(l - 1);
    assert.ok(cout >= coutPrec, `palier ${l} doit coûter ≥ palier ${l-1}`);
  }
});

test('titres de palier', () => {
  assert.equal(titreNiveau(1), 'Débutant');
  assert.equal(titreNiveau(5), 'Initié');
  assert.equal(titreNiveau(10), 'Confirmé');
  assert.equal(titreNiveau(20), 'Avancé');
  assert.equal(titreNiveau(80), 'Légende');
});

test('courbe par exercice (base douce) : monte plus vite que la globale', () => {
  // base réduite ⇒ pour une même XP, le niveau par exercice est ≥ au niveau global
  assert.ok(niveauPourXp(2807.5, XP_BASE_EXO) > niveauPourXp(2807.5));
  // ~2-3 séances d'un exo (≈ 2800 XP) doivent déjà dépasser le niveau 1
  assert.ok(niveauPourXp(2807.5, XP_BASE_EXO) >= 3);
  // l'inverse reste cohérent avec sa propre courbe
  assert.equal(niveauPourXp(xpCumulNiveau(4, XP_BASE_EXO), XP_BASE_EXO), 4);
  // bornes d'infosNiveau respectent la base passée
  const n = infosNiveau(5000, XP_BASE_EXO);
  assert.ok(n.planche <= n.total && n.total < n.plafond);
});

test('infosNiveau : bornes cohérentes et pourcentage clampé 0–100', () => {
  const n = infosNiveau(0);
  assert.equal(n.niveau, 1);
  assert.equal(n.total, 0);
  assert.equal(n.pct, 0);

  const m = infosNiveau(50000);
  assert.ok(m.planche <= m.total && m.total < m.plafond);
  assert.equal(m.dansNiveau, m.total - m.planche);
  assert.equal(m.restant, m.plafond - m.total);
  assert.ok(m.pct >= 0 && m.pct <= 100);
});
