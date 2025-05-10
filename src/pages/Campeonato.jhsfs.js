// Página “Campeonato” – front-end

import wixUsers          from 'wix-users';
import { currentMember } from 'wix-members';
import wixData           from 'wix-data';

import {
  saveForecast,
  getLatestForecast,
  fetchReportsByTimeWindow
} from 'backend/forecasts';

import { fetchReports }  from 'backend/reports';
import * as turf         from '@turf/turf';

// Pesos, bônus SS e penalidades por ponto fora do polígono
const weights    = { granizo: 5, vento: 7, tornado: 10 };
const ssBonus    = { granizo: 2, vento: 3, tornado: 4 };
const outPenalty = { granizo: -3, vento: -3, tornado: -3 };

/* ─── Config ─────────────────────────────────────── */
const MAP_IFRAME = '#bswc';
const CHANNEL    = 'main';
const DEADLINE   = '11';                 // 11 h horário local (apenas hora)
const UPDATE_MS  = 5 * 60 * 1000;        // 5 min

/* ─── Estado ─────────────────────────────────────── */
let polygons  = [];     // últimos polígonos do usuário p/ o dia ativo
let refreshId = null;   // id do setInterval() do placar

/* ─── Helpers de data ────────────────────────────── */
const todayISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const isPastDeadline = () => new Date().getHours() >= +DEADLINE;

const addDaysISO = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return todayISO(d);
};

const isoAt11 = iso => `${iso}T${DEADLINE}:00-03:00`;

/* ─── Auth → iframe ─────────────────────────────── */
async function sendAuthToIframe($map) {
  const { currentUser } = wixUsers;
  const loggedIn = currentUser.loggedIn;

  let nick = '', email = '';
  if (loggedIn) {
    const m = await currentMember.getMember();
    nick  = (m?.profile?.nickname    || '').trim();
    email = (m?.contact?.emails?.[0] || '').trim();
  }
  $map.postMessage({ loggedIn, nick, email }, CHANNEL);
}

/* ─── Recalcula placar ──────────────────────────── */
async function refreshScoreboard($map, { dateISO, probPct }) {
  if (!polygons.length) return;

  // 1) busca relatórios dentro da janela
  let reports = [];
  if (dateISO === todayISO() && isPastDeadline()) {
    reports = await fetchReportsByTimeWindow(
      isoAt11(todayISO()),
      isoAt11(addDaysISO(todayISO(), 1))
    );
  } else {
    reports = await fetchReportsByTimeWindow(
      isoAt11(dateISO),
      isoAt11(addDaysISO(dateISO, 1))
    );
  }

  // 2) inicializa estatísticas com contadores e pontos
  const stats = {
    granizo: { hit: 0, miss: 0, ss: 0, pts: 0 },
    vento:   { hit: 0, miss: 0, ss: 0, pts: 0 },
    tornado:{ hit: 0, miss: 0, ss: 0, pts: 0 }
  };

  // 3) percorre cada relatório, conta e acumula pontos
  reports.forEach(rep => {
    const haz = rep.hazard;
    if (!stats[haz]) return;

    const point = turf.point([rep.lng, rep.lat]);
    const inside = polygons.some(poly => turf.booleanPointInPolygon(point, poly));

    const sev = String(rep.sev || rep.SEV || 'NOR').trim().toUpperCase();

    if (inside) {
      stats[haz].hit++;
      let pts = weights[haz] || 0;
      if (sev === 'SS') {
        stats[haz].ss++;
        pts += ssBonus[haz] || 0;
      }
      stats[haz].pts += pts;
    } else {
      stats[haz].miss++;
      stats[haz].pts += outPenalty[haz] || 0;
    }
  });

  // 4) envia os resultados atualizados ao iframe do mapa
  $map.postMessage({ action: 'updateScore', stats }, CHANNEL);
}

/* ─── Placar inicial (pós-deadline) ─────────────── */
async function bootstrapScoreboard($map) {
  const user = wixUsers.currentUser;
  if (!user.loggedIn) return;
  const today    = todayISO();
  const fc       = await getLatestForecast(user.id, today);
  if (!fc?.features?.length) return;

  polygons = fc.features
    .filter(f => f.geometry?.type === 'Polygon')
    .map(f => ({ type:'Feature', geometry:f.geometry }));

  const currentProb = Number($w('#probSel').value);
  await refreshScoreboard($map, { dateISO: today, probPct: currentProb });

  refreshId = setInterval(() => {
    const p = Number($w('#probSel').value);
    refreshScoreboard($map, { dateISO: today, probPct: p });
  }, UPDATE_MS);
}

