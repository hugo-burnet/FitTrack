import { $ } from '../utils.js';
import { rythmeMensuel, tendanceTaille, tendanceBras } from '../stats.js';

/* ================= VERDICT : l'arbre de décision ================= */
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

    const seuilTaille = 0.5; /* cm — en dessous : bruit de mesure */
    let cls='v-neutre', t='Données insuffisantes',
        e='Entre au moins 2 semaines de pesées et 2 relevés de taille pour obtenir un verdict.';

    if(rythme!==null && dTaille===null){
      cls='v-neutre'; t='Taille manquante';
      e='Le poids seul ne suffit pas : c’est le tour de taille qui dit la vérité. Ajoute un 2e relevé mensuel.';
    }
    if(rythme!==null && dTaille!==null){
      const tailleMonte = dTaille >  seuilTaille;
      const tailleBaisse = dTaille < -seuilTaille;
      if(rythme > 0.5 && tailleMonte){
        cls='v-baisse'; t='−150 kcal · sur le riz';
        e='La balance monte trop vite et la taille suit : tu stockes du gras. Retire 30 g de riz cru au déjeuner. Réévalue dans 4 semaines.';
      } else if(rythme < -0.5){
        cls='v-hausse'; t='+150 kcal';
        e='Déficit trop agressif pour une recompo : tu risques le muscle. Ajoute 30 g de riz cru ou 1 banane. Réévalue dans 4 semaines.';
      } else if(Math.abs(rythme) <= 0.5 && !tailleMonte && dBras!==null && dBras <= 0 && this.etat.mensurations.length >= 2){
        cls='v-hausse'; t='+100-150 kcal · si bras stagne 6 sem.';
        e='Poids et taille stables mais le bras ne progresse pas sur le dernier relevé. Si ça se confirme au prochain : petit surplus, et vérifie sommeil + progression des charges au carnet.';
      } else if(rythme <= 0.3 && !tailleMonte){
        cls='v-ok'; t='RAS — Continue';
        e='Recompo sur les rails : poids maîtrisé, taille stable ou en baisse. Ne change rien, ni calories ni programme.';
      } else {
        cls='v-neutre'; t='Zone grise — Observe';
        e='Légère prise sans hausse nette de taille : probablement muscle + bruit de mesure. Pas d’ajustement, re-verdict au prochain relevé mensuel.';
      }
    }
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
