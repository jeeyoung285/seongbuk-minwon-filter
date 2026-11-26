// 공공 API 는 서버(api)에서만 부른다. 실패하면 이유와 「시연 값」을 함께 돌려준다.
const TIMEOUT = 8000;
// 법령정보센터·국민참여입법센터는 신청 때 등록한 도메인을 Referer 로 확인한다(없으면 「필수 입력값이 존재하지 않습니다」)
const SITE_URL = (process.env.SITE_URL || 'https://seongbuk-minwon-filter-hnud.vercel.app').replace(/\/$/, '') + '/';

// 시연 값: 기획서(팀_기획서.md 5.3절, 2026.10.25.~11.05. 국가법령정보센터 확인) 기준
const DEMO_LAW = {
  '민원 처리에 관한 법률': '2022.7.12. 시행 (법률 제18748호)',
  '민원 처리에 관한 법률 시행령': '2026.5.6. 시행 (대통령령 제36296호)',
  '개인정보 보호법': '2026.9.11. 시행 (법률 제21445호)',
  '인공지능 발전과 신뢰 기반 조성 등에 관한 기본법': '2026.1.22. 시행, 일부 2026.7.21. (법률 제21311호)',
  '서울특별시 성북구 민원업무담당 공무원 등의 보호 및 지원에 관한 조례': '2023.12.28. (조례 제1562호)',
};
const DEMO_LAWMAKING = [
  { title: '민원 처리에 관한 법률 일부개정법률안', org: '행정안전부', period: '2024.8.21.~2024.9.30. (공고 제2024-1216호, 종료)', note: '기획서 기준 — 2024.10.22. 국무회의 통과, 현행 법률에는 미반영' },
];

function classify(e, status, body) {
  if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) return '시간 초과';
  if (status === 401 || status === 403) return '승인 안 됨';
  if (/SERVICE_KEY_IS_NOT_REGISTERED|SERVICE ACCESS DENIED|NOT_REGISTERED|미신청|승인|인증|권한|사용자 정보/i.test(body || '')) return '승인 안 됨';
  if (e) return `오류: ${e.message}`;
  return `오류: HTTP ${status}`;
}

async function fetchText(url, headers = {}) {
  let status = 0, body = '';
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT) });
    status = r.status; body = await r.text();
    if (!r.ok) return { ok: false, reason: classify(null, status, body) };
    return { ok: true, body };
  } catch (e) {
    return { ok: false, reason: classify(e, status, body) };
  }
}

// 국가법령정보센터(LAW_OC): 현행 법령 · 조례 시행일
async function lawInfo(name) {
  const demo = DEMO_LAW[name] || '시연 값 없음';
  const oc = (process.env.LAW_OC || '').trim();
  if (!oc) return { ok: false, live: false, reason: '키 비어 있음 (LAW_OC)', value: demo };
  const target = /조례/.test(name) ? 'ordin' : 'law';
  const url = `https://www.law.go.kr/DRF/lawSearch.do?OC=${encodeURIComponent(oc)}&target=${target}&type=JSON&display=5&query=${encodeURIComponent(name)}`;
  const r = await fetchText(url, { referer: SITE_URL });
  if (!r.ok) return { ok: false, live: false, reason: r.reason, value: demo };
  try {
    const j = JSON.parse(r.body);
    const root = j.LawSearch || j.OrdinSearch || {};
    let items = root.law || root.ordin || [];
    if (!Array.isArray(items)) items = [items];
    const norm = s => String(s || '').replace(/\s/g, '');
    const hit = items.find(i => norm(i['법령명한글'] || i['자치법규명']) === norm(name)) || items[0];
    // 검증 실패 등은 {result, msg} 로 온다 → 그 문구를 그대로 실패 이유로 보여 준다
    if (!hit) return { ok: false, live: false, reason: j.msg || j.result || (j.Response && (j.Response.msg || j.Response.result)) || '검색 결과 없음', value: demo };
    const d = String(hit['시행일자'] || '');
    const date = d.length === 8 ? `${d.slice(0, 4)}.${+d.slice(4, 6)}.${+d.slice(6)}.` : d;
    return { ok: true, live: true, value: `${date} 시행`, source: '국가법령정보센터 실시간' };
  } catch {
    return { ok: false, live: false, reason: classify(null, 200, r.body), value: demo };
  }
}

