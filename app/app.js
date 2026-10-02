// Код канала и сборка адреса живут в <head> (объект WF): манифест нужно
// подменить раньше, чем сюда дойдёт очередь. Здесь — всё остальное.

const params = new URLSearchParams(location.search);

// Приход из «Поделиться» (Android). В манифесте share_target указывает сюда же,
// поэтому выделенный в чужом приложении текст прилетает обычными параметрами.
// Ищем сразу, не показывая промежуточный экран.
const shared = (params.get('text') || params.get('url') || params.get('title') || '').trim();
if (shared) {
  // replace, а не href: иначе «назад» из выдачи вернёт на эту же страницу,
  // она снова уйдёт в поиск, и выбраться будет нельзя.
  location.replace(WF.searchUrl(shared));
}

const ua = navigator.userAgent;
const isIOS = /iphone|ipad|ipod/i.test(ua) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isIOSSafari = isIOS && !/crios|fxios|edgios|opt\//i.test(ua);

// Запущено со значка, а не из браузера.
const installed = matchMedia('(display-mode: standalone)').matches ||
                  navigator.standalone === true;

/* ------------------------------------------------------------------ */
/* Поиск                                                               */
/* ------------------------------------------------------------------ */

const form  = document.getElementById('form');
const input = document.getElementById('q');
const clid  = document.getElementById('clid');

clid.value = WF.clid;

// Приложение открывают ради одного действия, так что сразу просим клавиатуру.
// Safari такой фокус без жеста пользователя игнорирует — там это просто
// ничего не сделает.
input.focus({ preventScroll: true });

form.addEventListener('submit', () => {
  // Отправку не перехватываем: форма сама уходит GET-запросом на ya.ru.
  // Код мог измениться уже после загрузки страницы — например, его только
  // что ввели руками, — поэтому clid обновляем в момент перехода.
  clid.value = WF.clid;
});

/* ------------------------------------------------------------------ */
/* Подвал                                                              */
/* ------------------------------------------------------------------ */

const footer = document.getElementById('code');

function renderFooter() {
  footer.textContent = WF.vid
    ? `Код подключения: ${WF.vid} · `
    : 'Код подключения не задан · ';

  // Когда код пришёл из адреса, менять его руками бессмысленно: при следующем
  // запуске значка адрес подставит свой, и правка молча потеряется.
  if (WF.fromUrl) return;

  const link = document.createElement('a');
  link.href = '#';
  link.textContent = WF.vid ? 'изменить' : 'ввести код';
  link.addEventListener('click', (event) => {
    event.preventDefault();
    openCode(false);
  });
  footer.append(link, ' · ');
}

renderFooter();

/* ------------------------------------------------------------------ */
/* Ввод кода руками                                                    */
/* ------------------------------------------------------------------ */
// Основной способ привязки к каналу. Раздача идёт через магазины и через
// сказанное вслух «найдите приложение и введите такой-то номер» — ссылки с
// кодом там нет и быть не может: карточка в магазине одна на всех.
// Ссылка с ?vid= остаётся для тех каналов, где её есть куда положить.

const codeCard   = document.getElementById('code-card');
const codeForm   = document.getElementById('code-form');
const codeInput  = document.getElementById('code-input');
const codeHint   = document.getElementById('code-hint');
const codeStatus = document.getElementById('code-status');
const codeSkip   = document.getElementById('code-skip');

function openCode(first) {
  // «Номер» — потому что вслух говорят обычно так, а не «код подключения».
  codeHint.textContent = first
    ? 'Если вам называли номер — введите его. Если нет, пропустите: приложение работает и без него.'
    : 'Номер, который вам называли. Чтобы убрать его, очистите поле и сохраните.';
  codeInput.value = WF.vid;
  codeStatus.hidden = true;
  codeSkip.textContent = first ? 'Пропустить' : 'Закрыть';
  codeCard.hidden = false;

  // При первом запуске клавиатуру не поднимаем: человек пришёл искать,
  // а не заполнять форму. Открыл сам — тогда ставим курсор.
  if (!first) codeInput.focus();
}

