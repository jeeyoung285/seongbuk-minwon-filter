// 안내 챗봇: docs/답변참고문서/청킹 에 있는 내용으로만 답하고, 근거 문서 이름을 붙인다.
const { search, contactChunk } = require('./_lib/chunks');
const { askAI } = require('./_lib/ai');
const { lawInfo, DEMO_LAW } = require('./_lib/publicApi');

const SYSTEM = `너는 「성북 안심 민원 필터」 서비스의 안내 챗봇이다. 민원인·담당 공무원·관리자의 질문에 답한다.
규칙:
1. 아래 [자료]에 있는 내용으로만 답한다. 자료에 없는 사실·숫자·조문을 만들지 않는다.
2. 자료로 답할 수 없으면 첫 줄에 정확히 NOT_FOUND 라고만 쓴다.
3. 본문 문장에는 문서 이름을 쓰지 않는다. 대신 맨 마지막 줄에 "근거: 문서 이름, 문서 이름" 형식으로 실제로 쓴 자료의 문서 이름만 한 번 적는다.
4. 개별 민원의 단계·처분·자격을 단정하지 않는다. "담당 공무원이 최종 결정합니다"처럼 안내까지만 한다.
5. [팀 설계안] 값(예: 소명 기한 7일)은 "시제품 기준"이라고 밝힌다.
6. 해요체로, 쉬운 말로 3~6문장 안에 답한다.`;

function contactText() {
  const c = contactChunk();
  if (!c) return '- 성북구청 대표전화: 02-2241-3114';
  const body = c.text.split(/^## 문의처\s*$/m)[1] || '';
  return body.split(/\r?\n/).filter(l => l.startsWith('- ')).join('\n');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST 로 보내 주세요' });
  const q = String((req.body || {}).question || '').trim();
  if (!q) return res.status(400).json({ error: '질문을 입력해 주세요' });
  if (q.length > 500) return res.status(400).json({ error: '500자 이하로 입력해 주세요' });
  const skip = Array.isArray(req.body.skip) ? req.body.skip : [];

  const hits = search(q, 5);
  const notFound = (provider, tried, why) => res.status(200).json({
    found: false,
    answer: `이 질문은 답변참고문서에서 근거를 찾지 못해 답하기 어려워요. 아래 문의처로 물어봐 주세요.\n${contactText()}`,
    sources: ['성북구 문의처 안내'], provider, tried, why, laws: [],
  });
  if (!hits.length) return notFound('없음(검색 결과 없음)', [], '관련 문서 없음');

  const context = hits.map((h, i) => `[자료 ${i + 1}] 문서 이름: ${h.doc} · ${h.section}\n${h.text.slice(0, 1800)}`).join('\n\n');
  const ai = await askAI(SYSTEM, `[자료]\n${context}\n\n[질문]\n${q}`, { maxTokens: 2000, skip });
  if (ai.ok) ai.text = ai.text.replace(/\\([*_#])/g, '$1').replace(/\*\*(.+?)\*\*/g, '$1');

  if (!ai.ok) {
    return res.status(200).json({
      found: true, demo: true,
      answer: `AI가 응답하지 않아 찾은 문서만 보여 드려요(시연 값).\n` + hits.slice(0, 3).map(h => `- ${h.doc} · ${h.section}`).join('\n'),
      sources: [...new Set(hits.map(h => h.doc))], provider: '없음', tried: ai.tried, laws: [],
    });
  }
  if (/^\s*NOT_FOUND/.test(ai.text)) return notFound(ai.provider, ai.tried, 'AI가 문서에서 답을 찾지 못함');

  // 마지막 "근거:" 줄을 떼어 내 아래 「근거 문서」 줄로 옮긴다
  const m = ai.text.match(/\n?\s*근거\s*[:：]\s*(.+)\s*$/);
  const citeLine = m ? m[1] : '';
  if (m) ai.text = ai.text.slice(0, m.index);
  ai.text = ai.text.replace(/\s*\[[^\]]*(발췌|법률|조례|안내|기준|가이드|윤리|보도|연구)[^\]]*\]/g, '');
  const all = [...new Set(hits.map(h => h.doc))];
  const cited = all.filter(d => citeLine.includes(d) || citeLine.includes(d.replace(/\s*[(—].*$/, '').trim()));
  const sources = cited.length ? cited : all;
  const base = d => d.replace(/\s*\(.*\)\s*$/, '').replace(/\s*[—-].*$/, '').trim();
  const lawNames = [...new Set(sources.map(base).filter(d => DEMO_LAW[d]))];
  const laws = await Promise.all(lawNames.map(async n => ({ name: n, ...(await lawInfo(n)) })));

  res.status(200).json({ found: true, answer: ai.text.trim(), sources, provider: ai.provider, model: ai.model, tried: ai.tried, laws });
};
