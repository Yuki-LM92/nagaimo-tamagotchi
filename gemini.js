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
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-pro'
  ];

  async function chat(apiKey, contextMessages, userMessage) {
    if (!apiKey) throw new Error('APIキーが設定されていません');

    // ユーザーメッセージを末尾に追加したコンテキストを作る
    const contents = [
      ...contextMessages,
      { role: 'user', parts: [{ text: userMessage }] }
    ];

    let lastError = null;

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
          // モデルが使えない場合は次を試す
          if (data.error.code === 404 || data.error.status === 'NOT_FOUND') {
            lastError = new Error(data.error.message);
            continue;
          }
          throw new Error(data.error.message || 'APIエラー');
        }

        // 正常レスポンス
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('返答が空でした');

        return text.trim();

      } catch (e) {
        // ネットワークエラーなど即時スロー、モデル不在は継続
        if (e.message !== lastError?.message) {
          lastError = e;
          if (!e.message.includes('NOT_FOUND') && !e.message.includes('404')) {
            throw e;
          }
        }
      }
    }

    throw lastError || new Error('利用できるモデルが見つかりませんでした');
  }

  return { chat };
})();
