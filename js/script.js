(function () {
  'use strict';

  /* Графік: пн–пт 09:00–18:00, сб–нд зачинено. Ключ — getDay() (0 = нд). */
  var SCHEDULE = {
    0: null,
    1: [9 * 60, 18 * 60],
    2: [9 * 60, 18 * 60],
    3: [9 * 60, 18 * 60],
    4: [9 * 60, 18 * 60],
    5: [9 * 60, 18 * 60],
    6: null
  };
  var TZ = 'Europe/Kyiv';

  function initMenu() {
    var btn = document.getElementById('burgerBtn');
    var menu = document.getElementById('mobileMenu');
    if (!btn || !menu) return;
    function setOpen(open) {
      menu.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Закрити меню' : 'Відкрити меню');
    }
    btn.addEventListener('click', function () { setOpen(!menu.classList.contains('open')); });
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });
  }

  /* Слайдер: слайди змінюються лише за дією користувача
     (стрілки, крапки, свайп, клавіші ←/→). Автопрокрутки немає. */
  function initSlider() {
    var track = document.getElementById('sliderTrack');
    var dotsWrap = document.getElementById('sliderDots');
    var root = document.getElementById('slider');
    if (!track || !dotsWrap || !root) return;

    var count = track.children.length;
    var index = 0;
    var dots = [];

    for (var i = 0; i < count; i++) {
      (function (n) {
        var d = document.createElement('button');
        d.className = 'slider-dot';
        d.setAttribute('role', 'tab');
        d.setAttribute('aria-label', 'Слайд ' + (n + 1) + ' з ' + count);
        d.addEventListener('click', function () { goTo(n); });
        dotsWrap.appendChild(d);
        dots.push(d);
      })(i);
    }

    function goTo(n) {
      index = (n + count) % count;
      track.style.transform = 'translateX(-' + index * 100 + '%)';
      dots.forEach(function (d, k) {
        d.classList.toggle('active', k === index);
        d.setAttribute('aria-selected', String(k === index));
      });
    }
    var next = function () { goTo(index + 1); };
    var prev = function () { goTo(index - 1); };

    document.getElementById('nextBtn').addEventListener('click', next);
    document.getElementById('prevBtn').addEventListener('click', prev);

    var startX = null;
    track.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); }
      startX = null;
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    });

    goTo(0);
  }

  /* Поточний час у Києві, щоб статус не залежав від часового поясу відвідувача */
  function kyivNow() {
    try {
      var parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
      }).formatToParts(new Date());
      var map = {};
      parts.forEach(function (p) { map[p.type] = p.value; });
      var days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      return { day: days[map.weekday], minutes: (parseInt(map.hour, 10) % 24) * 60 + parseInt(map.minute, 10) };
    } catch (e) {
      var d = new Date();
      return { day: d.getDay(), minutes: d.getHours() * 60 + d.getMinutes() };
    }
  }

  function initStatus() {
    var now = kyivNow();
    var row = document.querySelector('#hoursTable tr[data-day="' + now.day + '"]');
    if (row) row.classList.add('today');

    var badge = document.getElementById('statusBadge');
    var text = document.getElementById('statusText');
    if (!badge || !text) return;

    var today = SCHEDULE[now.day];
    var open = today && now.minutes >= today[0] && now.minutes < today[1];
    badge.classList.add(open ? 'open' : 'closed');

    if (open) {
      text.textContent = 'Відчинено зараз · до 18:00';
    } else if (today && now.minutes < today[0]) {
      text.textContent = 'Зараз зачинено · відчинимося о 09:00';
    } else {
      text.textContent = 'Зараз зачинено · працюємо Пн–Пт 09:00–18:00';
    }
  }

  /* ============================================================
     ФОРМА ЗАПИСУ
     Дані йдуть не напряму в Telegram, а на ваш Worker (js/config.js),
     де зберігається токен бота. Токен у коді сайту ніколи не лежить.
     ============================================================ */
  // @@normalize-start
  function normalizePhone(raw) {
    var d = String(raw || '').replace(/\D/g, '');
    if (d.length === 12 && d.indexOf('380') === 0) return '+' + d;
    if (d.length === 10 && d.charAt(0) === '0') return '+38' + d;
    if (d.length === 9) return '+380' + d;
    return null;
  }
  // @@normalize-end

  function formatPhone(p) {
    // +380XXXXXXXXX -> +380 XX XXX XX XX
    return p.replace(/^(\+380)(\d{2})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5');
  }

  function initForm() {
    var form = document.getElementById('bookingForm');
    if (!form) return;

    var btn = document.getElementById('formSubmit');
    var status = document.getElementById('formStatus');
    var loadedAt = Date.now();
    var cfg = window.SITE_CONFIG || {};

    var fields = {
      name: document.getElementById('f-name'),
      phone: document.getElementById('f-phone'),
      car: document.getElementById('f-car'),
      problem: document.getElementById('f-problem'),
      consent: document.getElementById('f-consent')
    };

    function setError(key, msg) {
      var input = fields[key];
      var out = document.getElementById('e-' + key);
      if (out) out.textContent = msg || '';
      if (input) {
        if (msg) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
      }
    }

    function validate() {
      var ok = true;
      var name = fields.name.value.trim();
      var car = fields.car.value.trim();
      var problem = fields.problem.value.trim();
      var phone = normalizePhone(fields.phone.value);

      setError('name', name.length < 2 ? 'Вкажіть імʼя' : '');
      setError('phone', phone ? '' : 'Вкажіть коректний номер телефону, наприклад +380 68 123 45 67');
      setError('car', car.length < 2 ? 'Вкажіть марку автомобіля' : '');
      setError('problem', problem.length < 3 ? 'Коротко опишіть проблему' : '');
      setError('consent', fields.consent.checked ? '' : 'Потрібна згода на обробку даних');

      if (name.length < 2 || !phone || car.length < 2 || problem.length < 3 || !fields.consent.checked) ok = false;
      return ok ? { name: name, phone: phone, car: car, problem: problem } : null;
    }

    function show(type, html) {
      status.className = 'form-status ' + type;
      status.innerHTML = html;
    }

    var FALLBACK = 'Зателефонуйте <a href="tel:+380688956363">+380 68 895 6363</a> або напишіть у <a href="https://t.me/+380688956363" target="_blank" rel="noopener noreferrer">Telegram</a>.';

    // нормалізуємо номер, коли користувач вийшов з поля
    fields.phone.addEventListener('blur', function () {
      var p = normalizePhone(fields.phone.value);
      if (p) fields.phone.value = formatPhone(p);
    });
    // прибираємо помилку, щойно користувач виправляє поле
    ['name', 'phone', 'car', 'problem'].forEach(function (k) {
      fields[k].addEventListener('input', function () { setError(k, ''); });
    });
    fields.consent.addEventListener('change', function () { setError('consent', ''); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.className = 'form-status';
      status.textContent = '';

      var data = validate();
      if (!data) {
        var firstBad = form.querySelector('[aria-invalid="true"]');
        if (firstBad) firstBad.focus();
        return;
      }

      if (!cfg.formEndpoint) {
        show('err', 'Форма тимчасово недоступна. ' + FALLBACK);
        return;
      }

      data.website = document.getElementById('f-website').value;
      data.elapsed = Date.now() - loadedAt;
      data.consent = true;

      btn.disabled = true;
      var label = btn.textContent;
      btn.textContent = 'Надсилаємо…';

      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = window.setTimeout(function () { if (ctrl) ctrl.abort(); }, 12000);

      fetch(cfg.formEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: ctrl ? ctrl.signal : undefined
      })
        .then(function (res) { return res.json().catch(function () { return {}; }).then(function (j) { return { ok: res.ok && j.ok, status: res.status }; }); })
        .then(function (r) {
          if (!r.ok) throw new Error('bad response ' + r.status);
          form.reset();
          show('ok', 'Дякуємо! Заявку надіслано. Ми звʼяжемося з вами у робочий час (Пн–Пт, 09:00–18:00).');
        })
        .catch(function () {
          show('err', 'Не вдалося надіслати заявку. ' + FALLBACK);
        })
        .then(function () {
          window.clearTimeout(timer);
          btn.disabled = false;
          btn.textContent = label;
        });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initMenu();
    initSlider();
    initStatus();
    initForm();
    var y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
  });
})();
