import { $, echap, slug, jourLocal } from '../utils.js';
import { ALIMENTS, COURSES_DEFAUT } from '../data.js';
import { consoQuotidienne } from '../nutrition.js';
import { toast } from '../ui.js';

/* ================= LISTE DE COURSES ================= */
export class CoursesModule {
  constructor(store, app){
    this.store = store;
    this.app = app;
    /* id d'article → aliment du PLAN, pour dériver la quantité même sur les listes
       déjà en stockage (les ids = slug(nom) des défauts) — cf. specs 4.3 */
    this.cleParId = {};
    COURSES_DEFAUT.forEach(c=>{ if(c.cle) this.cleParId[slug(c.nom)] = c.cle; });
    this.bind();
  }

  get etat(){ return this.store.etat; }
  joursCourse(){ const j = this.etat.courses.jours; return (typeof j==='number' && j>0) ? j : 7; }

  /* aliment lié à un article (champ explicite ou mapping par id) */
  cleArticle(it){ return it.cle || this.cleParId[it.id] || null; }

  formatQteCourse(cle, total){
    total = Math.round(total);
    const a = ALIMENTS[cle];
    if(a.unite!==undefined){
      const u = a.unite || 'unité';
      return `${total} ${u}${(total>1 && a.unite)?'s':''}`.trim();
    }
    if(total>=1000){ const kg = total/1000; return (Number.isInteger(kg)?String(kg):kg.toFixed(1)).replace('.',',')+' kg'; }
    return `${total} g`;
  }

  bind(){
    $('btn-ajouter-course').addEventListener('click', () => this.ajouterCourse());
    $('btn-cocher-courses').addEventListener('click', () => this.cocherCourses());
    $('btn-decocher-courses').addEventListener('click', () => this.decocherCourses());
    $('courses-jours').addEventListener('change', e => {
      const v = parseInt(e.target.value,10);
      this.etat.courses.jours = Math.max(1, Math.min(60, isNaN(v)?7:v));
      this.store.sauver(); this.render();
    });

    const liste = $('courses-liste');
    liste.addEventListener('click', e => {
      const suppr = e.target.closest('[data-action="suppr-course"]');
      if(suppr){ e.stopPropagation(); this.supprimerCourse(suppr.dataset.id); return; }
      const item = e.target.closest('[data-action="toggle-course"]');
      if(item) this.basculerCourse(item.dataset.id);
    });
    liste.addEventListener('keydown', e => {
      const item = e.target.closest('[data-action="toggle-course"]');
      if(item && (e.key===' '||e.key==='Enter')){ e.preventDefault(); this.basculerCourse(item.dataset.id); }
    });
  }

  render(){
    const jours = this.joursCourse();
    const ji = $('courses-jours');
    if(ji && document.activeElement!==ji) ji.value = jours;
    /* quantités dérivées du plan, recalculées à chaque rendu (suit l'objectif kcal) */
    const conso = consoQuotidienne(this.etat.objectifKcal, this.etat.plan);

    const liste = $('courses-liste');
    const items = this.etat.courses.items;
    if(!items.length){
      liste.innerHTML = '<p class="vide">Liste vide. Ajoute des articles ci-dessous.</p>';
    } else {
      const cats = [];
      items.forEach(it=>{ if(!cats.includes(it.cat)) cats.push(it.cat); });
      liste.innerHTML = cats.map(cat=>{
        const rows = items.filter(it=>it.cat===cat).map(it=>{
          const pris = !!this.etat.courses.coches[it.id];
          const cle = this.cleArticle(it);
          const derive = cle && conso[cle] ? this.formatQteCourse(cle, conso[cle]*jours) : null;
          const qteAff = derive!=null ? derive : (it.qte||'');
          return `<div class="course-item${pris?' pris':''}" role="button" tabindex="0" aria-pressed="${pris}"
             data-action="toggle-course" data-id="${echap(it.id)}">
             <span class="course-coche">${pris?'✓':''}</span>
             <span class="course-nom">${echap(it.nom)}</span>
             <span class="course-qte${derive!=null?' derivee':''}">${echap(qteAff)}</span>
             <button class="suppr" aria-label="Supprimer" data-action="suppr-course" data-id="${echap(it.id)}">✕</button>
          </div>`;
        }).join('');
        return `<div class="course-cat">${echap(cat)}</div>${rows}`;
      }).join('');
    }
    const n = items.length, pris = items.filter(it=>this.etat.courses.coches[it.id]).length;
    $('courses-compte').textContent = `${pris} / ${n}`;
    $('courses-rempli').style.width = n ? (100*pris/n).toFixed(0)+'%' : '0%';
  }

  basculerCourse(id){
    if(this.etat.courses.coches[id]) delete this.etat.courses.coches[id]; else this.etat.courses.coches[id]=true;
    this.store.sauver(); this.render();
  }
  ajouterCourse(){
    const nom = $('course-nom').value.trim();
    if(!nom){ toast('Nom de l’article requis.', 'erreur'); return; }
    const qte = $('course-qte').value.trim();
    const cat = $('course-cat').value;
    let id = slug(nom);
    while(this.etat.courses.items.some(it=>it.id===id)) id += '-'+Math.floor(Math.random()*1000);
    this.etat.courses.items.push({id, nom, qte, cat});
    this.store.sauver(); this.render();
    $('course-nom').value=''; $('course-qte').value='';
  }
  supprimerCourse(id){
    this.etat.courses.items = this.etat.courses.items.filter(it=>it.id!==id);
    delete this.etat.courses.coches[id];
    this.store.sauver(); this.render();
  }
  cocherCourses(){
    const c = {}; this.etat.courses.items.forEach(it=>{ c[it.id]=true; });
    this.etat.courses.coches = c; this.etat.courses.maj = jourLocal();
    this.store.sauver(); this.render();
  }
  decocherCourses(){
    this.etat.courses.coches = {}; this.etat.courses.maj = jourLocal();
    this.store.sauver(); this.render();
  }
}
