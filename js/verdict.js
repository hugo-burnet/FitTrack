/* ================= MOTEUR DE VERDICT (fonction pure) =================
   L'arbre de décision recompo, isolé du DOM pour être testable (specs 5).
   Cohérence stricte avec les cartes « scénario » affichées :
     -150 : poids ↑ vite ET taille ↑     | +150 : poids ↓ vite ET taille ↓
     +100-150 : poids & taille stables ET bras qui stagne (2 relevés)
     RAS : poids 0..+0,3 kg/mois ET taille stable ou ↓
   Anti-réactivité : aucun ajustement avant 3 moyennes hebdo ; la branche « bras »
   exige 2 deltas non positifs (pas un seul, trop bruité). */

export const SEUIL_TAILLE = 0.5;   /* cm — en dessous : bruit de mesure */
export const SEM_MIN = 3;          /* moyennes hebdo requises avant un ajustement */

export function decisionVerdict({ rythme, dTaille, dBras, nbSem, brasStagne }){
  if(rythme == null)
    return { cls:'v-neutre', t:'Données insuffisantes',
      e:'Entre au moins 2 semaines de pesées et 2 relevés de taille pour obtenir un verdict.' };

  if(nbSem < SEM_MIN)
    return { cls:'v-neutre', t:'Tendance provisoire',
      e:'Encore peu de recul : moins de 3 moyennes hebdomadaires. Continue de te peser — un verdict fiable arrive au 3ᵉ point, pas avant.' };

  if(dTaille == null)
    return { cls:'v-neutre', t:'Taille manquante',
      e:'Le poids seul ne suffit pas : c’est le tour de taille qui dit la vérité. Ajoute un 2ᵉ relevé mensuel.' };

  const tailleMonte  = dTaille >  SEUIL_TAILLE;
  const tailleBaisse = dTaille < -SEUIL_TAILLE;
  const tailleStable = !tailleMonte && !tailleBaisse;

  if(rythme > 0.5 && tailleMonte)
    return { cls:'v-baisse', t:'−150 kcal · sur le riz',
      e:'La balance monte trop vite et la taille suit : tu stockes du gras. Retire 30 g de riz cru au déjeuner. Réévalue dans 4 semaines.' };

  if(rythme < -0.5 && tailleBaisse)
    return { cls:'v-hausse', t:'+150 kcal',
      e:'Déficit trop agressif pour une recompo, et la taille baisse vite : tu risques le muscle. Ajoute 30 g de riz cru ou 1 banane. Réévalue dans 4 semaines.' };

  if(Math.abs(rythme) <= 0.5 && tailleStable && brasStagne)
    return { cls:'v-hausse', t:'+100-150 kcal · bras qui stagne',
      e:'Poids et taille stables, et le bras ne progresse plus sur les 2 derniers relevés : petit surplus, et vérifie sommeil + progression des charges au carnet.' };

  if(rythme >= 0 && rythme <= 0.3 && !tailleMonte)
    return { cls:'v-ok', t:'RAS — Continue',
      e:'Recompo sur les rails : poids maîtrisé (0 à +0,3 kg/mois), taille stable ou en baisse. Ne change rien, ni calories ni programme.' };

  return { cls:'v-neutre', t:'Zone grise — Observe',
    e:'Signal ambigu (légère variation sans confirmation de la taille) : probablement muscle + bruit de mesure. Pas d’ajustement, re-verdict au prochain relevé mensuel.' };
}
