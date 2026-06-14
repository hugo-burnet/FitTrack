/* ================= CHRONO DE REPOS =================
   Compte à rebours sticky au-dessus de la navigation. Démarré depuis chaque
   exercice avec sa durée conseillée. Bip + vibration à zéro. */
export class RestTimer {
  constructor(rootId){
    this.root = document.getElementById(rootId);
    this.remaining = 0; this.total = 0; this.running = false; this.finished = false; this.id = null;
    this.elTime   = this.root.querySelector('.rt-time');
    this.elLabel  = this.root.querySelector('.rt-label');
    this.elFill   = this.root.querySelector('.rt-fill');
    this.elToggle = this.root.querySelector('[data-rt="toggle"]');

    this.root.addEventListener('click', e => {
      const b = e.target.closest('[data-rt]'); if(!b) return;
      const a = b.dataset.rt;
      if(a==='toggle') this.toggle();
      else if(a==='add') this.add(15);
      else if(a==='skip') this.stop();
    });

    // L'audio mobile (iOS surtout) doit être débloqué par un geste utilisateur.
    // On débloque le contexte audio au tout premier tap/clic n'importe où.
    const unlock = () => { this.unlockAudio(); };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('touchend', unlock, { once: true });
    document.addEventListener('click', unlock, { once: true });
  }

  /* Contexte audio unique, créé/réveillé lors d'un geste utilisateur. */
  unlockAudio(){
    try{
      const Ctx = window.AudioContext || window.webkitAudioContext; if(!Ctx) return null;
      if(!this.actx) this.actx = new Ctx();
      if(this.actx.state === 'suspended') this.actx.resume();
      return this.actx;
    }catch(e){ return null; }
  }

  fmt(s){ s = Math.max(0, s); const m = Math.floor(s/60), sec = s%60; return `${m}:${String(sec).padStart(2,'0')}`; }
  show(){ this.root.classList.remove('cache'); }
  hide(){ this.root.classList.add('cache'); }

  start(seconds, label){
    this.unlockAudio();
    this.stopTick();
    this.total = seconds; this.remaining = seconds; this.running = true; this.finished = false;
    if(this.elLabel) this.elLabel.textContent = label ? 'Repos · ' + label : 'Repos';
    this.root.classList.remove('rt-done');
    this.elToggle.textContent = '⏸';
    this.update(); this.show();
    this.id = window.setInterval(() => this.tick(), 1000);
  }

  tick(){
    if(!this.running) return;
    this.remaining--;
    if(this.remaining <= 0){ this.remaining = 0; this.update(); this.finish(); return; }
    if(this.remaining === 3){ this.beep({ freq: 660, dur: 0.12, vol: 0.2 }); this.vibrate([60]); }
    this.update();
  }

  update(){
    if(this.elTime) this.elTime.textContent = this.fmt(this.remaining);
    if(this.elFill) this.elFill.style.width = this.total ? (100*(this.total-this.remaining)/this.total).toFixed(1)+'%' : '0%';
  }

  finish(){
    this.stopTick(); this.running = false; this.finished = true;
    this.root.classList.add('rt-done');
    if(this.elLabel) this.elLabel.textContent = 'Repos terminé — go !';
    this.elToggle.textContent = '✕';
    this.beep(); this.vibrate();
    window.setTimeout(() => { if(this.finished) this.hide(); }, 4000);
  }

  toggle(){
    if(this.finished){ this.hide(); return; }
    this.running = !this.running;
    this.elToggle.textContent = this.running ? '⏸' : '▶';
    if(this.running && !this.id) this.id = window.setInterval(() => this.tick(), 1000);
  }

  add(s){
    this.remaining += s; this.total += s; this.finished = false;
    this.root.classList.remove('rt-done');
    if(this.root.classList.contains('cache')) this.show();
    if(!this.running){ this.running = true; this.elToggle.textContent = '⏸'; if(!this.id) this.id = window.setInterval(() => this.tick(), 1000); }
    this.update();
  }

  stop(){ this.stopTick(); this.running = false; this.finished = false; this.hide(); }
  stopTick(){ if(this.id){ window.clearInterval(this.id); this.id = null; } }

  beep({ freq = 880, dur = 0.45, vol = 0.3 } = {}){
    try{
      const ctx = this.unlockAudio(); if(!ctx) return;
      // Le contexte peut être encore « suspended » après mise en veille de l'écran.
      if(ctx.state === 'suspended') ctx.resume();
      const t0 = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.start(t0); o.stop(t0 + dur + 0.02);
    }catch(e){ /* audio indisponible : tant pis */ }
  }
  vibrate(pattern = [120,60,120]){ try{ if(navigator.vibrate) navigator.vibrate(pattern); }catch(e){} }
}
