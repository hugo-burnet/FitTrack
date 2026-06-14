/* ================= MOTEUR DE PROGRESSION (surcharge progressive « 0 doute ») =================
   Fonctions pures : prennent les données, renvoient des recommandations.
   Modèle : double progression. On grimpe en reps dans la fourchette ; une fois le
   haut de fourchette atteint sur TOUTES les séries de travail, on monte la charge
   d'un « pas » (level up). Si on s'écroule sous le bas de fourchette, on redescend
   (deload) — c'est ainsi que les réductions de poids sont prises en compte. */

import { e1rm } from './stats.js';

export const PAS_DEFAUT = 2.5; /* kg ajoutés à chaque palier, par défaut */

/* "10-12" -> {min:10,max:12} ; "12" / "12/jambe" -> {min:12,max:12} ; "tours"/"" -> null */
export function parseFourchette(reps){
  const r = String(reps==null?'':reps);
  if(/tour|gain/i.test(r)) return null;
  const inter = r.match(/(\d+)\s*-\s*(\d+)/);
  if(inter) return { min:+inter[1], max:+inter[2] };
  const seul = r.match(/(\d+)/);
  if(seul) return { min:+seul[1], max:+seul[1] };
  return null;
}

export function fmtKg(n){
  if(n==null) return '';
  const v = Math.round(n*100)/100;
  return Number.isInteger(v) ? String(v) : String(v);
}

/* repos conseillé (secondes) déduit de la fourchette de reps */
export function reposRecommande(ex){
  const f = parseFourchette(ex && ex.reps);
  if(!f) return 45;                 /* gainage / circuit */
  if(f.max <= 6)  return 210;       /* lourd / force */
  if(f.max <= 8)  return 180;
  if(f.max <= 12) return 120;       /* hypertrophie classique */
  if(f.max <= 15) return 90;
  return 60;                        /* haut volume / isolation */
}

export function fmtRepos(s){
  if(s < 60) return s + ' s';
  const m = Math.floor(s/60), sec = s%60;
  return sec ? `${m} min ${sec}` : `${m} min`;
}

/* niveau & record d'un exercice, dérivés de l'historique (1 niveau gagné par PR de charge) */
export function statsExo(seances, nom){
  const sessions = [];
  seances.forEach(s=>{
    const ex = s.exercices.find(e=>e.nom===nom);
    if(!ex) return;
    const charges = ex.series.map(x=>x.charge).filter(c=>c!=null);
    sessions.push({ date:s.date, bestCharge: charges.length ? Math.max(...charges) : null, series: ex.series });
  });
  sessions.sort((a,b)=>a.date.localeCompare(b.date));
  let niveau = 0, record = -Infinity;
  sessions.forEach(s=>{ if(s.bestCharge!=null && s.bestCharge > record){ niveau++; record = s.bestCharge; } });
  return { sessions, niveau, record: record===-Infinity ? null : record };
}

/* gainage : meilleur temps de maintien (s) et temps sous tension total (s·reps) d'un tableau */
export function meilleurTemps(series){
  let best = null;
  (Array.isArray(series) ? series : []).forEach(s=>{ if(s.duree!=null && (best==null || s.duree>best)) best = s.duree; });
  return best;
}
export function tempsSousTension(series){
  return (Array.isArray(series) ? series : []).reduce((a,s)=> a + (s.duree!=null ? s.duree*(s.reps||0) : 0), 0);
}

/* recommandation gainage : pas de charge, on pilote le TEMPS de maintien vers une cible. */
function recommanderGainage(ex, lastSeries){
  const cible = ex && ex.dureeCible;
  if(!lastSeries || !lastSeries.length){
    return { statut:'demarrer', ton:'neutre', xp:0, cible:null,
      message: cible ? `Première fois : tiens la position proprement, vise ${cible} s par série.`
                     : `Première fois : tiens la position le plus longtemps possible, propre.` };
  }
  const best = meilleurTemps(lastSeries);
  if(!cible || best==null){
    return { statut:'neutre', ton:'neutre', xp:null, cible:null,
      message: 'Gainage : ajoute du temps ou une rép. à chaque fois.' };
  }
  const xp = Math.max(0, Math.min(100, Math.round(100 * best / cible)));
  if(best >= cible){
    return { statut:'monter', ton:'up', xp:100, cible:null,
      message: `🔥 Cible tenue (${best} s) — allonge encore le maintien ou ajoute une rép.` };
  }
  return { statut:'temps', ton:'neutre', xp, cible:null,
    message: `Tiens plus longtemps : ${best} s → vise ${cible} s par série.` };
}

