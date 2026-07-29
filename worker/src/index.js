const SERVICES = {
  // operation 경로는 공공데이터포털 활용신청 화면의 "요청주소"와 다르면 그 값으로 바꾸세요.
  temperature: 'https://apis.data.go.kr/1192000/apVhdService_Tgcw15/getOpnTgcw15',
  salinity: 'https://apis.data.go.kr/1192000/apVhdService_Tgcsy15/getOpnTgcsy15',
  current: 'https://apis.data.go.kr/1192000/apVhdService_ContOc15/getOpnContOc15',
  grid2: 'https://apis.data.go.kr/1192000/apVhdService_G2s/getOpnG2s'
};
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

function valid(query) {
  return /^GR2_[A-Z0-9]+$/.test(query.gridCd || '') && /^\d{8}$/.test(query.analsYmd || '') && /^\d{4}$/.test(query.analsTime || '');
}
async function fetchXml(url, params, key) {
  const target = new URL(url);
  target.search = new URLSearchParams({ serviceKey: key, ...params }).toString();
  const response = await fetch(target, { headers: { Accept: 'application/xml, text/xml, */*' } });
  const xml = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${xml.slice(0, 300)}`);
  return xml;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true });
    if (url.pathname !== '/api/ocean') return json({ error: 'Not found' }, 404);
    if (!env.DATA_GO_KR_SERVICE_KEY) return json({ error: 'Worker secret DATA_GO_KR_SERVICE_KEY가 없습니다.' }, 500);
    const params = Object.fromEntries(['gridCd', 'analsYmd', 'analsTime'].map(k => [k, url.searchParams.get(k) || '']));
    if (!valid(params)) return json({ error: 'gridCd, analsYmd, analsTime 형식이 올바르지 않습니다.' }, 400);
    try {
      const [temperature, salinity, current] = await Promise.all([
        fetchXml(SERVICES.temperature, params, env.DATA_GO_KR_SERVICE_KEY),
        fetchXml(SERVICES.salinity, params, env.DATA_GO_KR_SERVICE_KEY),
        fetchXml(SERVICES.current, params, env.DATA_GO_KR_SERVICE_KEY)
      ]);
      return json({ temperature, salinity, current });
    } catch (error) { return json({ error: '공공 API 호출 실패', detail: error.message }, 502); }
  }
};
