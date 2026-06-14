import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFourchette, recommander, statsExo, meilleurE1rm, meilleureCharge,
  meilleurTemps, tempsSousTension, PAS_DEFAUT,
} from '../js/progression.js';

test('parseFourchette : intervalle, valeur seule, gainage', () => {
  assert.deepEqual(parseFourchette('10-12'), { min:10, max:12 });
  assert.deepEqual(parseFourchette('12'), { min:12, max:12 });
  assert.deepEqual(parseFourchette('12/jambe'), { min:12, max:12 });
  assert.equal(parseFourchette('tours'), null);
  assert.equal(parseFourchette(''), null);
});

test('recommander : démarrer quand aucune série passée', () => {
  const r = recommander({ reps:'10-12' }, []);
  assert.equal(r.statut, 'demarrer');
  assert.equal(r.xp, 0);
});

test('recommander : neutre pour exercice sans fourchette (gainage)', () => {
  const r = recommander({ reps:'tours' }, [{ charge:null, reps:5 }]);
  assert.equal(r.statut, 'neutre');
  assert.equal(r.cible, null);
});

test('recommander : deload quand même la meilleure série tombe sous le bas de fourchette', () => {
  const r = recommander({ reps:'10-12' }, [{ charge:50, reps:8 }, { charge:50, reps:7 }]);
  assert.equal(r.statut, 'deload');
  assert.equal(r.ton, 'down');
  assert.equal(r.cible.charge, 50 - PAS_DEFAUT);   // 47.5
});

test('recommander : monter (level up) quand toutes les séries tiennent le haut de fourchette', () => {
  const r = recommander({ reps:'10-12' }, [{ charge:50, reps:12 }, { charge:50, reps:12 }]);
  assert.equal(r.statut, 'monter');
  assert.equal(r.ton, 'up');
  assert.equal(r.xp, 100);
  assert.equal(r.cible.charge, 50 + PAS_DEFAUT);   // 52.5
});

test('recommander : respecte le pas personnalisé de l\'exercice', () => {
  const r = recommander({ reps:'12-15', pas:1 }, [{ charge:10, reps:15 }, { charge:10, reps:15 }]);
  assert.equal(r.statut, 'monter');
  assert.equal(r.cible.charge, 11);
});

test('recommander : consolide quand le top de charge n\'est pas tenu sur toutes les séries', () => {
  const r = recommander({ reps:'10-12' }, [{ charge:50, reps:12 }, { charge:45, reps:12 }]);
  assert.equal(r.statut, 'consolide');
  assert.equal(r.cible.charge, 50);                // la charge de travail = la plus lourde
});

test('recommander : reps quand séries droites mais pas encore au max', () => {
  const r = recommander({ reps:'10-12' }, [{ charge:50, reps:10 }, { charge:50, reps:10 }]);
  assert.equal(r.statut, 'reps');
  assert.equal(r.cible.charge, 50);
  assert.equal(r.cible.reps, 12);
});

test('gainage : meilleurTemps et tempsSousTension', () => {
  const series = [{ duree:30, reps:3 }, { duree:45, reps:2 }];
  assert.equal(meilleurTemps(series), 45);
  assert.equal(tempsSousTension(series), 30*3 + 45*2);   // 180
  assert.equal(meilleurTemps([]), null);
  assert.equal(tempsSousTension([]), 0);
});

test('recommander gainage : démarrer, viser la cible, cible tenue', () => {
  const ex = { gainage:true, dureeCible:30, reps:'tours' };
  assert.equal(recommander(ex, []).statut, 'demarrer');
  const sousCible = recommander(ex, [{ duree:20, reps:3 }]);
  assert.equal(sousCible.statut, 'temps');
  assert.equal(sousCible.ton, 'neutre');
  assert.ok(sousCible.xp > 0 && sousCible.xp < 100);
  const atteint = recommander(ex, [{ duree:35, reps:3 }]);
  assert.equal(atteint.statut, 'monter');
  assert.equal(atteint.ton, 'up');
  assert.equal(atteint.xp, 100);
  // sans cible définie : message neutre « au ressenti »
  assert.equal(recommander({ gainage:true }, [{ duree:30, reps:3 }]).statut, 'neutre');
});

test('statsExo : niveau gagné à chaque PR de charge, record = meilleure charge', () => {
  const seances = [
    { date:'2026-01-01', exercices:[{ nom:'A', series:[{ charge:20, reps:10 }, { charge:22, reps:8 }] }] },
    { date:'2026-01-08', exercices:[{ nom:'A', series:[{ charge:25, reps:10 }] }] },
    { date:'2026-01-15', exercices:[{ nom:'A', series:[{ charge:24, reps:10 }] }] }, // pas de PR
    { date:'2026-01-22', exercices:[{ nom:'B', series:[{ charge:99, reps:5 }] }] },  // autre exo, ignoré
  ];
  const s = statsExo(seances, 'A');
  assert.equal(s.niveau, 2);        // 22 puis 25
  assert.equal(s.record, 25);
  assert.equal(s.sessions.length, 3);
});

test('statsExo : exercice jamais fait → niveau 0, record null', () => {
  const s = statsExo([], 'Inconnu');
  assert.equal(s.niveau, 0);
  assert.equal(s.record, null);
});

test('meilleurE1rm : reps plafonnées à 12 (via e1rm)', () => {
  // 40 kg × 20 reps, capé à 12 → 40 * (1 + 12/30) = 56 (et non 40*(1+20/30)=66,7)
  assert.ok(Math.abs(meilleurE1rm([{ charge:40, reps:20 }]) - 56) < 1e-9);
});

test('meilleurE1rm / meilleureCharge : ignorent les charges nulles', () => {
  const series = [{ charge:null, reps:12 }, { charge:40, reps:10 }, { charge:50, reps:5 }];
  assert.equal(meilleureCharge(series), 50);
  // Epley : 40*(1+10/30)=53.33 ; 50*(1+5/30)=58.33 → meilleur = 58.33
  assert.ok(Math.abs(meilleurE1rm(series) - 58.3333) < 1e-3);
  assert.equal(meilleureCharge([{ charge:null, reps:8 }]), null);
});
