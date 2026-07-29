const OBSERVATION_API = 'https://apis.data.go.kr/1192136/twRecent/GetTWRecentApiService';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

function getItem(payload) {
  const body = payload?.response?.body || payload?.body || {};
  const item = body?.items?.item || body?.item;
  return Array.isArray(item) ? item[0] : item;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true });
    if (url.pathname !== '/api/buoy') return json({ error: 'Not found' }, 404);
    if (!env.DATA_GO_KR_SERVICE_KEY) return json({ error: 'Worker secret DATA_GO_KR_SERVICE_KEY가 없습니다.' }, 500);

    const obsCode = url.searchParams.get('obsCode') || '';
    if (!/^(TW|HB|YS|KG)_\d{4}$/.test(obsCode)) {
      return json({ error: '유효하지 않은 관측소 코드입니다.' }, 400);
    }

    const target = new URL(OBSERVATION_API);
    target.search = new URLSearchParams({
      serviceKey: env.DATA_GO_KR_SERVICE_KEY,
      type: 'json',
      pageNo: '1',
      numOfRows: '1',
      obsCode,
      reqDate: new Date().toISOString().slice(0, 10).replaceAll('-', ''),
      min: '60'
    }).toString();

    try {
      const response = await fetch(target, { headers: { Accept: 'application/json' } });
      const raw = await response.text();
      if (!response.ok) throw new Error(`공공 API HTTP ${response.status}: ${raw.slice(0, 300)}`);
      const payload = JSON.parse(raw);
      const resultCode = payload?.response?.header?.resultCode || payload?.header?.resultCode;
      const resultMsg = payload?.response?.header?.resultMsg || payload?.header?.resultMsg;
      if (resultCode && resultCode !== '00') throw new Error(resultMsg || `공공 API 오류 ${resultCode}`);
      const observation = getItem(payload);
      if (!observation) return json({ observation: null, message: '해당 관측소의 최신 관측값이 없습니다.' });
      return json({ observation });
    } catch (error) {
      return json({ error: '관측부이 API 호출 실패', detail: error.message }, 502);
    }
  }
};