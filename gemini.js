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

  // 優先モデルキーワード（含まれていれば優先）
  const PREFERRED = ['2.5-flash', '2.5-pro', '2.0-flash', '1.5-flash', '1.5-pro'];

  // 発見したモデルをキャッシュ
  let cachedModel = null;

  // ListModels でアカウントで使えるモデルを自動検出
  async function discoverModel(apiKey) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const models = (data.models || [])
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => m.name.replace('models/', ''));

    if (models.length === 0) throw new Error('generateContent対応モデルが見つかりません');

    // 優先キーワード順に探す
    for (const keyword of PREFERRED) {
      const found = models.find(m => m.includes(keyword));
      if (found) return found;
    }

    return models[0];
  }

  async function chat(apiKey, contextMessages, userMessage) {
    if (!apiKey) throw new Error('APIキーが設定されていません');

    // モデルを未発見なら自動検出
    if (!cachedModel) {
      cachedModel = await discoverModel(apiKey);
    }

    const contents = [
      ...contextMessages,
      { role: 'user', parts: [{ text: userMessage }] }
    ];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cachedModel}:generateContent?key=${apiKey}`;

    const body = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { maxOutputTokens: 256, temperature: 0.9 }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (data.error) {
      // キャッシュを捨てて次回再検出させる
      cachedModel = null;
      const status = data.error.status ? data.error.status + ': ' : '';
      throw new Error(status + (data.error.message || 'APIエラー'));
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('返答が空でした');

    return text.trim();
  }

  // テスト用：発見したモデル名も返す
  async function test(apiKey) {
    const model = await discoverModel(apiKey);
    const reply = await chat(apiKey, [], 'テスト');
    return { model, reply };
  }

  return { chat, test };
})();
