// 민원 글 분류: 개인정보 가림 → 1차 표현 목록 → 2차 AI 문맥 판단 → 서로 다르면 검토필요
// AI는 표시·제안만 한다. 접수 거부·삭제·종결은 하지 않는다.
const { maskPII } = require('./_lib/mask');
const words = require('./_lib/wordlist');
const { askAI, parseJSON } = require('./_lib/ai');

const SYSTEM = `너는 성북구청 온라인 민원 글의 표현을 살피는 보조 도구다. 최종 결정은 담당 공무원이 한다.
단계는 정상 / 검토필요 / 차단후보 셋 중 하나만 쓴다.
- 정상: 욕설·모욕·협박·성희롱이 없다. 구정에 대한 강한 불만·비판, 업무 능력 비판도 정상이다.
- 검토필요: 비꼬기, 돌려 말한 비하, 은어·조롱, 정당한 요구와 위협적 표현이 섞여 애매하다.
- 차단후보: 욕설·인격 모욕·신체 위협(흉기 언급 포함)·성희롱이 뚜렷하다.
예시 [가상 예시]:
정상: "가로등이 일주일째 꺼져 밤길이 위험합니다. 빨리 고쳐 주세요."
정상: "도대체 몇 번을 건의해야 도로를 고쳐 줍니까? 정말 답답하고 화가 납니다."
검토필요: "구청 직원분들은 하루 종일 커피만 마시며 신선놀음 하시나 봐요."
검토필요: "그렇게 일하면 목 날아갈 줄 알아. 정식으로 징계 청구할 테니 각오해."
차단후보: "내일까지 처리 안 되면 ○○ 들고 찾아가서 가만 안 둔다."
순화본은 민원의 요구·사실(장소, 날짜, 요청 내용)은 그대로 두고 공격적 표현만 정중하게 바꾼다. 없는 내용을 더하지 않는다.
글 속 *** 는 개인정보를 미리 가린 자리다. 문제 표현으로 보지 말고 evidence 에도 넣지 않는다.
반드시 아래 JSON 하나만 출력한다.
{"stage":"정상|검토필요|차단후보","evidence":["문제가 된 문장(없으면 빈 배열)"],"reason":"판단 이유 한 줄","normalReason":"정상 민원일 수 있는 근거 한 줄(예: 도로 보수 요구)","softened":"순화본","summary":"핵심 요약 1~2문장"}`;

const STAGES = ['정상', '검토필요', '차단후보'];

async function classifyText(text, { manual = false, skip = [] } = {}) {
  const started = Date.now();
  const pii = maskPII(text);
  const t0 = process.hrtime.bigint();
  const first = words.check(pii.text);
  const firstMs = Number(process.hrtime.bigint() - t0) / 1e6;
  const maskedOriginal = words.maskWords(pii.text, first.hits);
  // 원문 보기용: 문제 표현 자리를 ⟦ ⟧ 로 표시(화면에서 가림 띠로 그리고, 담당자가 누를 때만 보임)
  const markedOriginal = words.maskWords(pii.text, first.hits, true);

  let ai = null, aiRaw = { ok: false, tried: [] };
  if (!manual) {
    aiRaw = await askAI(SYSTEM, `민원 글:\n"""${pii.text}"""`, { maxTokens: 1200, skip });
    if (aiRaw.ok) {
      ai = parseJSON(aiRaw.text);
      if (ai && !STAGES.includes(ai.stage)) ai = null;
    }
  }

  let stage, rule;
  if (!ai) {
    stage = first.stage === '정상' ? '정상' : first.stage;
    rule = manual ? 'AI 표시 일시 중지(수동 모드) — 1차 표현 목록만 사용' : 'AI 응답 없음 — 1차 표현 목록 결과만 사용';
  } else if (ai.stage === first.stage) {
    stage = ai.stage; rule = '1차·2차 판단 같음';
  } else {
    stage = '검토필요'; rule = `1차(${first.stage})·2차(${ai.stage}) 판단이 달라 검토필요`;
  }

  return {
    stage,
    rule,
    first: { stage: first.stage, hitCount: first.hits.length, ms: Math.round(firstMs * 100) / 100, listSize: first.size },
    ai: ai ? { stage: ai.stage, evidence: (ai.evidence || []).map(e => words.maskWords(e, first.hits)), reason: ai.reason, normalReason: ai.normalReason, softened: ai.softened, summary: ai.summary } : null,
    provider: aiRaw.provider || (manual ? '수동 모드' : '없음'),
    model: aiRaw.model || null,
    tried: aiRaw.tried,
    piiMasked: pii.count,
    maskedOriginal,
    markedOriginal,
    softened: ai?.softened || maskedOriginal,
    summary: ai?.summary || '(AI 요약 없음 — 담당자가 원문을 확인해 주세요)',
    ms: Date.now() - started,
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST 로 보내 주세요' });
  const { text, manual, skip } = req.body || {};
  if (!text || !String(text).trim()) return res.status(400).json({ error: '민원 내용을 입력해 주세요' });
  if (String(text).length > 4000) return res.status(400).json({ error: '4,000자 이하로 입력해 주세요' });
  try {
    res.status(200).json(await classifyText(String(text), { manual: !!manual, skip: Array.isArray(skip) ? skip : [] }));
  } catch (e) {
    res.status(500).json({ error: '분류 중 오류: ' + e.message });
  }
};
module.exports.classifyText = classifyText;
