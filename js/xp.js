/* ================= SYSTÈME D'XP & DE NIVEAUX =================
   Fonctions pures. Un vrai système de progression « façon RPG », mais ancré dans
   le réel : l'XP gagné vient du TRAVAIL effectivement produit — la charge × les reps
   de chaque série (le volume). Pas de points gratuits : soulever lourd longtemps fait
   monter, et chaque niveau coûte plus cher que le précédent (courbe en puissance).

   RÈGLE D'ACQUISITION (surcharge progressive) : un exercice ne rapporte son XP QUE s'il
   a fait MIEUX que sa dernière séance, jugé sur la GLOBALITÉ des séries — c.-à-d. volume
   total en hausse (≥ +1 rep quelque part) OU 1RM estimé en hausse (≥ +1 kg, même si les
   reps baissent). Sinon : 0 XP. La première fois qu'on note un exercice (aucune référence)
   compte, pour amorcer la base.

   Deux échelles, même moteur :
   - niveau GLOBAL : sur l'XP cumulé de TOUTES les séances (ton « niveau de perso »).
   - niveau PAR EXERCICE : sur l'XP cumulé de cet exercice (le badge « Niv. »).        */

import { e1rm } from './stats.js';

/* XP d'une série au poids du corps (charge nulle) : on valorise quand même l'effort,
   à raison de N points par rep (tractions non lestées, pompes, etc.). */
export const XP_REP_POIDS_CORPS = 10;

/* Gainage / isométrie : pas de charge, donc le « volume » est le TEMPS SOUS TENSION —
   durée d'un maintien (s) × nombre de reps, valorisé à N points la seconde. Calibré
   pour qu'une série de gainage pèse dans le même ordre de grandeur qu'une série légère. */
export const XP_SEC_GAINAGE = 2;

/* Courbe de niveaux : XP cumulé requis pour ATTEINDRE le niveau L = BASE·(L-1)^EXP.
   EXP > 1 ⇒ chaque palier demande davantage que le précédent (la pente s'accentue),
   ce qui rend les hauts niveaux rares et donc signifiants. Constantes calibrées sur
   le volume réel d'une séance d'hypertrophie (≈ 15 000–25 000 kg·reps). */
export const XP_BASE = 4000;
export const XP_EXP  = 1.6;

/* Base dédiée au niveau PAR EXERCICE : un seul exercice ne produit qu'une fraction
   du volume d'une séance entière, donc sa courbe doit être plus douce — sinon le badge
   « Niv. » paraît figé. Calibrée pour qu'il monte dès les premières séances. */
export const XP_BASE_EXO = 800;

/* XP d'une seule série. reps invalides → 0. Avec charge : volume kg·reps.
   Sans charge (poids du corps) : forfait par rep. */
export function xpSerie(charge, reps){
  const r = Number(reps);
  if(!Number.isFinite(r) || r <= 0) return 0;
  const c = Number(charge);
  if(Number.isFinite(c) && c > 0) return c * r;
  return r * XP_REP_POIDS_CORPS;
}

/* XP d'une série de gainage : temps sous tension (durée × reps) × forfait/seconde. */
export function xpSerieGainage(duree, reps){
  const d = Number(duree), r = Number(reps);
  if(!Number.isFinite(d) || d <= 0 || !Number.isFinite(r) || r <= 0) return 0;
  return d * r * XP_SEC_GAINAGE;
}

/* XP d'une série, gainage (a une `duree`) ou charge — aiguillage sur la nature de la série. */
export function xpDeSerie(s){
  if(!s) return 0;
  return s.duree != null ? xpSerieGainage(s.duree, s.reps) : xpSerie(s.charge, s.reps);
}

/* XP d'un exercice d'une séance. L'unilatéral compte les DEUX côtés (×2), cohérent
   avec le calcul de volume de la courbe de progression. */
export function xpExercice(ex){
  if(!ex || !Array.isArray(ex.series)) return 0;
  const v = ex.series.reduce((a, s) => a + xpDeSerie(s), 0);
  return ex.unilateral ? v * 2 : v;
}

/* XP d'une séance complète, sans condition (potentiel brut). */
export function xpSeance(exercices){
  if(!Array.isArray(exercices)) return 0;
  return exercices.reduce((a, ex) => a + xpExercice(ex), 0);
}

/* ---- jugement « a-t-on fait mieux que la dernière fois ? » ---- */
/* volume brut d'un tableau de séries (sans le ×2 unilatéral : il s'annule de toute
   façon dans une comparaison, et la charge d'un côté reste comparable d'une fois sur l'autre). */
function volumeBrut(series){
  return Array.isArray(series) ? series.reduce((a, s) => a + xpDeSerie(s), 0) : 0;
}
/* meilleur 1RM estimé du tableau (Epley borné, cf. stats.js) */
function meilleurE1rm(series){
  let best = null;
  (Array.isArray(series) ? series : []).forEach(s => {
    const e = e1rm(s.charge, s.reps);
    if(e != null && (best == null || e > best)) best = e;
  });
  return best;
}
/* A-t-on progressé sur la GLOBALITÉ des séries vs la dernière fois ?
   Vrai si plus de volume total (≥ +1 rep) OU un meilleur 1RM estimé (≥ +1 kg, même reps
   en baisse). Sans référence (première séance de l'exo) → vrai. */
