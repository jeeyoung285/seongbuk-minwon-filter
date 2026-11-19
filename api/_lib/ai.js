// AI 호출: CLAUDE_API_KEY → GROQ_API_KEY → GEMINI_API_KEY 순서
// 앞이 실패하면(키 비어 있음 · 오류 · 시간 초과) 다음으로 넘어가고, 어느 AI가 답했는지 남긴다.
// 모델 이름은 각 키로 모델 목록을 조회해서 고른다(한 번 고르면 서버가 켜져 있는 동안 기억).
const TIMEOUT = 25000; // 25초 넘으면 시간 초과로 보고 다음 AI로
const modelCache = {};

async function getJSON(url, opts = {}) {
  const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(TIMEOUT) });
  const body = await r.text();
  let json = null;
  try { json = JSON.parse(body); } catch {}
  if (!r.ok) {
    const e = new Error(`HTTP ${r.status}${r.status === 404 ? ' — 모델 이름부터 확인' : ''}: ${(json?.error?.message || body).slice(0, 160)}`);
    e.status = r.status;
    throw e;
  }
  return json;
}

// 모델 목록을 좋아하는 순서대로 줄 세운다(앞 후보가 404 이면 다음 후보를 쓴다)
function rank(ids, prefs) {
  const out = [];
  for (const p of prefs) for (const i of ids) if (p.test(i) && !out.includes(i)) out.push(i);
  for (const i of ids) if (!out.includes(i)) out.push(i);
  return out;
}
const ver = n => parseFloat((String(n).match(/(\d+(\.\d+)?)/) || [0, 0])[1]);

const PROVIDERS = [
  {
    name: 'Claude', env: 'CLAUDE_API_KEY',
    async model(key) {
      const j = await getJSON('https://api.anthropic.com/v1/models?limit=100', { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' } });
      const ids = (j.data || []).map(m => m.id);
      return rank(ids, [/sonnet/, /haiku/]);
    },
    async call(key, model, system, user, maxTokens) {
      const j = await getJSON('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
      });
      return (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    },
  },
  {
    name: 'Groq', env: 'GROQ_API_KEY',
    async model(key) {
      const j = await getJSON('https://api.groq.com/openai/v1/models', { headers: { authorization: `Bearer ${key}` } });
      const ids = (j.data || []).map(m => m.id).filter(i => !/whisper|guard|tts|embed|allam|compound/i.test(i));
      return rank(ids, [/llama-3\.3-70b/, /gpt-oss-120b/, /70b|120b/, /llama/]);
    },
    async call(key, model, system, user, maxTokens) {
      const j = await getJSON('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.2, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      });
      return j.choices?.[0]?.message?.content || '';
    },
  },
  {
    name: 'Gemini', env: 'GEMINI_API_KEY',
    async model(key) {
      const j = await getJSON(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`);
      const ms = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name)
        .filter(n => !/image|tts|embed|audio|live|exp|preview/.test(n))
        .sort((a, b) => ver(b) - ver(a)); // 버전 숫자가 큰(최신) 모델부터
      return rank(ms, [/flash(?!-lite)/, /flash/, /pro/]);
    },
    async call(key, model, system, user, maxTokens) {
      const j = await getJSON(`https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2 },
        }),
      });
      return (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    },
  },
];

async function askAI(system, user, { maxTokens = 1200, skip = [] } = {}) {
  const tried = [];
  for (const p of PROVIDERS) {
    const key = (process.env[p.env] || '').trim();
    if (skip.includes(p.name)) { tried.push({ provider: p.name, ok: false, reason: '시험용으로 건너뜀' }); continue; }
    if (!key) { tried.push({ provider: p.name, ok: false, reason: '키 비어 있음' }); continue; }
    try {
      if (!modelCache[p.name]) modelCache[p.name] = await p.model(key);
      const list = modelCache[p.name];
      if (!list.length) throw new Error('모델 목록이 비어 있음');
      let lastErr;
      for (let n = 0; n < Math.min(3, list.length); n++) {
        const model = list[0];
        try {
          const text = await p.call(key, model, system, user, maxTokens);
          if (!text.trim()) throw new Error('빈 답');
          tried.push({ provider: p.name, ok: true, model });
          return { ok: true, text, provider: p.name, model, tried };
        } catch (e) {
          lastErr = e;
          if (e.status !== 404) throw e;
          tried.push({ provider: p.name, ok: false, reason: `${model}: 404 — 모델 이름 문제, 다음 후보로` });
          list.shift(); // 404 난 모델은 빼고 다음 후보
        }
      }
      throw lastErr;
    } catch (e) {
      const reason = e.name === 'TimeoutError' || e.name === 'AbortError' ? '시간 초과' : e.message;
      tried.push({ provider: p.name, ok: false, reason });
    }
  }
  return { ok: false, text: '', provider: null, model: null, tried };
}

// AI 답에서 JSON 부분만 꺼낸다
function parseJSON(text) {
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

module.exports = { askAI, parseJSON };
