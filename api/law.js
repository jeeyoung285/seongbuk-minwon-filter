// 관리자 화면용: 입법예고(LAWMAKING_OC) · 법령 시행일(LAW_OC) · 민원 키워드(DATA_GO_KR_KEY)
const { lawInfo, lawmaking, minwonKeywords } = require('./_lib/publicApi');

module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const kind = url.searchParams.get('kind') || 'lawmaking';
  try {
    if (kind === 'law') return res.status(200).json(await lawInfo(url.searchParams.get('name') || '민원 처리에 관한 법률'));
    if (kind === 'data') return res.status(200).json(await minwonKeywords());
    return res.status(200).json(await lawmaking(url.searchParams.get('q') || '민원 처리에 관한 법률'));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
