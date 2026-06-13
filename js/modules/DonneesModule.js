import { $, jourLocal, aujourdHui, cloneProfond, slug } from '../utils.js';
import { OBJ_DEFAUT, PROG_DEFAUT, COURSES_DEFAUT } from '../data.js';
import { fusionnerEtat } from '../fusion.js';
import { toast, confirmer } from '../ui.js';

/* ================= DONNÉES : export / import / reset ================= */
export class DonneesModule {
  constructor(store, app){
    this.store = store;
    this.app = app;
    this.bind();
  }

  get etat(){ return this.store.etat; }

  bind(){
    $('btn-export').addEventListener('click', () => this.exporterJSON());
    $('btn-import').addEventListener('click', () => $('fichier-import').click());
    $('fichier-import').addEventListener('change', e => this.importerJSON(e));
    $('btn-effacer').addEventListener('click', () => this.toutEffacer());
    $('opt-auto-export').addEventListener('change', e => {
      this.etat.autoExport = e.target.checked;
      this.store.sauver(); this.render();
    });
  }

  render(){
    $('opt-auto-export').checked = !!this.etat.autoExport;
    const el = $('derniere-sauvegarde');
    const iso = this.etat.dernierEnregistrement;
    if(iso){
      const d = new Date(iso);
      el.innerHTML = `Dernière sauvegarde locale : <b>${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</b>`;
    } else {
      el.textContent = 'Aucune sauvegarde locale encore enregistrée.';
    }
  }

  exporterJSON(){
    const blob = new Blob([JSON.stringify({version:2, exporte:new Date().toISOString(), ...this.etat}, null, 2)],
                          {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `carnet-recompo-${aujourdHui()}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  }

  importerJSON(ev){
    const f = ev.target.files[0]; if(!f) return;
    const lecteur = new FileReader();
    lecteur.onload = () => {
      try{
        const imp = JSON.parse(lecteur.result);
        const connus = ['poids','mensurations','objectifKcal','repas','journalRepas','programmes','programmeActif','seances','courses'];
        if(!connus.some(k=>k in imp)) throw new Error('format');
        /* réconciliation par date/id (assainissement inclus) : l'état existant n'est
           jamais altéré par une entrée malformée. Même moteur que la synchro Gist. */
        const etat = this.etat;
        fusionnerEtat(etat, imp);
        this.app.muscu.jourSelectionne = null;
        this.store.sauver(); this.app.renderAll();
        toast(`Import réussi : ${etat.poids.length} pesées, ${etat.mensurations.length} relevés, ${etat.seances.length} séances, ${etat.programmes.length} programme(s).`, 'ok');
      }catch(err){ toast('Fichier invalide : ce n’est pas un export du carnet.', 'erreur'); }
      ev.target.value='';
    };
    lecteur.readAsText(f);
  }

  async toutEffacer(){
    if(!(await confirmer('Tout effacer ? As-tu bien exporté d’abord ? C’est irréversible.', {danger:true, okLabel:'Tout effacer'}))) return;
    this.store.etat = {poids:[], mensurations:[], repas:{jour:jourLocal(), coches:{}}, objectifKcal:OBJ_DEFAUT,
            journalRepas:[], programmes:cloneProfond(PROG_DEFAUT), programmeActif:'pplul', seances:[],
            courses:{items:COURSES_DEFAUT.map(c=>({id:slug(c.nom), ...c})), coches:{}, maj:null}, brouillons:{}};
    this.app.muscu.jourSelectionne = null;
    this.store.sauver(); this.app.renderAll();

    /* La synchro Gist fusionne par UNION : une suppression locale ne se propage pas
       seule → sans ça, le gist ré-hydrate les données au prochain démarrage. On écrase
       donc tout de suite la copie distante avec l'état vide (push immédiat, pas debouncé). */
    const sync = this.app.sync;
    if(sync && sync.actif()){
      await sync.pousser();
      if(!navigator.onLine)
        toast('Données locales effacées. Hors-ligne : la copie cloud (Gist) n’a pas pu être vidée — relance « Effacer » une fois reconnecté, sinon les données reviendront.', 'erreur');
    }
  }
}
