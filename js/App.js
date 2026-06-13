import { Store } from './Store.js';
import { Sync } from './Sync.js';
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

  async init(){
    await this.store.charger();
    this.store.resetSiNouveauJour();

    try{
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

      /* synchro Gist (specs 2.1) : démarrée après le rendu pour ne jamais bloquer
         l'affichage ; ses erreurs restent internes (l'app fonctionne en local) */
      this.sync = new Sync(this.store, this);
      this.sync.init().catch(err => console.error('Init synchro échouée', err));
    }catch(err){
      /* le rendu initial a crashé : on n'empêche jamais l'utilisateur d'exporter ses données */
      this.afficherRecuperation(err);
    }
  }

  /* écran de secours : l'app ne démarre pas, mais les données en mémoire sont intactes
     et l'export reste possible (indépendant des modules, qui ont pu échouer à se construire) */
  afficherRecuperation(err){
    console.error('Échec du démarrage du carnet', err);
    const ecran = $('ecran-recuperation');
    if(!ecran){ alert('Erreur au démarrage. Recharge la page.'); return; }
    ecran.classList.remove('cache');
    const detail = $('recup-detail');
    if(detail) detail.textContent = String(err && err.stack || err);
    $('recup-export').addEventListener('click', () => this.exporterSecours());
    $('recup-reload').addEventListener('click', () => location.reload());
  }

  exporterSecours(){
    try{
      const blob = new Blob([JSON.stringify({version:2, exporte:new Date().toISOString(), ...this.store.etat}, null, 2)],
                            {type:'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `carnet-recompo-secours-${aujourdHui()}.json`;
      a.click(); URL.revokeObjectURL(a.href);
    }catch(e){ console.error('Export de secours impossible', e); }
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
    if(this.muscu) this.muscu.surOnglet(nom);   /* wake lock : actif seulement en séance (specs 4.2) */
    /* courses : quantités dérivées du plan → on rafraîchit à l'entrée (suit l'objectif kcal) */
    if(nom==='courses' && this.courses) this.courses.render();
  }
}
