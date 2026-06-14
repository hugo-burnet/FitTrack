import { $, fmtDate, fleche, triDate } from '../utils.js';
import { moyennesHebdo } from '../stats.js';
import { optCommun } from '../charts.js';
import { toast } from '../ui.js';

/* ================= MESURES : poids + mensurations + bandeau + courbes ================= */
export class MesuresModule {
  constructor(store, app){
    this.store = store;
    this.app = app;
    this.chPoids = null;
    this.chMens = null;
    this.bind();
  }

  get etat(){ return this.store.etat; }

  bind(){
    $('btn-poids').addEventListener('click', () => this.ajouterPoids());
    $('btn-mens').addEventListener('click', () => this.ajouterMens());
    $('hist-poids').addEventListener('click', e => {
      const b = e.target.closest('[data-action="suppr-poids"]');
      if(b) this.supprimerPoids(b.dataset.date);
    });
    $('hist-mens').addEventListener('click', e => {
      const b = e.target.closest('[data-action="suppr-mens"]');
      if(b) this.supprimerMens(b.dataset.date);
    });
  }

  /* ---- saisie ---- */
  ajouterPoids(){
    const date = $('p-date').value;
    const kg = parseFloat($('p-kg').value);
    if(!date || isNaN(kg)){ toast('Date et poids requis.', 'erreur'); return; }
    this.etat.poids = this.etat.poids.filter(p=>p.date!==date);
    this.etat.poids.push({date, kg}); this.etat.poids.sort(triDate);
    this.store.sauver(); this.app.renderAll();
    $('p-kg').value='';
  }
  ajouterMens(){
    const date = $('m-date').value;
    if(!date){ toast('Date requise.', 'erreur'); return; }
    const champ = id => { const v=parseFloat($(id).value); return isNaN(v)?null:v; };
    const rel = {date, taille:champ('m-taille'), tailleRelache:champ('m-tailler'),
                 bras:champ('m-bras'), cuisse:champ('m-cuisse'), torse:champ('m-torse')};
    if(rel.taille===null && rel.bras===null){ toast('Renseigne au moins la taille ou le bras.', 'erreur'); return; }
    this.etat.mensurations = this.etat.mensurations.filter(m=>m.date!==date);
    this.etat.mensurations.push(rel); this.etat.mensurations.sort(triDate);
    this.store.sauver(); this.app.renderAll();
    ['m-taille','m-tailler','m-bras','m-cuisse','m-torse'].forEach(i=>$(i).value='');
  }
  supprimerPoids(date){ this.etat.poids = this.etat.poids.filter(p=>p.date!==date); this.store.sauver(); this.app.renderAll(); }
  supprimerMens(date){ this.etat.mensurations = this.etat.mensurations.filter(m=>m.date!==date); this.store.sauver(); this.app.renderAll(); }

  /* ---- affichage ---- */
  render(){
    this.afficherBandeau();
    this.afficherHistPoids();
    this.afficherHistMens();
    this.dessinerPoids();
    this.dessinerMens();
  }

  afficherBandeau(){
    const moy = moyennesHebdo(this.etat.poids);
    const stP = $('st-poids'), stPd = $('st-poids-d');
    if(moy.length){
      stP.textContent = moy[moy.length-1].kg.toFixed(1);
      stPd.innerHTML = moy.length>1 ? fleche(moy[moy.length-1].kg-moy[moy.length-2].kg) : '';
    } else { stP.textContent='—'; stPd.innerHTML=''; }
    const t = this.etat.mensurations.filter(m=>m.taille!==null);
    const b = this.etat.mensurations.filter(m=>m.bras!==null);
    $('st-taille').textContent = t.length? t[t.length-1].taille.toFixed(1) : '—';
    $('st-taille-d').innerHTML = t.length>1? fleche(t[t.length-1].taille-t[t.length-2].taille) : '';
    $('st-bras').textContent = b.length? b[b.length-1].bras.toFixed(1) : '—';
    $('st-bras-d').innerHTML = b.length>1? fleche(b[b.length-1].bras-b[b.length-2].bras, true) : '';
  }

