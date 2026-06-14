import { $, echap, cloneProfond } from '../utils.js';
import { ALIMENTS } from '../data.js';
import { kcalItem, protItem, facteurFlex, flexSature, protCible } from '../nutrition.js';

/* ================= REPAS : cible du jour, écart temps réel, log de la réalité =================
   Modèle « cible + écart » (specs 4.1) : le plan n'est qu'un DÉFAUT suggéré ; la vérité,
   c'est le journal du jour. La cible (kcal ET protéines) est explicite, l'écart se recalcule
   à chaque action. Les repas du plan cochés ET les ajouts hors-plan (« j'ai mangé autre
   chose ») sont journalisés tels que mangés et comptent dans la cible et l'export. */
export class RepasModule {
  constructor(store, app){
    this.store = store;
    this.app = app;
    /* état d'interface (non persisté) du mode « réorganiser les repas » */
    this.reorgOuvert = false;       /* le mode déplacement est-il actif */
    this.porteeDepl = 'plan';       /* 'plan' (permanent) | 'jour' (aujourd'hui seulement) */
    this.deplItem = null;           /* "idRepas:cle" de l'aliment dont le sélecteur de cible est ouvert */
    this.bind();
  }

  get etat(){ return this.store.etat; }

  /* plan effectif : surcharge du jour si elle existe, sinon le plan permanent */
  plan(){ return this.etat.repas.planJour || this.etat.plan; }

  bind(){
    /* options du sélecteur d'aliment hors-plan (une fois) */
    const sel = $('extra-aliment');
    Object.keys(ALIMENTS).forEach(cle=>{
      const a = ALIMENTS[cle];
      const dens = a.unite!==undefined ? `${a.protU} g prot/${a.unite||'u'}` : `${a.prot100} g prot/100 g`;
      const o = document.createElement('option');
      o.value = cle; o.textContent = `${a.nom} — ${dens}`;
      sel.appendChild(o);
    });

    const root = $('ong-repas');
    root.addEventListener('click', e => {
      const step = e.target.closest('[data-action="obj-step"]');
      if(step){ this.ajusterObjectif(parseInt(step.dataset.delta,10)); return; }
      if(e.target.closest('#btn-repas-reorg')){ this.basculerReorg(); return; }
      const portee = e.target.closest('[data-action="depl-portee"]');
      if(portee){ this.porteeDepl = portee.dataset.portee; this.render(); return; }
      const dOuvrir = e.target.closest('[data-action="depl-ouvrir"]');
      if(dOuvrir){ this.basculerDeplItem(dOuvrir.dataset.rid, dOuvrir.dataset.cle); return; }
      const dVers = e.target.closest('[data-action="depl-vers"]');
      if(dVers){ this.deplacerAliment(dVers.dataset.from, dVers.dataset.cle, dVers.dataset.to); return; }
      const annuler = e.target.closest('[data-action="annuler-repas"]');
      if(annuler){ e.stopPropagation(); this.annulerRepas(annuler.dataset.id); return; }
      const combler = e.target.closest('[data-action="combler"]');
      if(combler){ this.ajouterExtraAliment(combler.dataset.cle, parseFloat(combler.dataset.qte)); return; }
      const supprX = e.target.closest('[data-action="suppr-extra"]');
      if(supprX){ this.supprimerExtra(supprX.dataset.id); return; }
      if(e.target.closest('#btn-extra-toggle')){ this.basculerFormExtra(); return; }
      if(e.target.closest('#btn-extra-add')){ this.ajouterDepuisForm(); return; }
      const carte = e.target.closest('[data-action="prendre-repas"]');
      if(carte){ this.prendreRepas(carte.dataset.id); return; }
    });
    root.addEventListener('keydown', e => {
      const carte = e.target.closest('[data-action="prendre-repas"]');
      if(carte && (e.key===' '||e.key==='Enter')){ e.preventDefault(); this.prendreRepas(carte.dataset.id); }
    });
    root.addEventListener('change', e => { if(e.target.id==='extra-aliment') this.majModeExtra(); });
    root.addEventListener('input', e => {
      if(e.target.id==='extra-qte' || e.target.id==='extra-kcal' || e.target.id==='extra-prot') this.majApercuExtra();
    });
    $('obj-kcal').addEventListener('change', () => this.majObjectif());
  }

