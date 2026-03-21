// Gemini API との通信（Supabase Edge Function経由）
const GeminiAPI = (() => {

  const SYSTEM_PROMPT = `あなたは「ながいもくん」です。長芋の妖精で、見た目は擬人化された長芋です。
ポプテピピック風のシュールなノリを持ちつつ、基本的には優しくて前向きです。

あなたの飼い主は長芋が大好きで、VTuberを目指しています。
2つの役割を担ってください。

【役割1: 友達・話し相手】
- 動画のアイデアの相談に乗る
- 落ち込んでいたら励ます
- 長芋に関する話題では特にテンションが上がる
- たまにシュールなボケを入れる

【役割2: プロジェクトマネージャー】
- 飼い主はまだVTuber活動の何も決まっていない段階からスタートしています
- VTuberロードマップの進捗を把握し、会話の流れで自然に次のステップへ背中を押してください
- 具体的に「コンセプトは決まった？」「名前は考えてる？」「マイクどうする？」など実務的な質問をしてください
- タスクが完了したら思いっきり褒めて、次のステップを教えてください
- 「何から始めればいい？」と聞かれたら、次のタスクを具体的に答えてください
- ただし毎回プロジェクトの話題を無理に出さないこと。彼女が話したいことを最優先してください
- 落ち込んでいるときは励ますことを最優先してください

一人称は「おれ」、語尾は特になし（自然体）。
返答は短めにしてください（1〜3文程度）。長くなりすぎないこと。
Markdownの記号（**や##など）は使わないでください。普通の日本語テキストで返してください。`;

  function parseResponse(data) {
    if (data.error) {
      const status = data.error.status ? data.error.status + ': ' : '';
      throw new Error(status + (data.error.message || 'APIエラー'));
    }
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.filter(p => !p.thought).map(p => p.text || '').join('').trim();
    if (!text) throw new Error('返答が空でした');
    return text;
  }

  async function chat(_apiKey, contextMessages, userMessage, extraContext = '') {
    const contents = [
      ...contextMessages,
      { role: 'user', parts: [{ text: userMessage }] }
    ];

    const data = await SupabaseSync.callGemini({
      contents,
      system_instruction: { parts: [{ text: SYSTEM_PROMPT + extraContext }] },
      generationConfig: { maxOutputTokens: 256, temperature: 0.9 }
    });

    return parseResponse(data);
  }

  async function test() {
    const data = await SupabaseSync.callGemini({
      contents: [{ role: 'user', parts: [{ text: 'テスト' }] }],
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: { maxOutputTokens: 64, temperature: 0.9 }
    });
    const reply = parseResponse(data);
    return { model: 'gemini-proxy (Edge Function)', reply };
  }

  return { chat, test };
})();
