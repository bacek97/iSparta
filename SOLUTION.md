# Итоговое Решение: BIP39 Авторизация для Hasura

## 🎯 Ваш вопрос

> "Как в Hasura перед внесением новой записи в БД сделать проверку подписи БЕЗ своего сервера?"

## ✅ Ответ

**PostgreSQL НЕ подходит** для проверки ECDSA secp256k1 (BIP39):
- ❌ `pgsodium` устаревает (deprecated by Supabase)
- ❌ Нет встроенной поддержки secp256k1
- ❌ Hasura не поддерживает pgsodium

**Актуальное решение: Serverless платформы**

Да, это "хостинг", но:
- ✅ Бесплатно (в пределах щедрых лимитов)
- ✅ Не нужно настраивать сервер
- ✅ Деплой за 1 команду
- ✅ Автоматическое масштабирование

---

## 🏆 Рекомендация: Deno Deploy

### Почему именно Deno Deploy:

1. **Самые щедрые лимиты**
   - 1,000,000 запросов/месяц (бесплатно)
   - В 10 раз больше чем Vercel
   - В 3 раза больше чем Netlify

2. **Простота**
   - Деплой через GitHub (автоматический)
   - Нет node_modules
   - TypeScript из коробки

3. **Производительность**
   - 35+ регионов по всему миру
   - Холодный старт ~50ms
   - Глобальный CDN

### Быстрый старт:

```bash
# 1. Зайдите на https://dash.deno.com
# 2. Sign in with GitHub
# 3. Import from GitHub
# 4. Entry point: deno-deploy/main.ts
# 5. Deploy!

# Получите URL: https://your-project.deno.dev
```

### Настройка Hasura:

```graphql
# Action Definition
type Mutation {
  addWorkout(
    publicKey: String!
    signature: String!
    data: WorkoutInput!
  ): Workout
}

# Handler URL
https://your-project.deno.dev
```

---

## 📊 Сравнение альтернатив

| Платформа | Запросов/месяц | Деплой | Скорость | Рекомендация |
|-----------|----------------|--------|----------|--------------|
| **Deno Deploy** | 1,000,000 | GitHub | Быстро | 🏆 **Лучший** |
| **Cloudflare Workers** | ~3,000,000 | CLI | Очень быстро | Отлично |
| **Vercel Functions** | 100,000 | GitHub/CLI | Средне | Хорошо |
| **Netlify Functions** | 125,000 | GitHub/CLI | Средне | Хорошо |

---

## 📁 Структура проекта

```
iSparta/
├── deno-deploy/
│   ├── main.ts              # ⭐ Deno Deploy функция (РЕКОМЕНДУЕТСЯ)
│   └── deno.json            # Конфигурация Deno
│
├── cloudflare-worker/
│   ├── src/index.js         # Cloudflare Workers (альтернатива)
│   └── wrangler.toml        # Конфигурация Cloudflare
│
├── api/
│   └── verify-signature.js  # Vercel Functions (альтернатива)
│
├── hasura-client.ts         # Клиент для работы с Hasura
├── secure-auth.ts           # Генерация ключей и подписей
│
└── Документация:
    ├── MODERN_ALTERNATIVES.md   # Сравнение платформ
    ├── DENO_DEPLOY.md          # Инструкция по Deno Deploy
    ├── SERVERLESS_OPTIONS.md   # Все serverless опции
    ├── HASURA_SIMPLE.md        # Настройка Hasura
    └── SECURE_AUTH.md          # Как работает криптография
```

---

## 🔐 Как это работает

```
┌─────────┐                    ┌──────────────┐                    ┌─────────────┐
│ Клиент  │                    │ Deno Deploy  │                    │   Hasura    │
└────┬────┘                    └──────┬───────┘                    └──────┬──────┘
     │                                │                                   │
     │ 1. Подписать данные            │                                   │
     │    signature = sign(data)      │                                   │
     │                                │                                   │
     │ 2. Отправить mutation          │                                   │
     ├────────────────────────────────┼──────────────────────────────────>│
     │    { publicKey, signature,     │                                   │
     │      data }                    │                                   │
     │                                │                                   │
     │                                │ 3. Вызвать Action                 │
     │                                │<──────────────────────────────────┤
     │                                │                                   │
     │                                │ 4. Проверить подпись              │
     │                                │    verify(signature, data,        │
     │                                │            publicKey)              │
     │                                │                                   │
     │                                │ 5. Вернуть результат              │
     │                                ├──────────────────────────────────>│
     │                                │    { ...data, publicKey }         │
     │                                │                                   │
     │                                │                          6. Вставить в БД
     │                                │                                   │
     │ 7. Получить результат          │                                   │
     │<───────────────────────────────┼───────────────────────────────────┤
     │                                │                                   │
```

---

## 💰 Стоимость

**Все варианты БЕСПЛАТНЫ** для большинства проектов:

- Deno Deploy: 1M запросов/месяц
- Cloudflare Workers: 100k запросов/день (3M/месяц)
- Vercel: 100k запросов/месяц
- Netlify: 125k запросов/месяц

Если превысите лимиты:
- Deno Deploy: $10/мес за +1M запросов
- Cloudflare Workers: $5/мес за безлимит
- Vercel: $20/мес за Pro план

---

## 🚀 Следующие шаги

1. **Выбрать платформу** (рекомендую Deno Deploy)
2. **Задеплоить функцию** (см. [DENO_DEPLOY.md](./DENO_DEPLOY.md))
3. **Настроить Hasura Action** (см. [HASURA_SIMPLE.md](./HASURA_SIMPLE.md))
4. **Интегрировать в клиент** (см. [hasura-client.ts](./hasura-client.ts))

---

## 📚 Дополнительные ресурсы

- [Deno Deploy Documentation](https://deno.com/deploy/docs)
- [Hasura Actions Documentation](https://hasura.io/docs/latest/actions/overview/)
- [BIP39 Specification](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)
- [@noble/curves Documentation](https://github.com/paulmillr/noble-curves)

---

## ✅ Чеклист

- [ ] Выбрана платформа (Deno Deploy)
- [ ] Код задеплоен
- [ ] URL получен
- [ ] Hasura Action создан
- [ ] Handler URL настроен
- [ ] Клиент интегрирован
- [ ] Тесты пройдены
- [ ] Проект работает!

---

## 🎉 Готово!

Теперь у вас есть:
- ✅ Безопасная авторизация через BIP39
- ✅ Проверка подписи перед записью в БД
- ✅ Serverless функция (бесплатно)
- ✅ Автоматический деплой
- ✅ Никаких паролей

**Вопросы?** Проверьте документацию в папке проекта!
