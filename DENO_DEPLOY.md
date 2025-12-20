# Деплой на Deno Deploy за 2 минуты

## Почему Deno Deploy?

- ✅ **1,000,000 запросов/месяц бесплатно** (в 10 раз больше чем Vercel)
- ✅ **Деплой через GitHub** (автоматический при каждом push)
- ✅ **Нет node_modules** (импорт прямо из npm)
- ✅ **TypeScript из коробки**

---

## 🚀 Вариант 1: Деплой через GitHub (Рекомендуется)

### Шаг 1: Загрузить код на GitHub

```bash
# Если ещё не создали репозиторий
git init
git add .
git commit -m "Add Deno Deploy function"
git branch -M main
git remote add origin https://github.com/your-username/your-repo.git
git push -u origin main
```

### Шаг 2: Подключить к Deno Deploy

1. Зайдите на https://dash.deno.com
2. Нажмите **Sign in with GitHub**
3. Нажмите **New Project**
4. Выберите **Import from GitHub**
5. Выберите ваш репозиторий
6. Настройки:
   - **Entry point**: `deno-deploy/main.ts`
   - **Environment variables**: (оставьте пустым)
7. Нажмите **Deploy**

### Шаг 3: Получить URL

После деплоя вы получите URL:
```
https://your-project.deno.dev
```

### Шаг 4: Настроить Hasura Action

В Hasura Console:
- **Handler URL**: `https://your-project.deno.dev`

✅ Готово! Теперь каждый push в GitHub автоматически деплоится.

---

## 🔧 Вариант 2: Деплой через CLI

### Шаг 1: Установить Deno

**Windows (PowerShell):**
```powershell
irm https://deno.land/install.ps1 | iex
```

**macOS/Linux:**
```bash
curl -fsSL https://deno.land/install.sh | sh
```

### Шаг 2: Установить deployctl

```bash
deno install -Arf jsr:@deno/deployctl
```

### Шаг 3: Войти в Deno Deploy

```bash
deployctl login
```

### Шаг 4: Задеплоить

```bash
cd deno-deploy
deployctl deploy --project=hasura-verify main.ts
```

При первом деплое вас попросят создать проект.

### Шаг 5: Получить URL

```
https://hasura-verify.deno.dev
```

---

## 🧪 Тестирование локально

```bash
cd deno-deploy
deno run --allow-net main.ts
```

Откроется на `http://localhost:8000`

Тест:
```bash
curl -X POST http://localhost:8000 \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "publicKey": "test",
      "signature": "test",
      "data": {"exerciseName": "Push-ups", "reps": 20}
    }
  }'
```

---

## 📊 Мониторинг

После деплоя:
1. Зайдите на https://dash.deno.com
2. Выберите ваш проект
3. Вкладки:
   - **Logs** - логи запросов
   - **Analytics** - метрики
   - **Settings** - настройки

---

## 🔄 Обновление

### Через GitHub:
```bash
git add .
git commit -m "Update function"
git push
# Автоматический деплой!
```

### Через CLI:
```bash
deployctl deploy --project=hasura-verify main.ts
```

---

## 🐛 Отладка

### Просмотр логов:

```bash
# В реальном времени
deployctl logs --project=hasura-verify
```

Или в веб-интерфейсе: https://dash.deno.com → Logs

### Типичные ошибки:

**Ошибка: "Module not found"**
```typescript
// ❌ Неправильно
import { secp256k1 } from "@noble/curves/secp256k1";

// ✅ Правильно
import { secp256k1 } from "npm:@noble/curves@1.3.0/secp256k1";
```

**Ошибка: "Permission denied"**
```bash
# Добавьте флаг --allow-net
deno run --allow-net main.ts
```

---

## 💰 Лимиты

**Бесплатный план:**
- 1,000,000 запросов/месяц
- 100 GB bandwidth
- Безлимитные проекты
- Глобальный CDN

**Платный план ($10/мес):**
- Дополнительные 1M запросов
- Priority support

Для большинства проектов бесплатного плана более чем достаточно!

---

## ✅ Чеклист

- [ ] Код загружен на GitHub
- [ ] Проект создан на dash.deno.com
- [ ] Репозиторий подключён
- [ ] Entry point: `deno-deploy/main.ts`
- [ ] Деплой успешен
- [ ] URL получен
- [ ] Hasura Action настроен
- [ ] Тест прошёл успешно

---

## 🎉 Готово!

Теперь у вас есть:
- ✅ Serverless функция на Deno Deploy
- ✅ Автоматический деплой из GitHub
- ✅ 1M запросов/месяц бесплатно
- ✅ Проверка подписи перед записью в БД

Вопросы? Проверьте логи в https://dash.deno.com
