// 会話履歴のローカルストレージ管理
const Memory = (() => {
  const HISTORY_KEY = 'nagaimo_history';
  const API_KEY_KEY  = 'nagaimo_apikey';
  const MAX_MESSAGES = 60; // 保存上限（多めに持っておく）
  const CONTEXT_LIMIT = 50; // Geminiに送る直近件数

  // 会話履歴
  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(messages) {
    const trimmed = messages.slice(-MAX_MESSAGES);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  }

  function addMessage(role, content) {
    const history = loadHistory();
    history.push({ role, content, ts: Date.now() });
    saveHistory(history);
    return history;
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
  }

  // APIエラー時に追加したユーザーメッセージを取り消す
  function removeLastMessage() {
    const history = loadHistory();
    if (history.length > 0) history.pop();
    saveHistory(history);
  }

  // Geminiに渡す直近履歴（role: 'user' | 'model'）
  // 連続同ロール問題（INVALID_ARGUMENT）を防ぐためsanitizeする
  function getContextMessages() {
    const raw = loadHistory().slice(-CONTEXT_LIMIT);

    // 連続する同ロールを除去（後のメッセージを優先して残す）
    const sanitized = [];
    for (const m of raw) {
      const geminiRole = m.role === 'assistant' ? 'model' : 'user';
      if (sanitized.length > 0 && sanitized[sanitized.length - 1].role === geminiRole) {
        // 同ロールが連続 → 前のものを上書き（最新のみ残す）
        sanitized[sanitized.length - 1] = { role: geminiRole, parts: [{ text: m.content }] };
      } else {
        sanitized.push({ role: geminiRole, parts: [{ text: m.content }] });
      }
    }

    // Geminiは必ずuserで始まる必要がある
    while (sanitized.length > 0 && sanitized[0].role !== 'user') {
      sanitized.shift();
    }

    return sanitized;
  }

  // APIキー
  function saveApiKey(key) {
    localStorage.setItem(API_KEY_KEY, key);
  }

  function loadApiKey() {
    return localStorage.getItem(API_KEY_KEY) || '';
  }

  function clearApiKey() {
    localStorage.removeItem(API_KEY_KEY);
  }

  return {
    loadHistory,
    addMessage,
    removeLastMessage,
    clearHistory,
    getContextMessages,
    saveApiKey,
    loadApiKey,
    clearApiKey
  };
})();
