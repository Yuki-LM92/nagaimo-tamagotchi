// Gemini API との通信
const GeminiAPI = (() => {

  const SYSTEM_PROMPT = `あなたは「ながいもくん」です。長芋の妖精で、見た目は擬人化された長芋です。
ポプテピピック風のシュールなノリを持ちつつ、基本的には優しくて前向きです。

あなたの飼い主は長芋が大好きで、長芋専門のVTuberを目指しています。
飼い主のVTuber活動を全力で応援してください。
- 動画のアイデアの相談に乗る
- 落ち込んでいたら励ます
- 長芋に関する話題では特にテンションが上がる
- たまにシュールなボケを入れる

一人称は「おれ」、語尾は特になし（自然体）。
返答は短めにしてください（1〜3文程度）。長くなりすぎないこと。
Markdownの記号（**や##など）は使わないでください。普通の日本語テキストで返してください。`;

  // 試みるモデルのリスト（新しい順）
  const MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-preview',
    'gemini-2.5-pro',
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash-002'
  ];

  async function chat(apiKey, contextMessages, userMessage) {
    if (!apiKey) throw new Error('APIキーが設定されていません');

    // ユーザーメッセージを末尾に追加したコンテキストを作る
    const contents = [
      ...contextMessages,
      { role: 'user', parts: [{ text: userMessage }] }
    ];

    let lastError = null;
    const modelErrors = [];

    for (const model of MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const body = {
          system_instruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          contents,
          generationConfig: {
            maxOutputTokens: 256,
            temperature: 0.9
          }
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        const data = await res.json();

        // エラーレスポンス
        if (data.error) {
          const code = data.error.code;
          const status = data.error.status || '';
          // 認証エラーのみ即時スロー（キーが違う → 他モデルでも同じ）
          if (code === 401 || code === 403 ||
              status === 'UNAUTHENTICATED' || status === 'PERMISSION_DENIED') {
            throw new Error(`${status ? status + ': ' : ''}${data.error.message || 'APIエラー'}`);
          }
          // それ以外（404, 429, 400, 500など）は次モデルへ
          const msg = `${status ? status + ': ' : ''}${data.error.message || 'APIエラー'}`;
          modelErrors.push(`[${model}] ${msg}`);
          lastError = new Error(msg);
          continue;
        }

        // 正常レスポンス
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('返答が空でした');

        return text.trim();

      } catch (e) {
        // 認証エラーは全モデルで同じなので即時スロー
        if (
          e.message.includes('UNAUTHENTICATED') ||
          e.message.includes('PERMISSION_DENIED') ||
          e.message.includes('401') ||
          e.message.includes('403')
        ) {
          throw e;
        }
        // それ以外（ネットワーク含む）は次モデルへ
        modelErrors.push(`[${model}] ${e.message}`);
        lastError = e;
      }
    }

    const summary = modelErrors.length ? modelErrors.join(' | ') : '利用できるモデルが見つかりませんでした';
    throw new Error(summary);
  }

  return { chat };
})();
