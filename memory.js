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
  function getContextMessages() {
    return loadHistory()
      .slice(-CONTEXT_LIMIT)
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
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
