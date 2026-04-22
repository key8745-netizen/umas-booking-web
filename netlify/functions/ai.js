const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ content: [{ type: 'text', text: 'API Key 未設定' }] }) };
  }

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
      generationConfig: { maxOutputTokens: body.max_tokens || 1000, temperature: 0.7 }
    };
    if (systemPrompt) {
      geminiBody.system_instruction = { parts: [{ text: systemPrompt }] };
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody)
      }
    );

    const data = await res.json();
    if (!res.ok) {
      return { statusCode: 200, headers, body: JSON.stringify({ content: [{ type: 'text', text: 'Gemini 錯誤：' + JSON.stringify(data) }] }) };
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '無法取得回應';
    return { statusCode: 200, headers, body: JSON.stringify({ content: [{ type: 'text', text }] }) };

  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ content: [{ type: 'text', text: '發生錯誤：' + err.message }] }) };
  }
};

module.exports = { handler };
