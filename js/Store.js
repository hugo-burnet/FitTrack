import { jourLocal, cloneProfond, slug } from './utils.js';
import { CLE, OBJ_DEFAUT, PLAN, PROG_DEFAUT, COURSES_DEFAUT } from './data.js';
import { assainirEtat } from './sanitize.js';
import { idbGet, idbSet } from './idb.js';

/* ================= ÉTAT & PERSISTANCE =================
   Source unique de vérité en mémoire (`this.etat`).
   Durabilité : IndexedDB en primaire (résiste à l'éviction iOS), localStorage en
   miroir de secours (lecture rapide + environnements sans IndexedDB + migration).
   Émet 'storage-error' uniquement quand AUCUNE couche de persistance n'est disponible. */
export class Store extends EventTarget {
  constructor(){
    super();
    this.etat = { poids: [], mensurations: [], repas: null, objectifKcal: OBJ_DEFAUT };
    this.storageOK = true;   /* au moins une couche persiste */
    this.idbOK = true;       /* IndexedDB opérationnel */
  }

  /* lecture localStorage (legacy / secours) : clé principale puis miroir */
  _lireLocalStorage(){
    let brut = localStorage.getItem(CLE);
    if(!brut) brut = localStorage.getItem(CLE+'-backup');
    if(!brut) return null;
    let e;
    try{ e = JSON.parse(brut); }
    catch{ try{ e = JSON.parse(localStorage.getItem(CLE+'-backup')); }catch{ return null; } }
    return (e && Array.isArray(e.poids)) ? e : null;
  }

  async charger(){
    let charge = null;
    try{
      charge = await idbGet(CLE);
      if(!charge){
        /* migration transparente : premier lancement post-IndexedDB → on récupère l'ancien
           état localStorage et on le promeut vers IndexedDB */
        const legacy = this._lireLocalStorage();
        if(legacy){ charge = legacy; try{ await idbSet(CLE, legacy); }catch{} }
      }
    }catch(err){
      /* IndexedDB indisponible (navigation privée Safari, etc.) → repli localStorage */
      this.idbOK = false;
      charge = this._lireLocalStorage();
    }

    if(charge && Array.isArray(charge.poids)) this.etat = charge;

    /* si IndexedDB est tombé ET que localStorage est aussi inutilisable, on prévient l'UI */
    if(!this.idbOK && !this._localStorageDispo()){
      this.storageOK = false;
      this.dispatchEvent(new Event('storage-error'));
    }

    /* demande de stockage persistant (best-effort ; non garanti sur iOS) */
    if(navigator.storage && navigator.storage.persist){
      try{ navigator.storage.persist(); }catch{}
    }

    /* on ne fait jamais confiance à ce qui est déjà en stockage : purge des formes invalides
       AVANT les défauts, pour qu'une collection vidée soit re-remplie par défaut juste après */
    assainirEtat(this.etat);
    /* migrations / valeurs par défaut pour les anciens enregistrements */
    const etat = this.etat;
    if(!Array.isArray(etat.poids)) etat.poids = [];
    if(!Array.isArray(etat.mensurations)) etat.mensurations = [];
    if(typeof etat.objectifKcal !== 'number') etat.objectifKcal = OBJ_DEFAUT;
    if(!etat.repas || typeof etat.repas !== 'object') etat.repas = { jour: jourLocal(), coches: {} };
    if(!etat.repas.coches) etat.repas.coches = {};
    /* planJour : déplacements d'aliments valables seulement aujourd'hui (sinon null).
       Réinitialisé à minuit comme les cochages (cf. resetSiNouveauJour). */
    if(!Array.isArray(etat.repas.planJour)) etat.repas.planJour = null;
    /* plan nutritionnel ÉDITABLE (déplacement d'aliments entre repas). Défaut = PLAN de référence. */
    if(!Array.isArray(etat.plan) || !etat.plan.length) etat.plan = cloneProfond(PLAN);
    /* nouveaux modules : journal repas, muscu, courses */
    if(!Array.isArray(etat.journalRepas)) etat.journalRepas = [];
    if(!Array.isArray(etat.programmes) || !etat.programmes.length) etat.programmes = cloneProfond(PROG_DEFAUT);
    this._migrerMcGill(etat);   /* l'ancien « Circuit McGill big 3 » devient 3 gainages distincts */
    if(!etat.programmeActif || !etat.programmes.some(p=>p.id===etat.programmeActif)) etat.programmeActif = etat.programmes[0].id;
    if(!Array.isArray(etat.seances)) etat.seances = [];
    if(!etat.courses || typeof etat.courses !== 'object') etat.courses = { items:[], coches:{}, maj:null };
    if(!Array.isArray(etat.courses.items) || !etat.courses.items.length)
      etat.courses.items = COURSES_DEFAUT.map(c=>({id:slug(c.nom), ...c}));
    if(!etat.courses.coches) etat.courses.coches = {};
    if(typeof etat.courses.jours !== 'number') etat.courses.jours = 7;   /* horizon de la liste (specs 4.3) */
    /* brouillons de séance (saisie en cours, non encore enregistrée) par id de jour */
    if(!etat.brouillons || typeof etat.brouillons !== 'object') etat.brouillons = {};
    if(typeof etat.autoExport !== 'boolean') etat.autoExport = false;
  }

