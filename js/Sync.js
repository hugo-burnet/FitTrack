import { $ } from './utils.js';
import { confirmer } from './ui.js';
import { idbGet, idbSet, idbDel } from './idb.js';
import { lireGist, ecrireGist, creerGist, messageErreur } from './gist.js';
import { fusionnerEtat } from './fusion.js';

/* ================= SYNCHRONISATION GIST (specs 2.1 + 2.2) =================
   Synchro automatique principale via un Gist GitHub secret, 100 % côté navigateur.

   SÉCURITÉ DU TOKEN (2.2, non négociable) :
   - Le token n'est JAMAIS dans le code, le repo, le JSON exporté, ni écrit dans le
     gist de données. Il vit UNIQUEMENT en saisie runtime + IndexedDB local, sous une
     clé SÉPARÉE de l'état (`CLE_SYNC`) → il n'entre jamais dans `store.etat`, donc
     jamais dans l'export ni dans le contenu poussé sur le gist.
   - Le champ de saisie est un <input type="password"> nommé : le gestionnaire de mots
     de passe de l'OS (Trousseau iCloud / Google) le mémorise et l'autofill → « saisi
     une fois, rempli partout », réponse à la re-saisie après éviction iOS.

   FLUX :
   - Démarrage / « Synchroniser » → pull GET, fusion (par date/id), persistance locale,
     puis push PATCH de l'état réconcilié.
   - Chaque écriture de Store (événement 'change') → push PATCH débouncé.
   - Échec réseau → on reste fonctionnel en local et on retente (retour 'online'). */

const CLE_SYNC = 'carnet-recompo-sync';   /* {token, gistId} — séparé de l'état */
const DEBOUNCE = 1500;

function ilYa(iso){
  if(!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime())/1000);
  if(s < 45)    return 'à l’instant';
  if(s < 3600)  return `il y a ${Math.floor(s/60)} min`;
  if(s < 86400) return `il y a ${Math.floor(s/3600)} h`;
  return `il y a ${Math.floor(s/86400)} j`;
}

export class Sync extends EventTarget {
  constructor(store, app){
    super();
    this.store = store;
    this.app = app;
    this.token = null;
    this.gistId = null;
    this.statut = 'inactif';     /* inactif | encours | ok | erreur | horsligne */
    this.message = 'Synchro non configurée.';
    this.dernier = null;          /* ISO de la dernière synchro réussie */
    this._enCours = false;
    this._tpush = null;
  }

  actif(){ return !!(this.token && this.gistId); }

  async init(){
    try{
      const c = await idbGet(CLE_SYNC);
      if(c){ this.token = c.token || null; this.gistId = c.gistId || null; }
    }catch{ /* idb indisponible : la synchro reste simplement désactivée */ }

    this.bind();
    /* toute écriture locale doit repartir vers le gist */
    this.store.addEventListener('change', () => this._planifierPush());
    /* au retour du réseau, on rattrape les modifs faites hors-ligne */
    window.addEventListener('online', () => { if(this.actif()) this.synchroniser(); });

    if(this.actif()) await this.synchroniser();
    else this._emettre('inactif', 'Synchro non configurée.');
    this.render();
    /* rafraîchit le « il y a X » sans solliciter le réseau */
    setInterval(() => { if(this.statut === 'ok') this.render(); }, 30000);
  }

  /* ---- réconciliation complète : pull → fusion → persistance → push ---- */
  async synchroniser(){
    if(!this.actif() || this._enCours) return;
    if(!navigator.onLine){ this._emettre('horsligne', 'Hors-ligne — synchro en attente du réseau.'); return; }
    this._enCours = true;
    this._emettre('encours', 'Synchronisation…');
    try{
      const distant = await lireGist(this.token, this.gistId);
      if(distant){
        fusionnerEtat(this.store.etat, distant);
        this.app.muscu.jourSelectionne = null;
        this.store.sauver();        /* persiste la fusion en local (émet 'change') */
        this.app.renderAll();
      }
      await this._ecrire();          /* pousse l'état réconcilié */
      this._succes();
    }catch(err){ this._echec(err); }
    finally{
      this._enCours = false;
      clearTimeout(this._tpush);     /* le 'change' du sauver() ci-dessus est déjà couvert */
    }
  }

  /* ---- push débouncé (déclenché par chaque écriture de Store) ---- */
  _planifierPush(){
    if(!this.actif()) return;
    clearTimeout(this._tpush);
    this._tpush = setTimeout(() => this.pousser(), DEBOUNCE);
  }