  /* ---- calculs nutritionnels (moteur pur dans nutrition.js) ---- */
  qteAjustee(cle, qBase){
    if(!ALIMENTS[cle].flex) return qBase;
    const q = qBase * facteurFlex(this.etat.objectifKcal, this.etat.plan);
    return Math.round(q/5)*5; /* arrondi à 5 g */
  }
  repasKcal(r){ return r.items.reduce((s,[cle,q])=>s+kcalItem(cle, this.qteAjustee(cle,q)),0); }
  repasProt(r){ return r.items.reduce((s,[cle,q])=>s+protItem(cle, this.qteAjustee(cle,q)),0); }

  /* cible du jour : kcal = objectif réglé ; protéines = ce que le plan délivre (fixe) */
  cibles(){ return { kcal:this.etat.objectifKcal, prot:protCible(this.etat.objectifKcal, this.etat.plan) }; }

  /* ---- journal du jour (= réalité) ---- */
  journalDuJour(){ const j=this.etat.repas.jour; return this.etat.journalRepas.filter(e=>e.date===j); }
  extrasDuJour(){ return this.journalDuJour().filter(e=>e.horsPlan); }
  consomme(){
    return this.journalDuJour().reduce((s,e)=>({kcal:s.kcal+(e.kcal||0), prot:s.prot+(e.prot||0)}), {kcal:0,prot:0});
  }

  /* ---- cochage : un tap prend le repas (ne décoche jamais) ; bouton Annuler explicite ---- */
  prendreRepas(id){
    this.store.resetSiNouveauJour();
    if(!this.etat.repas.coches[id]){ this.etat.repas.coches[id] = true; this.journaliserRepas(id); this.store.sauver(); this.render(); }
  }
  annulerRepas(id){
    this.store.resetSiNouveauJour();
    if(this.etat.repas.coches[id]){ delete this.etat.repas.coches[id]; this.deJournaliserRepas(id); this.store.sauver(); this.render(); }
  }

