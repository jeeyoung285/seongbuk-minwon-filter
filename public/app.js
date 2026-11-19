// 성북 안심 민원 필터 — 화면 동작
// 저장: 브라우저(localStorage). 시연용이라 이 컴퓨터·이 브라우저에서만 보입니다.
(() => {
  const KEY = 'sb-filter-v1';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const now = () => new Date().toISOString();
  const fmt = iso => { const d = new Date(iso); return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

  // ○○ 와 ⟦문제 표현⟧ 을 가림 띠로 그린다
  const veil = s => esc(s)
    .replace(/⟦([^⟧]*)⟧/g, (_, w) => `<span class="veil" data-word="${w}" aria-label="가린 표현"></span>`)
    .replace(/○○/g, '<span class="veil" aria-label="가린 표현">○○</span>');

  // ---------- 시연 데이터: 기획서 표 2 [가상 예시] ----------
  const SEED = [
    ['가로등 고장', '성북동 골목 가로등이 일주일째 꺼져 있어 밤길이 위험합니다. 빨리 고쳐 주세요.', '정상', '생활 불편을 공격 표현 없이 요청함', '가로등 수리 요청', '성북동 골목 가로등 고장 수리를 요청함.'],
    ['불법주차 단속 기준', '불법주차 단속 기준이 부서마다 달라 주민만 피해를 봅니다. 지침을 다시 검토해야 합니다.', '정상', '정책 비판은 정당한 의견', '단속 지침 재검토 요청', '부서마다 다른 불법주차 단속 기준의 재검토를 요청함.'],
    ['도로 보수 반복 건의', '도대체 몇 번을 건의해야 도로를 고쳐 줍니까? 정말 답답하고 화가 납니다.', '정상', '강한 불만이지만 특정인 모욕·욕설 없음', '도로 보수 요구', '여러 번 건의한 도로 보수가 안 돼 빠른 처리를 요청함.'],
    ['처리 미숙', '담당자가 일을 이렇게밖에 못 하나요? 업무 처리가 너무 미숙합니다.', '정상', '업무 능력 비판이며 욕설·인격 모욕 아님', '업무 처리 개선 요구', '담당자의 업무 처리 방식 개선을 요구함.'],
    ['직원 근무 태도', '구청 직원분들은 하루 종일 커피만 마시며 신선놀음 하시나 봐요.', '검토필요', '직접 욕설은 없으나 집단을 비꼬는 맥락', '근무 태도에 대한 불만 표현', '구청 직원의 근무 태도에 불만을 나타냄.', '구청 직원분들의 근무 태도가 성실하지 않아 보여 아쉽습니다.'],
    ['처리 수준', '담당자분 완전 ○○ 수준이네요. 초등학생도 이것보단 잘하겠어요 ㅋㅋ', '검토필요', '은어·조롱이 섞여 사람의 판단이 필요', '업무 처리 품질 불만', '담당자의 업무 처리 수준에 불만을 나타냄.', '담당자분의 처리 방식이 만족스럽지 않습니다. 개선을 바랍니다.'],
    ['징계 청구 예고', '그렇게 일하면 목 날아갈 줄 알아. 정식으로 징계 청구할 테니 각오해.', '검토필요', '징계 청구는 정당한 권리이나 위협적 표현이 섞임(1·2차 판단 충돌 예)', '징계 청구는 정당한 권리', '담당자 업무 처리에 대해 정식 징계 청구 의사를 밝힘.', '업무 처리에 문제가 있다고 생각해 정식으로 징계를 청구하려 합니다.'],
    ['처리 지연', '야 이 ○○들아, 민원 넣은 지가 언젠데 일을 안 해? 머리에 ○○만 찼냐?', '차단후보', '뚜렷한 욕설과 인격 모욕', '처리 지연에 대한 항의', '접수한 민원의 처리가 늦어지는 데 항의함.', '민원을 넣은 지 오래됐는데 아직 처리되지 않았습니다. 빨리 처리해 주세요.'],
    ['처리 기한 요구', '내일까지 처리 안 되면 ○○ 들고 찾아가서 가만 안 둔다.', '차단후보', '흉기 언급과 신체 위협', '빠른 처리 요구', '내일까지 처리해 달라고 요구함(위협 표현 포함).', '내일까지 처리해 주시기를 강하게 요청합니다.'],
    ['통화 후 민원', '목소리 들으니 기분 좋네, 민원 들어주면 맛있는 거 사줄게, 예쁘게 하고 나와.', '차단후보', '성적 대상화·성희롱 표현', '구체적 요구 없음', '민원 요구 내용 없이 담당자를 대상화하는 표현만 있음.', '(요구 내용이 없어 순화할 문장이 없습니다)'],
  ];
  function seed() {
    const base = Date.now() - 1000 * 60 * 60 * 30;
    return SEED.map(([title, text, stage, reason, normalReason, summary, softened], i) => ({
      id: `SB-${String(i + 1).padStart(4, '0')}`, title, text, at: new Date(base + i * 1000 * 60 * 97).toISOString(),
      aiStage: stage, stage, decided: false, choice: stage === '차단후보' ? '그대로 제출' : '-',
      rule: '시연 값(기획서 표 2의 판단)', provider: '시연 값', model: null,
      evidence: stage === '정상' ? [] : [text], reason, normalReason, summary, softened: softened || text,
      markedOriginal: text, demo: true,
    }));
  }

  let state;
  function load() {
    try { state = JSON.parse(localStorage.getItem(KEY)); } catch { state = null; }
    if (!state || !Array.isArray(state.items)) state = { items: seed(), history: [], manual: false, seq: SEED.length };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }
  load();

  // ---------- 탭 ----------
  function show(view) {
    $$('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === view)));
    $$('.view').forEach(v => { v.hidden = v.id !== `view-${view}`; });
    if (view === 'officer') renderOfficer();
    if (view === 'admin') renderAdmin();
    try { localStorage.setItem(KEY + '-tab', view); } catch {}
  }
  $$('.tabs button').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));

  async function api(path, body) {
    const r = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `서버 오류 ${r.status}`);
    return j;
  }

  // ---------- 민원인 ----------
  const EX = [
    ['가로등 고장', '성북동 골목 가로등이 일주일째 꺼져 있어 밤길이 위험합니다. 빨리 고쳐 주세요. 연락처 010-1234-5678'],
    ['도로 보수', '도대체 몇 번을 건의해야 도로를 고쳐 줍니까? 정말 답답하고 화가 납니다.'],
    ['직원 태도', '구청 직원분들은 하루 종일 커피만 마시며 신선놀음 하시나 봐요. 민원 답변 좀 빨리 주세요.'],
    ['처리 지연', '보문로 횡단보도 신호등 고장 신고한 지 2주째인데 아직도 그대로네. 내일까지 안 고치면 찾아가서 가만 안 둔다.'],
  ];
  $$('[data-ex]').forEach(b => b.addEventListener('click', () => {
    const [t, x] = EX[+b.dataset.ex];
    $('#c-title').value = t; $('#c-body').value = x; count();
  }));
  const count = () => { $('#c-count').textContent = `${$('#c-body').value.length} / 4000`; };
  $('#c-body').addEventListener('input', count);

  let pending = null; // 안내 창을 띄운 동안의 분류 결과
  $('#form-citizen').addEventListener('submit', async e => {
    e.preventDefault();
    const title = $('#c-title').value.trim(), text = $('#c-body').value.trim();
    if (!title || !text) return;
    await submit(title, text, null);
  });

  async function submit(title, text, choice) {
    const btn = $('#c-submit');
    btn.disabled = true; btn.textContent = '살펴보는 중…';
    $('#c-result').hidden = true;
    try {
      const r = await api('/api/classify', { text, manual: state.manual });
      if (r.stage === '차단후보' && !choice) { pending = { title, text, r }; openModal(r); return; }
      receive(title, text, r, choice || '-');
    } catch (err) {
      $('#c-result').hidden = false;
      $('#c-result').innerHTML = `<h2>제출하지 못했어요</h2><p>${esc(err.message)}. 서버가 켜져 있는지 확인하고 다시 눌러 주세요.</p>`;
    } finally { btn.disabled = false; btn.textContent = '제출하기'; }
  }

  function receive(title, text, r, choice) {
    const id = `SB-${String(++state.seq).padStart(4, '0')}`;
    state.items.unshift({
      id, title, text: r.maskedOriginal ? text : text, at: now(), aiStage: r.stage, stage: r.stage, decided: false, choice,
      rule: r.rule, provider: r.provider, model: r.model, tried: r.tried, first: r.first,
      evidence: r.ai?.evidence || [], reason: r.ai?.reason || (r.first.hitCount ? `1차 표현 목록에서 ${r.first.hitCount}개 표현 발견` : '1차 표현 목록에서 문제 표현 없음'),
      normalReason: r.ai?.normalReason || '(AI 응답 없음)', summary: r.summary, softened: r.softened,
      markedOriginal: r.markedOriginal, aiMade: !!r.ai,
    });
    save();
    const hidden = choice === '그대로 제출';
    $('#c-result').hidden = false;
    $('#c-result').innerHTML = `<h2>접수되었습니다</h2>
      <p>접수번호 <span class="mono">${id}</span> · 처리 기간은 주말·공휴일을 빼고 7일이에요.</p>
      ${hidden ? '<p>일부 표현은 가려진 채 담당자에게 전달됩니다. 가림이 확정되면 이유를 알려 드리고, 7일 안에 의견을 낼 수 있어요(시제품 기준).</p>' : ''}
      <p class="hint">AI 분류는 참고용이며, 담당 공무원이 최종 확인합니다.</p>`;
    $('#form-citizen').reset(); count();
  }

  function openModal(r) {
    const ev = r.ai?.evidence?.length ? r.ai.evidence : [r.maskedOriginal];
    $('#m-evidence').innerHTML = ev.map(x => `<li>${veil(x)}</li>`).join('');
    $('#m-reason').textContent = r.ai?.reason || '욕설·위협으로 보이는 표현이 있어요.';
    $('#m-suggest').textContent = r.ai?.softened || '(AI 제안 문장을 만들지 못했어요. 직접 고쳐 주세요.)';
    $('#m-use').disabled = !r.ai?.softened;
    $('#modal').hidden = false;
    $('#m-use').focus();
  }
  const closeModal = () => { $('#modal').hidden = true; };
  $('#m-use').addEventListener('click', async () => {
    const p = pending; closeModal(); if (!p) return;
    await submit(p.title, p.r.ai.softened, '제안대로 고치기');
  });
  $('#m-edit').addEventListener('click', () => {
    closeModal(); const b = $('#c-body'); b.focus(); b.setSelectionRange(0, 0);
    $('#c-result').hidden = false;
    $('#c-result').innerHTML = '<p>내용을 고친 뒤 다시 [제출하기]를 눌러 주세요. 고치지 않고 내도 접수돼요.</p>';
    pending = null;
  });
  $('#m-asis').addEventListener('click', () => {
    const p = pending; closeModal(); if (!p) return;
    receive(p.title, p.text, p.r, '그대로 제출'); pending = null;
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) $('#m-edit').click(); });

  // ---------- 담당 공무원 ----------
  let curStage = '검토필요', curId = null;
  $$('.stage-tabs button').forEach(b => b.addEventListener('click', () => {
    curStage = b.dataset.stage; curId = null;
    $$('.stage-tabs button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    renderOfficer();
  }));

  function renderOfficer() {
    ['정상', '검토필요', '차단후보'].forEach(s => { $(`[data-count="${s}"]`).textContent = state.items.filter(i => i.stage === s).length; });
    const items = state.items.filter(i => i.stage === curStage);
    $('#o-list').innerHTML = items.length ? items.map(i => `<li><button data-id="${i.id}" aria-current="${i.id === curId}">
      <span class="t">${esc(i.title)}</span>
      <span class="m"><span class="mono">${i.id}</span><span class="mono">${fmt(i.at)}</span>${i.decided ? '<span>확정됨</span>' : '<span>확인 전</span>'}</span>
    </button></li>`).join('') : '<li class="empty" style="padding:16px">이 단계의 민원이 없어요.</li>';
    $$('#o-list button').forEach(b => b.addEventListener('click', () => { curId = b.dataset.id; renderOfficer(); }));
    renderDetail(state.items.find(i => i.id === curId));
  }

  function renderDetail(it) {
    const box = $('#o-detail');
    if (!it) { box.innerHTML = '<p class="empty">왼쪽에서 민원을 고르세요.</p>'; return; }
    const aiTag = '<em class="ai-tag">AI가 만든 문장</em>';
    const showVeiled = it.stage !== '정상';
    box.innerHTML = `
      <div class="detail-head"><span class="badge ${it.stage}">${it.stage}</span><h1>${esc(it.title)}</h1></div>
      <p class="meta"><span class="mono">${it.id}</span> · 접수 <span class="mono">${fmt(it.at)}</span> · 민원인 선택: ${esc(it.choice)} · AI 단계: ${esc(it.aiStage)}</p>
      ${showVeiled ? `
      <div class="block"><span class="label">핵심 요약 ${aiTag}</span><p>${esc(it.summary)}</p></div>
      <div class="block"><span class="label">순화본 — 요구는 그대로, 공격적 표현만 바꿈 ${aiTag}</span><p>${esc(it.softened)}</p></div>` : ''}
      <div class="pair">
        <div class="block"><span class="label">AI 판단 이유 ${aiTag}</span><p>${esc(it.reason)}</p></div>
        <div class="block"><span class="label">정상 민원일 수 있는 근거 ${aiTag}</span><p>${esc(it.normalReason)}</p></div>
      </div>
      ${showVeiled ? `<button class="btn secondary small toggle-original" id="o-orig" aria-expanded="false">원문 보기</button>` : ''}
      <div class="block original veiled" id="o-orig-box" ${showVeiled ? 'hidden' : ''}>
        <span class="label">원문 (개인정보는 *** 로 가림)</span><p>${veil(it.markedOriginal || it.text)}</p>
        ${/⟦/.test(it.markedOriginal || '') ? '<button class="btn tertiary small" id="o-lift">가린 표현 보기</button>' : ''}
      </div>
      <div class="decide">
        <button class="btn primary" id="o-confirm">${esc(it.stage)}(으)로 확정</button>
        <div><label for="o-new">바꿀 단계</label><select id="o-new">${['정상', '검토필요', '차단후보'].filter(s => s !== it.stage).map(s => `<option>${s}</option>`).join('')}</select></div>
        <div><label for="o-why">사유(선택)</label><select id="o-why"><option value="">고르지 않음</option><option>정당한 비판·요구</option><option>공격 표현 있음</option><option>맥락상 판단</option><option>AI 순화본 오류</option></select></div>
        <button class="btn secondary" id="o-change">단계 변경</button>
      </div>
      <div class="meta"><details><summary>AI 처리 기록</summary>
        <p>${esc(it.rule)} · 답한 AI: ${esc(it.provider)}${it.model ? ` (${esc(it.model)})` : ''}${it.first ? ` · 1차 목록 ${it.first.ms}ms` : ''}</p>
        ${(it.tried || []).map(t => `<p>${esc(t.provider)}: ${t.ok ? '성공' : esc(t.reason)}</p>`).join('')}
      </details></div>`;
    $('#o-orig')?.addEventListener('click', e => {
      const b = $('#o-orig-box'); b.hidden = !b.hidden;
      e.target.setAttribute('aria-expanded', String(!b.hidden)); e.target.textContent = b.hidden ? '원문 보기' : '원문 닫기';
    });
    $('#o-lift')?.addEventListener('click', e => { const b = $('#o-orig-box'); b.classList.toggle('lifted'); e.target.textContent = b.classList.contains('lifted') ? '다시 가리기' : '가린 표현 보기'; });
    $('#o-confirm').addEventListener('click', () => decide(it, it.stage, '확정', ''));
    $('#o-change').addEventListener('click', () => decide(it, $('#o-new').value, '변경', $('#o-why').value));
  }

  function decide(it, stage, action, reason) {
    state.history.unshift({ at: now(), id: it.id, aiStage: it.aiStage, from: it.stage, to: stage, action, reason: reason || '-', provider: it.provider, model: it.model });
    it.stage = stage; it.decided = true;
    save();
    curStage = stage;
    $$('.stage-tabs button').forEach(x => x.setAttribute('aria-selected', String(x.dataset.stage === stage)));
    renderOfficer();
  }

  // ---------- 관리자 ----------
  $('#a-manual').addEventListener('change', e => { state.manual = e.target.checked; save(); renderAdmin(); });
  $('#a-reset').addEventListener('click', () => {
    if (!confirm('브라우저에 저장된 민원과 판단 이력을 지우고 시연 데이터 10건으로 되돌릴까요?')) return;
    state = { items: seed(), history: [], manual: false, seq: SEED.length }; save(); renderAdmin();
  });

  let pubLoaded = false;
  function renderAdmin() {
    $('#a-manual').checked = state.manual;
    const n = s => state.items.filter(i => i.stage === s).length;
    const decisions = state.history.length, changes = state.history.filter(h => h.action === '변경').length;
    $('#a-stats').innerHTML = [
      ['전체 접수', state.items.length, ''],
      ['정상', n('정상'), '정상'], ['검토필요', n('검토필요'), '검토필요'], ['차단후보', n('차단후보'), '차단후보'],
      ['판단 변경률', decisions ? `${Math.round(changes / decisions * 100)}%` : '-', '', `${changes} ÷ ${decisions}건`],
    ].map(([k, v, s, sub]) => `<div class="stat"><span class="k">${s ? `<span class="badge ${s}">${k}</span>` : k}</span><div class="v">${v}</div>${sub ? `<span class="hint mono">${sub}</span>` : ''}</div>`).join('');
    $('#a-history tbody').innerHTML = state.history.length ? state.history.map(h => `<tr>
      <td class="mono">${fmt(h.at)}</td><td class="mono">${h.id}</td><td><span class="badge ${h.aiStage}">${h.aiStage}</span></td>
      <td><span class="badge ${h.to}">${h.to}</span></td><td>${h.action}</td><td>${esc(h.reason)}</td><td>${esc(h.provider)}</td></tr>`).join('')
      : '<tr><td colspan="7" class="hint">아직 기록이 없어요. 담당 공무원 화면에서 단계를 확정하거나 바꾸면 여기에 쌓여요.</td></tr>';
    if (!pubLoaded) { pubLoaded = true; loadPublic(); }
  }
  const badge = (live, reason) => live ? '<span class="status live">실시간</span>' : `<span class="status demo">시연 값</span> <span class="hint">실패 이유: ${esc(reason)}</span>`;
  async function loadPublic() {
    try {
      const r = await api('/api/law?kind=lawmaking');
      $('#a-lawmaking').innerHTML = `<p>${badge(r.live, r.reason)}</p>` + r.items.map(i => `<div class="block"><p><b>${esc(i.title)}</b></p><p class="hint">${esc([i.org, i.period, i.note].filter(Boolean).join(' · '))}</p></div>`).join('');
    } catch (e) { $('#a-lawmaking').innerHTML = `<p class="hint">불러오지 못했어요: ${esc(e.message)}</p>`; }
    try {
      const r = await api('/api/law?kind=data');
      $('#a-data').innerHTML = `<p>${badge(r.live, r.reason)}</p><ul>` + r.items.map(i => `<li>${esc(i.keyword)} <span class="hint mono">${esc(i.count)}</span></li>`).join('') + '</ul>';
    } catch (e) { $('#a-data').innerHTML = `<p class="hint">불러오지 못했어요: ${esc(e.message)}</p>`; }
  }

  // ---------- 챗봇 ----------
  const QS = [
    '차단후보로 분류되면 접수가 거부되거나 처리 기간이 늦어지나요?',
    'AI가 제 이름이나 전화번호를 수집하나요?',
    'AI 분류가 잘못됐다고 생각하면 어떻게 이의를 제기하나요?',
    'AI 판단과 제 생각이 다르면 바꿀 수 있나요?',
    'AI가 계속 잘못 판단하면 관리자는 어떻게 멈추나요?',
  ];
  $('#q-examples').innerHTML = QS.map((q, i) => `<button class="chip" data-q="${i}">${esc(q)}</button>`).join('');
  $$('[data-q]').forEach(b => b.addEventListener('click', () => ask(QS[+b.dataset.q])));
  $('#form-chat').addEventListener('submit', e => { e.preventDefault(); const q = $('#q').value.trim(); if (q) ask(q); });

  async function ask(q) {
    const log = $('#chat-log');
    log.insertAdjacentHTML('beforeend', `<div class="msg me">${esc(q)}</div>`);
    const wait = document.createElement('div'); wait.className = 'msg bot'; wait.textContent = '문서를 찾는 중…'; log.append(wait);
    $('#q').value = '';
    try {
      const r = await api('/api/chat', { question: q });
      const laws = (r.laws || []).map(l => `<br>· ${esc(l.name)}: ${esc(l.value)} ${l.live ? '<span class="status live">실시간</span>' : `<span class="status demo">시연 값</span> <span class="hint">(${esc(l.reason)})</span>`}`).join('');
      wait.innerHTML = `${esc(r.answer)}
        <div class="src">${r.found && !r.demo ? '<em class="ai-tag">AI가 만든 문장</em> ' : ''}근거 문서: ${esc(r.sources.join(', '))}<br>답한 AI: ${esc(r.provider)}${r.model ? ` (${esc(r.model)})` : ''}${laws ? `<br>현행 시행일:${laws}` : ''}</div>`;
    } catch (e) { wait.textContent = `답을 받지 못했어요: ${e.message}`; }
    wait.scrollIntoView({ block: 'nearest' });
  }

  let tab = 'citizen';
  try { tab = localStorage.getItem(KEY + '-tab') || 'citizen'; } catch {}
  show(tab);
})();