/* ─── ON READY ─────────────────────────────────── */
$w.onReady(() => {
  const $map = $w(MAP_IFRAME);

  $map.onMessage(async (evt) => {
    const msg = evt.data;
    console.log("📬 requestScore data:", msg.data);

    // handshake
    if (msg === 'ready') {
      await sendAuthToIframe($map);
      if (isPastDeadline()) await bootstrapScoreboard($map);
      return;
    }
    if (!msg?.action) return;

    switch (msg.action) {
      case 'updateScore': {
        const stats = msg.stats || {};
        const tbl   = document.getElementById('scoreboard');

        // 1) zera todas as linhas
        tbl.querySelectorAll('tbody tr').forEach(row => {
          row.cells[1].textContent = '0';
          row.cells[2].textContent = '0';
          row.cells[3].textContent = '0 %';
          row.cells[4].textContent = '0';
        });

        // 2) preenche cada linha com os dados já calculados no backend
        Object.entries(stats).forEach(([hazard, s]) => {
          const row = tbl.querySelector(`tr[data-hazard="${hazard}"]`);
          if (!row) return;

          const hit   = s.hit  || 0;
          const miss  = s.miss || 0;
          const ratio = (hit + miss)
            ? `${Math.round(hit * 100 / (hit + miss))} %`
            : '0 %';
          const pts   = s.pts  || 0;

          row.cells[1].textContent = hit;
          row.cells[2].textContent = miss;
          row.cells[3].textContent = ratio;
          row.cells[4].textContent = pts;
        });
        break;
      }
      case 'requestScore': {
        const { dateISO = todayISO(), probPct = 0 } = msg.data;
        const fc = await getLatestForecast(wixUsers.currentUser.id, dateISO);
        polygons = (fc?.features||[])
          .filter(f => f.geometry?.type==='Polygon')
          .map(f => ({ type:'Feature', geometry:f.geometry }));
        await refreshScoreboard($map, { dateISO, probPct });
        break;
      }
case 'fetchReports': {
  try {
    // recebe a janela de deadline enviada pelo mapa
    const { startISO, endISO } = msg.data;
    // busca apenas entre essas duas datas
    const reports = await fetchReportsByTimeWindow(startISO, endISO);
    // converte para GeoJSON
    const features = reports.map(r => ({
      type: 'Feature',
      geometry: { type:'Point', coordinates:[r.lng, r.lat] },
      properties: { hazard: r.hazard, sev: r.sev || 'NOR' }
    }));
    $map.postMessage({ action:'reportsData', data:{ features } }, CHANNEL);
  } catch (e) {
    console.error('Erro ao buscar relatos por janela:', e);
    $map.postMessage({ action:'reportsData', data:{ features:[] } }, CHANNEL);
  }
  break;
}
      case 'requestForecast': {
        const user = wixUsers.currentUser;
        if (!user.loggedIn) return;
        const geojson = await getLatestForecast(user.id, msg.data.dateISO);
        $map.postMessage({ action:'deliverForecast', geojson }, CHANNEL);
        break;
      }
      case 'saveforecast': {
        const user = wixUsers.currentUser;
        if (!user.loggedIn) return;
        await saveForecast({
          memberId : user.id,
          dateISO  : msg.data.dateISO,
          dayType  : msg.data.dayType,
          geojson  : msg.data.geojson
        });
        break;
      }
      case 'requestLayers': {
        const { items } = await wixData.query('layers')
          .eq('key','outlook-prevots')
          .descending('_createdDate')
          .limit(1)
          .find({ suppressAuth:true });
        const geojson = items.length ? items[0].geojson : null;
        $map.postMessage({ action:'deliverLayer', key:'outlook-prevots', geojson }, CHANNEL);
        break;
      }
    }
  });

  if (typeof wixUsers.onLogin  === 'function') wixUsers.onLogin(() => sendAuthToIframe($map));
  if (typeof wixUsers.onLogout === 'function') wixUsers.onLogout(() => {
    polygons = [];
    if (refreshId) { clearInterval(refreshId); refreshId = null; }
    sendAuthToIframe($map);
  });
});