// 국민참여입법센터(LAWMAKING_OC): 진행 중인 입법예고
// [확인 필요] 주소·응답 형식은 open.law.go.kr 신청 화면의 안내로 대조해야 한다
async function lawmaking(query = '민원 처리에 관한 법률') {
  const oc = (process.env.LAWMAKING_OC || '').trim();
  if (!oc) return { ok: false, live: false, reason: '키 비어 있음 (LAWMAKING_OC)', items: DEMO_LAWMAKING };
  const url = `https://opinion.lawmaking.go.kr/rest/ogLmPp?OC=${encodeURIComponent(oc)}&lsNm=${encodeURIComponent(query)}`;
  const r = await fetchText(url, { referer: SITE_URL });
  if (!r.ok) return { ok: false, live: false, reason: r.reason, items: DEMO_LAWMAKING };
  const items = [...r.body.matchAll(/<(?:lsNm|법령안명)>([\s\S]*?)<\/(?:lsNm|법령안명)>/g)].map(m => ({ title: m[1].trim(), org: '', period: '', note: '실시간' }));
  if (!items.length) return { ok: false, live: false, reason: classify(null, 200, r.body) === '승인 안 됨' ? '승인 안 됨' : '진행 중인 입법예고 없음 또는 응답 형식 다름', items: DEMO_LAWMAKING };
  return { ok: true, live: true, items };
}

// 공공데이터포털 키: Encoding 키(% 포함)는 그대로, Decoding 키는 한 번 인코딩해서 붙인다
function serviceKeyParam(key) {
  key = String(key || '').trim();
  return /%[0-9A-Fa-f]{2}/.test(key) ? key : encodeURIComponent(key);
}

// 국민권익위원회 민원빅데이터(DATA_GO_KR_KEY) — 통계 화면 선택 기능
// [확인 필요] 서비스 주소는 공공데이터포털 활용신청 화면의 「요청주소」로 바꿔야 한다
const DATA_URL = 'https://apis.data.go.kr/1140100/minAnalsInfoView5/minTopNKeyword5';
async function minwonKeywords() {
  const demo = [{ keyword: '불법주차', count: '시연 값' }, { keyword: '가로등', count: '시연 값' }, { keyword: '도로 보수', count: '시연 값' }];
  const key = process.env.DATA_GO_KR_KEY;
  if (!key) return { ok: false, live: false, reason: '키 비어 있음 (DATA_GO_KR_KEY)', items: demo };
  const url = `${DATA_URL}?serviceKey=${serviceKeyParam(key)}&dataType=json&target=pttn&searchword=&dateFrom=20250101&dateTo=20251231&resultCount=5`;
  const r = await fetchText(url);
  if (!r.ok) return { ok: false, live: false, reason: r.reason, items: demo };
  try {
    const j = JSON.parse(r.body);
    const list = j.data || j.response?.body?.items || j.items;
    if (!Array.isArray(list) || !list.length) throw 0;
    return { ok: true, live: true, items: list.slice(0, 5).map(i => ({ keyword: i.keyword || i.topic || JSON.stringify(i).slice(0, 30), count: i.df || i.count || '' })) };
  } catch {
    return { ok: false, live: false, reason: classify(null, 200, r.body) === '승인 안 됨' ? '승인 안 됨' : '응답 형식 다름(요청주소 확인 필요)', items: demo };
  }
}

module.exports = { lawInfo, lawmaking, minwonKeywords, serviceKeyParam, DEMO_LAW };
