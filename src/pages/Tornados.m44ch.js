import wixData from 'wix-data';

$w.onReady(() => {
  // 1) Responder ao iframe pedidos de lista de tornados
  $w('#html5').onMessage(msg => {
    const { type, data } = msg.data || {};
    if (type === 'REQUEST_TORNADO_LIST') {
      wixData.query('Tornados1')
        .find()
        .then(res => {
          const list = res.items.map(item => ({
            _id: item._id,
            title: item.title,
            date: item.periodStart   // você pode exibir periodEnd se preferir
          }));
          // envia de volta ao iframe
          $w('#html5').postMessage({ type: 'TORNADO_LIST', data: list }, '*');
        })
        .catch(err => console.error('Erro ao buscar Tornados1:', err));
    }
    // 2) Gravar dados enviados pelo iframe
    else if (type === 'SEND_TORNADO_DATA') {
      const {
        tornadoId,
        title,
        tornadoDt,
        periodStart,
        periodEnd,
        pathGeoJSON,
        damages
      } = data;

      const isUpdate = Boolean(tornadoId);
      const item = {
        title,
        periodStart,
        periodEnd,
        pathGeoJSON
      };

      const op = isUpdate
        ? wixData.update('Tornados1', { _id: tornadoId, ...item })
        : wixData.insert('Tornados1', item);

      op
        .then(res => {
          const tornadoRef = res._id;
          // grava cada ponto de dano
          return Promise.all(
            damages.map(f => {
              const [lon, lat] = f.geometry.coordinates;
              return wixData.insert('DamagePoints', {
                tornadoRef,
                latitude: lat,
                longitude: lon,
                intensity: f.properties.intensity,
                description: f.properties.description
              });
            })
          );
        })
        .then(() => {
          console.log('✅ Tudo salvo com sucesso');
        })
        .catch(err => {
          console.error('❌ Erro ao gravar:', err);
        });
    }
  });

  // 3) Ao carregar a página, já buscamos todos os tornados e danos para plotar no mapa do iframe
  Promise.all([
    wixData.query('Tornados1').find(),
    wixData.query('DamagePoints').find()
  ])
    .then(([tRes, dRes]) => {
      const tornados = tRes.items.map(t => ({
        _id: t._id,
        title: t.title,
        pathGeoJSON: t.pathGeoJSON
      }));
      const damages = dRes.items.map(d => ({
        tornadoRef: d.tornadoRef,
        latitude: d.latitude,
        longitude: d.longitude,
        intensity: d.intensity,
        description: d.description
      }));
      $w('#html5').postMessage(
        { type: 'LOAD_EXISTING_DATA', data: { tornados, damages } },
        '*'
      );
    })
    .catch(err => console.error('Erro ao buscar dados iniciais:', err));
});