function say(text, isError) {
  codeStatus.textContent = text;
  codeStatus.className = 'status ' + (isError ? 'err' : 'ok');
  codeStatus.hidden = false;
}

codeForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const raw = codeInput.value.trim();

  // Правила те же, что на экране настроек расширения.
  if (raw !== '' && (!/^\d{1,2}$/.test(raw) || Number(raw) === 0)) {
    say('Код — это число от 1 до 99. Либо оставьте поле пустым.', true);
    return;
  }

  const saved = WF.setVid(raw);
  WF.markAsked();
  clid.value = WF.clid;
  codeInput.value = saved;
  renderFooter();
  say(saved ? `Код ${saved} сохранён.` : 'Сохранено. Приложение работает без кода.');
  codeSkip.textContent = 'Закрыть';
});

codeSkip.addEventListener('click', () => {
  WF.markAsked();
  codeCard.hidden = true;
});

// Первый запуск со значка, кода нет и ещё не спрашивали — спрашиваем один раз.
// В браузере не лезем: там это место занято приглашением установить, да и
// значка, ради которого всё затевалось, ещё нет.
if (installed && !shared && !WF.fromUrl && !WF.vid && !WF.asked()) {
  openCode(true);
}

/* ------------------------------------------------------------------ */
/* Установка на домашний экран                                         */
/* ------------------------------------------------------------------ */

const card  = document.getElementById('install');
const title = document.getElementById('install-title');
const body  = document.getElementById('install-body');

const SHARE_ICON =
  '<svg class="share" viewBox="0 0 13 17" aria-hidden="true">' +
  '<path d="M6.5 0 3.1 3.4l.85.85L5.9 2.3V11h1.2V2.3l1.95 1.95.85-.85L6.5 0z"/>' +
  '<path d="M1 6h3.2v1.2H2.2v8.6h8.6V7.2H8.8V6H12v11H1V6z"/></svg>';

function show(heading, html) {
  title.textContent = heading;
  body.innerHTML = html;
  card.hidden = false;
}

if (!installed && !shared) {
  if (isIOSSafari) {
    show('Установите на домашний экран',
      '<ol>' +
      `<li>Нажмите <b>Поделиться</b> ${SHARE_ICON} внизу экрана</li>` +
      '<li>Пролистайте список и выберите <b>На экран «Домой»</b></li>' +
      '<li>Нажмите <b>Добавить</b></li>' +
      '</ol>');
  } else if (isIOS) {
    show('Откройте в Safari',
      '<p>Значок на домашний экран на iPhone и iPad ставит только Safari. ' +
      'Откройте эту страницу в нём — и появится инструкция.</p>');
  }
  // Android и десктоп: ждём beforeinstallprompt, он придёт сам.
}

let prompt = null;

window.addEventListener('beforeinstallprompt', (event) => {
  // Без preventDefault Chrome покажет собственную плашку внизу экрана —
  // её легко смахнуть и больше не увидеть. Своя кнопка заметнее.
  event.preventDefault();
  prompt = event;
  if (installed || shared) return;

  show('Установите на домашний экран',
    '<p>Значок рядом с остальными приложениями: поиск открывается в один тап, ' +
    'без адресной строки.</p>' +
    '<button type="button" id="install-btn">Установить</button>');

  document.getElementById('install-btn').addEventListener('click', async () => {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    // Повторно показать то же приглашение браузер не даст — событие одноразовое.
    prompt = null;
    card.hidden = true;
  });
});

window.addEventListener('appinstalled', () => { card.hidden = true; });

/* ------------------------------------------------------------------ */

if ('serviceWorker' in navigator) {
  // Регистрируем после load: иначе запрос за sw.js конкурирует за канал
  // с тем, что нужно показать на экране прямо сейчас.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Запрещены куки, приватный режим, http вместо https — приложение
      // работает и без офлайна, молчим.
    });
  });
}
