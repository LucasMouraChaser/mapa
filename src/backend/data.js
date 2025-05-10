// backend/data.js
import wixData from 'wix-data';

/**
 *  relatos_afterInsert — executa depois de cada INSERT na coleção “relatos”.
 *  Agora ele só registra nos logs e devolve o item; não publica nada.
 */
export async function relatos_afterInsert(item, context) {

  try {
    /* escreve nos logs para você acompanhar, se quiser */
    console.log('Relato salvo (hook pass-through):', {
      hazard : (item.hazard || '').toLowerCase(),
      lat    : item.lat,
      lng    : item.lon
    });

  } catch (err) {
    /* nunca lance erro — apenas registre */
    console.error('HOOK relatos_afterInsert (pass-through) falhou:', err);
  }

  return item;     // devolve SEMPRE para não anular o insert
}