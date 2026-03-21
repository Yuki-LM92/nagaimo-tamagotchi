// 会話履歴・プロフィール・記憶のローカルストレージ管理 + Supabase同期
const Memory = (() => {
  const HISTORY_KEY = 'nagaimo_history';
  const PROFILE_KEY = 'nagaimo_profile';
  const PINS_KEY    = 'nagaimo_pins';
  const IDEAS_KEY   = 'nagaimo_ideas';
  const LOG_KEY     = 'nagaimo_log';
  const GOALS_KEY   = 'nagaimo_goals';

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
    const goals   = loadGoals().filter(g => !g.done);
    let ctx = '';
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
    if (goals.length > 0) {
      ctx += '\n\n## 飼い主の未達成の目標';
      goals.forEach(g => { ctx += `\n・${g.text}`; });
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
    buildSystemContext, loadFromSupabase
  };
})();
