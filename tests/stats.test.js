import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moyennesHebdo, rythmeMensuel, tendanceTaille, tendanceBras, e1rm } from '../js/stats.js';

test('moyennesHebdo : groupe par blocs de 7 jours depuis la 1re pesée', () => {
  const poids = [
    { date:'2026-01-01', kg:80 },
    { date:'2026-01-03', kg:80.4 },   // même semaine que le 01
    { date:'2026-01-08', kg:79.8 },   // semaine suivante (J+7)
  ];
  const m = moyennesHebdo(poids);
  assert.equal(m.length, 2);
  assert.deepEqual(m[0], { sem:0, kg:(80 + 80.4) / 2 });
  assert.deepEqual(m[1], { sem:1, kg:79.8 });
});

test('moyennesHebdo : tableau vide → []', () => {
  assert.deepEqual(moyennesHebdo([]), []);
});

test('rythmeMensuel : pente linéaire -0,5 kg/sem → ≈ -2,17 kg/mois', () => {
  const poids = [
    { date:'2026-01-01', kg:80 },
    { date:'2026-01-08', kg:79.5 },
    { date:'2026-01-15', kg:79 },
    { date:'2026-01-22', kg:78.5 },
  ];
  const r = rythmeMensuel(poids);
  assert.ok(Math.abs(r - (-0.5 * 4.345)) < 1e-6);   // -2.1725
});

test('rythmeMensuel : moins de 2 moyennes hebdo → null', () => {
  assert.equal(rythmeMensuel([{ date:'2026-01-01', kg:80 }]), null);
});

test('tendanceTaille / tendanceBras : delta des deux derniers relevés, en ignorant les nuls', () => {
  const mens = [
    { taille:86, bras:32 },
    { taille:null, bras:null },        // relevé incomplet : ignoré
    { taille:85.5, bras:32.2 },
  ];
  assert.ok(Math.abs(tendanceTaille(mens) - (-0.5)) < 1e-9);
  assert.ok(Math.abs(tendanceBras(mens) - 0.2) < 1e-9);
});

test('tendanceTaille : moins de 2 relevés valides → null', () => {
  assert.equal(tendanceTaille([{ taille:86 }]), null);
  assert.equal(tendanceBras([{ bras:null }, { bras:32 }]), null);
});

test('e1rm : Epley, null si charge absente', () => {
  assert.ok(Math.abs(e1rm(60, 10) - 60 * (1 + 10 / 30)) < 1e-9);   // 80
  assert.equal(e1rm(null, 10), null);
});

test('e1rm : reps plafonnées à 12 (anti-bruit en haut de fourchette)', () => {
  assert.equal(e1rm(50, 12), 70);            // 50 * (1 + 12/30)
  assert.equal(e1rm(50, 15), e1rm(50, 12));  // au-delà de 12 → même estimation
  assert.equal(e1rm(50, 20), 70);
});
