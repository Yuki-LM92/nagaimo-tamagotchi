// 会話履歴・プロフィール・記憶のローカルストレージ管理
const Memory = (() => {
  const HISTORY_KEY = 'nagaimo_history';
  const API_KEY_KEY = 'nagaimo_apikey';
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

  // ===== 会話履歴 =====
  function loadHistory() { return load(HISTORY_KEY, []); }
  function saveHistory(messages) { save(HISTORY_KEY, messages.slice(-MAX_MESSAGES)); }
  function addMessage(role, content) {
    const history = loadHistory();
    history.push({ role, content, ts: Date.now() });
    saveHistory(history);
    return history;
  }
  function clearHistory() { localStorage.removeItem(HISTORY_KEY); }
  function removeLastMessage() {
    const history = loadHistory();
    if (history.length > 0) history.pop();
    saveHistory(history);
  }

  // Geminiに渡す直近履歴（連続同ロールを自動修復）
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

  // ===== APIキー =====
  function saveApiKey(key) { localStorage.setItem(API_KEY_KEY, key); }
  function loadApiKey() { return localStorage.getItem(API_KEY_KEY) || ''; }
  function clearApiKey() { localStorage.removeItem(API_KEY_KEY); }

  // ===== VTuberプロフィール =====
  function loadProfile() { return load(PROFILE_KEY, {}); }
  function saveProfile(profile) { save(PROFILE_KEY, profile); }

  // ===== ピン留め記憶 =====
  function loadPins() { return load(PINS_KEY, []); }
  function addPin(text) {
    const pins = loadPins();
    pins.unshift({ text: text.trim(), date: today() });
    save(PINS_KEY, pins.slice(0, 20));
  }
  function removePin(index) {
    const pins = loadPins();
    pins.splice(index, 1);
    save(PINS_KEY, pins);
  }

  // ===== アイデアメモ =====
  function loadIdeas() { return load(IDEAS_KEY, []); }
  function addIdea(text) {
    const ideas = loadIdeas();
    ideas.unshift({ text: text.trim(), date: today() });
    save(IDEAS_KEY, ideas.slice(0, 100));
  }
  function removeIdea(index) {
    const ideas = loadIdeas();
    ideas.splice(index, 1);
    save(IDEAS_KEY, ideas);
  }

  // ===== 活動ログ =====
  function loadLog() { return load(LOG_KEY, []); }
  function addLog(text) {
    const log = loadLog();
    log.unshift({ text: text.trim(), date: today() });
    save(LOG_KEY, log.slice(0, 200));
  }
  function removeLog(index) {
    const log = loadLog();
    log.splice(index, 1);
    save(LOG_KEY, log);
  }

  // ===== 目標管理 =====
  function loadGoals() { return load(GOALS_KEY, []); }
  function addGoal(text) {
    const goals = loadGoals();
    goals.push({ text: text.trim(), done: false, date: today() });
    save(GOALS_KEY, goals);
  }
  function toggleGoal(index) {
    const goals = loadGoals();
    if (goals[index]) goals[index].done = !goals[index].done;
    save(GOALS_KEY, goals);
  }
  function removeGoal(index) {
    const goals = loadGoals();
    goals.splice(index, 1);
    save(GOALS_KEY, goals);
  }

  // ===== Gemini用：システムプロンプト追加コンテキストを構築 =====
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
    saveApiKey, loadApiKey, clearApiKey,
    loadProfile, saveProfile,
    loadPins, addPin, removePin,
    loadIdeas, addIdea, removeIdea,
    loadLog, addLog, removeLog,
    loadGoals, addGoal, toggleGoal, removeGoal,
    buildSystemContext
  };
})();
