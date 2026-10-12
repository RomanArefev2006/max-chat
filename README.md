# Чат MAX на GREEN-API

Веб-клиент для текстовой переписки в мессенджере MAX. Отправка идёт методом [SendMessage](https://green-api.com/v3/docs/api/sending/SendMessage/), ответы читаются из очереди [ReceiveNotification](https://green-api.com/v3/docs/api/receiving/technology-http-api/ReceiveNotification/) и подтверждаются [DeleteNotification](https://green-api.com/v3/docs/api/receiving/technology-http-api/DeleteNotification/). Номер перед созданием чата проверяется методом [CheckAccount](https://green-api.com/v3/docs/api/service/CheckAccount/).

Стек: React, TypeScript, Vite.

## Локальный запуск

Нужен Node.js 20 или новее.

```bash
npm install
npm run dev
```

Откройте адрес, который напечатает Vite. Обычно это http://localhost:5173.

Сборка статики:

```bash
npm run build
npm run preview
```

## Подготовка инстанса

1. В [личном кабинете GREEN-API](https://console.green-api.com/) создайте инстанс MAX и дождитесь, пока он станет рабочим.
2. Авторизуйте инстанс QR-кодом: в приложении MAX откройте Профиль → Устройства → Войти по QR-коду и отсканируйте код из кабинета.
3. Для приёма ответов оставьте webhook URL пустым и включите уведомления о входящих сообщениях. Иначе `receiveNotification` вернёт ошибку.
4. С карточки инстанса скопируйте `idInstance`, `apiTokenInstance` и `apiUrl`.

`apiUrl` у каждого инстанса свой, например `https://1101.api.green-api.com`. Без него запросы не попадут на нужный хост.

## Как проверить переписку

1. Войдите, вставив три значения с карточки инстанса.
2. Нажмите «Новый чат» и введите номер получателя. Подходят номера России и Беларуси, в формате `+7`, `8` или без кода страны.
3. Напишите текст и отправьте его. Enter отправляет сообщение, Shift+Enter переносит строку.
4. Ответьте на сообщение из приложения MAX. Ответ появится в этом чате.

История чатов и ключ инстанса хранятся в `localStorage` браузера. Кнопка «Выйти» удаляет ключ из браузера и оставляет историю для следующего входа в тот же инстанс.
