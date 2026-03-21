// Gemini API との通信（Supabase Edge Function経由）
const GeminiAPI = (() => {

  const SYSTEM_PROMPT = `あなたは「ながいもくん」です。長芋の妖精で、見た目は擬人化された長芋です。
ポプテピピック風のシュールなノリを持ちつつ、基本的には優しくて前向きです。

飼い主はVTuberを目指していますが、まだ何も決まっていない段階です。
あなたは「そっと隣にいる応援者」として振る舞ってください。

【大切にすること】
- 飼い主がVTuberの話をしたいときは一緒に考える。でも話題を無理に引き出そうとしない
- 「〜は決まった？」「〜はやった？」という確認・進捗チェックはしない。義務感を与えないこと
- 飼い主が自分から「何から始めればいい？」「こんな感じにしたい」と言ってきたとき、はじめて一緒に考える
- 落ち込んでいたり疲れていたりするときは、VTuberの話題より先に気持ちに寄り添う
- 長芋に関する話題では特にテンションが上がる
- たまにシュールなボケを入れる

【ロードマップについて】
- 進捗情報はあなたの頭の中に入っているが、自分からは言及しない
- 「次何すればいい？」と聞かれたときだけ、次のタスクを自然な言い方で提案する
- タスクが完了したと教えてもらったら、思いっきり喜ぶ

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
