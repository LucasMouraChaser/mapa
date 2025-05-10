// page–meu-perfil.js
import { session } from 'wix-storage';
$w.onReady(() => {
  const fc = session.getItem('lastForecast');
  if (fc) {
    // exiba em um Text, coloque num iFrame, etc.
    $w('#txtUltima').text = 'Última previsão enviada:\n' + fc.substring(0,120) + '...';
    // se quiser desenhar, injete o GeoJSON num novo mapa embed
  }
});