/* recommandation pour la prochaine série, à partir de la dernière perf (tableau de séries) */
export function recommander(ex, lastSeries){
  if(ex && ex.gainage) return recommanderGainage(ex, lastSeries);
  const f = parseFourchette(ex && ex.reps);
  const pas = (ex && ex.pas) || PAS_DEFAUT;

  if(!lastSeries || !lastSeries.length){
    return { statut:'demarrer', ton:'neutre', xp:0, cible:{charge:null, reps:f?f.max:null},
      message: `Première fois : trouve un poids tenu sur ${f ? f.min+'-'+f.max : ex.reps} reps propres.` };
  }
  if(!f){
    return { statut:'neutre', ton:'neutre', xp:0, cible:null,
      message: 'Progresse au ressenti (gainage / temps sous tension).' };
  }

  const n = lastSeries.length;                                        /* séries réellement faites */
  const charges = lastSeries.map(s=>s.charge).filter(c=>c!=null);
  const wc = charges.length ? Math.max(...charges) : null;            /* charge de travail = la plus lourde */
  const atWc = wc!=null ? lastSeries.filter(s=>s.charge===wc) : lastSeries.slice();
  const allAtWc = atWc.length === n;                                  /* séries droites (même charge partout) ? */
  const topReps = Math.max(...atWc.map(s=>s.reps));                   /* meilleures reps à la charge de travail */
  const minRepsAtWc = Math.min(...atWc.map(s=>s.reps));               /* pire série à la charge de travail */
  const xp = Math.round(100 * lastSeries.reduce((a,s)=>a + Math.min(s.reps/f.max, 1), 0) / n);

  /* trop lourd : même ta meilleure série au top de charge ne tient pas le bas de fourchette */
  if(topReps < f.min){
    const c = wc!=null ? Math.max(0, wc - pas) : null;
    return { statut:'deload', ton:'down', xp, cible:{charge:c, reps:f.min},
      message: `Trop lourd : ${wc!=null ? 'redescends à '+fmtKg(c)+' kg' : 'allège'} et reconstruis proprement.` };
  }
  /* charge tenue sur TOUTES les séries au haut de fourchette → on monte */
  if(allAtWc && minRepsAtWc >= f.max){
    const c = wc!=null ? wc + pas : null;
    return { statut:'monter', ton:'up', xp:100, cible:{charge:c, reps:f.min},
      message: `🔥 Level up ! ${c!=null ? 'Monte à '+fmtKg(c)+' kg' : 'Ajoute du poids'} et vise ${f.min} reps propres.` };
  }
  /* tu as touché le top de charge, mais pas sur toutes les séries (charge dégressive) → consolide d'abord */
  if(!allAtWc && wc!=null){
    return { statut:'consolide', ton:'neutre', xp, cible:{charge:wc, reps:f.max},
      message: `Tu n'as tenu ${fmtKg(wc)} kg que sur ${atWc.length}/${n} séries — refais ${fmtKg(wc)} kg sur les ${n} avant de monter.` };
  }
  /* séries droites mais pas encore au max partout → gratte des reps */
  return { statut:'reps', ton:'neutre', xp, cible:{charge:wc, reps:f.max},
    message: `Garde ${wc!=null ? fmtKg(wc)+' kg' : 'le poids'}, gratte des reps jusqu'à ${f.max} partout.` };
}

/* meilleur 1RM estimé (Epley) d'un tableau de séries — reps plafonnées via e1rm (cf. 4.2) */
export function meilleurE1rm(series){
  let best = null;
  series.forEach(s=>{
    const e = e1rm(s.charge, s.reps);
    if(e!=null && (best==null || e>best)) best = e;
  });
  return best;
}

/* meilleure charge d'un tableau de séries */
export function meilleureCharge(series){
  const c = series.map(s=>s.charge).filter(x=>x!=null);
  return c.length ? Math.max(...c) : null;
}
