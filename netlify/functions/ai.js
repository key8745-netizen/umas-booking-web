const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ content: [{ type: 'text', text: 'API Key 未設定' }] }) };

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

    // 依序嘗試免費模型
    const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite-preview-06-17', 'gemini-2.5-pro'];
    let lastError = null;

    for (const model of models) {
      try {
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
        lastError = data?.error?.message || `HTTP ${res.status}`;
        // 只有 503/429 才換下一個模型，其他錯誤直接回報
        if (errCode !== 503 && errCode !== 429) break;
      } catch(e) {
        lastError = e.message;
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ content: [{ type: 'text', text: `AI 暫時無法使用，請稍後再試。錯誤：${lastError}` }] }) };

  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ content: [{ type: 'text', text: '發生錯誤：' + err.message }] }) };
  }
};

module.exports = { handler };
