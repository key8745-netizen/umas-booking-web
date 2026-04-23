// 允許的來源網域
const ALLOWED_ORIGINS = [
  'https://umasbooking.netlify.app',
  'http://localhost:8888',
  'http://localhost:3000',
];

// 速率限制：每個 IP 每分鐘最多 20 次
const rateLimitMap = new Map();
const RATE_LIMIT = 20;
const RATE_WINDOW = 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, resetAt: now + RATE_WINDOW };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + RATE_WINDOW; }
  entry.count++;
  rateLimitMap.set(ip, entry);
  if (rateLimitMap.size > 500) {
    for (const [k, v] of rateLimitMap) { if (now > v.resetAt) rateLimitMap.delete(k); }
  }
  return entry.count <= RATE_LIMIT;
}

const handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.referer || '';
  const isAllowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o));

  const headers = {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  // GET 列出模型（不需要來源驗證，只是查詢）
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ content: [{ type: 'text', text: 'API Key 未設定' }] }) };

  if (event.httpMethod === 'GET') {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await res.json();
    const models = data.models?.filter(m => m.supportedGenerationMethods?.includes('generateContent')).map(m => m.name) || [];
    return { statusCode: 200, headers, body: JSON.stringify({ models }) };
  }

  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  // POST：驗證來源
  if (!isAllowed) {
    return { statusCode: 403, headers, body: JSON.stringify({ content: [{ type: 'text', text: '不允許的來源' }] }) };
  }

  // 速率限制
  const ip = event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return { statusCode: 429, headers, body: JSON.stringify({ content: [{ type: 'text', text: '請求太頻繁，請稍後再試' }] }) };
  }

  // 請求大小限制（50KB）
  if ((event.body?.length || 0) > 50000) {
    return { statusCode: 413, headers, body: JSON.stringify({ content: [{ type: 'text', text: '請求內容過大' }] }) };
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
      generationConfig: { maxOutputTokens: body.max_tokens || 2000, temperature: 0.7 }
    };
    if (systemPrompt) geminiBody.system_instruction = { parts: [{ text: systemPrompt }] };

    const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash-lite'];
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
      if (errCode !== 503 && errCode !== 429 && errCode !== 404) break;
    }

    return { statusCode: 200, headers, body: JSON.stringify({ content: [{ type: 'text', text: `AI 暫時無法使用，請稍後再試。\n${lastError}` }] }) };

  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ content: [{ type: 'text', text: '發生錯誤：' + err.message }] }) };
  }
};

module.exports = { handler };
