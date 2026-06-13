import { $, qsa, fmtDate, echap, aujourdHui, triDate } from '../utils.js';
import { e1rm } from '../stats.js';
import { optCommun } from '../charts.js';
import { RestTimer } from '../RestTimer.js';
import {
  parseFourchette, recommander, statsExo, reposRecommande, fmtRepos,
  meilleurE1rm, meilleureCharge, PAS_DEFAUT
} from '../progression.js';

/* ================= MUSCU : programmes, séances, surcharge progressive, chrono ================= */
export class MuscuModule {
  constructor(store, app){
    this.store = store;
    this.app = app;
    /* état d'interface (non persisté) */
    this.jourSelectionne = null;
    this.editeurOuvert = false;
    this.exoProgressionSel = null;
    this.chProg = null;
    this.dernierRecap = null;     /* recap affiché après enregistrement */
    this.histoOuverte = new Set(); /* exos dont le détail des séances précédentes est déplié */
    this._draftTimer = null;
    this.timer = new RestTimer('rest-timer');
    this.bind();
  }

  get etat(){ return this.store.etat; }
  programmeActif(){ return this.etat.programmes.find(p=>p.id===this.etat.programmeActif) || this.etat.programmes[0]; }
  jourCourant(){ return this.programmeActif().jours.find(j=>j.id===this.jourSelectionne); }

  bind(){
    $('muscu-prog').addEventListener('change', e => this.changerProgrammeActif(e.target.value));
    $('prog-exo').addEventListener('change', e => this.dessinerProgression(e.target.value));
    $('btn-editeur').addEventListener('click', () => this.basculerEditeur());
    $('btn-import-prog').addEventListener('click', () => $('fichier-import').click());

    /* chips de séances */
    $('muscu-jours').addEventListener('click', e => {
      const chip = e.target.closest('[data-action="choisir-jour"]');
      if(chip) this.choisirJour(chip.dataset.id);
    });

    /* recap : fermeture */
    $('muscu-recap').addEventListener('click', e => {
      if(e.target.closest('[data-action="fermer-recap"]')){ this.dernierRecap = null; this.afficherRecap(); }
    });

    /* formulaire de saisie de séance */
    const form = $('muscu-form');
    form.addEventListener('click', e => {
      if(e.target.closest('[data-action="set-add"]')){ this.ajouterSetLigne(e.target.closest('[data-action="set-add"]')); return; }
      if(e.target.closest('[data-action="set-del"]')){ this.supprimerSetLigne(e.target.closest('[data-action="set-del"]')); return; }
      if(e.target.closest('[data-action="toggle-uni-seance"]')){ this.toggleUniSeance(e.target.closest('[data-action="toggle-uni-seance"]')); return; }
      if(e.target.closest('[data-action="toggle-historique"]')){ this.toggleHistorique(+e.target.closest('[data-action="toggle-historique"]').dataset.exo); return; }
      if(e.target.closest('[data-action="repos"]')){ const b = e.target.closest('[data-action="repos"]'); this.timer.start(+b.dataset.sec, b.dataset.nom); return; }
      if(e.target.closest('[data-action="enregistrer-seance"]')){ this.enregistrerSeance(); return; }
    });
    form.addEventListener('keydown', e => {
      const o = e.target.closest('[data-action="toggle-historique"]');
      if(o && (e.key===' '||e.key==='Enter')){ e.preventDefault(); this.toggleHistorique(+o.dataset.exo); }
    });
    form.addEventListener('input', () => this.sauverBrouillonDiffere());
    form.addEventListener('change', () => this.sauverBrouillon()); /* flush immédiat au blur (avant de quitter l'onglet) */

    /* éditeur de programmes : clics + modifications de champs */
    const ed = $('muscu-editeur');
    ed.addEventListener('click', e => {
      const b = e.target.closest('[data-action]'); if(!b) return;
      const a = b.dataset.action, ji = +b.dataset.ji, ei = +b.dataset.ei;
      if(a==='ajouter-exo') this.ajouterExo(ji);
      else if(a==='suppr-exo') this.supprimerExo(ji, ei);
      else if(a==='ajouter-jour') this.ajouterJour();
      else if(a==='suppr-jour') this.supprimerJour(ji);
      else if(a==='nouveau-programme') this.nouveauProgramme();
      else if(a==='suppr-programme') this.supprimerProgramme();
      else if(a==='toggle-flag') this.basculerFlag(ji, ei, b.dataset.flag);
    });
    ed.addEventListener('change', e => {
      const f = e.target.closest('[data-action]'); if(!f) return;
      const a = f.dataset.action, ji = +f.dataset.ji, ei = +f.dataset.ei;
      if(a==='renommer-programme') this.renommerProgramme(f.value);
      else if(a==='maj-jour') this.majJour(ji, f.value);
      else if(a==='maj-exo') this.majExo(ji, ei, f.dataset.champ, f.value);
    });

    /* historique des séances */
    $('muscu-hist').addEventListener('click', e => {
      const b = e.target.closest('[data-action="suppr-seance"]');
      if(b) this.supprimerSeance(b.dataset.date, b.dataset.jour);
    });
  }

