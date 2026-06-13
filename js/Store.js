import { jourLocal, cloneProfond, slug } from './utils.js';
import { CLE, OBJ_DEFAUT, PROG_DEFAUT, COURSES_DEFAUT } from './data.js';

/* ================= ÉTAT & PERSISTANCE =================
   Source unique de vérité. Émet l'évènement 'storage-error' quand
   localStorage est indisponible, pour que l'App affiche l'avertissement. */
export class Store extends EventTarget {
  constructor(){
    super();
    this.etat = { poids: [], mensurations: [], repas: null, objectifKcal: OBJ_DEFAUT };
    this.storageOK = true;
  }

  charger(){
    try{
      let brut = localStorage.getItem(CLE);
      /* filet de sécurité : si la clé principale est absente/corrompue, on tente la sauvegarde miroir */
      if(!brut) brut = localStorage.getItem(CLE+'-backup');
      if(brut){
        let e;
        try{ e = JSON.parse(brut); }
        catch{ e = JSON.parse(localStorage.getItem(CLE+'-backup')); }
        if(e && Array.isArray(e.poids)) this.etat = e;
      }
    }catch(err){
      this.storageOK = false;
      this.dispatchEvent(new Event('storage-error'));
    }
    /* migrations / valeurs par défaut pour les anciens enregistrements */
    const etat = this.etat;
    if(!Array.isArray(etat.mensurations)) etat.mensurations = [];
    if(typeof etat.objectifKcal !== 'number') etat.objectifKcal = OBJ_DEFAUT;
    if(!etat.repas || typeof etat.repas !== 'object') etat.repas = { jour: jourLocal(), coches: {} };
    if(!etat.repas.coches) etat.repas.coches = {};
    /* nouveaux modules : journal repas, muscu, courses */
    if(!Array.isArray(etat.journalRepas)) etat.journalRepas = [];
    if(!Array.isArray(etat.programmes) || !etat.programmes.length) etat.programmes = cloneProfond(PROG_DEFAUT);
    if(!etat.programmeActif || !etat.programmes.some(p=>p.id===etat.programmeActif)) etat.programmeActif = etat.programmes[0].id;
    if(!Array.isArray(etat.seances)) etat.seances = [];
    if(!etat.courses || typeof etat.courses !== 'object') etat.courses = { items:[], coches:{}, maj:null };
    if(!Array.isArray(etat.courses.items) || !etat.courses.items.length)
      etat.courses.items = COURSES_DEFAUT.map(c=>({id:slug(c.nom), ...c}));
    if(!etat.courses.coches) etat.courses.coches = {};
    /* brouillons de séance (saisie en cours, non encore enregistrée) par id de jour */
    if(!etat.brouillons || typeof etat.brouillons !== 'object') etat.brouillons = {};
    if(typeof etat.autoExport !== 'boolean') etat.autoExport = false;
  }

  sauver(){
    if(!this.storageOK) return;
    this.etat.dernierEnregistrement = new Date().toISOString();
    try{
      const json = JSON.stringify(this.etat);
      localStorage.setItem(CLE, json);
      /* sauvegarde miroir : si la clé principale est purgée, on garde une copie */
      localStorage.setItem(CLE+'-backup', json);
    }catch(err){ this.storageOK = false; this.dispatchEvent(new Event('storage-error')); }
  }

  /* reset par tampon de date : le cœur du "décochage à minuit" */
  resetSiNouveauJour(){
    const j = jourLocal();
    if(this.etat.repas.jour !== j){
      this.etat.repas.jour = j;
      this.etat.repas.coches = {};
      this.sauver();
      return true;
    }
    return false;
  }
}
