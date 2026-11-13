/* Заявка с сайта → Telegram. Общий модуль для v5 и v6.

   Как заявка доходит до вас:
   1) endpoint задан  → сайт сам отправляет заявку на ваш обработчик (server/lead-worker.js),
      тот пересылает её в Telegram. Клиенту ничего открывать не нужно. Токен бота на сайте не лежит.
   2) endpoint пуст   → клиенту открывается чат с вами в Telegram, где уже набран текст заявки;
      ему остаётся нажать «Отправить». Работает сразу, без настройки.
   Если обработчик не ответил за 6 секунд, сайт сам переходит ко второму способу — заявка не теряется.

   Настройка: впишите адрес обработчика в CONFIG.endpoint. Больше ничего менять не нужно. */
window.LEAD = (() => {
  const CONFIG = {
    endpoint: '',          // например 'https://lead.ваш-поддомен.workers.dev' — см. server/README.md
    tg: 'AI_KUHTA',        // кому открывать чат, если обработчика нет (Кирилл)
    tgPartner: 'usamaluh', // Даня
    wa: '',                // номер WhatsApp только цифрами, например '79001234567'; пусто — кнопки нет
    mail: 'ai_kuhta@outlook.com',
  };
  /* у каждого варианта сайта свой черновик: ключ по папке страницы (/v5/, /v6/) */
  const KEY = 'kd-lead-draft:' + location.pathname.replace(/[^/]*$/, ''), SENT = 'kd-lead-sent';

  /* Заявка — простой объект. Все поля необязательны, пустые в текст не попадают.
     { source, name, biz, link, site, addons:[], goal, wish, when, budget, estimate, days, contact, extra:[[k,v]] } */
  function format(lead, forOwner) {
    const L = [], add = (k, v) => { if (v && String(v).trim()) L.push(k + ': ' + String(v).trim()); };
    L.push(forOwner ? 'Новая заявка с сайта' + (lead.source ? ' (' + lead.source + ')' : '') : lead.hello || (/только бот/i.test(lead.site || '') ? 'Здравствуйте! Хочу Telegram-бота.' : 'Здравствуйте! Хочу сайт.'));
    add('Дело', [lead.biz, lead.name ? '«' + lead.name + '»' : ''].filter(Boolean).join(' — '));
    add('Мы в сети', lead.link);
    add('Нужно', lead.site);
    add('Дополнительно', (lead.addons || []).join(', '));
    add('Цель', lead.goal);
    add('Пожелания', lead.wish);
    add('Когда', lead.when);
    add('Бюджет', lead.budget);
    (lead.extra || []).forEach(([k, v]) => add(k, v));
    add('Ориентир с сайта', [lead.estimate, lead.days].filter(Boolean).join(', '));
    if (forOwner) add('Контакт', lead.contact);
    else L.push('Покажите, пожалуйста, демо.');
    return L.join('\n');
  }

  const enc = encodeURIComponent;
  const tgLink = (text, who) => `https://t.me/${who === 'partner' || who === 'danya' ? CONFIG.tgPartner : CONFIG.tg}` + (text ? `?text=${enc(text)}` : '');
  const waLink = text => CONFIG.wa ? `https://wa.me/${CONFIG.wa}?text=${enc(text || '')}` : '';
  const mailLink = text => `mailto:${CONFIG.mail}?subject=${enc('Сайт для моего дела')}&body=${enc(text || '')}`;

  /* Отправка. Возвращает { ok, via: 'auto' | 'chat', href?, text }.
     via 'auto' — заявка уже у вас, покажите «Отправлено».
     via 'chat' — откройте href (чат Telegram с готовым текстом); клиент дожимает «Отправить» сам. */
  async function send(lead) {
    const text = format(lead, false);
    if (lead.hp) return { ok: true, via: 'auto', text };                 // ловушка для роботов: поле, которое человек не видит
    if (CONFIG.endpoint) {
      try {
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000);
        const r = await fetch(CONFIG.endpoint, { method: 'POST', headers: { 'content-type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ text: format(lead, true), page: location.pathname }), signal: ctl.signal });
        clearTimeout(t);
        if (r.ok) { done(); return { ok: true, via: 'auto', text }; }
      } catch (e) { /* падаем на чат */ }
    }
    done();
    return { ok: true, via: 'chat', href: tgLink(text, lead.to), text };
  }
  function done() { try { localStorage.setItem(SENT, String(Date.now())); localStorage.removeItem(KEY); } catch (e) {} }

  /* Черновик: чтобы выбор не пропал, если человек ушёл посмотреть работы и вернулся */
  const save = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} };
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(t); t.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e2) {} t.remove(); return ok;
    }
  }
  /* Контакт: @ник в Telegram или телефон. Возвращает '' если годится, иначе подсказку. */
  function checkContact(v) {
    v = (v || '').trim();
    if (!v) return 'Оставьте ник в Telegram или телефон — иначе нам некуда ответить.';
    if (/^@?[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(v)) return '';
    if (v.replace(/\D/g, '').length >= 10) return '';
    return 'Похоже на опечатку. Нужен ник вида @name или телефон с кодом.';
  }

  return { CONFIG, auto: () => !!CONFIG.endpoint, format, send, tgLink, waLink, mailLink, save, load, copy, checkContact };
})();