  /* ---- dernière perf notée pour un exercice (par nom) → prérempli les placeholders ---- */
  dernierePerf(nom){
    for(let i=this.etat.seances.length-1;i>=0;i--){
      const ex = this.etat.seances[i].exercices.find(e=>e.nom===nom);
      if(ex) return { date:this.etat.seances[i].date, series:ex.series };
    }
    return null;
  }
  /* perf de l'occurrence précédant strictement `date` (pour les deltas / recap) */
  perfPrecedente(date, nom){
    let prev = null;
    this.etat.seances.forEach(s=>{ if(s.date < date){ const e = s.exercices.find(x=>x.nom===nom); if(e) prev = e; } });
    return prev;
  }
  fmtPerf(series, unilateral){
    if(!series || !series.length) return '';
    const cote = unilateral ? '/côté' : '';
    const charges = series.map(s=>s.charge);
    const memeCharge = charges.every(c=>c===charges[0]);
    if(memeCharge){
      /* séries droites : forme compacte « 40 kg · 10/9/8 » */
      const c = charges[0];
      return (c!=null ? c+' kg'+cote+' · ' : '') + series.map(s=>s.reps).join('/');
    }
    /* charges variables : détail série par série « 40×10 · 38×9 · 35×8 » (la charge max ne suffit pas) */
    return series.map(s=>(s.charge!=null ? s.charge+'×' : '') + s.reps).join(' · ') + (unilateral ? ' /côté' : '');
  }

  /* ---- affichage de l'onglet Muscu ---- */
  render(){
    const prog = this.programmeActif();
    const sel = $('muscu-prog');
    sel.innerHTML = this.etat.programmes.map(p=>
      `<option value="${echap(p.id)}"${p.id===prog.id?' selected':''}>${echap(p.nom)}</option>`).join('');
    const chips = $('muscu-jours');
    chips.innerHTML = prog.jours.length
      ? prog.jours.map(j=>`<button class="chip${j.id===this.jourSelectionne?' actif':''}" data-action="choisir-jour" data-id="${echap(j.id)}">${echap(j.nom)}</button>`).join('')
      : '<span class="vide">Aucune séance dans ce programme. Ajoute-en via « Modifier les programmes ».</span>';
    this.afficherRecap();
    this.renderSeanceForm();
    this.afficherEditeur();
    this.majSelectExoProgression();
    this.afficherHistMuscu();
  }

  choisirJour(id){ this.jourSelectionne = id; this.histoOuverte.clear(); this.render(); }

