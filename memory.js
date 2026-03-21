// 会話履歴・プロフィール・記憶のローカルストレージ管理 + Supabase同期
const Memory = (() => {
  const HISTORY_KEY      = 'nagaimo_history';
  const PROFILE_KEY      = 'nagaimo_profile';
  const PINS_KEY         = 'nagaimo_pins';
  const IDEAS_KEY        = 'nagaimo_ideas';
  const LOG_KEY          = 'nagaimo_log';
  const GOALS_KEY        = 'nagaimo_goals';
  const ROADMAP_INIT_KEY = 'nagaimo_roadmap_inited';
  const CHECKIN_DATE_KEY = 'nagaimo_checkin_date';

  // VTuberデビューまでのデフォルトロードマップ
  const VTUBER_ROADMAP = [
    'コンセプトを決める（どんなVTuberになりたいか）',
    'VTuber名・キャラクター名を決める',
    'キャラクタービジュアルのイメージを固める',
    'Live2Dモデルを依頼 or 自作するか決める',
    'マイクを用意する',
    'OBS Studioをインストール・設定する',
    'YouTubeチャンネルを開設する',
    'X（Twitter）アカウントを開設する',
    'チャンネルアート・アイコンを作る',
    'テスト配信を1回やってみる（非公開でOK）',
    '初配信の告知をする',
    '初配信をする！！',
  ];

  const MAX_MESSAGES  = 60;
  const CONTEXT_LIMIT = 50;

  // ===== 共通ユーティリティ =====
  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }
  function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function today() {
    return new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  // ===== Supabase同期（デバウンス1.5秒） =====
  let syncTimer = null;
  function scheduleSyncToSupabase() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
      try {
        const roomCode = SupabaseSync.getRoomCode();
        if (!roomCode) return;
        await SupabaseSync.saveRoom(roomCode, {
          profile: loadProfile(),
          pins:    loadPins(),
          ideas:   loadIdeas(),
          log:     loadLog(),
          goals:   loadGoals(),
          history: loadHistory()
        });
      } catch { /* オフライン時は無視 */ }
    }, 1500);
  }

  // Supabaseから取得したデータをlocalStorageに反映
  function loadFromSupabase(roomData) {
    if (!roomData) return;
    if (roomData.profile && typeof roomData.profile === 'object') save(PROFILE_KEY, roomData.profile);
    if (Array.isArray(roomData.pins))    save(PINS_KEY,    roomData.pins);
    if (Array.isArray(roomData.ideas))   save(IDEAS_KEY,   roomData.ideas);
    if (Array.isArray(roomData.log))     save(LOG_KEY,     roomData.log);
    if (Array.isArray(roomData.goals))   save(GOALS_KEY,   roomData.goals);
    if (Array.isArray(roomData.history)) save(HISTORY_KEY, roomData.history);
  }

  // ===== 会話履歴 =====
  function loadHistory() { return load(HISTORY_KEY, []); }
  function saveHistory(messages) { save(HISTORY_KEY, messages.slice(-MAX_MESSAGES)); }
  function addMessage(role, content) {
    const history = loadHistory();
    history.push({ role, content, ts: Date.now() });
    saveHistory(history);
    scheduleSyncToSupabase();
    return history;
  }
  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
    scheduleSyncToSupabase();
  }
  function removeLastMessage() {
    const history = loadHistory();
    if (history.length > 0) history.pop();
    saveHistory(history);
  }

  function getContextMessages() {
    const raw = loadHistory().slice(-CONTEXT_LIMIT);
    const sanitized = [];
    for (const m of raw) {
      const role = m.role === 'assistant' ? 'model' : 'user';
      if (sanitized.length > 0 && sanitized[sanitized.length - 1].role === role) {
        sanitized[sanitized.length - 1] = { role, parts: [{ text: m.content }] };
      } else {
        sanitized.push({ role, parts: [{ text: m.content }] });
      }
    }
    while (sanitized.length > 0 && sanitized[0].role !== 'user') sanitized.shift();
    return sanitized;
  }

  // ===== VTuberプロフィール =====
  function loadProfile() { return load(PROFILE_KEY, {}); }
  function saveProfile(profile) { save(PROFILE_KEY, profile); scheduleSyncToSupabase(); }

  // ===== ピン留め記憶 =====
  function loadPins() { return load(PINS_KEY, []); }
  function addPin(text) {
    const pins = loadPins();
    pins.unshift({ text: text.trim(), date: today() });
    save(PINS_KEY, pins.slice(0, 20));
    scheduleSyncToSupabase();
  }
  function removePin(index) {
    const pins = loadPins(); pins.splice(index, 1);
    save(PINS_KEY, pins); scheduleSyncToSupabase();
  }

  // ===== アイデアメモ =====
  function loadIdeas() { return load(IDEAS_KEY, []); }
  function addIdea(text) {
    const ideas = loadIdeas();
    ideas.unshift({ text: text.trim(), date: today() });
    save(IDEAS_KEY, ideas.slice(0, 100));
    scheduleSyncToSupabase();
  }
  function removeIdea(index) {
    const ideas = loadIdeas(); ideas.splice(index, 1);
    save(IDEAS_KEY, ideas); scheduleSyncToSupabase();
  }

  // ===== 活動ログ =====
  function loadLog() { return load(LOG_KEY, []); }
  function addLog(text) {
    const log = loadLog();
    log.unshift({ text: text.trim(), date: today() });
    save(LOG_KEY, log.slice(0, 200));
    scheduleSyncToSupabase();
  }
  function removeLog(index) {
    const log = loadLog(); log.splice(index, 1);
    save(LOG_KEY, log); scheduleSyncToSupabase();
  }

  // ===== VTuberロードマップ初期化 =====
  function initRoadmap() {
    if (localStorage.getItem(ROADMAP_INIT_KEY)) return; // 初期化済み
    if (loadGoals().length > 0) return;                 // 既存の目標がある場合はスキップ
    const goals = VTUBER_ROADMAP.map(text => ({ text, done: false, date: today(), roadmap: true }));
    save(GOALS_KEY, goals);
    localStorage.setItem(ROADMAP_INIT_KEY, '1');
    scheduleSyncToSupabase();
  }

  // ===== デイリーチェックイン =====
  function isFirstOpenToday() { return (localStorage.getItem(CHECKIN_DATE_KEY) || '') !== today(); }
  function markCheckinDone()  { localStorage.setItem(CHECKIN_DATE_KEY, today()); }

  // ===== 目標管理 =====
  function loadGoals() { return load(GOALS_KEY, []); }
  function addGoal(text) {
    const goals = loadGoals();
    goals.push({ text: text.trim(), done: false, date: today() });
    save(GOALS_KEY, goals); scheduleSyncToSupabase();
  }
  function toggleGoal(index) {
    const goals = loadGoals();
    if (goals[index]) goals[index].done = !goals[index].done;
    save(GOALS_KEY, goals); scheduleSyncToSupabase();
  }
  function removeGoal(index) {
    const goals = loadGoals(); goals.splice(index, 1);
    save(GOALS_KEY, goals); scheduleSyncToSupabase();
  }

  // ===== Gemini用システムコンテキスト構築 =====
  function buildSystemContext() {
    const profile = loadProfile();
    const pins    = loadPins();
    const allGoals = loadGoals();
    const doneGoals = allGoals.filter(g => g.done);
    const pendingGoals = allGoals.filter(g => !g.done);
    const nextTask = pendingGoals[0];
    let ctx = '';

    // VTuberプロジェクト進捗（最重要コンテキスト）
    if (allGoals.length > 0) {
      ctx += `\n\n## VTuberプロジェクト進捗`;
      ctx += `\n完了ステップ: ${doneGoals.length}/${allGoals.length}`;
      if (nextTask) ctx += `\n次のタスク: ${nextTask.text}`;
      if (doneGoals.length > 0) {
        ctx += `\n最近完了したこと: ${doneGoals.slice(-3).map(g => g.text).join('、')}`;
      }
      if (profile.debutDate) {
        const days = Math.ceil((new Date(profile.debutDate) - new Date()) / 86400000);
        if (days > 0) ctx += `\nデビューまで残り${days}日`;
        else if (days <= 0) ctx += `\nデビュー予定日を過ぎています！`;
      }
    }

    // プロフィール
    const hasProfile = Object.values(profile).some(v => v && String(v).trim());
    if (hasProfile) {
      ctx += '\n\n## 飼い主のVTuber情報';
      if (profile.vtubeName) ctx += `\nVTuber名: ${profile.vtubeName}`;
      if (profile.concept)   ctx += `\nコンセプト: ${profile.concept}`;
      if (profile.genre)     ctx += `\nジャンル: ${profile.genre}`;
      if (profile.debutDate) ctx += `\n初配信予定: ${profile.debutDate}`;
      if (profile.goal)      ctx += `\n目標: ${profile.goal}`;
      if (profile.notes)     ctx += `\nメモ: ${profile.notes}`;
    }

    if (pins.length > 0) {
      ctx += '\n\n## 必ず覚えておくこと';
      pins.forEach(p => { ctx += `\n・${p.text}`; });
    }

    return ctx;
  }

  return {
    loadHistory, addMessage, removeLastMessage, clearHistory, getContextMessages,
    loadProfile, saveProfile,
    loadPins, addPin, removePin,
    loadIdeas, addIdea, removeIdea,
    loadLog, addLog, removeLog,
    loadGoals, addGoal, toggleGoal, removeGoal,
    buildSystemContext, loadFromSupabase,
    initRoadmap, isFirstOpenToday, markCheckinDone
  };
})();
