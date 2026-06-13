import { $ } from '../utils.js';
import { moyennesHebdo, rythmeMensuel, tendanceTaille, tendanceBras, brasStagne } from '../stats.js';
import { decisionVerdict } from '../verdict.js';

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
  }
}
