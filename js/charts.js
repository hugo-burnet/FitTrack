/* ================= CONFIG CHART.JS PARTAGÉE ================= */
/* Chart est fourni en global par le <script> vendoré (vendor/chart.umd.min.js) dans index.html */
/* Palette « instrument » (specs identité §6) : grille très faible, libellés discrets,
   chiffres tabulaires, infobulles sur surface relevée. */

const FONT = 'Inter, system-ui, sans-serif';

export const optCommun = {
  responsive:true, maintainAspectRatio:false,
  plugins:{
    legend:{labels:{color:'#9aa1ab',font:{family:FONT,size:12}}},
    tooltip:{
      backgroundColor:'#1c1f26', titleColor:'#e7e9ec', bodyColor:'#e7e9ec',
      borderColor:'#2a2e37', borderWidth:1, padding:10,
      titleFont:{family:FONT}, bodyFont:{family:FONT}
    }
  },
  scales:{
    x:{ticks:{color:'#9aa1ab',maxRotation:45,font:{family:FONT,size:11}},grid:{color:'rgba(42,46,55,.5)'}},
    y:{ticks:{color:'#9aa1ab',font:{family:FONT,size:11}},grid:{color:'rgba(42,46,55,.5)'}}
  }
};
