import { $, echap, ilYaJours } from '../utils.js';
import { moyennesHebdo, rythmeMensuel, tendanceTaille, tendanceBras, brasStagne } from '../stats.js';
import { decisionVerdict } from '../verdict.js';
import { protCible } from '../nutrition.js';
import { adherenceHebdo, bilanForce } from '../bilan.js';

/* ================= VERDICT : l'arbre de décision (rendu) ================= */
export class VerdictModule {
  constructor(store, app){ this.store = store; this.app = app; }

  get etat(){ return this.store.etat; }

  render(){
    const box = $('verdict-box');
    const tampon = $('verdict-tampon');
    const expl = $('verdict-expl');
    const data = $('verdict-data');
    const rythme = rythmeMensuel(this.etat.poids);
    const dTaille = tendanceTaille(this.etat.mensurations);
    const dBras = tendanceBras(this.etat.mensurations);
    const nbSem = moyennesHebdo(this.etat.poids).length;

    const { cls, t, e } = decisionVerdict({
      rythme, dTaille, dBras, nbSem, brasStagne: brasStagne(this.etat.mensurations),
    });
    box.className = 'verdict '+cls;
    tampon.textContent = t;
    expl.textContent = e;
    let html='';
    if(rythme!==null) html += `<span>Rythme <b>${(rythme>=0?'+':'')+rythme.toFixed(2)} kg/mois</b></span>`;
    if(dTaille!==null) html += `<span>Taille <b>${(dTaille>=0?'+':'')+dTaille.toFixed(1)} cm</b></span>`;
    if(dBras!==null) html += `<span>Bras <b>${(dBras>=0?'+':'')+dBras.toFixed(1)} cm</b></span>`;
    data.innerHTML = html;

    this.renderSemaine(rythme);
  }

  /* ---- reads hebdo entre deux verdicts mensuels (specs 4.4) ---- */
  renderSemaine(rythme){
    /* tendance lissée : on réutilise le rythme mensuel déjà calculé */
    const tr = $('sem-trend'), trs = $('sem-trend-sub');
    if(rythme!=null){
      tr.textContent = (rythme>=0?'+':'') + rythme.toFixed(2);
      trs.textContent = rythme>0.5 ? 'kg/mois · prise' : rythme< -0.5 ? 'kg/mois · perte' : 'kg/mois · stable';
    } else { tr.textContent='—'; trs.textContent='≥ 2 sem. de pesées'; }

    /* adhérence : protéines à la cible + séances sur 7 jours glissants */
    const cutoff = ilYaJours(6);   /* aujourd'hui inclus → fenêtre de 7 jours */
    const { joursProt, nbSeances } = adherenceHebdo(
      this.etat.journalRepas, this.etat.seances, protCible(this.etat.objectifKcal), cutoff);
    const ep = $('sem-prot'); ep.textContent = `${joursProt} / 7`;
    ep.className = 'sem-val mono ' + (joursProt>=5 ? 'up bon' : joursProt>=3 ? 'flat' : 'up');
    $('sem-seances').textContent = String(nbSeances);

    /* signal de force : e1RM qui décroche sur plusieurs exercices récents (≤ 21 j) */
    const f = bilanForce(this.etat.seances, ilYaJours(21));
    const sf = $('sem-force');
    if(f.declin >= 2){
      const noms = f.exosDeclin.slice(0,3).map(echap).join(', ');
      sf.className = 'sem-force alerte';
      sf.innerHTML = `⚠ Force en baisse sur <b>${f.declin} exercices</b> (${noms}${f.exosDeclin.length>3?'…':''}) — signal précoce possible de sous-alimentation ou de récupération insuffisante. Vérifie sommeil & apport calorique avant de creuser le déficit.`;
    } else if(f.total >= 2 && f.hausse >= f.total/2){
      sf.className = 'sem-force ok';
      sf.innerHTML = `💪 Force stable ou en hausse (${f.hausse}/${f.total} exercices) — récupération OK, le déficit est soutenable.`;
    } else { sf.className='sem-force'; sf.textContent=''; }
  }
}
