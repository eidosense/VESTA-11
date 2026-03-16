class AudioService {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playClick() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, this.ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playType() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playFusion() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Drum-like impact (Low thump)
    const kickOsc = this.ctx.createOscillator();
    const kickGain = this.ctx.createGain();
    kickOsc.type = 'sine';
    kickOsc.frequency.setValueAtTime(150, now);
    kickOsc.frequency.exponentialRampToValueAtTime(0.01, now + 0.5);
    kickGain.gain.setValueAtTime(0.5, now);
    kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    kickOsc.connect(kickGain);
    kickGain.connect(this.ctx.destination);
    kickOsc.start(now);
    kickOsc.stop(now + 0.5);

    // Harmonica-like drone (Complex harmonic)
    const createHarmonic = (freq: number, startTime: number, duration: number, vol: number) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      // Subtle vibrato
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 5;
      lfoGain.gain.value = 2;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(startTime);
      
      g.gain.setValueAtTime(0, startTime);
      g.gain.linearRampToValueAtTime(vol, startTime + 0.5);
      g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
      lfo.stop(startTime + duration);
    };

    // Play a chord-like harmonica sound for 5 seconds
    createHarmonic(440, now, 5, 0.1); // A4
    createHarmonic(554.37, now, 5, 0.05); // C#5
    createHarmonic(659.25, now, 5, 0.05); // E5
  }

  private ambientOsc: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;

  startAmbient() {
    this.init();
    if (!this.ctx || this.ambientOsc) return;
    
    this.ambientOsc = this.ctx.createOscillator();
    this.ambientGain = this.ctx.createGain();
    
    this.ambientOsc.type = 'sine';
    this.ambientOsc.frequency.setValueAtTime(55, this.ctx.currentTime); // Low G
    
    this.ambientGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.ambientGain.gain.linearRampToValueAtTime(0.02, this.ctx.currentTime + 2);
    
    // Add a second oscillator for a richer drone
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(110, this.ctx.currentTime); // G2
    const gain2 = this.ctx.createGain();
    gain2.gain.value = 0.01;
    osc2.connect(gain2);
    gain2.connect(this.ambientGain);
    osc2.start();
    
    this.ambientOsc.connect(this.ambientGain);
    this.ambientGain.connect(this.ctx.destination);
    
    this.ambientOsc.start();
    
    // Store osc2 to stop it later
    (this.ambientOsc as any)._secondary = osc2;
  }

  stopAmbient() {
    if (this.ambientGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.ambientGain.gain.linearRampToValueAtTime(0, now + 1);
      setTimeout(() => {
        if (this.ambientOsc) {
          this.ambientOsc.stop();
          if ((this.ambientOsc as any)._secondary) {
            (this.ambientOsc as any)._secondary.stop();
          }
          this.ambientOsc = null;
          this.ambientGain = null;
        }
      }, 1100);
    }
  }

  playAmbient() {
    this.init();
    if (!this.ctx) return;
    // Very subtle low drone
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(55, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    // Keep it running? Or just a pulse?
    // For now, let's just make it a long fade
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 10);
    osc.stop(this.ctx.currentTime + 10);
  }
}

export const audioService = new AudioService();
