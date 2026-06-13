import { $ } from '../utils.js';
import { ALIMENTS, PLAN } from '../data.js';
import { kcalItem, protItem, facteurFlex } from '../nutrition.js';

/* ================= REPAS : plan du jour + objectif kcal ================= */
export class RepasModule {
  constructor(store, app){
    this.store = store;
    this.app = app;
    this.bind();
  }

  get etat(){ return this.store.etat; }

  bind(){
    const root = $('ong-repas');
    root.addEventListener('click', e => {
      const step = e.target.closest('[data-action="obj-step"]');
      if(step){ this.ajusterObjectif(parseInt(step.dataset.delta,10)); return; }
      const annuler = e.target.closest('[data-action="annuler-repas"]');
      if(annuler){ e.stopPropagation(); this.annulerRepas(annuler.dataset.id); return; }
      const carte = e.target.closest('[data-action="prendre-repas"]');
      if(carte){ this.prendreRepas(carte.dataset.id); return; }
    });
    root.addEventListener('keydown', e => {
      const carte = e.target.closest('[data-action="prendre-repas"]');
      if(carte && (e.key===' '||e.key==='Enter')){ e.preventDefault(); this.prendreRepas(carte.dataset.id); }
    });
    $('obj-kcal').addEventListener('change', () => this.majObjectif());
  }

  /* ---- calculs nutritionnels (moteur pur dans nutrition.js) ---- */
  /* quantité affichée d'un item après ajustement du facteur flex */
  qteAjustee(cle, qBase){
    if(!ALIMENTS[cle].flex) return qBase;
    const q = qBase * facteurFlex(this.etat.objectifKcal);
    return Math.round(q/5)*5; /* arrondi à 5 g */
  }
  repasKcal(r){ return r.items.reduce((s,[cle,q])=>s+kcalItem(cle, this.qteAjustee(cle,q)),0); }
  repasProt(r){ return r.items.reduce((s,[cle,q])=>s+protItem(cle, this.qteAjustee(cle,q)),0); }

  /* ---- cochage : un tap prend le repas (ne décoche jamais) ; bouton Annuler explicite pour revenir ---- */
  prendreRepas(id){
    this.store.resetSiNouveauJour();
    if(!this.etat.repas.coches[id]){ this.etat.repas.coches[id] = true; this.journaliserRepas(id); this.store.sauver(); this.render(); }
  }
  annulerRepas(id){
    this.store.resetSiNouveauJour();
    if(this.etat.repas.coches[id]){ delete this.etat.repas.coches[id]; this.deJournaliserRepas(id); this.store.sauver(); this.render(); }
  }

  /* journal : enregistre CE qui a été mangé et EN QUELLE QUANTITÉ (pas juste "pris") — sert à l'export détaillé */
  journaliserRepas(id){
    const r = PLAN.find(x=>x.id===id); if(!r) return;
    const jour = this.etat.repas.jour;
    this.etat.journalRepas = this.etat.journalRepas.filter(e=>!(e.date===jour && e.id===id));
    const items = r.items.map(([cle,qBase])=>{
      const a = ALIMENTS[cle]; const q = this.qteAjustee(cle,qBase);
      return { cle, nom:a.nom, qte:q, unite: a.unite!==undefined ? (a.unite||'unité') : 'g' };
    });
    this.etat.journalRepas.push({ date:jour, id, nom:r.nom,
      kcal:Math.round(this.repasKcal(r)), prot:Math.round(this.repasProt(r)),
      objectifKcal:this.etat.objectifKcal, items });
  }
  deJournaliserRepas(id){
    const jour = this.etat.repas.jour;
    this.etat.journalRepas = this.etat.journalRepas.filter(e=>!(e.date===jour && e.id===id));
  }

  /* ---- objectif kcal ---- */
  majObjectif(){
    const v = parseInt($('obj-kcal').value,10);
    if(!isNaN(v)) this.etat.objectifKcal = Math.max(1600, Math.min(4000, v));
    this.store.sauver(); this.render();
  }
  ajusterObjectif(delta){
    this.etat.objectifKcal = Math.max(1600, Math.min(4000, this.etat.objectifKcal + delta));
    this.store.sauver(); this.render();
  }

  /* ---- affichage ---- */
  render(){
    this.store.resetSiNouveauJour();
    const obj = $('obj-kcal');
    if(document.activeElement!==obj) obj.value = this.etat.objectifKcal;

    /* cartes repas */
    const cont = $('liste-repas');
    cont.innerHTML = PLAN.map(r=>{
      const pris = !!this.etat.repas.coches[r.id];
      const items = r.items.map(([cle,qBase])=>{
        const a=ALIMENTS[cle]; const q=this.qteAjustee(cle,qBase);
        const lib = a.unite!==undefined
          ? `${q} ${a.unite}${q>1&&a.unite?'s':''}`.trim()
          : `${q} g`;
        return `<li><span>${a.nom}</span><span class="qte${a.flex?' flex':''}">${lib}</span></li>`;
      }).join('');
      return `<div class="repas-carte${pris?' pris':''}" role="button" tabindex="0" aria-pressed="${pris}"
         data-action="prendre-repas" data-id="${r.id}">
         <div class="repas-haut">
           <span class="repas-coche">${pris?'✓':''}</span>
           <span class="repas-nom">${r.nom}</span>
           ${pris
              ? `<button type="button" class="repas-annuler" data-action="annuler-repas" data-id="${r.id}">Annuler</button>`
              : `<span class="repas-kcal">${Math.round(this.repasKcal(r))} kcal</span>`}
         </div>
         <ul class="repas-items">${items}</ul>
      </div>`;
    }).join('');

    /* progression */
    const total = PLAN.length;
    const prisN = PLAN.filter(r=>this.etat.repas.coches[r.id]).length;
    const kcalTot = PLAN.reduce((s,r)=>s+this.repasKcal(r),0);
    const protTot = PLAN.reduce((s,r)=>s+this.repasProt(r),0);
    const kcalPris = PLAN.filter(r=>this.etat.repas.coches[r.id]).reduce((s,r)=>s+this.repasKcal(r),0);
    const protPris = PLAN.filter(r=>this.etat.repas.coches[r.id]).reduce((s,r)=>s+this.repasProt(r),0);
    $('prog-repas').textContent = `${prisN} / ${total} repas`;
    $('prog-kcal').textContent = `${Math.round(kcalPris)} / ${Math.round(kcalTot)} kcal`;
    $('prog-rempli').style.width = kcalTot? (100*kcalPris/kcalTot).toFixed(0)+'%' : '0%';
    $('prog-macros').innerHTML =
      `<span>Protéines <b>${Math.round(protPris)} / ${Math.round(protTot)} g</b></span>`+
      `<span>Objectif <b>${this.etat.objectifKcal} kcal</b></span>`;
  }
}
