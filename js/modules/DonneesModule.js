import { $, jourLocal, aujourdHui, triDate, cloneProfond, slug } from '../utils.js';
import { OBJ_DEFAUT, PROG_DEFAUT, COURSES_DEFAUT } from '../data.js';

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
        const etat = this.etat;
        /* fusion par date, l'import gagne */
        const fusionDate = (locale, importee) => {
          const map = {}; (locale||[]).forEach(x=>map[x.date]=x); (importee||[]).forEach(x=>map[x.date]=x);
          return Object.values(map).sort(triDate);
        };
        if(Array.isArray(imp.poids)) etat.poids = fusionDate(etat.poids, imp.poids);
        if(Array.isArray(imp.mensurations)) etat.mensurations = fusionDate(etat.mensurations, imp.mensurations);
        /* objectif kcal : l'import gagne s'il est présent */
        if(typeof imp.objectifKcal === 'number') etat.objectifKcal = imp.objectifKcal;
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
        /* programmes : fusion par id (l'import remplace un id existant) */
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
        this.app.muscu.jourSelectionne = null;
        this.store.sauver(); this.app.renderAll();
        alert(`Import réussi : ${etat.poids.length} pesées, ${etat.mensurations.length} relevés, ${etat.seances.length} séances, ${etat.programmes.length} programme(s).`);
      }catch(err){ alert('Fichier invalide : ce n’est pas un export du carnet.'); }
      ev.target.value='';
    };
    lecteur.readAsText(f);
  }

  toutEffacer(){
    if(confirm('Tout effacer ? As-tu exporté d’abord ?')){
      this.store.etat = {poids:[], mensurations:[], repas:{jour:jourLocal(), coches:{}}, objectifKcal:OBJ_DEFAUT,
              journalRepas:[], programmes:cloneProfond(PROG_DEFAUT), programmeActif:'pplul', seances:[],
              courses:{items:COURSES_DEFAUT.map(c=>({id:slug(c.nom), ...c})), coches:{}, maj:null}};
      this.app.muscu.jourSelectionne = null;
      this.store.sauver(); this.app.renderAll();
    }
  }
}