  afficherHistPoids(){
    const c = $('hist-poids');
    if(this.etat.poids.length===0){ c.innerHTML='<p class="vide">Aucune pesée. La première est la plus importante : elle ancre la série.</p>'; return; }
    const lignes = [...this.etat.poids].reverse().slice(0,20).map(p=>
      `<tr><td>${fmtDate(p.date)}</td><td class="n">${p.kg.toFixed(1)} kg</td>
       <td style="text-align:right"><button class="suppr" aria-label="Supprimer" data-action="suppr-poids" data-date="${p.date}">✕</button></td></tr>`).join('');
    c.innerHTML = `<table><tr><th>Date</th><th>Poids</th><th></th></tr>${lignes}</table>`;
  }

  afficherHistMens(){
    const c = $('hist-mens');
    if(this.etat.mensurations.length===0){ c.innerHTML='<p class="vide">Aucun relevé. Rendez-vous le 1er du mois.</p>'; return; }
    const f = v => v===null||v===undefined ? '·' : v.toFixed(1);
    const lignes = [...this.etat.mensurations].reverse().map(m=>
      `<tr><td>${fmtDate(m.date)}</td><td class="n">${f(m.taille)}</td><td class="n">${f(m.bras)}</td><td class="n">${f(m.cuisse)}</td><td class="n">${f(m.torse)}</td>
       <td style="text-align:right"><button class="suppr" aria-label="Supprimer" data-action="suppr-mens" data-date="${m.date}">✕</button></td></tr>`).join('');
    c.innerHTML = `<table><tr><th>Date</th><th>Taille</th><th>Bras</th><th>Cuisse</th><th>Torse</th><th></th></tr>${lignes}</table>`;
  }

  dessinerPoids(){
    const ctx = $('graph-poids');
    const labels = this.etat.poids.map(p=>fmtDate(p.date));
    const moy = moyennesHebdo(this.etat.poids);
    /* projeter la moyenne hebdo sur l'axe des pesées : valeur de la semaine de chaque point */
    const t0 = this.etat.poids.length? new Date(this.etat.poids[0].date+'T12:00:00').getTime() : 0;
    const moyParSem = {}; moy.forEach(m=>moyParSem[m.sem]=m.kg);
    const serieMoy = this.etat.poids.map(p=>{
      const i = Math.floor((new Date(p.date+'T12:00:00').getTime()-t0)/(7*864e5));
      return moyParSem[i] ?? null;
    });
    if(this.chPoids) this.chPoids.destroy();
    this.chPoids = new Chart(ctx,{type:'line',data:{labels,datasets:[
      {label:'Pesées',data:this.etat.poids.map(p=>p.kg),borderColor:'#686f7a',backgroundColor:'#686f7a',pointRadius:3,borderWidth:1.5,tension:.2},
      {label:'Moyenne hebdo',data:serieMoy,borderColor:'#4d7ef0',backgroundColor:'#4d7ef0',pointRadius:0,borderWidth:2.5,tension:.3,stepped:true}
    ]},options:optCommun});
  }

  dessinerMens(){
    const ctx = $('graph-mens');
    const m = this.etat.mensurations;
    if(this.chMens) this.chMens.destroy();
    this.chMens = new Chart(ctx,{type:'line',data:{labels:m.map(x=>fmtDate(x.date)),datasets:[
      {label:'Taille (cm)',data:m.map(x=>x.taille),borderColor:'#e07a63',backgroundColor:'#e07a63',borderWidth:2,pointRadius:4,tension:.25,spanGaps:true},
      {label:'Bras (cm)',data:m.map(x=>x.bras),borderColor:'#4cb784',backgroundColor:'#4cb784',borderWidth:2,pointRadius:4,tension:.25,spanGaps:true,yAxisID:'y2'}
    ]},options:{...optCommun,scales:{...optCommun.scales,
      y2:{position:'right',ticks:{color:'#4cb784',font:{family:'Inter, system-ui, sans-serif',size:11}},grid:{display:false}}
    }}});
  }
}
