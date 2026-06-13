/* ================= CLIENT GIST GITHUB =================
   100 % côté navigateur (aucun backend — cf. specs). Le token est passé en argument
   à chaque appel : ce module ne le stocke ni ne le journalise JAMAIS (cf. specs 2.2).
   Un seul fichier JSON par gist sert de coffre de données. */

const API = 'https://api.github.com';
const FICHIER = 'carnet-recompo.json';     /* nom du fichier de données dans le gist */

/* Erreur transportant le code HTTP, pour un message lisible côté UI. */
export class ErreurGist extends Error {
  constructor(statut, message){ super(message || `Erreur Gist (${statut})`); this.name='ErreurGist'; this.statut=statut; }
}

function entetes(token){
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/* message humain à partir du code HTTP (jamais le token) */
export function messageErreur(err){
  if(err && err.name === 'TypeError') return 'Réseau indisponible — réessai au retour de la connexion.';
  const s = err && err.statut;
  if(s === 401) return 'Token invalide ou expiré.';
  if(s === 403) return 'Accès refusé : vérifie le scope « Gists » du token (ou quota atteint).';
  if(s === 404) return 'Gist introuvable : vérifie l’ID.';
  if(s === 422) return 'Requête refusée par GitHub (contenu invalide).';
  return (err && err.message) || 'Erreur de synchronisation.';
}

async function lever(r){
  /* on ne lit pas le corps d'erreur en détail : il pourrait être volumineux et n'apporte rien */
  throw new ErreurGist(r.status);
}

/* choisit le fichier de données dans la métadonnée du gist :
   priorité au nom attendu, sinon premier .json, sinon premier fichier */
function choisirFichier(meta){
  const fichiers = meta && meta.files ? Object.values(meta.files) : [];
  if(!fichiers.length) return null;
  return fichiers.find(f => f.filename === FICHIER)
      || fichiers.find(f => /\.json$/i.test(f.filename || ''))
      || fichiers[0];
}

/* GET /gists/{id} → objet de données (ou null si gist vide / fichier introuvable).
   Gère la troncature : si le contenu dépasse ~1 Mo, l'API renvoie truncated:true
   + raw_url → on récupère le contenu complet via raw_url (cf. specs 2.1). */
export async function lireGist(token, gistId){
  const r = await fetch(`${API}/gists/${gistId}`, { headers: entetes(token) });
  if(!r.ok) await lever(r);
  const meta = await r.json();
  const fichier = choisirFichier(meta);
  if(!fichier) return null;

  let contenu = fichier.content;
  if(fichier.truncated && fichier.raw_url){
    /* raw_url d'un gist secret est accessible par son hash, sans en-tête d'auth
       (et on évite d'envoyer le Bearer hors de api.github.com) */
    const rr = await fetch(fichier.raw_url);
    if(!rr.ok) throw new ErreurGist(rr.status);
    contenu = await rr.text();
  }
  if(typeof contenu !== 'string' || !contenu.trim()) return null;
  return JSON.parse(contenu);
}

/* PATCH /gists/{id} — remplace le fichier de données. */
export async function ecrireGist(token, gistId, contenuJSON){
  const r = await fetch(`${API}/gists/${gistId}`, {
    method:'PATCH',
    headers:{ ...entetes(token), 'Content-Type':'application/json' },
    body: JSON.stringify({ files:{ [FICHIER]:{ content: contenuJSON } } }),
  });
  if(!r.ok) await lever(r);
}

/* POST /gists — crée un gist SECRET (public:false) et renvoie son id.
   Utilisé quand l'utilisateur fournit un token sans ID : zéro friction. */
export async function creerGist(token, contenuJSON){
  const r = await fetch(`${API}/gists`, {
    method:'POST',
    headers:{ ...entetes(token), 'Content-Type':'application/json' },
    body: JSON.stringify({
      description: 'Carnet Recompo — données (privé, ne pas partager le lien)',
      public: false,
      files: { [FICHIER]:{ content: contenuJSON } },
    }),
  });
  if(!r.ok) await lever(r);
  const meta = await r.json();
  return meta.id;
}
