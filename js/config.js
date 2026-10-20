/* Налаштування сайту.
   formEndpoint — адреса вашого Cloudflare Worker, який приймає заявки та пересилає їх у Telegram
   (інструкція — worker/README.md). Поки порожньо, форма покаже повідомлення з номером телефону. */
window.SITE_CONFIG = {
  formEndpoint: 'https://grandam-booking.korotun545.workers.dev'
};