  /* migration : le « Circuit McGill big 3 » (une ligne, comptée en charge) est remplacé
     in situ par ses 3 mouvements, chacun en gainage (temps + reps). Idempotent : après
     remplacement le nom ne matche plus. N'altère pas l'historique des séances déjà notées. */
  _migrerMcGill(etat){
    const splits = [
      {nom:'Curl-up (McGill big 3)',    series:3, reps:'tours', gainage:true, dureeCible:10},
      {nom:'Side plank (McGill big 3)', series:2, reps:'tours', gainage:true, dureeCible:10, unilateral:true},
      {nom:'Bird-dog (McGill big 3)',   series:3, reps:'tours', gainage:true, dureeCible:10},
    ];
    (etat.programmes||[]).forEach(p=>(p.jours||[]).forEach(j=>{
      if(!Array.isArray(j.exercices)) return;
      const i = j.exercices.findIndex(e=>e && e.nom==='Circuit McGill big 3');
      if(i>=0) j.exercices.splice(i, 1, ...cloneProfond(splits));
    }));
  }

  _localStorageDispo(){
    try{ const k='__t'; localStorage.setItem(k,'1'); localStorage.removeItem(k); return true; }
    catch{ return false; }
  }

  sauver(){
    if(!this.storageOK) return;
    this.etat.dernierEnregistrement = new Date().toISOString();
    let json;
    try{ json = JSON.stringify(this.etat); }
    catch(err){ this.storageOK = false; this.dispatchEvent(new Event('storage-error')); return; }

    /* miroir localStorage : rapide, sert de secours anti-corruption et de repli sans IndexedDB */
    let lsOK = true;
    try{
      localStorage.setItem(CLE, json);
      localStorage.setItem(CLE+'-backup', json);
    }catch{ lsOK = false; }

    /* primaire : IndexedDB (anti-éviction). Fire-and-forget ; on capture l'état figé à écrire */
    if(this.idbOK){
      const instantane = JSON.parse(json);
      idbSet(CLE, instantane).catch(err => {
        this.idbOK = false;
        console.error('Écriture IndexedDB échouée, repli localStorage', err);
      });
    } else if(!lsOK){
      /* ni IndexedDB ni localStorage → plus aucune persistance */
      this.storageOK = false;
      this.dispatchEvent(new Event('storage-error'));
    }

    /* notifie la couche de synchro (Gist) qu'il y a du neuf à pousser (cf. specs 2.1) */
    this.dispatchEvent(new Event('change'));
  }

  /* reset par tampon de date : le cœur du "décochage à minuit" */
  resetSiNouveauJour(){
    const j = jourLocal();
    if(this.etat.repas.jour !== j){
      this.etat.repas.jour = j;
      this.etat.repas.coches = {};
      this.etat.repas.planJour = null;   /* les déplacements « aujourd'hui » expirent à minuit */
      this.sauver();
      return true;
    }
    return false;
  }
}
