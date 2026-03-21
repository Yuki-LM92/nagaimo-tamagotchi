// キャラクターのアニメーション制御
const Character = (() => {
  const el = () => document.getElementById('character');
  const speechBubble = () => document.getElementById('speech-bubble');
  const speechText = () => document.getElementById('speech-text');
  const thinkingDots = () => document.getElementById('thinking-dots');

  let idleTimer = null;
  let bubbleTimer = null;

  function setState(state) {
    const c = el();
    if (!c) return;
    // 既存のアニメーションクラスを全て除去
    c.classList.remove('idle', 'talking', 'happy', 'thinking', 'love', 'dancing', 'surprised');
    // 一度外して再付与することでアニメーションをリセット
    void c.offsetWidth;
    c.classList.add(state);
  }

  function clearIdleTimer() {
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  }

  function clearBubbleTimer() {
    if (bubbleTimer) { clearTimeout(bubbleTimer); bubbleTimer = null; }
  }

  function idle() {
    clearIdleTimer();
    setState('idle');
  }

  function think() {
    clearIdleTimer();
    setState('thinking');
    thinkingDots()?.classList.remove('hidden');
  }

  function talk(text, duration = 5000) {
    clearIdleTimer();
    clearBubbleTimer();
    thinkingDots()?.classList.add('hidden');

    setState('talking');
    showBubble(text);

    // talking -> idle
    idleTimer = setTimeout(() => {
      setState('idle');
    }, 1500);

    // 吹き出しを一定時間後に消す
    bubbleTimer = setTimeout(() => {
      hideBubble();
    }, duration);
  }

  function happy() {
    clearIdleTimer();
    thinkingDots()?.classList.add('hidden');
    setState('happy');
    idleTimer = setTimeout(() => idle(), 1600);
  }

  function sleepy() {
    clearIdleTimer();
    thinkingDots()?.classList.add('hidden');
    setState('sleepy');
    showEmotion('💤');
    idleTimer = setTimeout(() => idle(), 4200);
  }

  function excited() {
    clearIdleTimer();
    thinkingDots()?.classList.add('hidden');
    setState('excited');
    showEmotion('⚡');
    idleTimer = setTimeout(() => idle(), 2200);
  }

  function blush() {
    clearIdleTimer();
    thinkingDots()?.classList.add('hidden');
    setState('blush');
    showEmotion('💗');
    idleTimer = setTimeout(() => idle(), 2000);
  }

  function love() {
    clearIdleTimer();
    thinkingDots()?.classList.add('hidden');
    setState('love');
    showEmotion('💖');
    idleTimer = setTimeout(() => idle(), 2600);
  }

  function dancing() {
    clearIdleTimer();
    thinkingDots()?.classList.add('hidden');
    setState('dancing');
    showEmotion('🎵');
    idleTimer = setTimeout(() => idle(), 3200);
  }

  function surprised() {
    clearIdleTimer();
    thinkingDots()?.classList.add('hidden');
    setState('surprised');
    showEmotion('😲');
    idleTimer = setTimeout(() => idle(), 1400);
  }

  function showEmotion(emoji) {
    const ov = document.getElementById('emotion-overlay');
    if (!ov) return;
    ov.textContent = emoji;
    ov.classList.remove('show');
    void ov.offsetWidth;
    ov.classList.add('show');
  }

  function showBubble(text) {
    const bubble = speechBubble();
    const st = speechText();
    if (!bubble || !st) return;
    st.textContent = text;
    bubble.classList.remove('hidden');
  }

  function hideBubble() {
    speechBubble()?.classList.add('hidden');
    thinkingDots()?.classList.add('hidden');
  }

  return { idle, think, talk, happy, sleepy, excited, blush, love, dancing, surprised, showBubble, hideBubble };
})();
