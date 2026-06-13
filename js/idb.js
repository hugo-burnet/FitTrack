/* ================= MINI-WRAPPER INDEXEDDB =================
   Un seul store clé/valeur, une seule entrée d'état. Promesses, zéro dépendance.
   IndexedDB survit à l'éviction du stockage iOS bien mieux que localStorage :
   c'est la couche de durabilité de Store (cf. specs 1.2). */

const NOM_DB = 'carnet-recompo';
const STORE  = 'etat';
const VERSION = 1;

function ouvrir(){
  return new Promise((resoudre, rejeter) => {
    const req = indexedDB.open(NOM_DB, VERSION);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resoudre(req.result);
    req.onerror  = () => rejeter(req.error);
  });
}

export async function idbGet(cle){
  const db = await ouvrir();
  try{
    return await new Promise((resoudre, rejeter) => {
      const tx  = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(cle);
      req.onsuccess = () => resoudre(req.result);
      req.onerror  = () => rejeter(req.error);
    });
  } finally { db.close(); }
}

export async function idbSet(cle, valeur){
  const db = await ouvrir();
  try{
    return await new Promise((resoudre, rejeter) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(valeur, cle);
      tx.oncomplete = () => resoudre();
      tx.onerror   = () => rejeter(tx.error);
      tx.onabort   = () => rejeter(tx.error);
    });
  } finally { db.close(); }
}

export async function idbDel(cle){
  const db = await ouvrir();
  try{
    return await new Promise((resoudre, rejeter) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(cle);
      tx.oncomplete = () => resoudre();
      tx.onerror   = () => rejeter(tx.error);
      tx.onabort   = () => rejeter(tx.error);
    });
  } finally { db.close(); }
}
