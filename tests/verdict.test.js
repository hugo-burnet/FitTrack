import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decisionVerdict } from '../js/verdict.js';
import { brasStagne } from '../js/stats.js';

/* base : assez de recul (3 sem) + taille présente, on surcharge au cas par cas */
const base = { rythme:0.1, dTaille:0, dBras:0, nbSem:3, brasStagne:false };
const d = (o) => decisionVerdict({ ...base, ...o });

test('verdict : données insuffisantes si rythme inconnu', () => {
  assert.equal(d({ rythme:null }).t, 'Données insuffisantes');
});

test('verdict : tendance provisoire tant qu\'il y a < 3 moyennes hebdo (anti-réactivité)', () => {
  assert.equal(d({ nbSem:2, rythme:1, dTaille:1 }).t, 'Tendance provisoire');
});

test('verdict : taille manquante bloque tout ajustement', () => {
  assert.equal(d({ dTaille:null, rythme:1 }).t, 'Taille manquante');
});

test('verdict : −150 si poids ↑ vite ET taille ↑', () => {
  assert.equal(d({ rythme:0.8, dTaille:1 }).cls, 'v-baisse');
});

test('verdict : +150 EXIGE une taille qui baisse (cohérence avec la carte)', () => {
  assert.equal(d({ rythme:-0.8, dTaille:-1 }).t, '+150 kcal');
  // poids ↓ vite mais taille stable → PAS de +150 (le bug d'origine)
  assert.notEqual(d({ rythme:-0.8, dTaille:0 }).t, '+150 kcal');
});

test('verdict : +100-150 seulement si poids/taille stables ET bras stagne (2 relevés)', () => {
  assert.match(d({ rythme:0, dTaille:0, brasStagne:true }).t, /\+100-150/);
  // un bras qui stagne mais sans le flag confirmé → pas d'ajustement bras
  assert.ok(!/\+100-150/.test(d({ rythme:0, dTaille:0, brasStagne:false }).t));
});

test('verdict : RAS pour 0..+0,3 kg/mois et taille non montante', () => {
  assert.equal(d({ rythme:0.2, dTaille:-0.2 }).cls, 'v-ok');
});

test('verdict : zone grise pour les cas ambigus (ex. perte douce, taille stable)', () => {
  assert.equal(d({ rythme:-0.3, dTaille:0 }).t, 'Zone grise — Observe');
});

test('brasStagne : faux sous 3 relevés, vrai si 2 derniers deltas ≤ 0', () => {
  assert.equal(brasStagne([{ bras:32 }, { bras:32.2 }]), false);
  assert.equal(brasStagne([{ bras:32 }, { bras:32.2 }, { bras:32.4 }]), false);   // progresse
  assert.equal(brasStagne([{ bras:32.4 }, { bras:32.2 }, { bras:32.2 }]), true);  // stagne/baisse
});
