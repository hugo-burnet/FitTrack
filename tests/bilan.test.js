import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adherenceHebdo, bilanForce } from '../js/bilan.js';

test('adherenceHebdo : compte les jours ≥ 90 % de la cible protéique + les séances', () => {
  const journal = [
    { date:'2026-06-10', prot:120 },
    { date:'2026-06-10', prot:40 },   // même jour → 160, atteint (cible 150 → seuil 135)
    { date:'2026-06-11', prot:100 },  // sous le seuil
    { date:'2026-06-12', prot:150 },  // atteint
    { date:'2026-06-01', prot:200 },  // hors fenêtre
  ];
  const seances = [
    { date:'2026-06-10', exercices:[] },
    { date:'2026-06-12', exercices:[] },
    { date:'2026-05-30', exercices:[] },  // hors fenêtre
  ];
  const r = adherenceHebdo(journal, seances, 150, '2026-06-08');
  assert.equal(r.joursProt, 2);    // le 10 et le 12
  assert.equal(r.nbSeances, 2);
});

test('bilanForce : repère les exercices dont le e1RM décroche (récents)', () => {
  const seances = [
    { date:'2026-06-01', exercices:[{ nom:'Dev', series:[{ charge:50, reps:10 }] }] },
    { date:'2026-06-08', exercices:[{ nom:'Dev', series:[{ charge:45, reps:10 }] }] }, // baisse
    { date:'2026-06-02', exercices:[{ nom:'Squat', series:[{ charge:80, reps:10 }] }] },
    { date:'2026-06-09', exercices:[{ nom:'Squat', series:[{ charge:85, reps:10 }] }] }, // hausse
  ];
  const r = bilanForce(seances, '2026-06-01');
  assert.equal(r.total, 2);
  assert.equal(r.declin, 1);
  assert.equal(r.hausse, 1);
  assert.deepEqual(r.exosDeclin, ['Dev']);
});

test('bilanForce : ignore les exercices sans séance récente', () => {
  const seances = [
    { date:'2026-01-01', exercices:[{ nom:'Vieux', series:[{ charge:50, reps:10 }] }] },
    { date:'2026-01-08', exercices:[{ nom:'Vieux', series:[{ charge:40, reps:10 }] }] },
  ];
  assert.equal(bilanForce(seances, '2026-06-01').total, 0);   // trop ancien
});
