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
  const messagesEl    = $('messages');
  const userInput     = $('user-input');
  const sendBtn       = $('send-btn');
  const settingsBtn   = $('settings-btn');
  const settingsModal = $('settings-modal');
  const settingsClearBtn  = $('settings-clear-btn');
  const settingsCloseBtn  = $('settings-close-btn');

  // ===== 初期化 =====
  async function init() {
    bindEvents();
    Character.idle();
    Character.setupTap();

    const roomCode = SupabaseSync.getRoomCode();
    if (roomCode) {
      await syncAndShowApp(roomCode);
    } else {
      showSetup();
    }
  }

  async function syncAndShowApp(roomCode) {
    try {
      const roomData = await SupabaseSync.fetchRoom(roomCode);
      if (roomData) {
        Memory.loadFromSupabase(roomData);
      }
    } catch { /* オフライン時はlocalStorageのデータを使用 */ }
    showApp();
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

    // VTuberロードマップ初期化（初回のみ）
    Memory.initRoadmap();

    // 初回挨拶 or デイリーチェックイン
    if (Memory.loadHistory().length === 0) {
      // 初めて開いた場合
      setTimeout(() => {
        Character.happy();
        Character.talk('よっ、ながいもくんだ。なんでも話しかけてくれ。おれずっとここにいるよ。', 8000);
      }, 600);
    } else if (Memory.isFirstOpenToday()) {
      // 今日初めて開いた場合（デイリーチェックイン）
      Memory.markCheckinDone();
      setTimeout(() => dailyCheckin(), 1500);
    }

    // 生活シミュレーター開始
    LifeSim.start();
  }

  function dailyCheckin() {
    const goals = Memory.loadGoals();
    const done  = goals.filter(g => g.done).length;
    const total = goals.length;

    // 進捗チェックではなく「今日も来てくれた」という歓迎メッセージ
    const pool = done === total && total > 0
      ? [
          'デビューまでもうすぐだな。楽しみにしてるぞ。',
          'いつ来ても待ってるよ。何でも話して。',
        ]
      : [
          '今日も来たね。何かあったら話しかけてくれ。',
          'おれここにいるよ。ゆっくりしてって。',
          'よっ。今日どんな日だった？',
          'いつでもいるから、気が向いたら話しかけてくれ。',
          '来てくれて嬉しい。何でも話してね。',
          'おれ待ってたよ。今日もいい日にしよう。',
        ];

    const msg = pool[Math.floor(Math.random() * pool.length)];
    Character.talk(msg, 7000);
  }

  // ===== イベント =====
  function bindEvents() {
    // ルームコード保存
    $('save-room-code-btn')?.addEventListener('click', handleSaveRoomCode);
    $('room-code-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleSaveRoomCode();
    });

    // メッセージ送信
    sendBtn.addEventListener('click', handleSend);
    userInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    // 設定モーダルを開く
    settingsBtn.addEventListener('click', () => {
      settingsModal.classList.remove('hidden');
      updateCharPreview();
      loadProfileToForm();
      renderPins();
      renderIdeas();
      renderLog();
      renderGoals();
    });
    settingsClearBtn.addEventListener('click', handleClearHistory);
    settingsCloseBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
    settingsModal.addEventListener('click', e => {
      if (e.target === settingsModal) settingsModal.classList.add('hidden');
    });
    $('settings-test-btn')?.addEventListener('click', handleApiTest);
    $('api-test-copy-btn')?.addEventListener('click', () => {
      copyMsg($('api-test-text')?.textContent || '');
    });

    // タブ切り替え
    settingsModal.querySelectorAll('.modal-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // プロフィール保存
    $('profile-save-btn')?.addEventListener('click', handleProfileSave);

    // ピン留め記憶
    $('pin-add-btn')?.addEventListener('click', handlePinAdd);
    $('pin-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') handlePinAdd(); });

    // アイデアメモ
    $('idea-add-btn')?.addEventListener('click', handleIdeaAdd);
    $('idea-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') handleIdeaAdd(); });

    // 活動ログ
    $('log-add-btn')?.addEventListener('click', handleLogAdd);
    $('log-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogAdd(); });

    // 目標管理
    $('goal-add-btn')?.addEventListener('click', handleGoalAdd);
    $('goal-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') handleGoalAdd(); });

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

  async function handleSaveRoomCode() {
    const input = $('room-code-input');
    const code = input?.value.trim();
    if (!code) { shake(input); return; }
    SupabaseSync.saveRoomCode(code);
    await syncAndShowApp(code);
  }

  async function handleSend() {
    const text = userInput.value.trim();
    if (!text || isSending) return;

    isSending = true;
    sendBtn.disabled = true;
    userInput.value = '';

    // ユーザーメッセージをUIに表示（履歴保存はAPI成功後）
    addMessageToUI('user', text);
    scrollToBottom();

    // タイピングインジケーター表示 & 考え中
    showTypingIndicator();
    Character.think();

    try {
      const context = Memory.getContextMessages();
      const extraContext = Memory.buildSystemContext();
      const reply = await GeminiAPI.chat(null, context, text, extraContext);

      hideTypingIndicator();

      // API成功後に両方を保存
      Memory.addMessage('user', text);
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
      const errMsg = friendlyError(err?.message || '');
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

  async function handleApiTest() {
    const wrapEl = $('api-test-result');
    const textEl = $('api-test-text');
    if (!wrapEl || !textEl) return;
    wrapEl.style.display = 'block';
    textEl.style.color = '#aaa';
    textEl.textContent = '接続テスト中...';
    try {
      const { model, reply } = await GeminiAPI.test();
      textEl.style.color = '#0f0';
      textEl.textContent = '✅ 成功\nモデル: ' + model + '\n返答: ' + reply;
    } catch (err) {
      textEl.style.color = '#f66';
      textEl.textContent = '❌ エラー:\n' + (err?.message || String(err));
    }
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

    // アシスタントメッセージにアクションボタンを追加
    if (role === 'assistant') {
      const actions = document.createElement('div');
      actions.classList.add('msg-actions');

      const ideaBtn = document.createElement('button');
      ideaBtn.classList.add('msg-action-btn');
      ideaBtn.title = 'アイデアとして保存';
      ideaBtn.textContent = '💡';
      ideaBtn.addEventListener('click', () => {
        Memory.addIdea(content);
        showToast('💡 アイデアに保存した！');
      });

      const pinBtn = document.createElement('button');
      pinBtn.classList.add('msg-action-btn');
      pinBtn.title = '記憶メモに追加';
      pinBtn.textContent = '📌';
      pinBtn.addEventListener('click', () => {
        Memory.addPin(content.slice(0, 100));
        showToast('📌 記憶に追加した！');
      });

      actions.appendChild(ideaBtn);
      actions.appendChild(pinBtn);
      div.appendChild(actions);
    }

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

  function truncateForBubble(text, max = 38) {
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  function shake(el) {
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = 'shake 0.4s ease';
    el.addEventListener('animationend', () => { el.style.animation = ''; }, { once: true });
  }

  function friendlyError(msg) {
    if (!msg) return '…うまく答えられなかった。もう一回試してみて。';
    const m = msg.toLowerCase();
    if (m.includes('api_key') || m.includes('401') || m.includes('api key') || m.includes('invalid_api_key'))
      return '…APIキーが合ってないっぽい。設定で確認してみて。';
    if (m.includes('limit: 0') || (m.includes('resource_exhausted') && m.includes('limit: 0')))
      return 'APIキーにクォータがないみたい。aistudio.google.com で新しいキーを作って設定してみて。';
    if (m.includes('quota') || m.includes('429') || m.includes('resource_exhausted'))
      return 'ちょっと疲れた。少ししてからもう一回話しかけて。';
    if (m.includes('network') || m.includes('fetch') || m.includes('failed to fetch'))
      return 'ネット繋がってるか確認してくれる？';
    if (m.includes('invalid_argument') || m.includes('invalid value') || m.includes('invalid json'))
      return '…送り方がおかしかったみたい。もう一回試してみて。';
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

  const VALID_SCENES = ['scene-room', 'scene-farm', 'scene-flowers', 'scene-space', 'scene-night', 'scene-cyber', 'scene-beach'];

  function initSceneSelector() {
    let saved = localStorage.getItem(SCENE_KEY);
    if (!saved) {
      // デスクトップはおうちシーンをデフォルトに
      saved = window.innerWidth >= 768 ? 'scene-room' : DEFAULT_SCENE;
    }
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

    // 室内家具の表示切り替え
    const furniture = $('room-furniture');
    if (furniture) furniture.classList.toggle('visible', scene === 'scene-room');

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

  // ===== タブ切り替え =====
  function switchTab(tabId) {
    settingsModal.querySelectorAll('.modal-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    settingsModal.querySelectorAll('.tab-content').forEach(pane => {
      pane.classList.toggle('hidden', pane.id !== tabId);
    });
  }

  // ===== プロフィール =====
  function loadProfileToForm() {
    const p = Memory.loadProfile();
    const set = (id, val) => { const el = $(id); if (el) el.value = val || ''; };
    set('profile-name',    p.vtubeName);
    set('profile-concept', p.concept);
    set('profile-genre',   p.genre);
    set('profile-debut',   p.debutDate);
    set('profile-goal',    p.goal);
    set('profile-notes',   p.notes);
  }

  function handleProfileSave() {
    const get = id => $(id)?.value.trim() || '';
    Memory.saveProfile({
      vtubeName: get('profile-name'),
      concept:   get('profile-concept'),
      genre:     get('profile-genre'),
      debutDate: get('profile-debut'),
      goal:      get('profile-goal'),
      notes:     get('profile-notes')
    });
    showToast('💾 プロフィールを保存した！');
    Character.happy();
    Character.talk('おれ、ちゃんと覚えたよ。任せて！', 4000);
  }

  // ===== 汎用リスト描画 =====
  function renderItemList(containerId, items, renderFn) {
    const el = $(containerId);
    if (!el) return;
    el.innerHTML = '';
    if (items.length === 0) {
      el.innerHTML = '<div class="list-empty">まだ何もない</div>';
      return;
    }
    items.forEach((item, i) => el.appendChild(renderFn(item, i)));
  }

  function makeDelBtn(onClick) {
    const btn = document.createElement('button');
    btn.classList.add('item-del');
    btn.textContent = '✕';
    btn.addEventListener('click', onClick);
    return btn;
  }

  function makeItemRow(text, date, delFn) {
    const row = document.createElement('div');
    row.classList.add('item-row');
    const span = document.createElement('span');
    span.classList.add('item-text');
    span.textContent = text;
    const dateEl = document.createElement('span');
    dateEl.classList.add('item-date');
    dateEl.textContent = date || '';
    row.appendChild(span);
    row.appendChild(dateEl);
    row.appendChild(makeDelBtn(delFn));
    return row;
  }

  // ===== ピン留め =====
  function renderPins() {
    renderItemList('pins-list', Memory.loadPins(), (item, i) =>
      makeItemRow(item.text, item.date, () => { Memory.removePin(i); renderPins(); })
    );
  }
  function handlePinAdd() {
    const input = $('pin-input');
    const text = input?.value.trim();
    if (!text) return;
    Memory.addPin(text);
    input.value = '';
    renderPins();
    showToast('📌 記憶に追加した！');
  }

  // ===== アイデアメモ =====
  function renderIdeas() {
    renderItemList('ideas-list', Memory.loadIdeas(), (item, i) =>
      makeItemRow(item.text, item.date, () => { Memory.removeIdea(i); renderIdeas(); })
    );
  }
  function handleIdeaAdd() {
    const input = $('idea-input');
    const text = input?.value.trim();
    if (!text) return;
    Memory.addIdea(text);
    input.value = '';
    renderIdeas();
    showToast('💡 アイデアを保存した！');
  }

  // ===== 活動ログ =====
  function renderLog() {
    renderItemList('log-list', Memory.loadLog(), (item, i) =>
      makeItemRow(item.text, item.date, () => { Memory.removeLog(i); renderLog(); })
    );
  }
  function handleLogAdd() {
    const input = $('log-input');
    const text = input?.value.trim();
    if (!text) return;
    Memory.addLog(text);
    input.value = '';
    renderLog();
    showToast('📅 ログを記録した！');
  }

  // ===== 目標管理 =====
  function renderGoals() {
    renderItemList('goals-list', Memory.loadGoals(), (item, i) => {
      const row = document.createElement('div');
      row.classList.add('item-row');
      if (item.done) row.classList.add('done');

      const check = document.createElement('button');
      check.classList.add('goal-check');
      check.textContent = item.done ? '✅' : '⬜';
      check.addEventListener('click', () => {
        const wasDone = item.done;
        Memory.toggleGoal(i);
        renderGoals();
        if (!wasDone) {
          Character.happy();
          Character.talk('やった！達成じゃん！', 4000);
        }
      });

      const span = document.createElement('span');
      span.classList.add('item-text');
      span.textContent = item.text;

      const dateEl = document.createElement('span');
      dateEl.classList.add('item-date');
      dateEl.textContent = item.date || '';

      row.appendChild(check);
      row.appendChild(span);
      row.appendChild(dateEl);
      row.appendChild(makeDelBtn(() => { Memory.removeGoal(i); renderGoals(); }));
      return row;
    });
  }
  function handleGoalAdd() {
    const input = $('goal-input');
    const text = input?.value.trim();
    if (!text) return;
    Memory.addGoal(text);
    input.value = '';
    renderGoals();
    showToast('✅ 目標を追加した！');
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
