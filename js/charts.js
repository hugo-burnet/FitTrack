/* ================= CONFIG CHART.JS PARTAGÉE ================= */
/* Chart est fourni en global par le <script> CDN dans index.html */

export const optCommun = {
  responsive:true, maintainAspectRatio:false,
  plugins:{ legend:{labels:{color:'#9aa0a8',font:{family:'Barlow'}}} },
  scales:{
    x:{ticks:{color:'#9aa0a8',maxRotation:45,font:{size:11}},grid:{color:'#2a2e35'}},
    y:{ticks:{color:'#9aa0a8',font:{family:'IBM Plex Mono',size:11}},grid:{color:'#2a2e35'}}
  }
};