  toggleHistorique(ei){
    const jour = this.jourCourant(); if(!jour || !jour.exercices[ei]) return;
    const nom = jour.exercices[ei].nom;
    if(this.histoOuverte.has(nom)) this.histoOuverte.delete(nom); else this.histoOuverte.add(nom);
    this.renderSeanceForm();
  }
  /* n dernières séances contenant cet exercice, plus récente en premier */
  historiqueExo(nom, n=3){
    const out = [];
    for(let i=this.etat.seances.length-1; i>=0 && out.length<n; i--){
      const s = this.etat.seances[i];
      const ex = s.exercices.find(e=>e.nom===nom);
      if(ex) out.push({ date:s.date, series:ex.series, unilateral:ex.unilateral, jourNom:s.jourNom });
    }
    return out;
  }
  renderHistoPanel(ex, ei){
    const list = this.historiqueExo(ex.nom, 3);
    const lignes = list.length
      ? list.map(h=>`<li><span class="histo-date mono">${fmtDate(h.date)}</span><span class="histo-perf mono">${echap(this.fmtPerf(h.series, h.unilateral))}</span></li>`).join('')
      : '<li class="histo-vide">Aucune séance précédente pour cet exercice.</li>';
    return `<div class="exo-histo">
      <div class="histo-haut"><span class="histo-titre">Séances précédentes</span><button class="repas-annuler" data-action="toggle-historique" data-exo="${ei}">Fermer</button></div>
      <ul class="histo-liste">${lignes}</ul>
    </div>`;
  }

  /* ---- formulaire de saisie : badges, objectif (level up), brouillon, suppression de série ---- */
  renderSeanceForm(){
    const cont = $('muscu-form');
    const jour = this.jourCourant();
    if(!jour){ cont.innerHTML = '<p class="vide">Choisis une séance ci-dessus pour noter tes charges et tes reps.</p>'; return; }

    const draft = this.etat.brouillons[jour.id];
    const dateVal = draft && draft.date ? draft.date : aujourdHui();
    let html = `<div class="champ" style="margin-top:12px"><label for="muscu-date">Date de la séance</label><input type="date" id="muscu-date" value="${dateVal}"></div>`;

    html += jour.exercices.map((ex,ei)=>{
      const presc = `${ex.series} × ${ex.reps}${ex.note?' · '+ex.note:''}`;
      const last = this.dernierePerf(ex.nom);
      const reco = recommander(ex, last ? last.series : null);
      const { niveau } = statsExo(this.etat.seances, ex.nom);
      const repos = reposRecommande(ex);
      const dBloc = draft && draft.blocs ? draft.blocs[ei] : null;
      /* unilatéral DE LA SÉANCE : initialisé sur le programme, mais modifiable pour cette séance.
         Quand actif, la charge saisie est celle d'UN côté (pas le total des deux). */
      const uni = draft && draft.unis && draft.unis[ei]!=null ? draft.unis[ei] : !!ex.unilateral;

      const badges = [];
      if(uni)              badges.push('<span class="exo-badge b-uni">Unilatéral · 1 côté</span>');
      if(ex.contraction2s) badges.push('<span class="exo-badge b-tempo">Contraction 2 s</span>');
      badges.push(`<span class="exo-badge b-repos">⏱ ${fmtRepos(repos)}</span>`);
      if(niveau>0) badges.push(`<span class="exo-badge b-niv">Niv. ${niveau}</span>`);

      const histoOpen = this.histoOuverte.has(ex.nom);
      const objectif = `<div class="exo-objectif ton-${reco.ton}${histoOpen?' ouvert':''}" data-action="toggle-historique" data-exo="${ei}" role="button" tabindex="0" aria-expanded="${histoOpen}">
          <div class="obj-haut"><span class="obj-tag">Objectif</span><span class="obj-msg">${echap(reco.message)}</span><span class="obj-caret">${histoOpen?'▾':'▸'}</span></div>
          ${reco.xp!=null ? `<div class="xp-barre"><div class="xp-rempli" style="width:${reco.xp}%"></div></div>` : ''}
        </div>`;
      const histoPanel = histoOpen ? this.renderHistoPanel(ex, ei) : '';

      const lastLine = last ? `<div class="exo-derniere">Dernière (${fmtDate(last.date)}) : <b>${echap(this.fmtPerf(last.series, ex.unilateral))}</b></div>` : '';

      const nRows = Math.max(ex.series||1, last ? last.series.length : 0, dBloc ? dBloc.length : 0);
      let rows='';
      for(let i=0;i<nRows;i++){
        const ph = last && last.series[i] ? last.series[i] : null;
        const phC = ph && ph.charge!=null ? ph.charge+' kg'+(uni?'/côté':'') : (ex.gainage?'—':(uni?'kg/côté':'kg'));
        const phR = ph ? ph.reps+' reps' : (uni?'reps/côté':'reps');
        const dv = dBloc && dBloc[i] ? dBloc[i] : null;
        const vc = dv && dv.charge!=='' && dv.charge!=null ? ` value="${echap(dv.charge)}"` : '';
        const vr = dv && dv.reps!=='' && dv.reps!=null ? ` value="${echap(dv.reps)}"` : '';
        rows += `<div class="set-ligne">
          <span class="set-n">${i+1}</span>
          <input class="in-charge" type="number" step="0.5" inputmode="decimal" placeholder="${phC}"${vc}>
          <input class="in-reps" type="number" inputmode="numeric" placeholder="${phR}"${vr}>
          <button class="set-del" data-action="set-del" aria-label="Supprimer la série">✕</button>
        </div>`;
      }
      return `<div class="exo-bloc" data-exo="${ei}">
        <div class="exo-tete"><span class="exo-nom">${echap(ex.nom)}</span><span class="exo-presc">${echap(presc)}</span></div>
        <div class="exo-badges">${badges.join('')}</div>
        ${objectif}
        ${histoPanel}
        <div class="exo-controls">
          <button class="chip-mini uni-toggle${uni?' actif':''}" data-action="toggle-uni-seance" aria-pressed="${uni}">Unilatéral · charge d'un côté</button>
        </div>
        ${lastLine}
        <div class="sets">${rows}</div>
        <div class="set-boutons">
          <button class="set-add" data-action="set-add">+ série</button>
          <button class="set-add set-repos" data-action="repos" data-sec="${repos}" data-nom="${echap(ex.nom)}">⏱ Repos ${fmtRepos(repos)}</button>
        </div>
      </div>`;
    }).join('');
    html += `<button class="btn" data-action="enregistrer-seance" style="margin-top:8px">Enregistrer la séance</button>`;
    cont.innerHTML = html;
  }

