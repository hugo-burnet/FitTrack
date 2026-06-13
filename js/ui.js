import { echap } from './utils.js';

/* ================= UI INLINE : toast + dialogues =================
   Remplace alert() / confirm() / prompt() (UX mobile ; prompt capricieux — specs 5).
   - toast(msg, type)        → notification transitoire, non bloquante
   - confirmer(msg, opts)    → Promise<boolean>
   - demander(msg, defaut)   → Promise<string|null> */

let _zone;
function zoneToast(){
  if(!_zone){
    _zone = document.createElement('div');
    _zone.className = 'toast-zone';
    _zone.setAttribute('aria-live', 'polite');
    document.body.appendChild(_zone);
  }
  return _zone;
}

export function toast(message, type='info'){      /* type : info | ok | erreur */
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  zoneToast().appendChild(el);
  requestAnimationFrame(() => el.classList.add('on'));
  const fermer = () => { el.classList.remove('on'); setTimeout(() => el.remove(), 250); };
  el.addEventListener('click', fermer);
  setTimeout(fermer, type==='erreur' ? 4500 : 3000);
}

function modal({ message, champ=false, defaut='', okLabel='OK', annulerLabel='Annuler', danger=false }){
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.className = 'modal-ov';
    ov.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
      <p class="modal-msg">${echap(message)}</p>
      ${champ ? `<input class="modal-input" type="text" value="${echap(defaut)}">` : ''}
      <div class="modal-actions">
        <button class="btn btn-2" data-r="0">${echap(annulerLabel)}</button>
        <button class="btn${danger ? ' btn-danger' : ''}" data-r="1">${echap(okLabel)}</button>
      </div>
    </div>`;
    document.body.appendChild(ov);
    const input = ov.querySelector('.modal-input');
    const annule = () => champ ? null : false;
    const fin = (val) => { ov.remove(); document.removeEventListener('keydown', onKey); resolve(val); };
    const onKey = (e) => {
      if(e.key==='Escape') fin(annule());
      else if(e.key==='Enter' && champ) fin(input.value.trim());
    };
    ov.addEventListener('click', (e) => {
      if(e.target===ov) return fin(annule());          /* clic hors carte = annuler */
      const b = e.target.closest('[data-r]'); if(!b) return;
      if(b.dataset.r==='1') fin(champ ? input.value.trim() : true);
      else fin(annule());
    });
    document.addEventListener('keydown', onKey);
    if(input){ input.focus(); input.select(); }
    else ov.querySelector('[data-r="1"]').focus();
  });
}

export function confirmer(message, opts={}){
  return modal({ message, danger:opts.danger, okLabel:opts.okLabel||'Confirmer', annulerLabel:opts.annulerLabel||'Annuler' });
}
export function demander(message, defaut=''){
  return modal({ message, champ:true, defaut, okLabel:'Valider' });
}
