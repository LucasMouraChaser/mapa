import { create as createReport } from 'backend/reports';

$w.onReady(() => {
  // identifica corretamente o HTML embed pelo id (ex: #html1)
  const html = $w('#html1');

  html.onMessage(async (event) => {
    // 1) mensagem bruta
    console.log('⚡ admin recebeu mensagem do iframe:', event.data);

    // 2) decode JSON
    let payload;
    try {
      payload = JSON.parse(event.data);
      console.log('🔍 payload decodificado:', payload);
    } catch (e) {
      console.warn('⚠ payload inválido:', event.data);
      return;
    }

    // 3) só interessa saveReport
    if (payload.action !== 'saveReport') {
      console.warn('⚠ ação desconhecida:', payload.action);
      return;
    }

    // 4) tenta gravar
    try {
      console.log('➡️ Chamando createReport com', payload.data);
      const res = await createReport(payload.data);
      console.log('✅ createReport retornou:', res);

      // 5) avisa o embed que deu certo
      html.postMessage(JSON.stringify({ ok: true }), '*');

    } catch (err) {
      console.error('❌ erro ao gravar relato', err);
      html.postMessage(JSON.stringify({ ok: false, msg: err.message }), '*');
    }
  });
});