  /* repas du PLAN coché → on suppose qu'il a été mangé tel que planifié (quantités ajustées).
     Pour TOUT écart (resto, substitution), passer par « J'ai mangé autre chose » ci-dessous. */
  journaliserRepas(id){
    const r = this.plan().find(x=>x.id===id); if(!r) return;
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

  /* ---- hors-plan : journalise la RÉALITÉ (corrige le mensonge de l'export) ---- */
  ajouterExtra(d){
    if((d.kcal||0)<=0 && (d.prot||0)<=0) return;
    this.store.resetSiNouveauJour();
    const jour = this.etat.repas.jour;
    const id = 'x-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
    const item = { cle:d.cle||null, nom:d.nom, qte:d.qte!=null?d.qte:null, unite:d.unite||'' };
    this.etat.journalRepas.push({ date:jour, id, nom:d.nom, horsPlan:true,
      kcal:Math.round(d.kcal)||0, prot:Math.round(d.prot)||0, objectifKcal:this.etat.objectifKcal, items:[item] });
    this.store.sauver(); this.render();
  }
  ajouterExtraAliment(cle, qte){
    const a = ALIMENTS[cle]; if(!a || !(qte>0)) return;
    const unite = a.unite!==undefined ? (a.unite||'unité') : 'g';
    this.ajouterExtra({ cle, nom:a.nom, qte, unite, kcal:kcalItem(cle,qte), prot:protItem(cle,qte) });
  }
  supprimerExtra(id){
    const jour = this.etat.repas.jour;
    this.etat.journalRepas = this.etat.journalRepas.filter(e=>!(e.date===jour && e.id===id));
    this.store.sauver(); this.render();
  }
  ajouterDepuisForm(){
    const cle = $('extra-aliment').value;
    if(cle){
      const qte = parseFloat($('extra-qte').value);
      if(!(qte>0)){ $('extra-qte').focus(); return; }
      this.ajouterExtraAliment(cle, qte);
    } else {
      const nom = ($('extra-nom').value||'').trim() || 'Hors-plan';
      const kcal = parseFloat($('extra-kcal').value)||0;
      const prot = parseFloat($('extra-prot').value)||0;
      if(kcal<=0 && prot<=0){ $('extra-kcal').focus(); return; }
      this.ajouterExtra({ nom, kcal, prot });
    }
    ['extra-qte','extra-nom','extra-kcal','extra-prot'].forEach(id=>{ $(id).value=''; });
    $('extra-aliment').value=''; this.majModeExtra();
  }

  /* suggestions pour combler le déficit protéique restant (data déjà dans ALIMENTS) */
  suggestionsProteine(resteProt){
    return ['whey','skyr','poulet'].map(cle=>{
      const a = ALIMENTS[cle];
      let qte, prot, kcal, unite;
      if(a.unite!==undefined){
        qte = Math.max(1, Math.round(resteProt / a.protU));
        unite = a.unite||'unité'; prot = a.protU*qte; kcal = a.kcalU*qte;
      } else {
        qte = Math.max(20, Math.round((resteProt / a.prot100 * 100)/10)*10);   /* arrondi 10 g */
        unite = 'g'; prot = a.prot100*qte/100; kcal = a.kcal100*qte/100;
      }
      return { cle, nom:a.nom, qte, unite, prot:Math.round(prot), kcal:Math.round(kcal) };
    });
  }

  /* ---- formulaire hors-plan ---- */
  basculerFormExtra(){
    const ouvert = $('extra-form').classList.toggle('cache') === false;
    $('btn-extra-toggle').textContent = ouvert ? '✕ Fermer' : '+ Ajouter un aliment hors-plan';
    if(ouvert) this.majModeExtra();
  }
  majModeExtra(){
    const cle = $('extra-aliment').value;
    const a = cle ? ALIMENTS[cle] : null;
    $('extra-aliment-q').classList.toggle('cache', !cle);
    $('extra-libre').classList.toggle('cache', !!cle);
    if(a) $('extra-unite').textContent = a.unite!==undefined ? (a.unite||'unité') : 'g';
    this.majApercuExtra();
  }
  majApercuExtra(){
    const cle = $('extra-aliment').value;
    let kcal=0, prot=0, ok=false;
    if(cle){
      const qte = parseFloat($('extra-qte').value);
      if(qte>0){ kcal=kcalItem(cle,qte); prot=protItem(cle,qte); ok=true; }
    } else {
      const k=parseFloat($('extra-kcal').value), p=parseFloat($('extra-prot').value);
      kcal=k||0; prot=p||0; ok=(k>0||p>0);
    }
    $('extra-apercu').textContent = ok ? `≈ ${Math.round(kcal)} kcal · ${Math.round(prot)} g protéines` : '';
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

    /* avertissement de saturation du facteur flex (le plan ne peut plus s'ajuster) */
    const sat = flexSature(this.etat.objectifKcal, this.etat.plan);
    const fw = $('flex-warn');
    if(sat==='bas'){
      fw.classList.remove('cache');
      fw.innerHTML = '⚠ Objectif très bas : riz/avoine déjà au minimum (×0,4). Le plan ne descend pas plus — le total réel restera <b>au-dessus</b> de la cible.';
    } else if(sat==='haut'){
      fw.classList.remove('cache');
      fw.innerHTML = '⚠ Objectif très haut : riz/avoine déjà au maximum (×1,8). Le plan ne monte pas plus — complète avec un ajout hors-plan pour atteindre la cible.';
    } else fw.classList.add('cache');

    /* cartes repas : mode normal (tap pour prendre) OU mode réorganisation (déplacer les aliments) */
    const plan = this.plan();
    $('btn-repas-reorg').textContent = this.reorgOuvert ? '✓ Terminer' : '⇄ Réorganiser les repas';
    const bar = $('repas-reorg-bar');
    if(this.reorgOuvert){
      bar.classList.remove('cache');
      bar.innerHTML = this.htmlReorgBar();
      $('liste-repas').innerHTML = plan.map(r=>this.htmlCarteReorg(r)).join('');
    } else {
      bar.classList.add('cache');
      $('liste-repas').innerHTML = plan.map(r=>this.htmlCarteNormale(r)).join('');
    }

    /* cible & écart (kcal + protéines), à partir de la réalité du jour */
    const c = this.cibles();
    const conso = this.consomme();
    const resteK = Math.round(c.kcal - conso.kcal);
    const resteP = Math.round(c.prot - conso.prot);
    $('cible-kcal').textContent = `${Math.round(conso.kcal)} / ${c.kcal} kcal`;
    $('cible-prot').textContent = `${Math.round(conso.prot)} / ${c.prot} g`;
    $('bar-kcal').style.width = (c.kcal ? Math.min(100, 100*conso.kcal/c.kcal) : 0).toFixed(0)+'%';
    $('bar-prot').style.width = (c.prot ? Math.min(100, 100*conso.prot/c.prot) : 0).toFixed(0)+'%';
    this._reste($('reste-kcal'), resteK, '');
    this._reste($('reste-prot'), resteP, ' g');
    const prisN = plan.filter(r=>this.etat.repas.coches[r.id]).length;
    $('cible-repas').textContent = `${prisN} / ${plan.length} repas du plan cochés`;

    /* comblement protéique : seulement s'il reste un vrai déficit */
    const carteC = $('carte-comblement');
    if(resteP >= 10){
      carteC.classList.remove('cache');
      $('comblement-txt').textContent = `Il te manque ~${resteP} g de protéines. Une de ces options comble l'écart (tape pour l'ajouter) :`;
      $('comblement-options').innerHTML = this.suggestionsProteine(resteP).map(s=>
        `<button type="button" class="chip chip-prot" data-action="combler" data-cle="${s.cle}" data-qte="${s.qte}">`
        + `${echap(s.nom)} · <b>${s.qte} ${s.unite}</b> · +${s.prot} g · ${s.kcal} kcal</button>`).join('');
    } else carteC.classList.add('cache');

    /* extras hors-plan du jour */
    const extras = this.extrasDuJour();
    $('extras-liste').innerHTML = extras.length ? extras.map(e=>{
      const it = e.items && e.items[0];
      const q = it && it.qte!=null ? ` · ${it.qte} ${it.unite||''}`.trimEnd() : '';
      return `<div class="extra-item">
        <div class="extra-info"><span class="extra-nom">${echap(e.nom)}</span>`
        + `<span class="extra-macros mono">${e.kcal} kcal · ${e.prot} g${q}</span></div>`
        + `<button type="button" class="repas-annuler" data-action="suppr-extra" data-id="${e.id}" aria-label="Retirer">✕</button>`
        + `</div>`;
    }).join('') : '<p class="note" style="margin:0 0 10px">Rien d’ajouté hors-plan aujourd’hui.</p>';
  }

  /* ---- carte repas normale (tap pour prendre / annuler) ---- */
  htmlCarteNormale(r){
    const pris = !!this.etat.repas.coches[r.id];
    const items = r.items.map(([cle,qBase])=>{
      const a=ALIMENTS[cle]; const q=this.qteAjustee(cle,qBase);
      const lib = a.unite!==undefined ? `${q} ${a.unite}${q>1&&a.unite?'s':''}`.trim() : `${q} g`;
      return `<li><span>${a.nom}</span><span class="qte${a.flex?' flex':''}">${lib}</span></li>`;
    }).join('');
    return `<div class="repas-carte${pris?' pris':''}" role="button" tabindex="0" aria-pressed="${pris}"
       data-action="prendre-repas" data-id="${r.id}">
       <div class="repas-haut">
         <span class="repas-coche">${pris?'✓':''}</span>
         <span class="repas-nom">${echap(r.nom)}</span>
         ${pris
            ? `<button type="button" class="repas-annuler" data-action="annuler-repas" data-id="${r.id}">Annuler</button>`
            : `<span class="repas-kcal">${Math.round(this.repasKcal(r))} kcal</span>`}
       </div>
       <ul class="repas-items">${items}</ul>
    </div>`;
  }

  /* ---- bandeau du mode réorganisation : portée du déplacement (plan / aujourd'hui) ---- */
  htmlReorgBar(){
    const p = this.porteeDepl;
    return `<div class="reorg-scope">
        <span class="reorg-lbl">Déplacer&nbsp;:</span>
        <button type="button" class="chip-mini${p==='plan'?' actif':''}" data-action="depl-portee" data-portee="plan">Dans le plan</button>
        <button type="button" class="chip-mini${p==='jour'?' actif':''}" data-action="depl-portee" data-portee="jour">Aujourd'hui</button>
      </div>
      <p class="note reorg-note">${p==='plan'
        ? 'Modifie ton plan pour de bon. Touche un aliment, puis choisis son nouveau repas.'
        : 'Vaut seulement pour aujourd’hui (remis à zéro demain). Touche un aliment, puis choisis son repas.'}</p>`;
  }

  /* ---- carte repas en mode réorganisation : chaque aliment se déplace vers un autre repas ----
     Un repas déjà pris est verrouillé (déjà journalisé) : ni source ni cible, pour ne pas
     compter deux fois un aliment. */
  htmlCarteReorg(r){
    const pris = !!this.etat.repas.coches[r.id];
    const plan = this.plan();
    const items = r.items.map(([cle,qBase])=>{
      const a = ALIMENTS[cle]; const q = this.qteAjustee(cle,qBase);
      const lib = a.unite!==undefined ? `${q} ${a.unite}${q>1&&a.unite?'s':''}`.trim() : `${q} g`;
      if(pris) return `<div class="ri-bloc"><div class="ri-tete fige"><span class="ri-nom">${echap(a.nom)}</span><span class="ri-qte">${lib}</span></div></div>`;
      const ouvert = this.deplItem === r.id+':'+cle;
      let cibles = '';
      if(ouvert){
        const dispo = plan.filter(t=>t.id!==r.id && !this.etat.repas.coches[t.id] && !t.items.some(([c])=>c===cle));
        cibles = `<div class="ri-cibles">${dispo.length
          ? dispo.map(t=>`<button type="button" class="chip" data-action="depl-vers" data-from="${r.id}" data-cle="${cle}" data-to="${t.id}">→ ${echap(t.nom)}</button>`).join('')
          : '<span class="note" style="margin:0">Aucun repas dispo (déjà présent, ou repas pris).</span>'}</div>`;
      }
      return `<div class="ri-bloc${ouvert?' ouvert':''}">
        <button type="button" class="ri-tete" data-action="depl-ouvrir" data-rid="${r.id}" data-cle="${cle}" aria-expanded="${ouvert}">
          <span class="ri-nom">${echap(a.nom)}</span><span class="ri-qte">${lib}</span><span class="ri-move">⇄</span>
        </button>${cibles}
      </div>`;
    }).join('');
    return `<div class="repas-carte reorg${pris?' pris':''}">
      <div class="repas-haut"><span class="repas-nom">${echap(r.nom)}</span>${pris?'<span class="repas-kcal">pris · verrouillé</span>':''}</div>
      <div class="repas-items-reorg">${items}</div>
    </div>`;
  }

  basculerReorg(){ this.reorgOuvert = !this.reorgOuvert; this.deplItem = null; this.render(); }
  basculerDeplItem(rid, cle){ const k = rid+':'+cle; this.deplItem = this.deplItem===k ? null : k; this.render(); }

  /* déplace un aliment d'un repas à l'autre, selon la portée choisie.
     - 'jour' : agit sur une copie du plan valable aujourd'hui (planJour, créée à la volée)
     - 'plan' : agit sur le plan permanent (et reporte le déplacement sur planJour si actif,
                pour que la vue du jour reste cohérente). Repérage par `cle` → robuste. */
  deplacerAliment(fromId, cle, toId){
    const appliquer = repas => {
      const from = repas.find(r=>r.id===fromId), to = repas.find(r=>r.id===toId);
      if(!from || !to) return;
      const i = from.items.findIndex(([c])=>c===cle);
      if(i<0 || to.items.some(([c])=>c===cle)) return;
      to.items.push(from.items.splice(i,1)[0]);
    };
    if(this.porteeDepl==='jour'){
      if(!this.etat.repas.planJour) this.etat.repas.planJour = cloneProfond(this.etat.plan);
      appliquer(this.etat.repas.planJour);
    } else {
      appliquer(this.etat.plan);
      if(this.etat.repas.planJour) appliquer(this.etat.repas.planJour);
    }
    this.deplItem = null;
    this.store.sauver();
    this.render();
  }

  _reste(el, v, suffixe){
    el.textContent = v>0 ? `reste ${v}${suffixe}` : (v<0 ? `+${-v}${suffixe} au-dessus` : 'atteint ✓');
    el.className = 'cible-reste mono' + (v<0 ? ' depasse' : v===0 ? ' atteint' : '');
  }
}
