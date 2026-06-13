/* ================= MOTEUR NUTRITIONNEL (fonctions pures) =================
   Extrait de RepasModule pour être testable hors DOM. Le plan nutritionnel fixe
   les protéines/lipides ; seuls les aliments `flex` (glucides) s'ajustent par un
   facteur, borné pour rester réaliste, afin d'atteindre l'objectif kcal. */

import { ALIMENTS, PLAN } from './data.js';

export const FLEX_MIN = 0.4, FLEX_MAX = 1.8;

export function kcalItem(cle, q){ const a=ALIMENTS[cle]; return a.unite!==undefined ? a.kcalU*q : a.kcal100*q/100; }
export function protItem(cle, q){ const a=ALIMENTS[cle]; return a.unite!==undefined ? a.protU*q : a.prot100*q/100; }

/* kcal de base : part fixe (non-flex) et part ajustable (flex) du plan */
export function basesKcal(){
  let fixe=0, flex=0;
  PLAN.forEach(r=>r.items.forEach(([cle,q])=>{
    (ALIMENTS[cle].flex ? (flex+=kcalItem(cle,q)) : (fixe+=kcalItem(cle,q)));
  }));
  return {fixe, flex};
}

/* facteur appliqué aux aliments flex pour viser l'objectif, borné [0.4, 1.8] */
export function facteurFlex(objectifKcal){
  const {fixe, flex} = basesKcal();
  if(flex<=0) return 1;
  const f = (objectifKcal - fixe) / flex;
  return Math.max(FLEX_MIN, Math.min(FLEX_MAX, f));
}

/* consommation quotidienne par aliment, dérivée du PLAN (flex ajusté à l'objectif).
   Sert à calculer une liste de courses « plan × jours » (specs 4.3) : ferme la boucle
   plan → conso → liste, et se met à jour avec l'objectif kcal. Renvoie {cle: qté/jour}. */
export function consoQuotidienne(objectifKcal){
  const f = facteurFlex(objectifKcal);
  const out = {};
  PLAN.forEach(r=>r.items.forEach(([cle,q])=>{
    const qte = ALIMENTS[cle].flex ? Math.round(q*f/5)*5 : q;   /* même arrondi que qteAjustee */
    out[cle] = (out[cle]||0) + qte;
  }));
  return out;
}

/* le facteur sature-t-il à une borne ? renvoie 'bas' | 'haut' | null
   (sert à avertir que le total réel diverge de la cible — cf. specs 4.1) */
export function flexSature(objectifKcal){
  const {fixe, flex} = basesKcal();
  if(flex<=0) return null;
  const f = (objectifKcal - fixe) / flex;
  if(f < FLEX_MIN) return 'bas';
  if(f > FLEX_MAX) return 'haut';
  return null;
}
