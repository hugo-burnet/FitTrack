import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basesKcal, facteurFlex, flexSature, consoQuotidienne, FLEX_MIN, FLEX_MAX } from '../js/nutrition.js';

const { fixe, flex } = basesKcal();

test('basesKcal : parts fixe et flex strictement positives', () => {
  assert.ok(fixe > 0);
  assert.ok(flex > 0);
});

test('facteurFlex : vaut 1 quand l\'objectif égale exactement le total du plan', () => {
  assert.ok(Math.abs(facteurFlex(fixe + flex) - 1) < 1e-9);
});

test('facteurFlex : sature à la borne basse pour un objectif très bas', () => {
  assert.equal(facteurFlex(0), FLEX_MIN);
  assert.equal(facteurFlex(fixe), FLEX_MIN);   // 0 kcal de flex demandé → borné à 0.4
});

test('facteurFlex : sature à la borne haute pour un objectif très élevé', () => {
  assert.equal(facteurFlex(100000), FLEX_MAX);
});

test('facteurFlex : reste dans [FLEX_MIN, FLEX_MAX] sur toute la plage réaliste', () => {
  for(let obj = 1600; obj <= 4000; obj += 50){
    const f = facteurFlex(obj);
    assert.ok(f >= FLEX_MIN && f <= FLEX_MAX, `objectif ${obj} → ${f} hors bornes`);
  }
});

test('flexSature : signale bas / haut / null selon la saturation', () => {
  assert.equal(flexSature(0), 'bas');
  assert.equal(flexSature(100000), 'haut');
  assert.equal(flexSature(fixe + flex), null);   // pile à 1, pas de saturation
});

test('consoQuotidienne : agrège le plan par aliment (parts non-flex déterministes)', () => {
  const c = consoQuotidienne(2545);
  assert.equal(c.banane, 3);     // pdej + coll + post
  assert.equal(c.whey, 2);       // pdej + post
  assert.equal(c.poulet, 220);
  assert.equal(c.skyr, 480);     // coll + dîner
  assert.equal(c.pois, 190);
  assert.equal(c.choco, 2);
  assert.ok('riz' in c && 'avoine' in c);
});

test('consoQuotidienne : la part flex (riz) suit l\'objectif kcal', () => {
  assert.ok(consoQuotidienne(4000).riz > consoQuotidienne(1600).riz);
});
