// backend/data/Forecasts.js
import wixUsersBackend from 'wix-users-backend';

export async function beforeInsert(item, context) {
  console.log('➤ hook beforeInsert disparou para Forecasts');
  if (context.user && context.user.id) {
    const user = await wixUsersBackend.getUser(context.user.id);
    const full = user.profile.fullName
               || [user.profile.firstName, user.profile.lastName]
                    .filter(Boolean).join(' ');
    item.nick = full || '—';
  } else {
    item.nick = '—';
  }
  return item;
}