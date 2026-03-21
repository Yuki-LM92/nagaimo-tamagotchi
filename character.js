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
    c.classList.remove('idle', 'talking', 'happy', 'thinking', 'love', 'dancing', 'surprised', 'glitch');
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

  function glitch() {
    clearIdleTimer();
    thinkingDots()?.classList.add('hidden');
    setState('glitch');
    showEmotion('⚡');
    idleTimer = setTimeout(() => idle(), 700);
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

    // フォントサイズをリセットしてテキストをセット（先頭末尾の空白・改行を除去）
    st.style.fontSize = '';
    st.textContent = text.trim();
    bubble.classList.remove('hidden');

    // シュリンクトゥフィット: max-heightに収まるまで文字を縮小
    const maxH = parseInt(getComputedStyle(bubble).maxHeight) || 120;
    const BASE_PX = parseFloat(getComputedStyle(st).fontSize) || 9.9;
    let size = BASE_PX;
    while (bubble.scrollHeight > maxH && size > 6) {
      size -= 0.5;
      st.style.fontSize = size + 'px';
    }
  }

  function hideBubble() {
    speechBubble()?.classList.add('hidden');
    thinkingDots()?.classList.add('hidden');
  }

  // タップ反応
  const TAP_REACTIONS = [
    { fn: () => happy(),    text: 'なんだい、元気？' },
    { fn: () => love(),     text: 'タップしてくれると嬉しい…' },
    { fn: () => excited(),  text: 'おっ！' },
    { fn: () => surprised(),text: 'わっ、びっくりした！' },
    { fn: () => dancing(),  text: 'テンション上がってきた〜' },
    { fn: () => blush(),    text: 'そんなに見つめないでくれ…' },
    { fn: () => sleepy(),   text: 'うーん…ちょっと眠い' },
    { fn: () => happy(),    text: '長芋最高だろ？' },
    { fn: () => love(),     text: 'おれのこと好き？' },
    { fn: () => excited(),  text: 'なんか用？' },
  ];

  let lastTapIndex = -1;

  function onTap() {
    // 直前と同じリアクションを連続させない
    let idx;
    do { idx = Math.floor(Math.random() * TAP_REACTIONS.length); }
    while (idx === lastTapIndex && TAP_REACTIONS.length > 1);
    lastTapIndex = idx;

    const { fn, text } = TAP_REACTIONS[idx];
    fn();
    talk(text, 3000);
  }

  function setupTap() {
    const wrapper = document.getElementById('character-wrapper');
    if (!wrapper) return;
    wrapper.style.cursor = 'pointer';
    wrapper.addEventListener('click', onTap);
  }

  return { idle, think, talk, happy, sleepy, excited, blush, glitch, love, dancing, surprised, showBubble, hideBubble, setupTap };
})();

// ===== 生活シミュレーター =====
const LifeSim = (() => {
  let running   = false;
  let nextTimer = null;
  let endTimer  = null;

  const ACTS = [
    { name:'eat',   dur:10000, item:'🍠',    msg:'もぐもぐ…長芋うまっ',   anim:'happy'   },
    { name:'sleep', dur:18000, item:'💤',    msg:'zzz…すやすや…',         anim:'sleepy'  },
    { name:'dance', dur:7000,  item:'🎵',    msg:'踊るぜ〜♪',             anim:'dancing' },
    { name:'water', dur:9000,  item:'🪴💧',  msg:'長芋に水やり中…',        anim:'happy'   },
    { name:'read',  dur:11000, item:'📚',    msg:'VTuberの研究してる…',    anim:'blush'   },
    { name:'watch', dur:9000,  item:'📺',    msg:'配信見てる〜',            anim:'excited' },
    { name:'cook',  dur:10000, item:'🍲',    msg:'長芋料理つくってるぞ',    anim:'happy'   },
    { name:'nap',   dur:12000, item:'🛏️',   msg:'ちょっと昼寝…',          anim:'sleepy'  },
  ];

  function setItem(text) {
    const el = document.getElementById('activity-item');
    if (el) el.textContent = text || '';
  }

  function pick() {
    const h = new Date().getHours();
    let names;
    if      (h >= 23 || h < 6)  names = ['sleep','sleep','sleep','nap','eat'];
    else if (h >= 6  && h < 10) names = ['eat','eat','cook','water','dance'];
    else if (h >= 10 && h < 12) names = ['read','water','dance','watch'];
    else if (h >= 12 && h < 14) names = ['eat','cook','nap','nap'];
    else if (h >= 14 && h < 18) names = ['watch','read','water','dance','cook'];
    else if (h >= 18 && h < 20) names = ['eat','cook','watch','dance'];
    else                         names = ['watch','read','dance','sleep'];
    const name = names[Math.floor(Math.random() * names.length)];
    return ACTS.find(a => a.name === name) || ACTS[0];
  }

  function run() {
    if (!running) return;
    const act = pick();
    Character.talk(act.msg, act.dur - 1500);
    // sleepyは自動でidle復帰するので複数回呼ぶ
    if (act.anim === 'sleepy') {
      Character.sleepy();
      setTimeout(() => running && Character.sleepy(), 4500);
      setTimeout(() => running && Character.sleepy(), 9000);
    } else {
      Character[act.anim]?.();
    }
    setItem(act.item);
    endTimer = setTimeout(() => {
      setItem('');
      Character.idle();
      schedule();
    }, act.dur);
  }

  function schedule() {
    if (!running) return;
    // 2〜5分後に次のアクティビティ
    const delay = 120000 + Math.random() * 180000;
    nextTimer = setTimeout(run, delay);
  }

  function start() {
    if (running) return;
    running = true;
    // 最初は30秒後
    nextTimer = setTimeout(run, 30000);
  }

  function stop() {
    running = false;
    clearTimeout(nextTimer);
    clearTimeout(endTimer);
    setItem('');
  }

  return { start, stop };
})();
