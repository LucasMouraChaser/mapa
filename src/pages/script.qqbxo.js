import { populateForecastsNick } from 'backend/populateForecastsNick';

$w.onReady(() => {
  $w('#btnPopulate').onClick(async () => {
    const res = await populateForecastsNick();
    console.log(res.message);
    $w('#txtResult').text = res.message;
  });
});