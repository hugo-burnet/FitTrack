import { $, echap, slug, jourLocal } from '../utils.js';

/* ================= LISTE DE COURSES ================= */
export class CoursesModule {
  constructor(store, app){
    this.store = store;
    this.app = app;
    this.bind();
  }

  get etat(){ return this.store.etat; }

  bind(){
    $('btn-ajouter-course').addEventListener('click', () => this.ajouterCourse());
    $('btn-decocher-courses').addEventListener('click', () => this.decocherCourses());

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
          return `<div class="course-item${pris?' pris':''}" role="button" tabindex="0" aria-pressed="${pris}"
             data-action="toggle-course" data-id="${echap(it.id)}">
             <span class="course-coche">${pris?'✓':''}</span>
             <span class="course-nom">${echap(it.nom)}</span>
             <span class="course-qte">${echap(it.qte||'')}</span>
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
    if(!nom){ alert('Nom de l’article requis.'); return; }
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
  decocherCourses(){
    this.etat.courses.coches = {}; this.etat.courses.maj = jourLocal();
    this.store.sauver(); this.render();
  }
}
