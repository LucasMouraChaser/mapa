/***************************************************
 * HTTP Functions  –  BSWC 2025
 *  • POST    /_functions/reports/create
 *  • GET     /_functions/reports/list?date=yyyy-mm-dd
 ***************************************************/
import wixData from 'wix-data';

// utilitário CORS
const cors = extra => ({
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  ...extra
});

// stub p/ compatibilidade
export function use_reports() {
  return { status: 200, headers: cors(), body: { ok: true } };
}

/* POST /_functions/reports/create */
export function options_reports_create() {
  return { status: 204, headers: cors(), body: {} };
}
export async function post_reports_create(request) {
  const data = await request.body.json();
  if (!data?.dateISO || !data?.hazard || data.lat == null || data.lon == null) {
    return {
      status: 400,
      headers: cors({ 'Content-Type': 'application/json' }),
      body:    { err: 'campos obrigatórios ausentes' }
    };
  }
  const pad  = n => String(n).padStart(2, '0');
  const full = new Date(data.dateISO);
  const hora = (data.hora || `${pad(full.getUTCHours())}:${pad(full.getUTCMinutes())}:00`).trim();
  const date = `${pad(full.getUTCDate())}/${pad(full.getUTCMonth()+1)}/${full.getUTCFullYear()}`;
  const saved = await wixData.insert('relatos', {
    date,
    hora,
    hazard : data.hazard,
    sev    : (data.sev || 'NOR').toUpperCase(),
    lat    : Number(data.lat),
    lon    : Number(data.lon),
    autor  : data.autor || 'admin'
  });
  return {
    status: 200,
    headers: cors({ 'Content-Type': 'application/json' }),
    body:    saved
  };
}

/* GET /_functions/reports/list?date=YYYY-MM-DD */
export function options_reports_list() {
  return { status: 204, headers: cors(), body: {} };
}
export async function get_reports_list(request) {
  try {
    const dateISO = request.query?.date || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      return {
        status: 400,
        headers: cors({ 'Content-Type': 'application/json' }),
        body:    { err: 'parâmetro ?date ausente ou inválido' }
      };
    }
    const pad = n => String(n).padStart(2, '0');
    const d   = new Date(dateISO);
    const dateTxt = `${pad(d.getUTCDate())}/${pad(d.getUTCMonth()+1)}/${d.getUTCFullYear()}`;
    const { items = [] } = await wixData.query('relatos')
      .eq('date', dateTxt)
      .limit(1000)
      .find();
    const feats = items.flatMap(it => {
      const lat = Number(it.lat), lon = Number(it.lon);
      if (!isFinite(lat) || !isFinite(lon)) return [];
      return [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: { hazard: it.hazard, sev: it.sev, hora: it.hora, autor: it.autor }
      }];
    });
    return {
      status: 200,
      headers: cors({ 'Content-Type': 'application/json' }),
      body:    { type: 'FeatureCollection', features: feats }
    };
  } catch (err) {
    console.error('reports/list', err);
    return {
      status: 500,
      headers: cors({ 'Content-Type': 'application/json' }),
      body:    { err: String(err) }
    };
  }
}