  ajouterSetLigne(btn){
    const sets = btn.closest('.exo-bloc').querySelector('.sets');
    const n = sets.children.length + 1;
    const div = document.createElement('div');
    div.className = 'set-ligne';
    div.innerHTML = `<span class="set-n">${n}</span>
      <input class="in-charge" type="number" step="0.5" inputmode="decimal" placeholder="kg">
      <input class="in-reps" type="number" inputmode="numeric" placeholder="reps">
      <button class="set-del" data-action="set-del" aria-label="Supprimer la série">✕</button>`;
    sets.appendChild(div);
    this.sauverBrouillon();
  }
  supprimerSetLigne(btn){
    const row = btn.closest('.set-ligne');
    const sets = row.parentElement;
    row.remove();
    [...sets.children].forEach((r,i)=>{ const n=r.querySelector('.set-n'); if(n) n.textContent=i+1; });
    this.sauverBrouillon();
  }

  /* ---- brouillon : la saisie en cours survit à la navigation / au rechargement ---- */
  sauverBrouillonDiffere(){ clearTimeout(this._draftTimer); this._draftTimer = setTimeout(() => this.sauverBrouillon(), 400); }
  sauverBrouillon(){
    const jour = this.jourCourant(); if(!jour) return;
    const blocs = [], unis = [];
    qsa('#muscu-form .exo-bloc').forEach(bloc=>{
      const ei = +bloc.dataset.exo;
      const series = [];
      bloc.querySelectorAll('.set-ligne').forEach(r=>{
        series.push({ charge: r.querySelector('.in-charge').value, reps: r.querySelector('.in-reps').value });
      });
      blocs[ei] = series;
      const t = bloc.querySelector('.uni-toggle');
      unis[ei] = t ? t.classList.contains('actif') : !!jour.exercices[ei].unilateral;
    });
    const dateEl = $('muscu-date');
    const date = dateEl ? dateEl.value : aujourdHui();
    const hasData = blocs.some(b => b && b.some(s => s.charge!=='' || s.reps!==''));
    const unisDiff = unis.some((u,i) => !!u !== !!(jour.exercices[i] && jour.exercices[i].unilateral));
    if(hasData || unisDiff) this.etat.brouillons[jour.id] = { date, blocs, unis };
    else delete this.etat.brouillons[jour.id];
    this.store.sauver();
  }

