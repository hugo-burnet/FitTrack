/* ================= UTILITAIRES PARTAGÉS ================= */

/* date locale au format AAAA-MM-JJ (jamais UTC : "minuit" = minuit local) */
export function jourLocal(d = new Date()){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export const aujourdHui = () => jourLocal();
/* date locale d'il y a n jours (pour les fenêtres glissantes hebdo) */
export function ilYaJours(n, d = new Date()){ const x = new Date(d); x.setDate(x.getDate()-n); return jourLocal(x); }

export const fmtDate = d => new Date(d+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'2-digit'});
export const triDate = (a,b) => a.date.localeCompare(b.date);

export function fleche(delta, inverse=false){
  if(delta===null||isNaN(delta)) return '';
  const eps = 0.05;
  if(Math.abs(delta)<eps) return `<span class="flat">=</span>`;
  const monte = delta>0;
  const bon = inverse ? !monte : monte;
  const cls = monte ? (bon?'up bon':'up') : (bon?'down':'down');
  return `<span class="${cls}">${monte?'▲':'▼'} ${Math.abs(delta).toFixed(1)}</span>`;
}

export function cloneProfond(o){ return JSON.parse(JSON.stringify(o)); }

export function echap(s){
  return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

export function slug(s){
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'item';
}

/* raccourcis DOM */
export const $ = (id) => document.getElementById(id);
export const qsa = (sel, root=document) => [...root.querySelectorAll(sel)];
