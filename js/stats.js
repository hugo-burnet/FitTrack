/* ================= CALCULS (fonctions pures) ================= */

/* moyenne hebdo glissante : groupe par semaine ISO approx (blocs de 7 jours depuis la 1re pesée) */
export function moyennesHebdo(poids){
  if(poids.length===0) return [];
  const t0 = new Date(poids[0].date+'T12:00:00').getTime();
  const sem = {};
  poids.forEach(p=>{
    const i = Math.floor((new Date(p.date+'T12:00:00').getTime()-t0)/(7*864e5));
    (sem[i] = sem[i]||[]).push(p.kg);
  });
  return Object.keys(sem).map(Number).sort((a,b)=>a-b)
    .map(i=>({sem:i, kg: sem[i].reduce((s,x)=>s+x,0)/sem[i].length}));
}

/* rythme en kg/mois : régression simple sur les 4 dernières moyennes hebdo */
export function rythmeMensuel(poids){
  const m = moyennesHebdo(poids);
  if(m.length<2) return null;
  const der = m.slice(-4);
  const n = der.length;
  const mx = der.reduce((s,p)=>s+p.sem,0)/n, my = der.reduce((s,p)=>s+p.kg,0)/n;
  let num=0, den=0;
  der.forEach(p=>{ num += (p.sem-mx)*(p.kg-my); den += (p.sem-mx)**2; });
  if(den===0) return null;
  return (num/den) * 4.345; /* pente kg/semaine -> kg/mois */
}

export function tendanceTaille(mensurations){
  const avecTaille = mensurations.filter(m=>m.taille!==null);
  if(avecTaille.length<2) return null;
  const a = avecTaille[avecTaille.length-2], b = avecTaille[avecTaille.length-1];
  return b.taille - a.taille;
}

export function tendanceBras(mensurations){
  const avec = mensurations.filter(m=>m.bras!==null);
  if(avec.length<2) return null;
  return avec[avec.length-1].bras - avec[avec.length-2].bras;
}

/* le bras stagne-t-il ? ≥3 relevés et les 2 derniers deltas mensuels ≤ 0 — exiger
   2 deltas (pas un seul, trop bruité) avant d'agir dessus dans le verdict (specs 5) */
export function brasStagne(mensurations){
  const avec = mensurations.filter(m=>m.bras!=null && isFinite(m.bras));
  if(avec.length < 3) return false;
  const n = avec.length;
  return (avec[n-1].bras - avec[n-2].bras) <= 0 && (avec[n-2].bras - avec[n-3].bras) <= 0;
}

/* plafond de reps dans l'estimation Epley : au-delà, charge*(1+reps/30) devient bruité
   (le programme est surtout 10-15 reps) → on borne pour des deltas 1RM fiables (specs 4.2) */
export const REPS_CAP_E1RM = 12;

/* 1RM estimé (formule Epley), reps plafonnées pour limiter le bruit en haut de fourchette */
export function e1rm(charge, reps){ return charge==null ? null : charge*(1+Math.min(reps, REPS_CAP_E1RM)/30); }
