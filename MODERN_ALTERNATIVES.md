# Актуальные Альтернативы (2024-2025)

## ❌ Что НЕ работает

- **pgsodium** - устаревает (deprecated by Supabase)
- **PostgreSQL функции** - нет встроенной поддержки ECDSA secp256k1
- **Hasura Remote Joins** - не подходит для проверки подписи

## ✅ Что РАБОТАЕТ

### Сравнение актуальных решений

| Платформа | Бесплатный лимит | Скорость деплоя | Простота | Скорость работы | Рекомендация |
|-----------|------------------|-----------------|----------|-----------------|--------------|
| **Deno Deploy** | 1M req/мес | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 🏆 **Лучший** |
| **Cloudflare Workers** | 100k req/день | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | Отлично |
| **Vercel Functions** | 100k req/мес | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | Хорошо |
| **Netlify Functions** | 125k req/мес | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | Хорошо |

---

## 🏆 Вариант 1: Deno Deploy (РЕКОМЕНДУЮ)

### Почему Deno Deploy:

- ✅ **1 миллион запросов/месяц** (в 10 раз больше чем Vercel)
- ✅ **Нет node_modules** - импорт прямо из npm
- ✅ **Нативная поддержка TypeScript**
- ✅ **Web Crypto API из коробки**
- ✅ **Деплой через GitHub** (автоматический)
- ✅ **Глобальный CDN** (35+ регионов)

### Быстрый старт:

```bash
# 1. Установить Deno (если ещё нет)
# Windows:
irm https://deno.land/install.ps1 | iex

# 2. Создать проект
cd deno-deploy

# 3. Тестировать локально
deno run --allow-net main.ts

# 4. Задеплоить
# Вариант A: Через GitHub (рекомендуется)
# - Загрузите код на GitHub
# - Зайдите на https://dash.deno.com
# - Подключите репозиторий
# - Автоматический деплой при каждом push

# Вариант B: Через CLI
deno install -Arf jsr:@deno/deployctl
deployctl deploy --project=your-project main.ts
```

### URL для Hasura:
```
https://your-project.deno.dev
```

---

## ⚡ Вариант 2: Cloudflare Workers (САМЫЙ БЫСТРЫЙ)

### Почему Cloudflare Workers:

- ✅ **100,000 запросов/ДЕНЬ** (3M/месяц!)
- ✅ **Самая быстрая платформа** (edge computing)
- ✅ **300+ дата-центров** по всему миру
- ✅ **Холодный старт < 1ms**

### Быстрый старт:

```bash
# 1. Установить Wrangler
npm install -g wrangler

# 2. Войти в Cloudflare
wrangler login

# 3. Создать проект
cd cloudflare-worker

# 4. Установить зависимости
npm install @noble/curves @noble/hashes

# 5. Тестировать локально
wrangler dev

# 6. Задеплоить
wrangler deploy
```

### URL для Hasura:
```
https://hasura-verify.your-subdomain.workers.dev
```

---

## 📦 Вариант 3: Vercel Functions (ПРОСТЕЙШИЙ)

### Почему Vercel:

- ✅ **Самый простой деплой**
- ✅ **Автоматический деплой из Git**
- ✅ **Отличная документация**

### Быстрый старт:

```bash
# 1. Установить Vercel CLI
npm i -g vercel

# 2. Задеплоить
cd iSparta
vercel --prod
```

### URL для Hasura:
```
https://your-project.vercel.app/api/verify-signature
```

---

## 🎯 Какой выбрать?

### Для большинства проектов:
**Deno Deploy** - лучший баланс простоты, производительности и лимитов

### Если нужна максимальная скорость:
**Cloudflare Workers** - самая быстрая платформа в мире

### Если нужна максимальная простота:
**Vercel Functions** - деплой за 1 команду

---

## 📊 Детальное сравнение

### Лимиты

| Платформа | Запросов/месяц | Запросов/день | Bandwidth |
|-----------|----------------|---------------|-----------|
| Deno Deploy | 1,000,000 | ~33,000 | 100 GB |
| Cloudflare Workers | ~3,000,000 | 100,000 | Безлимит |
| Vercel | 100,000 | ~3,300 | 100 GB |
| Netlify | 125,000 | ~4,100 | 100 GB |

### Производительность

| Платформа | Холодный старт | Регионы | Latency |
|-----------|----------------|---------|---------|
| Deno Deploy | ~50ms | 35+ | Низкая |
| Cloudflare Workers | <1ms | 300+ | Минимальная |
| Vercel | ~100ms | 20+ | Средняя |
| Netlify | ~100ms | 15+ | Средняя |

### Простота

| Платформа | Деплой | TypeScript | Зависимости |
|-----------|--------|------------|-------------|
| Deno Deploy | ⭐⭐⭐ | Нативно | npm: импорт |
| Cloudflare Workers | ⭐⭐ | Да | npm install |
| Vercel | ⭐⭐⭐ | Да | npm install |
| Netlify | ⭐⭐⭐ | Да | npm install |

---

## 🚀 Моя рекомендация

### Для вашего проекта:

**Используйте Deno Deploy**, потому что:

1. ✅ **1M запросов/месяц** - хватит надолго
2. ✅ **Простой деплой** - через GitHub или CLI
3. ✅ **Нет node_modules** - чище проект
4. ✅ **TypeScript из коробки**
5. ✅ **Бесплатно навсегда**

### Инструкция:

```bash
# 1. Зайдите на https://dash.deno.com
# 2. Sign in with GitHub
# 3. New Project → Import from GitHub
# 4. Выберите репозиторий
# 5. Entry point: deno-deploy/main.ts
# 6. Deploy!

# Получите URL: https://your-project.deno.dev
```

### Настройка Hasura Action:

```
Handler URL: https://your-project.deno.dev
```

Готово! 🎉

---

## 💡 Дополнительные советы

### Мониторинг

Все платформы предоставляют:
- ✅ Логи запросов
- ✅ Метрики производительности
- ✅ Алерты при ошибках

### Безопасность

Добавьте проверку origin:

```typescript
// В начале функции
const allowedOrigins = ['https://your-hasura.app'];
const origin = req.headers.get('origin');

if (!allowedOrigins.includes(origin)) {
    return new Response('Forbidden', { status: 403 });
}
```

### Rate Limiting

Cloudflare Workers имеет встроенный rate limiting через KV:

```typescript
// Проверка количества запросов от одного publicKey
const key = `rate:${publicKey}`;
const count = await env.KV.get(key);

if (count > 100) {
    return new Response('Too many requests', { status: 429 });
}
```

---

## ❓ FAQ

**Q: Можно ли использовать несколько платформ одновременно?**
A: Да! Можно настроить fallback: если Deno недоступен → Cloudflare

**Q: Что если превышу лимиты?**
A: 
- Deno Deploy: $10/месяц за дополнительные 1M запросов
- Cloudflare Workers: $5/месяц за безлимит
- Vercel: $20/месяц за Pro план

**Q: Какая платформа самая надёжная?**
A: Cloudflare Workers (99.99% uptime SLA)

**Q: Можно ли мигрировать между платформами?**
A: Да, код практически одинаковый, нужно только изменить формат экспорта
