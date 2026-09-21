export class PoetrySpeech {
  constructor(onChange, onError) {
    this.onChange = onChange; this.onError = onError; this.session = 0; this.active = null; this.playing = false; this.paused = false; this.utterance = null;
  }
  voices() { return globalThis.speechSynthesis?.getVoices().filter(v => /^zh[-_]/i.test(v.lang)) || []; }
  voice() { const voices = this.voices(); return voices.find(v => /^zh[-_]TW$/i.test(v.lang) && v.localService) || voices.find(v => /^zh[-_]TW$/i.test(v.lang)) || voices.find(v => v.localService) || voices[0]; }
  stop() { this.session++; globalThis.speechSynthesis?.cancel(); this.playing = false; this.paused = false; this.active = null; this.utterance = null; this.onChange(); }
  play(lines, speed = 1.25, lineIndex = 0) {
    this.stop();
    if (!globalThis.speechSynthesis || !globalThis.SpeechSynthesisUtterance) { this.onError('這個瀏覽器不支援朗讀，請使用 iPhone Safari。'); return; }
    const voice = this.voice();
    // Voice enumeration may still be empty on the first iOS gesture.
    // Let the system select a voice for zh-TW without delaying speak().
    const remaining = lines.slice(lineIndex);
    if (!remaining.length) return;
    // A single utterance avoids restarting the voice engine between lines.
    // A short comma keeps a natural breath without a full-stop pause per line.
    const segments = remaining.map(line => line.replace(/[，。；！？、,.!?;：:\s]+$/u, '') + '，');
    let offset = 0;
    const starts = segments.map(segment => { const start = offset; offset += segment.length; return start; });
    const utterance = new SpeechSynthesisUtterance(segments.join(''));
    const session = this.session;
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || 'zh-TW'; utterance.rate = speed;
    this.utterance = utterance; this.playing = true;
    utterance.onstart = () => { if (session === this.session) { this.active = lineIndex; this.onChange(); } };
    utterance.onboundary = event => {
      if (session !== this.session || !Number.isFinite(event.charIndex)) return;
      let index = 0;
      while (index + 1 < starts.length && starts[index + 1] <= event.charIndex) index++;
      if (this.active !== lineIndex + index) { this.active = lineIndex + index; this.onChange(); }
    };
    utterance.onend = () => {
      if (session !== this.session) return;
      this.playing = false; this.paused = false; this.active = null; this.utterance = null; this.onChange();
    };
    utterance.onerror = () => {
      if (session !== this.session) return;
      this.stop(); this.onError('朗讀暫時無法播放，請再次點選朗讀。');
    };
    this.onChange();
    try { speechSynthesis.speak(utterance); }
    catch { if (session === this.session) { this.stop(); this.onError('朗讀暫時無法播放，請再次點選朗讀。'); } }
  }
  togglePause() {
    if (!this.playing) return;
    if (this.paused) speechSynthesis.resume(); else speechSynthesis.pause();
    this.paused = !this.paused; this.onChange();
  }
}

// Follow actual speech boundary events, never an estimated lyric timer.
export function syncReadingLines(root, player, enabled, reducedMotion=false) {
  const active=enabled&&player.playing&&Number.isInteger(player.active)?player.active:null;
  for(const group of root.querySelectorAll('.poem-lines')) {
    group.classList.toggle('is-reading',active!==null);
    group.classList.toggle('is-paused',active!==null&&player.paused);
  }
  for(const line of root.querySelectorAll('.poem-line')) {
    const current=active!==null&&line.id===`line-${active}`;
    const changed=current&&!line.classList.contains('active');
    line.classList.toggle('active',current);
    if(current)line.setAttribute('aria-current','true');else line.removeAttribute('aria-current');
    if(changed)line.scrollIntoView({block:'center',behavior:reducedMotion?'auto':'smooth'});
  }
}