export function seanceAmelioree(seriesNow, seriesPrev){
  if(!Array.isArray(seriesPrev) || !seriesPrev.length) return true;
  const EPS = 1e-9;
  if(volumeBrut(seriesNow) > volumeBrut(seriesPrev) + EPS) return true;
  const eNow = meilleurE1rm(seriesNow), ePrev = meilleurE1rm(seriesPrev);
  return eNow != null && ePrev != null && eNow > ePrev + EPS;
}
/* XP réellement gagné par un exercice d'une séance, comparé à son occurrence précédente. */
export function xpGagneExercice(ex, exPrev){
  if(!ex) return 0;
  const prevSeries = exPrev ? exPrev.series : null;
  return seanceAmelioree(ex.series, prevSeries) ? xpExercice(ex) : 0;
}

/* XP cumulé de toutes les séances (niveau global) — gaté par la progression.
   On parcourt les séances dans l'ordre des dates, en gardant la dernière occurrence
   de chaque exercice pour juger l'amélioration de la suivante. */
export function xpTotal(seances){
  if(!Array.isArray(seances)) return 0;
  const ordre = [...seances].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const derniere = new Map();   /* nom d'exo → dernier exercice vu */
  let tot = 0;
  ordre.forEach(s => {
    if(!s || !Array.isArray(s.exercices)) return;
    s.exercices.forEach(ex => {
      if(!ex || !ex.nom) return;
      tot += xpGagneExercice(ex, derniere.get(ex.nom) || null);
      derniere.set(ex.nom, ex);
    });
  });
  return tot;
}

/* XP cumulé d'un exercice (par nom) — gaté par la progression d'une occurrence à l'autre. */
export function xpExerciceTotal(seances, nom){
  if(!Array.isArray(seances)) return 0;
  const occ = [];
  seances.forEach(s => {
    if(!s || !Array.isArray(s.exercices)) return;
    const ex = s.exercices.find(e => e && e.nom === nom);
    if(ex) occ.push({ date: s.date, ex });
  });
  occ.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let tot = 0, prev = null;
  occ.forEach(o => { tot += xpGagneExercice(o.ex, prev); prev = o.ex; });
  return tot;
}

/* XP cumulé requis pour atteindre un niveau donné (niveau 1 = 0).
   Non arrondi : sert de borne exacte à l'inverse ci-dessous ; l'affichage arrondit
   via fmtXp. (Arrondir ici décalerait la borne sous la frontière → niveau perdu.)
   `base` permet une courbe plus douce pour le niveau par exercice (XP_BASE_EXO). */
export function xpCumulNiveau(niveau, base = XP_BASE){
  if(niveau <= 1) return 0;
  return base * Math.pow(niveau - 1, XP_EXP);
}

/* Niveau correspondant à un total d'XP (inverse fermé de la courbe).
   L'epsilon absorbe l'imprécision flottante pile sur une frontière de niveau. */
export function niveauPourXp(total, base = XP_BASE){
  if(!Number.isFinite(total) || total <= 0) return 1;
  return Math.floor(Math.pow(total / base, 1 / XP_EXP) + 1e-9) + 1;
}

/* Titre de palier — la « classe » qui accompagne le niveau. */
export function titreNiveau(niveau){
  if(niveau >= 75) return 'Légende';
  if(niveau >= 50) return 'Élite';
  if(niveau >= 35) return 'Athlète';
  if(niveau >= 20) return 'Avancé';
  if(niveau >= 10) return 'Confirmé';
  if(niveau >= 5)  return 'Initié';
  return 'Débutant';
}

/* Détail complet pour l'affichage : niveau, titre, bornes du palier, XP restant, %. */
export function infosNiveau(total, base = XP_BASE){
  const t = Number.isFinite(total) && total > 0 ? total : 0;
  const niveau = niveauPourXp(t, base);
  const planche = xpCumulNiveau(niveau, base);        /* XP au pied du niveau courant */
  const plafond = xpCumulNiveau(niveau + 1, base);    /* XP requis pour le suivant    */
  const largeur = Math.max(1, plafond - planche);
  const dansNiveau = Math.max(0, t - planche);
  const restant = Math.max(0, plafond - t);
  const pct = Math.max(0, Math.min(100, Math.round(100 * dansNiveau / largeur)));
  return { total: t, niveau, titre: titreNiveau(niveau), planche, plafond,
           dansNiveau, restant, largeur, pct };
}

/* Formatage français des nombres d'XP (« 12 480 »). */
export function fmtXp(n){
  return Math.round(Number(n) || 0).toLocaleString('fr-FR');
}
