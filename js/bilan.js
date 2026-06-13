import { meilleurE1rm } from './progression.js';

/* ================= BILANS HEBDO (fonctions pures) =================
   Reads légers entre deux verdicts mensuels (specs 4.4) : adhérence (protéines +
   séances) et signal de force (un e1RM qui décroche sur plusieurs exercices est un
   marqueur précoce de sous-alimentation / mauvaise récupération). Données déjà là. */

/* protéines atteintes X/7 j (≥ 90 % de la cible) + nombre de séances sur la fenêtre */
export function adherenceHebdo(journalRepas, seances, cibleProt, cutoff){
  const protParJour = {};
  (journalRepas||[]).forEach(e=>{ if(e.date>=cutoff) protParJour[e.date] = (protParJour[e.date]||0) + (e.prot||0); });
  const seuil = cibleProt * 0.9;
  const joursProt = Object.values(protParJour).filter(p=>p>=seuil).length;
  const nbSeances = (seances||[]).filter(s=>s.date>=cutoff).length;
  return { joursProt, nbSeances };
}

/* compare le dernier e1RM de chaque exercice au précédent (séances récentes uniquement).
   declin = nb d'exos en baisse, hausse = en hausse, exosDeclin = leurs noms. */
export function bilanForce(seances, cutoffRecent){
  const parExo = {};
  (seances||[]).forEach(s=>s.exercices.forEach(ex=>{
    (parExo[ex.nom] = parExo[ex.nom]||[]).push({ date:s.date, e1:meilleurE1rm(ex.series) });
  }));
  let declin=0, hausse=0, total=0; const exosDeclin=[];
  Object.keys(parExo).forEach(nom=>{
    const pts = parExo[nom].filter(p=>p.e1!=null).sort((a,b)=>a.date.localeCompare(b.date));
    if(pts.length < 2) return;
    if(cutoffRecent && pts[pts.length-1].date < cutoffRecent) return;   /* exo plus entraîné récemment */
    total++;
    const d = pts[pts.length-1].e1 - pts[pts.length-2].e1;
    if(d < -0.1){ declin++; exosDeclin.push(nom); }
    else if(d > 0.1) hausse++;
  });
  return { total, declin, hausse, exosDeclin };
}
