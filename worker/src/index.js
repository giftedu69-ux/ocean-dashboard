const OBSERVATION_API = 'https://apis.data.go.kr/1192136/twRecent/GetTWRecentApiService';
const NIFS_API = 'https://www.nifs.go.kr/OpenAPI_json';
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
function getItems(payload) {
  const body = payload?.response?.body || payload?.body || payload?.data || {};
  const candidate = body?.items?.item || body?.items || body?.item || [];
  return Array.isArray(candidate) ? candidate : candidate ? [candidate] : [];
}
function assertSuccess(payload) {
  const header = payload?.response?.header || payload?.header || {};
  if (header.resultCode && header.resultCode !== '00') throw new Error(header.resultMsg || `API 오류 ${header.resultCode}`);
}
function nifsUrl(id, key, params = {}) {
  const target = new URL(NIFS_API);
  target.search = new URLSearchParams({ id, key, ...params }).toString();
  return target;
}
async function fetchNifs(id, key, params) {
  const response = await fetch(nifsUrl(id, key, params), { headers: { Accept: 'application/json' } });
  const raw = await response.text();
  if (!response.ok) throw new Error(`수산과학원 API HTTP ${response.status}`);
  const payload = JSON.parse(raw);
  assertSuccess(payload);
  return getItems(payload);
}
function nifsStations(observations, codes) {
  const locations = new Map(codes.map(item => [String(item.sta_cde), item]));
  const grouped = new Map();
  for (const item of observations) {
    const code = String(item.sta_cde || '');
    if (!code) continue;
    const station = grouped.get(code) || { code, name: item.sta_nam_kor || code, observedAt: '', layers: {}, repair: item.rpr_yn || item.repaire_gbn || '' };
    const layer = { '1': 'surface', '2': 'middle', '3': 'bottom' }[String(item.obs_lay)] || `layer${item.obs_lay}`;
    const temp = item.wtr_tmp;
    if (temp !== undefined && temp !== null && temp !== '') station.layers[layer] = Number(temp);
    station.observedAt = [item.obs_dat, item.obs_tim].filter(Boolean).join(' ') || station.observedAt;
    const location = locations.get(code);
    if (location) {
      station.lat = Number(location.lat);
      station.lng = Number(location.lon);
      station.depths = { surface: location.sur_dep, middle: location.mid_dep, bottom: location.bot_dep };
    }
    grouped.set(code, station);
  }
  return [...grouped.values()].filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng));
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true });
    if (url.pathname === '/api/nifs-temperature') {
      if (!env.NIFS_API_KEY) return json({ error: 'Worker secret NIFS_API_KEY가 없습니다.' }, 500);
      try {
        const [observations, codes] = await Promise.all([
          fetchNifs('risaList', env.NIFS_API_KEY),
          fetchNifs('risaCode', env.NIFS_API_KEY, { use_yn: 'Y' })
        ]);
        return json({ stations: nifsStations(observations, codes), source: '국립수산과학원 실시간 해양수산환경 관측시스템' });
      } catch (error) {
        return json({ error: '수산과학원 어장 수온 API 호출 실패', detail: error.message }, 502);
      }
    }
    if (url.pathname !== '/api/buoy') return json({ error: 'Not found' }, 404);
    if (!env.DATA_GO_KR_SERVICE_KEY) return json({ error: 'Worker secret DATA_GO_KR_SERVICE_KEY가 없습니다.' }, 500);

    const obsCode = url.searchParams.get('obsCode') || '';
    if (!/^(TW|HB|YS|KG)_\d{4}$/.test(obsCode)) return json({ error: '유효하지 않은 관측소 코드입니다.' }, 400);

    const target = new URL(OBSERVATION_API);
    target.search = new URLSearchParams({
      serviceKey: env.DATA_GO_KR_SERVICE_KEY, type: 'json', pageNo: '1', numOfRows: '1', obsCode,
      reqDate: new Date().toISOString().slice(0, 10).replaceAll('-', ''), min: '60'
    }).toString();

    try {
      const response = await fetch(target, { headers: { Accept: 'application/json' } });
      const raw = await response.text();
      if (!response.ok) throw new Error(`공공 API HTTP ${response.status}: ${raw.slice(0, 300)}`);
      const payload = JSON.parse(raw);
      assertSuccess(payload);
      const observation = getItem(payload);
      if (!observation) return json({ observation: null, message: '해당 관측소의 최신 관측값이 없습니다.' });
      return json({ observation });
    } catch (error) {
      return json({ error: '관측부이 API 호출 실패', detail: error.message }, 502);
    }
  }
};