  toggleUniSeance(btn){
    btn.classList.toggle('actif');
    this.sauverBrouillon();   /* capture l'état du toggle + les saisies en cours */
    this.renderSeanceForm();  /* re-rend pour mettre à jour badges, placeholders « /côté » */
  }

  enregistrerSeance(){
    const prog = this.programmeActif();
    const jour = this.jourCourant();
    if(!jour) return;
    const date = $('muscu-date').value;
    if(!date){ alert('Date requise.'); return; }
    const exercices=[];
    qsa('#muscu-form .exo-bloc').forEach(bloc=>{
      const ex = jour.exercices[+bloc.dataset.exo];
      const t = bloc.querySelector('.uni-toggle');
      const uni = t ? t.classList.contains('actif') : !!ex.unilateral;  /* unilatéral DÉCLARÉ pour cette séance */
      const series=[];
      bloc.querySelectorAll('.set-ligne').forEach(row=>{
        const charge = parseFloat(row.querySelector('.in-charge').value);
        const reps = parseInt(row.querySelector('.in-reps').value,10);
        if(!isNaN(reps)) series.push({ charge: isNaN(charge)?null:charge, reps });
      });
      if(series.length) exercices.push({ nom:ex.nom, presc:`${ex.series}×${ex.reps}`, series,
        unilateral:uni, contraction2s:!!ex.contraction2s });
    });
    if(!exercices.length){ alert('Note au moins une série (reps) sur un exercice.'); return; }

    /* recap calculé AVANT insertion (comparé à l'historique existant) */
    const recap = this.construireRecap(date, jour, exercices);

    this.etat.seances = this.etat.seances.filter(s=>!(s.date===date && s.jourId===jour.id));
    this.etat.seances.push({ date, programmeId:prog.id, jourId:jour.id, jourNom:jour.nom, exercices });
    this.etat.seances.sort(triDate);
    delete this.etat.brouillons[jour.id];   /* la séance enregistrée remplace le brouillon */
    this.store.sauver();

    this.dernierRecap = recap;
    if(this.etat.autoExport && this.app.donnees) this.app.donnees.exporterJSON();
    this.render();
  }

  /* ---- recap de séance : deltas vs occurrence précédente (hausses ET baisses) ---- */
  construireRecap(date, jour, exercices){
    const lignes = exercices.map(exo=>{
      const perf = this.fmtPerf(exo.series, exo.unilateral);   /* détail réel des séries (charges variables incluses) */
      const prev = this.perfPrecedente(date, exo.nom);
      const e1Now = meilleurE1rm(exo.series), cNow = meilleureCharge(exo.series);
      if(!prev) return { nom:exo.nom, statut:'nouveau', perf, cNow, e1Now };
      const e1Prev = meilleurE1rm(prev.series), cPrev = meilleureCharge(prev.series);
      const dE1 = (e1Now!=null && e1Prev!=null) ? e1Now - e1Prev : null;
      const dC  = (cNow!=null && cPrev!=null) ? cNow - cPrev : null;
      let ton = 'flat';
      if(dE1!=null){ if(dE1 > 0.1) ton='up'; else if(dE1 < -0.1) ton='down'; }
      return { nom:exo.nom, statut:'compare', perf, cNow, cPrev, dC, e1Now, e1Prev, dE1, ton };
    });
    const monte = lignes.filter(l=>l.ton==='up').length;
    const baisse = lignes.filter(l=>l.ton==='down').length;
    return { date, jourNom:jour.nom, lignes, monte, baisse };
  }

