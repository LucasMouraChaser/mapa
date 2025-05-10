// pages/Ranking.js
import { get_ranking_list } from 'backend/ranking';

$w.onReady(() => {
  // 1) Escuta mensagens vindas do iframe
  $w('#htmlRanking').onMessage(async (event) => {
    let msg = event.data;
    if (typeof msg === 'string') {
      try { msg = JSON.parse(msg); }
      catch { return; }
    }

    // 2) Só reagimos a loadRanking
    if (msg.type === 'loadRanking') {
      const { from, to } = msg;
      try {
        const rankingArray = await get_ranking_list({ query: { from, to } });
        // 3) Devolve os dados ao iframe
        $w('#htmlRanking').postMessage(
          JSON.stringify({ type: 'rankingData', payload: rankingArray }),
          '*'
        );
      } catch (err) {
        console.error('Erro ao carregar ranking:', err);
        $w('#htmlRanking').postMessage(
          JSON.stringify({ type: 'rankingError', message: err.message }),
          '*'
        );
      }
    }
  });
});