  async pousser(){
    clearTimeout(this._tpush);
    if(!this.actif() || this._enCours) return;
    if(!navigator.onLine){ this._emettre('horsligne', 'Hors-ligne — modifs gardées en local.'); return; }
    this._enCours = true;
    this._emettre('encours', 'Envoi…');
    try{ await this._ecrire(); this._succes(); }
    catch(err){ this._echec(err); }
    finally{ this._enCours = false; }
  }

  _ecrire(){
    /* même forme que l'export manuel ; AUCUN token n'y figure (il n'est pas dans l'état) */
    const json = JSON.stringify({ version:2, exporte:new Date().toISOString(), ...this.store.etat });
    return ecrireGist(this.token, this.gistId, json);
  }

  /* ---- configuration depuis l'UI : enregistre les identifiants puis synchronise ----
     Si le token est fourni sans ID de gist, on en crée un (secret) automatiquement. */
  async configurer(token, gistId){
    token = (token||'').trim();
    gistId = (gistId||'').trim();
    if(!token) throw new Error('token-manquant');
    this.token = token;
    this._emettre('encours', gistId ? 'Connexion…' : 'Création du gist…');
    try{
      if(!gistId){
        const json = JSON.stringify({ version:2, exporte:new Date().toISOString(), ...this.store.etat });
        gistId = await creerGist(this.token, json);
      }
      this.gistId = gistId;
      await idbSet(CLE_SYNC, { token: this.token, gistId: this.gistId });
    }catch(err){
      this._echec(err);
      throw err;
    }
    await this.synchroniser();
    return this.gistId;
  }

  async oublier(){
    clearTimeout(this._tpush);
    this.token = null; this.gistId = null;
    try{ await idbDel(CLE_SYNC); }catch{}
    this._emettre('inactif', 'Token oublié sur ce navigateur. Tes données locales restent intactes.');
  }

  _succes(){ this.dernier = new Date().toISOString(); this._emettre('ok', 'Synchronisé'); }

  _echec(err){
    const horsligne = !navigator.onLine || (err && err.name === 'TypeError');
    this._emettre(horsligne ? 'horsligne' : 'erreur', messageErreur(err));
    if(!horsligne) console.error('Synchro Gist : échec', messageErreur(err));
  }

  _emettre(statut, message){
    this.statut = statut; this.message = message;
    this.dispatchEvent(new CustomEvent('statut', { detail:{ statut, message } }));
    this.render();
  }

  /* ================= UI (onglet Données) ================= */
  bind(){
    const form = $('form-sync');
    if(!form) return;
    form.addEventListener('submit', e => { e.preventDefault(); this._enregistrer(); });
    const now = $('btn-sync-now');   if(now) now.addEventListener('click', () => this.synchroniser());
    const clr = $('btn-sync-clear'); if(clr) clr.addEventListener('click', () => this._oublierUI());
  }

  async _enregistrer(){
    const champToken = $('sync-token'), champGist = $('sync-gist');
    if(!champToken || !champGist) return;
    try{
      const id = await this.configurer(champToken.value, champGist.value);
      champGist.value = id;          /* reflète l'ID (utile si on vient de créer le gist) */
      /* on laisse le token dans le champ : la soumission permet à l'OS de proposer
         l'enregistrement du mot de passe (autofill « rempli partout ») */
    }catch(err){
      if(err && err.message === 'token-manquant') this._emettre('erreur', 'Renseigne d’abord un token.');
      /* les autres erreurs ont déjà été remontées par configurer() */
    }
  }

  async _oublierUI(){
    if(!(await confirmer('Oublier le token et l’ID de gist sur ce navigateur ? Tes données locales sont conservées.', {danger:true, okLabel:'Oublier'}))) return;
    const t = $('sync-token'), g = $('sync-gist');
    if(t) t.value = ''; if(g) g.value = '';
    this.oublier();
  }

  render(){
    const champGist = $('sync-gist');
    if(champGist && this.gistId && !champGist.value) champGist.value = this.gistId;

    const el = $('sync-status');
    if(!el) return;
    const icones = { inactif:'○', encours:'⏳', ok:'✓', erreur:'⚠', horsligne:'⌁' };
    let txt = `${icones[this.statut] || ''} ${this.message}`;
    if(this.statut === 'ok' && this.dernier) txt += ` · ${ilYa(this.dernier)}`;
    el.textContent = txt.trim();
    el.className = `note sync-statut sync-${this.statut}`;
  }
}
