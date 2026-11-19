// 답변참고문서/청킹 만 읽는다(원본·청킹전·청킹제외는 읽지 않음 — 같은 내용이 겹치기 때문)
const fs = require('fs');
const path = require('path');

const DIR = path.join(process.cwd(), 'docs', '답변참고문서', '청킹');
let cache = null;

function load() {
  if (cache) return cache;
  cache = fs.readdirSync(DIR).filter(f => f.endsWith('.md')).map(f => {
    const text = fs.readFileSync(path.join(DIR, f), 'utf8');
    const first = text.split(/\r?\n/)[0] || '';
    const m = first.match(/#\s*(.+?)\s*·\s*##\s*(.+)$/);
    const doc = m ? m[1].trim() : f.replace(/_\d+_.*$/, '');
    const section = m ? m[2].trim() : '';
    const kw = (text.match(/^키워드:\s*(.+)$/m) || [])[1] || '';
    return { file: f, doc, section, text, grams: grams(doc + ' ' + section + ' ' + kw + ' ' + text), head: grams(doc + ' ' + section + ' ' + kw) };
  });
  return cache;
}

// 한글은 낱말 끝(조사)이 바뀌어도 맞도록 두 글자씩 끊어 비교한다
function grams(t) {
  const s = new Set();
  for (const w of String(t).toLowerCase().split(/[^가-힣a-z0-9]+/)) {
    if (w.length < 2) continue;
    for (let i = 0; i < w.length - 1; i++) s.add(w.slice(i, i + 2));
  }
  return s;
}

const STOP = new Set(['하나', '나요', '어요', '해요', '인가', '있나', '어떻', '떻게', '무엇', '누구', '되나', '하면', '이에', '에게', '습니', '니다', '은지', '는지']);

function search(query, k = 5) {
  const q = [...grams(query)].filter(g => !STOP.has(g));
  if (!q.length) return [];
  return load()
    .map(c => {
      let score = 0;
      for (const g of q) { if (c.grams.has(g)) score += 1; if (c.head.has(g)) score += 2; }
      return { ...c, score: score / q.length };
    })
    .filter(c => c.score > 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

function contactChunk() {
  return load().find(c => c.doc.includes('문의처'));
}

module.exports = { search, contactChunk, load };
