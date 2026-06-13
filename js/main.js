import { App } from './App.js';

/* point d'entrée : démarre le carnet.
   Le .catch attrape une éventuelle erreur de la phase de chargement (avant le try interne)
   pour basculer sur l'écran de récupération plutôt que de laisser l'app blanche. */
const app = new App();
app.init().catch(err => app.afficherRecuperation(err));
