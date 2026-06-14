/* ================= ASSAINISSEMENT DE L'ÉTAT =================
   Fonctions PURES qui valident la forme des données persistées.
   Utilisées à deux endroits, pour ne jamais faire confiance à une source externe :
     - Store.charger()                 → ce qui est déjà en stockage peut être corrompu
     - DonneesModule.importerJSON()    → un fichier importé peut être malformé
   Règle d'or : ne JAMAIS lever d'exception. On laisse tomber les entrées
   invalides et on renvoie des données propres, pour que le rendu ne crashe jamais. */

import { ALIMENTS } from './data.js';

export function estNombre(x){ return typeof x === 'number' && isFinite(x); }
export function estChaine(x){ return typeof x === 'string'; }

/* ---- plan de repas éditable : [{id, nom, items:[[cle,qté],…]}] ----
   On ne garde que les aliments connus (cle ∈ ALIMENTS) et les quantités numériques.
   Renvoie null si rien d'exploitable → Store/Import retombe sur le plan par défaut. */
export function assainirRepasPlan(arr){
  if(!Array.isArray(arr)) return null;
  const repas = arr
    .filter(r => r && typeof r === 'object' && estChaine(r.id) && Array.isArray(r.items))
    .map(r => ({
      ...r,
      items: r.items
        .filter(it => Array.isArray(it) && it.length >= 2 && estChaine(it[0]) && ALIMENTS[it[0]] && estNombre(it[1]))
        .map(([cle, q]) => [cle, q]),
    }));
  return repas.length ? repas : null;
}

/* ---- entrées datées (pesées, mensurations) : la clé de fusion est `date` ---- */
export function assainirDates(arr){
  if(!Array.isArray(arr)) return [];
  return arr.filter(x => x && typeof x === 'object' && estChaine(x.date));
}

/* ---- série de muscu : charge {charge:number|null, reps} OU gainage {duree:number|null, reps} ---- */
export function serieValide(s){
  if(!s || typeof s !== 'object' || !estNombre(s.reps)) return false;
  if('duree' in s) return s.duree === null || estNombre(s.duree);   /* gainage : temps de maintien */
  return s.charge === null || estNombre(s.charge);                  /* charge classique */
}

/* ---- une séance : date + exercices[] dont chaque exercice a des séries valides ---- */
export function assainirSeance(s){
  if(!s || typeof s !== 'object' || !estChaine(s.date)) return null;
  if(!Array.isArray(s.exercices)) return null;
  const exercices = s.exercices
    .filter(e => e && typeof e === 'object' && estChaine(e.nom) && Array.isArray(e.series))
    .map(e => ({
      ...e,
      series: e.series.filter(serieValide).map(x => 'duree' in x ? { duree: x.duree, reps: x.reps } : { charge: x.charge, reps: x.reps }),
    }))
    .filter(e => e.series.length);          /* un exercice sans série valide est vide → écarté */
  if(!exercices.length) return null;        /* une séance sans exercice valide est inutile */
  return { ...s, exercices };
}
export function assainirSeances(arr){
  if(!Array.isArray(arr)) return [];
  return arr.map(assainirSeance).filter(Boolean);
}

/* ---- programmes : id + jours[] dont chaque jour.exercices est un tableau ---- */
export function assainirProgramme(p){
  if(!p || typeof p !== 'object' || !estChaine(p.id) || !Array.isArray(p.jours)) return null;
  const jours = p.jours.filter(j => j && typeof j === 'object' && Array.isArray(j.exercices));
  if(!jours.length) return null;
  return { ...p, jours };
}
export function assainirProgrammes(arr){
  if(!Array.isArray(arr)) return [];
  return arr.map(assainirProgramme).filter(Boolean);
}

/* ---- journal des repas : {date, id, items[]} ---- */
export function assainirJournalRepas(arr){
  if(!Array.isArray(arr)) return [];
  return arr
    .filter(e => e && typeof e === 'object' && estChaine(e.date) && e.id != null)
    .map(e => ({ ...e, items: Array.isArray(e.items) ? e.items.filter(it => it && typeof it === 'object') : [] }));
}

/* ---- articles de courses : {id, ...} ---- */
export function assainirCoursesItems(arr){
  if(!Array.isArray(arr)) return [];
  return arr.filter(it => it && typeof it === 'object' && it.id != null);
}

/* ---- état complet : assainit chaque section connue, en place et sans jamais lever ----
   Les valeurs par défaut / migrations restent gérées par Store.charger ; ici on ne fait
   que purger les formes invalides des collections. */
export function assainirEtat(etat){
  if(!etat || typeof etat !== 'object') return etat;
  if('poids' in etat)         etat.poids        = assainirDates(etat.poids);
  if('mensurations' in etat)  etat.mensurations = assainirDates(etat.mensurations);
  if('seances' in etat)       etat.seances      = assainirSeances(etat.seances);
  if('journalRepas' in etat)  etat.journalRepas = assainirJournalRepas(etat.journalRepas);
  if('plan' in etat)          etat.plan         = assainirRepasPlan(etat.plan);   /* null → Store re-défaut */
  if(etat.repas && typeof etat.repas === 'object' && 'planJour' in etat.repas)
    etat.repas.planJour = assainirRepasPlan(etat.repas.planJour);                  /* null → pas de surcharge */
  if(Array.isArray(etat.programmes)) etat.programmes = assainirProgrammes(etat.programmes);
  if(etat.courses && typeof etat.courses === 'object' && 'items' in etat.courses)
    etat.courses.items = assainirCoursesItems(etat.courses.items);
  return etat;
}