  afficherRecap(){
    const c = $('muscu-recap');
    const r = this.dernierRecap;
    if(!r){ c.innerHTML = ''; return; }
    const arrow = (d,unit) => {
      if(d==null) return '<span class="flat">nouveau</span>';
      if(Math.abs(d) < 0.1) return '<span class="flat">= maintenu</span>';
      const up = d>0;
      return `<span class="${up?'down':'up'}">${up?'▲':'▼'} ${(up?'+':'−')+Math.abs(d).toFixed(1)} ${unit}</span>`;
      /* NB: progression (▲) en vert (.down) ; régression (▼) en rouge (.up) — cohérent avec le reste de l'app */
    };
    const lignes = r.lignes.map(l=>{
      const delta = l.statut==='nouveau'
        ? '<span class="flat">nouvel exo</span>'
        : `${arrow(l.dE1,'kg 1RM')}${l.dC!=null && Math.abs(l.dC)>=0.1 ? ' · '+arrow(l.dC,'kg') : ''}`;
      return `<li>
        <div class="rc-tete"><span class="rc-nom">${echap(l.nom)}</span><span class="rc-delta">${delta}</span></div>
        <div class="rc-perf mono">${echap(l.perf)}</div>
      </li>`;
    }).join('');
    const bilan = r.monte || r.baisse
      ? `${r.monte} en hausse${r.baisse?` · ${r.baisse} en baisse`:''}`
      : 'séance de maintien';
    c.innerHTML = `<div class="recap-carte">
      <div class="recap-haut">
        <span class="recap-titre">Recap · ${echap(r.jourNom)} ${fmtDate(r.date)}</span>
        <button class="repas-annuler" data-action="fermer-recap">Fermer</button>
      </div>
      <div class="recap-bilan mono">${bilan}</div>
      <ul class="recap-liste">${lignes}</ul>
    </div>`;
  }

  afficherHistMuscu(){
    const c = $('muscu-hist');
    if(!this.etat.seances.length){ c.innerHTML = '<p class="vide">Aucune séance enregistrée. Note ta première séance ci-dessus — sans carnet, pas de progression pilotée.</p>'; return; }
    c.innerHTML = [...this.etat.seances].reverse().slice(0,30).map(s=>{
      const exos = s.exercices.map(e=>{
        const prev = this.perfPrecedente(s.date, e.nom);
        let delta = '';
        if(prev){
          const a = meilleurE1rm(e.series), b = meilleurE1rm(prev.series);
          if(a!=null && b!=null){
            const d = a-b;
            if(Math.abs(d) < 0.1) delta = '<span class="seance-delta flat">=</span>';
            else delta = `<span class="seance-delta ${d>0?'down':'up'}">${d>0?'▲':'▼'}${Math.abs(d).toFixed(1)}</span>`;
          }
        }
        return `<li><span>${echap(e.nom)}${e.unilateral?' <span class="exo-badge b-uni mini">uni</span>':''}</span><span class="perf">${echap(this.fmtPerf(e.series, e.unilateral))} ${delta}</span></li>`;
      }).join('');
      return `<div class="seance-carte">
        <div class="seance-haut">
          <span class="seance-jour">${echap(s.jourNom||'Séance')}</span>
          <span class="seance-date">${fmtDate(s.date)} <button class="suppr" aria-label="Supprimer" data-action="suppr-seance" data-date="${echap(s.date)}" data-jour="${echap(s.jourId)}">✕</button></span>
        </div>
        <ul class="seance-exos">${exos}</ul>
      </div>`;
    }).join('');
  }
  supprimerSeance(date, jourId){
    this.etat.seances = this.etat.seances.filter(s=>!(s.date===date && s.jourId===jourId));
    this.store.sauver(); this.render();
  }

