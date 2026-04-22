const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ content: [{ type: 'text', text: 'API Key 未設定' }] }) };

  if (event.httpMethod === 'GET') {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await res.json();
    const models = data.models?.filter(m => m.supportedGenerationMethods?.includes('generateContent')).map(m => m.name) || [];
    return { statusCode: 200, headers, body: JSON.stringify({ models }) };
  }

  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  try {
    const body = JSON.parse(event.body);
    const systemPrompt = body.system || '';
    const messages = body.messages || [];

    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(msg.content) }]
    }));

    const geminiBody = {
      contents,
      generationConfig: { maxOutputTokens: body.max_tokens || 2000, temperature: 0.7 }
    };
    if (systemPrompt) geminiBody.system_instruction = { parts: [{ text: systemPrompt }] };

    // 依序嘗試，503/429 才換下一個
    const models = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-2.5-flash-lite',
    ];
    let lastError = null;

    for (const model of models) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody) }
      );
      const data = await res.json();

      if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
        const text = data.candidates[0].content.parts[0].text;
        return { statusCode: 200, headers, body: JSON.stringify({ content: [{ type: 'text', text }] }) };
      }

      const errCode = data?.error?.code;
      lastError = `${model}: ${data?.error?.message || `HTTP ${res.status}`}`;
      // 503=忙碌、429=配額超過、404=找不到 → 繼續試下一個；其他錯誤直接停
      if (errCode !== 503 && errCode !== 429 && errCode !== 404) break;
    }

    return { statusCode: 200, headers, body: JSON.stringify({ content: [{ type: 'text', text: `AI 暫時無法使用，請稍後再試。\n${lastError}` }] }) };

  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ content: [{ type: 'text', text: '發生錯誤：' + err.message }] }) };
  }
};

module.exports = { handler };
