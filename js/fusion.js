import { jourLocal, triDate } from './utils.js';
import { assainirEtat } from './sanitize.js';

/* ================= FUSION D'ÉTAT =================
   Réconcilie un état entrant `imp` (fichier importé OU contenu d'un Gist distant)
   dans `etat` (mutation en place). Stratégie : fusion par date / id, `imp` gagne
   sur collision — PAS un last-write-wins brut sur l'objet entier, pour gérer le cas
   « PC et mobile modifiés hors-ligne » (cf. specs 2.1).
   `imp` est assaini AVANT toute fusion : une entrée malformée ne peut jamais
   corrompre `etat` ni faire crasher le rendu. Ne lève jamais.
   Partagé par DonneesModule.importerJSON (manuel) et Sync (Gist). */
export function fusionnerEtat(etat, imp){
  if(!imp || typeof imp !== 'object') return etat;
  assainirEtat(imp);

  /* pesées & mensurations : fusion par `date` */
  const fusionDate = (locale, importee) => {
    const map = {}; (locale||[]).forEach(x=>map[x.date]=x); (importee||[]).forEach(x=>map[x.date]=x);
    return Object.values(map).sort(triDate);
  };
  if(Array.isArray(imp.poids)) etat.poids = fusionDate(etat.poids, imp.poids);
  if(Array.isArray(imp.mensurations)) etat.mensurations = fusionDate(etat.mensurations, imp.mensurations);

  /* objectif kcal : l'entrant gagne s'il est présent */
  if(typeof imp.objectifKcal === 'number') etat.objectifKcal = imp.objectifKcal;

  /* plan de repas éditable (déplacement d'aliments) : l'entrant gagne s'il est valide
     (assaini ci-dessus → null si corrompu). Pas de fusion fine : c'est une structure unique. */
  if(Array.isArray(imp.plan)) etat.plan = imp.plan;

  /* repas du jour : fusion OR (coché sur un appareil = coché) */
  if(imp.repas && imp.repas.jour === jourLocal()){
    if(etat.repas.jour !== jourLocal()){ etat.repas = {jour:jourLocal(), coches:{}}; }
    Object.keys(imp.repas.coches||{}).forEach(k=>{ if(imp.repas.coches[k]) etat.repas.coches[k]=true; });
  }

  /* journal des repas : fusion par date+id */
  if(Array.isArray(imp.journalRepas)){
    const map={}; etat.journalRepas.forEach(e=>map[e.date+'|'+e.id]=e); imp.journalRepas.forEach(e=>map[e.date+'|'+e.id]=e);
    etat.journalRepas = Object.values(map).sort(triDate);
  }

  /* programmes : fusion par id (l'entrant remplace un id existant) */
  if(Array.isArray(imp.programmes) && imp.programmes.length){
    const map={}; etat.programmes.forEach(p=>map[p.id]=p);
    imp.programmes.forEach(p=>{ if(p && p.id && Array.isArray(p.jours)) map[p.id]=p; });
    etat.programmes = Object.values(map);
  }
  if(typeof imp.programmeActif === 'string' && etat.programmes.some(p=>p.id===imp.programmeActif)) etat.programmeActif = imp.programmeActif;

  /* séances : fusion par date+jourId */
  if(Array.isArray(imp.seances)){
    const map={}; etat.seances.forEach(s=>map[s.date+'|'+s.jourId]=s);
    imp.seances.forEach(s=>{ if(s && s.date) map[s.date+'|'+s.jourId]=s; });
    etat.seances = Object.values(map).sort(triDate);
  }

  /* courses : fusion des articles par id + coches OR */
  if(imp.courses && typeof imp.courses === 'object'){
    if(Array.isArray(imp.courses.items)){
      const map={}; (etat.courses.items||[]).forEach(it=>map[it.id]=it);
      imp.courses.items.forEach(it=>{ if(it && it.id) map[it.id]=it; });
      etat.courses.items = Object.values(map);
    }
    Object.keys(imp.courses.coches||{}).forEach(k=>{ if(imp.courses.coches[k]) etat.courses.coches[k]=true; });
  }
  return etat;
}
