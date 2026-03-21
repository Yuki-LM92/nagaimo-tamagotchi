// Supabase連携 & Gemini Edge Functionプロキシ
const SupabaseSync = (() => {
  const SUPABASE_URL  = 'https://errdubdisscxliwaaiwv.supabase.co';
  const ANON_KEY      = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVycmR1YmRpc3NjeGxpd2FhaXd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwODMxMzQsImV4cCI6MjA4OTY1OTEzNH0.PiyepPsA-rAHx_0kxdsVlOfHNA4hf0HfA4OrbVhOQak';
  const ROOM_CODE_KEY = 'nagaimo_room_code';

  const REST_HEADERS = {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,
    'Content-Type': 'application/json'
  };

  function getRoomCode() { return localStorage.getItem(ROOM_CODE_KEY) || ''; }
  function saveRoomCode(code) { localStorage.setItem(ROOM_CODE_KEY, code); }

  async function fetchRoom(roomCode) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/nagaimo_rooms?room_code=eq.${encodeURIComponent(roomCode)}&select=*`,
        { headers: REST_HEADERS }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return Array.isArray(data) && data.length > 0 ? data[0] : null;
    } catch { return null; }
  }

  async function saveRoom(roomCode, updates) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/nagaimo_rooms`, {
        method: 'POST',
        headers: { ...REST_HEADERS, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({
          room_code: roomCode,
          ...updates,
          updated_at: new Date().toISOString()
        })
      });
    } catch { /* オフライン時は無視 */ }
  }

  async function callGemini(payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000); // 20秒タイムアウト
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/gemini-proxy`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const data = await res.json();
      return data;
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('タイムアウト: 応答に時間がかかりすぎました');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  return { getRoomCode, saveRoomCode, fetchRoom, saveRoom, callGemini };
})();
