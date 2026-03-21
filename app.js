// メインアプリケーション
const App = (() => {

  // ===== 状態 =====
  let isSending  = false;
  let convCount  = 0;
  const CHAR_SRC_KEY  = 'nagaimo_char_src';
  const RARE_STATES   = ['sleepy', 'excited', 'blush', 'dancing', 'surprised', 'love', 'glitch'];

  // ===== DOM要素 =====
  const $ = id => document.getElementById(id);

  const setupScreen   = $('setup-screen');
  const appEl         = $('app');
  const apiKeyInput   = $('api-key-input');
  const saveApiKeyBtn = $('save-api-key-btn');
  const messagesEl    = $('messages');
  const userInput     = $('user-input');
  const sendBtn       = $('send-btn');
  const settingsBtn   = $('settings-btn');
  const settingsModal = $('settings-modal');
  const settingsApiInput  = $('settings-api-input');
  const settingsSaveBtn   = $('settings-save-btn');
  const settingsClearBtn  = $('settings-clear-btn');
  const settingsCloseBtn  = $('settings-close-btn');

  // ===== 初期化 =====
  function init() {
    const apiKey = Memory.loadApiKey();

    if (apiKey) {
      showApp();
    } else {
      showSetup();
    }

    bindEvents();
    Character.idle();
  }

  function showSetup() {
    setupScreen.classList.remove('hidden');
    appEl.classList.add('hidden');
  }

  function showApp() {
    setupScreen.classList.add('hidden');
    appEl.classList.remove('hidden');
    applyCustomChar();
    renderHistory();
    scrollToBottom();
    initSceneSelector();

    // 初回挨拶（履歴が空のとき）
    if (Memory.loadHistory().length === 0) {
      setTimeout(() => {
        Character.talk('よっ、ながいもくんだ。なんでも話しかけてくれ。', 6000);
      }, 600);
    }
  }

  // ===== イベント =====
  function bindEvents() {
    // APIキー保存
    saveApiKeyBtn.addEventListener('click', handleSaveApiKey);
    apiKeyInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleSaveApiKey();
    });

    // メッセージ送信
    sendBtn.addEventListener('click', handleSend);
    userInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    // 設定
    settingsBtn.addEventListener('click', () => {
      settingsModal.classList.remove('hidden');
      updateCharPreview();
    });
    settingsSaveBtn.addEventListener('click', handleSettingsSave);
    settingsClearBtn.addEventListener('click', handleClearHistory);
    settingsCloseBtn.addEventListener('click', () => {
      settingsModal.classList.add('hidden');
    });
    settingsModal.addEventListener('click', e => {
      if (e.target === settingsModal) settingsModal.classList.add('hidden');
    });

    // キャラ着せ替え
    $('char-file-input')?.addEventListener('change', handleCharFileChange);
    $('char-reset-btn')?.addEventListener('click', handleCharReset);

    // スタンプ
    $('stamps-bar')?.addEventListener('click', e => {
      const btn = e.target.closest('.stamp');
      if (btn?.dataset.msg && !isSending) {
        userInput.value = btn.dataset.msg;
        handleSend();
      }
    });
  }

  function handleSaveApiKey() {
    const key = apiKeyInput.value.trim();
    if (!key) { shake(apiKeyInput); return; }
    Memory.saveApiKey(key);
    showApp();
  }

  async function handleSend() {
    const text = userInput.value.trim();
    if (!text || isSending) return;

    const apiKey = Memory.loadApiKey();
    if (!apiKey) { showSetup(); return; }

    isSending = true;
    sendBtn.disabled = true;
    userInput.value = '';

    // ユーザーメッセージを表示・保存
    addMessageToUI('user', text);
    Memory.addMessage('user', text);
    scrollToBottom();

    // タイピングインジケーター表示 & 考え中
    showTypingIndicator();
    Character.think();

    try {
      const context = Memory.getContextMessages();
      // 最後に追加したユーザーメッセージは getContextMessages() に含まれるので
      // gemini.js 側では context + userMessage を結合して送る形に合わせる
      // ただし context は Memory.addMessage 後に取得しているため末尾に user が含まれる
      // → gemini.js の chat() はcontextMessagesにuserMessageを追加するので、
      //   ここでは userMessage を除いたコンテキストを渡す
      const contextWithoutLast = context.slice(0, -1);
      const reply = await GeminiAPI.chat(apiKey, contextWithoutLast, text);

      hideTypingIndicator();

      // 返答を表示・保存
      Memory.addMessage('assistant', reply);
      addMessageToUI('assistant', reply);
      scrollToBottom();

      // キャラのリアクション
      Character.talk(truncateForBubble(reply), 6000);

      // キャラのリアクション（優先度順）
      const combined = text + reply;
      if (/長芋|ながいも|やま芋|やまいも/i.test(combined)) {
        // 長芋ワード → はしゃいでハートバースト
        setTimeout(() => {
          Character.happy();
          const charEl = document.getElementById('character');
          if (charEl) {
            const rect = charEl.getBoundingClientRect();
            Particles.burstHearts(
              rect.left + rect.width  * 0.5,
              rect.top  + rect.height * 0.35,
              12
            );
          }
        }, 200);
      } else if (/好き|大好き|ありがとう|かわいい|すき|嬉しい|うれしい/i.test(combined)) {
        setTimeout(() => Character.love(), 300);
      } else if (/踊|ダンス|音楽|歌|うた|ライブ|配信|VTuber|vtuber/i.test(combined)) {
        setTimeout(() => Character.dancing(), 300);
      } else if (/びっくり|驚|まじか|えー|うそ|マジ|まじ|なんと|信じられない/i.test(combined)) {
        setTimeout(() => Character.surprised(), 300);
      } else {
        // レアリアクション（数回に一度ランダム発動）
        convCount++;
        if (convCount >= 3 && Math.random() < 0.30) {
          convCount = 0;
          const r = RARE_STATES[Math.floor(Math.random() * RARE_STATES.length)];
          setTimeout(() => Character[r]?.(), 1400);
        }
      }

    } catch (err) {
      hideTypingIndicator();
      const errMsg = friendlyError(err.message);
      addMessageToUI('assistant', errMsg);
      scrollToBottom();
      Character.glitch();
      setTimeout(() => Character.talk('うっ…うまく返せなかった', 3000), 800);
    } finally {
      isSending = false;
      sendBtn.disabled = false;
      userInput.focus();
    }
  }

  function handleSettingsSave() {
    const key = settingsApiInput.value.trim();
    if (!key) { shake(settingsApiInput); return; }
    Memory.saveApiKey(key);
    settingsApiInput.value = '';
    settingsModal.classList.add('hidden');
    Character.happy();
    Character.talk('APIキー更新したよ！', 3000);
  }

  function handleClearHistory() {
    if (!confirm('会話履歴を全部消しますか？元には戻せません。')) return;
    Memory.clearHistory();
    messagesEl.innerHTML = '';
    settingsModal.classList.add('hidden');
    Character.talk('あ…全部忘れちゃった。でもまたよろしく。', 5000);
  }

  // ===== UI操作 =====
  function addMessageToUI(role, content) {
    const div = document.createElement('div');
    div.classList.add('message', role);

    const sender = document.createElement('div');
    sender.classList.add('sender');
    sender.textContent = role === 'user' ? 'あなた' : 'ながいもくん';

    const body = document.createElement('div');
    body.textContent = content;

    // 長押し / 右クリックでコピー
    let pressTimer = null;
    body.addEventListener('touchstart', () => {
      pressTimer = setTimeout(() => copyMsg(content), 600);
    }, { passive: true });
    body.addEventListener('touchend',  () => clearTimeout(pressTimer));
    body.addEventListener('touchmove', () => clearTimeout(pressTimer), { passive: true });
    body.addEventListener('contextmenu', e => { e.preventDefault(); copyMsg(content); });

    div.appendChild(sender);
    div.appendChild(body);
    messagesEl.appendChild(div);
  }

  function renderHistory() {
    messagesEl.innerHTML = '';
    Memory.loadHistory().forEach(m => {
      addMessageToUI(m.role === 'model' ? 'assistant' : m.role, m.content);
    });
  }

  function scrollToBottom() {
    const section = document.getElementById('chat-section');
    if (section) section.scrollTop = section.scrollHeight;
  }

  function truncateForBubble(text, max = 60) {
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  function shake(el) {
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = 'shake 0.4s ease';
    el.addEventListener('animationend', () => { el.style.animation = ''; }, { once: true });
  }

  function friendlyError(msg) {
    if (msg.includes('API_KEY') || msg.includes('401') || msg.includes('API key'))
      return '…APIキーが合ってないっぽい。設定で確認してみて。';
    if (msg.includes('quota') || msg.includes('429'))
      return 'ちょっと疲れた。少ししてからもう一回話しかけて。';
    if (msg.includes('network') || msg.toLowerCase().includes('fetch'))
      return 'ネット繋がってるか確認してくれる？';
    return '…うまく答えられなかった。もう一回試してみて。';
  }

  // ===== タイピングインジケーター =====
  function showTypingIndicator() {
    hideTypingIndicator();
    const div = document.createElement('div');
    div.id = 'typing-indicator';
    div.classList.add('message', 'assistant', 'typing-msg');
    const sender = document.createElement('div');
    sender.classList.add('sender');
    sender.textContent = 'ながいもくん';
    const dots = document.createElement('div');
    dots.classList.add('typing-dots');
    dots.innerHTML = '<span></span><span></span><span></span>';
    div.appendChild(sender);
    div.appendChild(dots);
    messagesEl.appendChild(div);
    scrollToBottom();
  }

  function hideTypingIndicator() {
    $('typing-indicator')?.remove();
  }

  // ===== シーン背景 =====
  const SCENE_KEY = 'nagaimo_scene';
  const DEFAULT_SCENE = 'scene-farm';

  const VALID_SCENES = ['scene-farm', 'scene-flowers', 'scene-space', 'scene-night', 'scene-cyber', 'scene-beach'];

  function initSceneSelector() {
    let saved = localStorage.getItem(SCENE_KEY) || DEFAULT_SCENE;
    if (!VALID_SCENES.includes(saved)) saved = DEFAULT_SCENE;
    setScene(saved);

    $('bg-selector')?.addEventListener('click', e => {
      const btn = e.target.closest('.bg-btn');
      if (btn?.dataset.scene) setScene(btn.dataset.scene);
    });
  }

  function setScene(scene) {
    const bg = $('scene-bg');
    if (!bg) return;
    bg.className = scene;
    localStorage.setItem(SCENE_KEY, scene);

    // アクティブボタンを強調
    document.querySelectorAll('.bg-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.scene === scene);
    });
  }

  // ===== キャラ着せ替え =====
  function applyCustomChar() {
    const src = localStorage.getItem(CHAR_SRC_KEY);
    const el = $('character');
    if (el) el.src = src || 'assets/nagaimo.svg';
  }

  function updateCharPreview() {
    const p = $('char-preview');
    if (p) p.src = localStorage.getItem(CHAR_SRC_KEY) || 'assets/nagaimo.svg';
  }

  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  function handleCharFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      alert('対応形式はJPEG・PNG・GIF・WebPのみです');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('画像は5MB以下にしてください');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target.result;
      localStorage.setItem(CHAR_SRC_KEY, dataUrl);
      const el = $('character');
      if (el) el.src = dataUrl;
      updateCharPreview();
      Character.happy();
      Character.talk('着せ替えた！かわいいな。', 3000);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function handleCharReset() {
    localStorage.removeItem(CHAR_SRC_KEY);
    const el = $('character');
    if (el) el.src = 'assets/nagaimo.svg';
    updateCharPreview();
    Character.talk('元の長芋に戻った！', 3000);
  }

  // ===== コピー =====
  function copyMsg(text) {
    navigator.clipboard?.writeText(text)
      .then(() => showToast('コピーした！'))
      .catch(() => {});
  }

  function showToast(msg) {
    let toast = $('copy-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'copy-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1800);
  }

  return { init };
})();

// ===== CSS: シェイクアニメーション追加 =====
(function() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%,100% { transform: translateX(0); }
      20%      { transform: translateX(-6px); }
      40%      { transform: translateX(6px); }
      60%      { transform: translateX(-4px); }
      80%      { transform: translateX(4px); }
    }
  `;
  document.head.appendChild(style);
})();

// ===== 起動 =====
document.addEventListener('DOMContentLoaded', () => {
  Particles.setup();
  App.init();
});

// ===== Service Worker 登録（HTTPS / localhost のみ動作） =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
