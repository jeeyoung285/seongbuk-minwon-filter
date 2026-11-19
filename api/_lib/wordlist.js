// 1차 표현 목록 [팀 설계안] — 시제품용 작은 목록(실제 적용 전 구청 담당 부서 검토 필요)
// 단어는 base64 로 적었다(코드에서 욕설이 그대로 보이지 않게). 바꾸려면 scratch 생성기 대신 아래 배열에 base64 를 넣는다.
const dec = a => a.map(s => Buffer.from(s, 'base64').toString('utf8'));
const BLOCK = dec(["7JSo67Cc","7Iuc67Cc","44WF44WC","7JSo67CU","6rCc7IOI64G8","6rCc7IOJ","7IOI64G8","67OR7Iug","44WC44WF","7KKG","7KG064KY","7KeA656E","44WI44S5","66+47Lmc64aI","66+47Lmc64WE","64ul7LOQ","6rq87KC4","7KO97Jes","7KO97J2464uk","7KO97J2E7KSE","6rCA66eM7JWI65GU64uk","6rCA66eM7JWI65Gs","7Lm865Ok6rOg","7Z2J6riw","7LC+7JWE6rCA7ISc","7JiI7IGY6rKM7ZWY6rOg64KY7JmA","66q466ek","7Je/66i5","6rCc6rCZ","7JOw66CI6riw6rCZ7J2A","66i47KCA66as","65iQ65287J20"]);
const REVIEW = dec(["7Iug7ISg64aA7J2M","7IS46riI64+E65GR","7JuU6riJ66Oo7Yyh","7LKg67Cl7Ya1","44WL44WL","7IiY7KSA7J2064Sk","7LSI65Ox7ZWZ7IOd64+E","66qp64Kg7JWE6rCI","6rCB7Jik7ZW0","65GQ6rOg67O07J6Q","66y064ql","7ZWc7Ius","66mN7LKt","65Ox7Iug","67CU67O0"]);

// 띄어쓰기·특수문자·숫자를 지우고 비교한다(씨1발, 씨-발 같은 변형 대응)
function normalize(t) {
  return String(t || '').normalize('NFC').replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z]/g, '');
}

function check(text) {
  const n = normalize(text);
  const hitsBlock = BLOCK.filter(w => n.includes(normalize(w)));
  const hitsReview = REVIEW.filter(w => n.includes(normalize(w)));
  const stage = hitsBlock.length ? '차단후보' : hitsReview.length ? '검토필요' : '정상';
  return { stage, hits: [...hitsBlock, ...hitsReview], blockHits: hitsBlock, size: BLOCK.length + REVIEW.length };
}

// 원문에서 문제 표현을 ○○ 로 가린다(띄어쓰기가 끼어 있어도 가림)
function maskWords(text, words, mark = false) {
  let out = String(text || '');
  for (const w of words) {
    const chars = [...normalize(w)];
    if (!chars.length) continue;
    const re = new RegExp(chars.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z]{0,2}'), 'g');
    out = out.replace(re, m => (mark ? `⟦${m}⟧` : '○○'));
  }
  return out;
}

module.exports = { check, maskWords, normalize };
