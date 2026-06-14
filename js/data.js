/* ================= CONSTANTES & DONNÉES PAR DÉFAUT ================= */

export const CLE = 'carnet-recompo-v1';
export const OBJ_DEFAUT = 2545; /* référence du plan de la bible nutrition */

/* Valeurs nutritionnelles approximatives (par 100 g, sauf 'unite'). Les bases de données varient de ±10 %. */
export const ALIMENTS = {
  avoine:  {nom:"Flocons d'avoine",            kcal100:380, prot100:13,  flex:true},
  riz:     {nom:"Riz (cru)",                   kcal100:350, prot100:7,   flex:true},
  poulet:  {nom:"Haut de cuisse poulet (cru)", kcal100:130, prot100:19},
  skyr:    {nom:"Skyr nature",                 kcal100:63,  prot100:11},
  pb:      {nom:"Beurre de cacahuète",         kcal100:600, prot100:25},
  pois:    {nom:"Petits pois-carottes",        kcal100:60,  prot100:3.5},
  amandes: {nom:"Amandes",                     kcal100:600, prot100:21},
  noix:    {nom:"Noix",                         kcal100:650, prot100:15},
  whey:    {nom:"Whey",      unite:"shaker",   kcalU:115,   protU:23},
  banane:  {nom:"Banane",    unite:"",          kcalU:105,   protU:1.3},
  choco:   {nom:"Chocolat noir 85%", unite:"carré", kcalU:30, protU:0.5},
};

export const PLAN = [
  {id:'pdej',  nom:'Petit-déjeuner',     items:[['avoine',100],['whey',1],['banane',1],['pb',15]]},
  {id:'dej',   nom:'Déjeuner',           items:[['poulet',220],['riz',140],['pois',190]]},
  {id:'coll',  nom:'Collation aprèm',    items:[['skyr',240],['banane',1],['amandes',30]]},
  {id:'post',  nom:'Post-training',      items:[['whey',1],['banane',1]]},
  {id:'diner', nom:'Dîner',              items:[['skyr',240],['noix',15],['choco',2]]},
];

/* ================= MUSCU : PROGRAMME PAR DÉFAUT (bible PPLUL) ================= */
export const PROG_DEFAUT = [{
  id:'pplul', nom:'PPLUL 5 jours',
  jours:[
    {id:'push', nom:'Push', exercices:[
      {nom:'Chest press machine', series:3, reps:'10-12'},
      {nom:'Développé incliné haltères (30°)', series:3, reps:'10-12'},
      {nom:'Développé épaules haltères assis', series:3, reps:'10-12', note:'RIR 2'},
      {nom:'Élévations latérales', series:3, reps:'12-15', pas:1, contraction2s:true},
      {nom:'Extension triceps poulie', series:3, reps:'12-15'},
    ]},
    {id:'pull', nom:'Pull', exercices:[
      {nom:'Tirage vertical', series:3, reps:'10-12'},
      {nom:'Rowing unilatéral buste appuyé', series:3, reps:'10-12/côté', unilateral:true},
      {nom:'Face pull', series:3, reps:'15', note:'RIR 2', contraction2s:true},
      {nom:'Curl incliné haltères', series:3, reps:'10-12'},
      {nom:'Curl marteau', series:2, reps:'12-15'},
    ]},
    {id:'legs', nom:'Legs', exercices:[
      {nom:'Presse horizontale', series:4, reps:'12-15', note:'RIR 2'},
      {nom:'Leg curl assis', series:3, reps:'10-12'},
      {nom:'Leg extension', series:3, reps:'12-15'},
      {nom:'Mollets assis', series:3, reps:'12-15'},
      {nom:'Curl-up (McGill big 3)',    series:3, reps:'tours', gainage:true, dureeCible:10},
      {nom:'Side plank (McGill big 3)', series:2, reps:'tours', gainage:true, dureeCible:10, unilateral:true},
      {nom:'Bird-dog (McGill big 3)',   series:3, reps:'tours', gainage:true, dureeCible:10},
    ]},
    {id:'upper', nom:'Upper', exercices:[
      {nom:'Développé incliné haltères', series:3, reps:'10-12'},
      {nom:'Rowing machine appui pectoral', series:3, reps:'10-12'},
      {nom:'Développé épaules haltères assis', series:2, reps:'12', note:'RIR 2'},
      {nom:'Tirage vertical prise neutre', series:2, reps:'12'},
      {nom:'Élévations latérales', series:2, reps:'15'},
      {nom:'Curl au choix', series:2, reps:'12-15'},
    ]},
    {id:'lower', nom:'Lower', exercices:[
      {nom:'Presse horizontale', series:3, reps:'12-15', note:'RIR 2'},
      {nom:'Hip thrust', series:3, reps:'12'},
      {nom:'Leg curl allongé', series:3, reps:'12-15'},
      {nom:'Mollets assis', series:3, reps:'15'},
      {nom:'Fentes bulgares haltères', series:2, reps:'12/jambe', unilateral:true},
      {nom:'Curl-up (McGill big 3)',    series:3, reps:'tours', gainage:true, dureeCible:10},
      {nom:'Side plank (McGill big 3)', series:2, reps:'tours', gainage:true, dureeCible:10, unilateral:true},
      {nom:'Bird-dog (McGill big 3)',   series:3, reps:'tours', gainage:true, dureeCible:10},
    ]},
  ]
}];

/* ================= LISTE DE COURSES PAR DÉFAUT =================
   `cle` relie l'article à un aliment du PLAN → la quantité est alors DÉRIVÉE
   (plan × jours, flex ajusté à l'objectif). Sans `cle`, la quantité figée sert. */
export const COURSES_DEFAUT = [
  {cat:'Frais',              nom:'Skyr nature',                          qte:'3,4 kg',              cle:'skyr'},
  {cat:'Frais',              nom:'Haut de cuisse de poulet désossé',     qte:'1,6 kg',              cle:'poulet'},
  {cat:'Frais',              nom:'Bananes',                              qte:'21',                  cle:'banane'},
  {cat:'Épicerie',           nom:'Riz',                                  qte:'1 kg/sem (sac 5 kg)', cle:'riz'},
  {cat:'Épicerie',           nom:"Flocons d'avoine",                     qte:'700 g',               cle:'avoine'},
  {cat:'Épicerie',           nom:'Petits pois-carottes',                 qte:'7 boîtes 190 g',      cle:'pois'},
  {cat:'Épicerie',           nom:'Chocolat noir 85 %',                   qte:'2 × 100 g',           cle:'choco'},
  {cat:'Stock (2-4 sem)',    nom:'Beurre de cacahuète',                  qte:'pot 350 g',           cle:'pb'},
  {cat:'Stock (2-4 sem)',    nom:'Amandes natures non salées',           qte:'500 g',               cle:'amandes'},
  {cat:'Stock (2-4 sem)',    nom:'Cerneaux de noix',                     qte:'250 g',               cle:'noix'},
  {cat:'Stock (2-4 sem)',    nom:'Œufs',                                 qte:'si substitution noix'},
  {cat:'Réassort mensuel',   nom:'Whey',                                 qte:'~1,8 kg/mois',        cle:'whey'},
  {cat:'Réassort mensuel',   nom:'Créatine',                             qte:'90-150 g/mois'},
  {cat:'Réassort mensuel',   nom:'K2-D3 / Oméga-3 / Magnésium / Méla.',  qte:'vérifier piluliers'},
];
