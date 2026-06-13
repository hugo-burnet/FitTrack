import { Store } from './Store.js';
import { aujourdHui, $, qsa } from './utils.js';
import { MesuresModule } from './modules/MesuresModule.js';
import { VerdictModule } from './modules/VerdictModule.js';
import { RepasModule } from './modules/RepasModule.js';
import { MuscuModule } from './modules/MuscuModule.js';
import { CoursesModule } from './modules/CoursesModule.js';
import { DonneesModule } from './modules/DonneesModule.js';

/* ================= APPLICATION : routeur + orchestration ================= */
export class App {
  constructor(){
    this.store = new Store();
    this.store.addEventListener('storage-error', () => {
      $('storage-warn').classList.remove('cache');
    });
  }

  init(){
    this.store.charger();
    this.store.resetSiNouveauJour();

    /* instanciation des modules (chacun attache ses écouteurs dans son constructeur) */
    this.mesures = new MesuresModule(this.store, this);
    this.verdict = new VerdictModule(this.store, this);
    this.repas   = new RepasModule(this.store, this);
    this.muscu   = new MuscuModule(this.store, this);
    this.courses = new CoursesModule(this.store, this);
    this.donnees = new DonneesModule(this.store, this);

    this.bindNav();

    $('p-date').value = aujourdHui();
    $('m-date').value = aujourdHui();
    this.renderAll();

    /* décochage automatique à minuit, robuste :
       1) au retour sur l'onglet/appli (cas le plus fréquent : app rouverte un nouveau jour) */
    document.addEventListener('visibilitychange', () => {
      if(!document.hidden && this.store.resetSiNouveauJour()) this.repas.render();
    });
    window.addEventListener('focus', () => { if(this.store.resetSiNouveauJour()) this.repas.render(); });
    /* 2) si l'appli reste ouverte au passage de minuit : contrôle chaque minute */
    setInterval(() => { if(this.store.resetSiNouveauJour()) this.repas.render(); }, 60000);
  }

  /* re-rend tous les onglets (équivalent de l'ancien toutAfficher) */
  renderAll(){
    this.mesures.render();   /* bandeau + historiques + courbes */
    this.verdict.render();
    this.repas.render();
    this.muscu.render();
    this.courses.render();
    this.donnees.render();   /* indicateur de sauvegarde + option auto-export */
  }

  bindNav(){
    qsa('nav button').forEach(b=>{
      b.addEventListener('click', () => this.changerOnglet(b.dataset.ong));
    });
  }
  changerOnglet(nom){
    qsa('.onglet').forEach(o=>o.classList.remove('actif'));
    $('ong-'+nom).classList.add('actif');
    qsa('nav button').forEach(b=>b.classList.toggle('actif', b.dataset.ong===nom));
  }
}