  /* ---- progression par exercice (1RM estimé Epley + volume) ---- */
  tousLesExos(){
    const set = new Set();
    this.etat.programmes.forEach(p=>p.jours.forEach(j=>j.exercices.forEach(e=>{ if(e.nom) set.add(e.nom); })));
    this.etat.seances.forEach(s=>s.exercices.forEach(e=>set.add(e.nom)));
    return [...set].sort((a,b)=>a.localeCompare(b,'fr'));
  }
  majSelectExoProgression(){
    const sel = $('prog-exo');
    const exos = this.tousLesExos();
    if(!this.exoProgressionSel || !exos.includes(this.exoProgressionSel)) this.exoProgressionSel = exos[0]||null;
    sel.innerHTML = exos.length
      ? exos.map(n=>`<option value="${echap(n)}"${n===this.exoProgressionSel?' selected':''}>${echap(n)}</option>`).join('')
      : '<option>—</option>';
    this.dessinerProgression(this.exoProgressionSel);
  }
  dessinerProgression(nom){
    this.exoProgressionSel = nom;
    const pts = [];
    this.etat.seances.forEach(s=>{
      const ex = s.exercices.find(e=>e.nom===nom);
      if(!ex) return;
      let best=null, vol=0;
      ex.series.forEach(se=>{
        vol += (se.charge||0)*se.reps;
        const e = e1rm(se.charge, se.reps);  /* 1RM estimé = par côté pour l'unilatéral (charge d'un côté) */
        if(e!=null && (best==null || e>best)) best=e;
      });
      if(ex.unilateral) vol *= 2;            /* volume total = les deux côtés */
      pts.push({ date:s.date, e1rm:best, vol });
    });
    pts.sort((a,b)=>a.date.localeCompare(b.date));
    /* couleur des points : vert si le 1RM monte vs point précédent, rouge s'il baisse (réductions visibles) */
    const couleursPts = pts.map((p,i)=>{
      if(i===0 || p.e1rm==null || pts[i-1].e1rm==null) return '#d9a441';
      if(p.e1rm > pts[i-1].e1rm + 0.05) return '#7fb069';
      if(p.e1rm < pts[i-1].e1rm - 0.05) return '#c8553d';
      return '#d9a441';
    });
    const ctx = $('graph-prog');
    if(this.chProg) this.chProg.destroy();
    this.chProg = new Chart(ctx,{type:'line',data:{labels:pts.map(p=>fmtDate(p.date)),datasets:[
      {label:'1RM estimé (kg)', data:pts.map(p=>p.e1rm!=null?Math.round(p.e1rm*10)/10:null), borderColor:'#d9a441',backgroundColor:couleursPts,pointBackgroundColor:couleursPts,borderWidth:2.5,pointRadius:5,tension:.25,spanGaps:true},
      {label:'Volume (kg·reps)', data:pts.map(p=>Math.round(p.vol)), borderColor:'#6f9ceb',backgroundColor:'#6f9ceb',borderWidth:1.5,pointRadius:3,tension:.25,yAxisID:'y2',spanGaps:true}
    ]},options:{...optCommun,scales:{...optCommun.scales,
      y2:{position:'right',ticks:{color:'#6f9ceb',font:{family:'IBM Plex Mono',size:11}},grid:{display:false}}
    }}});
  }

