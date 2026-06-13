import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RepasModule } from '../js/modules/RepasModule.js';

/* suggestionsProteine n'utilise pas `this` (uniquement ALIMENTS) → testable via .call */
const suggestions = (reste) => RepasModule.prototype.suggestionsProteine.call(null, reste);

test('suggestionsProteine : couvre le déficit avec whey / skyr / poulet', () => {
  const s = suggestions(20);
  assert.equal(s.length, 3);

  const whey = s.find(o => o.cle === 'whey');
  assert.equal(whey.qte, 1);              // 20 / 23 → 1 shaker
  assert.equal(whey.unite, 'shaker');
  assert.equal(whey.prot, 23);
  assert.equal(whey.kcal, 115);

  const skyr = s.find(o => o.cle === 'skyr');
  assert.equal(skyr.unite, 'g');
  assert.equal(skyr.qte, 180);            // 20/11*100 ≈ 182 → arrondi 10 g
  assert.equal(skyr.prot, 20);

  const poulet = s.find(o => o.cle === 'poulet');
  assert.equal(poulet.qte, 110);          // 20/19*100 ≈ 105 → arrondi 10 g
  assert.equal(poulet.prot, 21);
});

test('suggestionsProteine : reste petit → au moins 1 unité / quantité minimale', () => {
  const s = suggestions(5);
  assert.equal(s.find(o => o.cle === 'whey').qte, 1);   // jamais 0 shaker
  assert.ok(s.find(o => o.cle === 'skyr').qte >= 20);   // plancher 20 g
});