  /* ---- éditeur de programmes / exercices ---- */
  basculerEditeur(){
    this.editeurOuvert = !this.editeurOuvert;
    $('muscu-editeur').classList.toggle('cache', !this.editeurOuvert);
    $('btn-editeur').textContent = this.editeurOuvert ? '✓ Fermer l’éditeur' : '✎ Modifier les programmes';
    if(this.editeurOuvert) this.afficherEditeur();
  }
  afficherEditeur(){
    const c = $('muscu-editeur');
    if(!this.editeurOuvert) return;
    const prog = this.programmeActif();
    let html = `<div class="champ" style="margin-top:12px"><label for="ed-nom">Nom du programme</label><input type="text" id="ed-nom" value="${echap(prog.nom)}" data-action="renommer-programme"></div>`;
    html += prog.jours.map((j,ji)=>{
      const exos = j.exercices.map((ex,ei)=>`
        <div class="ed-exo">
          <input type="text" value="${echap(ex.nom)}" placeholder="Exercice" data-action="maj-exo" data-ji="${ji}" data-ei="${ei}" data-champ="nom">
          <input type="number" value="${ex.series}" min="1" placeholder="sér." data-action="maj-exo" data-ji="${ji}" data-ei="${ei}" data-champ="series">
          <input type="text" value="${echap(ex.reps)}" placeholder="reps" data-action="maj-exo" data-ji="${ji}" data-ei="${ei}" data-champ="reps">
          <button class="suppr" aria-label="Supprimer l'exercice" data-action="suppr-exo" data-ji="${ji}" data-ei="${ei}">✕</button>
        </div>
        <div class="ed-exo-opts">
          <button class="chip-mini${ex.unilateral?' actif':''}" data-action="toggle-flag" data-ji="${ji}" data-ei="${ei}" data-flag="unilateral">Unilatéral</button>
          <button class="chip-mini${ex.contraction2s?' actif':''}" data-action="toggle-flag" data-ji="${ji}" data-ei="${ei}" data-flag="contraction2s">Contraction 2 s</button>
          <label class="ed-pas">Pas <input type="number" step="0.5" min="0.5" value="${ex.pas!=null?ex.pas:PAS_DEFAUT}" data-action="maj-exo" data-ji="${ji}" data-ei="${ei}" data-champ="pas"> kg</label>
        </div>`).join('');
      return `<div class="ed-jour">
        <div class="ed-jour-tete">
          <input type="text" value="${echap(j.nom)}" placeholder="Nom de la séance" data-action="maj-jour" data-ji="${ji}">
          <button class="suppr" aria-label="Supprimer la séance" data-action="suppr-jour" data-ji="${ji}">✕</button>
        </div>
        ${exos}
        <button class="set-add" data-action="ajouter-exo" data-ji="${ji}">+ exercice</button>
      </div>`;
    }).join('');
    html += `<button class="btn btn-2" data-action="ajouter-jour">+ séance</button>`;
    html += `<div style="height:10px"></div><button class="btn btn-2" data-action="nouveau-programme">+ nouveau programme</button>`;
    if(this.etat.programmes.length>1)
      html += `<div style="height:10px"></div><button class="btn btn-danger" data-action="suppr-programme">Supprimer ce programme</button>`;
    c.innerHTML = html;
  }
  renommerProgramme(v){ this.programmeActif().nom = v.trim()||'Programme'; this.store.sauver(); this.render(); }
  majJour(ji, v){ this.programmeActif().jours[ji].nom = v.trim()||'Séance'; this.store.sauver(); }
  majExo(ji, ei, champ, v){
    const ex = this.programmeActif().jours[ji].exercices[ei];
    if(champ==='series') ex.series = Math.max(1, parseInt(v,10)||1);
    else if(champ==='pas'){ const n = parseFloat(v); ex.pas = (isNaN(n)||n<=0) ? undefined : n; }
    else ex[champ] = v.trim();
    this.store.sauver();
    if(champ==='reps' || champ==='pas') this.renderSeanceForm(); /* l'objectif/repos dépendent de reps & pas */
  }
  basculerFlag(ji, ei, flag){
    const ex = this.programmeActif().jours[ji].exercices[ei];
    ex[flag] = !ex[flag];
    this.store.sauver();
    this.afficherEditeur();
    this.renderSeanceForm();
  }
  ajouterExo(ji){ this.programmeActif().jours[ji].exercices.push({nom:'', series:3, reps:'10-12'}); this.store.sauver(); this.afficherEditeur(); }
  supprimerExo(ji, ei){ this.programmeActif().jours[ji].exercices.splice(ei,1); this.store.sauver(); this.afficherEditeur(); this.renderSeanceForm(); }
  ajouterJour(){ this.programmeActif().jours.push({id:'j'+Date.now(), nom:'Nouvelle séance', exercices:[]}); this.store.sauver(); this.render(); }
  supprimerJour(ji){
    const prog = this.programmeActif();
    if(!confirm('Supprimer cette séance et tous ses exercices ?')) return;
    if(prog.jours[ji] && prog.jours[ji].id===this.jourSelectionne) this.jourSelectionne=null;
    prog.jours.splice(ji,1); this.store.sauver(); this.render();
  }
  nouveauProgramme(){
    const nom = prompt('Nom du nouveau programme ?','Mon programme');
    if(nom===null) return;
    const id = 'p'+Date.now();
    this.etat.programmes.push({id, nom:nom.trim()||'Mon programme', jours:[]});
    this.etat.programmeActif = id; this.jourSelectionne=null;
    this.store.sauver(); this.render();
  }
  supprimerProgramme(){
    if(this.etat.programmes.length<=1) return;
    if(!confirm('Supprimer ce programme entier ?')) return;
    this.etat.programmes = this.etat.programmes.filter(p=>p.id!==this.etat.programmeActif);
    this.etat.programmeActif = this.etat.programmes[0].id; this.jourSelectionne=null;
    this.store.sauver(); this.render();
  }
  changerProgrammeActif(id){ this.etat.programmeActif=id; this.jourSelectionne=null; this.store.sauver(); this.render(); }
}
