# BIP39 Авторизация для Hasura

Безопасная авторизация без паролей, используя BIP39 мнемонические фразы и криптографические подписи.

## 🎯 Что это?

- ✅ **Без паролей** - пользователь запоминает 3 слова
- ✅ **Без регистрации** - пользователь = его публичный ключ
- ✅ **Без JWT** - подпись проверяется при каждой операции
- ✅ **Без своего сервера** - используем Vercel Functions (бесплатно)
- ✅ **Безопасно** - невозможно подделать данные без приватного ключа

## 📦 Структура проекта

```
├── api/
│   └── verify-signature.js    # Vercel serverless функция
├── secure-auth.ts             # Генерация ключей и подписей
├── hasura-client.ts           # Клиент для работы с Hasura
├── DEPLOY_VERCEL.md           # Инструкция по деплою
├── SERVERLESS_OPTIONS.md      # Альтернативные платформы
└── HASURA_SIMPLE.md           # Настройка Hasura
```

## 🚀 Быстрый старт

### 1. Выбрать платформу

**Рекомендуется: Deno Deploy** (1M запросов/месяц бесплатно)

Альтернативы:
- Cloudflare Workers (100k запросов/день)
- Vercel Functions (100k запросов/месяц)

### 2. Деплой на Deno Deploy (Рекомендуется)

```bash
# Через GitHub (автоматический деплой)
# 1. Загрузите код на GitHub
# 2. Зайдите на https://dash.deno.com
# 3. Import from GitHub
# 4. Entry point: deno-deploy/main.ts

# Или через CLI
deno install -Arf jsr:@deno/deployctl
deployctl deploy --project=hasura-verify deno-deploy/main.ts
```

Получите URL: `https://your-project.deno.dev`

**Подробная инструкция**: [DENO_DEPLOY.md](./DENO_DEPLOY.md)

### 3. Настроить Hasura Action

В Hasura Console создайте Action:

```graphql
type Mutation {
  addWorkout(
    publicKey: String!
    signature: String!
    data: WorkoutInput!
  ): Workout
}
```

Handler: `https://your-project.vercel.app/api/verify-signature`

### 4. Использовать в клиенте

```typescript
import { signData } from './hasura-client';

const mnemonic = 'mountain pilot push';
const data = { exerciseName: 'Push-ups', reps: 20 };

const { publicKey, signature } = await signData(mnemonic, data);

// Отправить в Hasura через GraphQL mutation
```

## 🔐 Как это работает

```
1. Клиент подписывает данные приватным ключом
   signature = sign(data, privateKey)

2. Отправляет: { publicKey, signature, data }

3. Hasura → Vercel Function

4. Vercel проверяет подпись:
   verify(signature, data, publicKey) === true?

5. Если ОК → данные вставляются в БД
   Если НЕТ → ошибка 400
```

## 📚 Документация

- **[DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md)** - Деплой на Vercel
- **[SERVERLESS_OPTIONS.md](./SERVERLESS_OPTIONS.md)** - Альтернативы (Cloudflare, Netlify, Supabase)
- **[HASURA_SIMPLE.md](./HASURA_SIMPLE.md)** - Настройка Hasura
- **[SECURE_AUTH.md](./SECURE_AUTH.md)** - Как работает криптография

## 🎓 Примеры

### Генерация мнемоники

```typescript
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

const mnemonic = generateMnemonic(wordlist, 128); // 12 слов
console.log(mnemonic);
```

### Подпись данных

```typescript
import { signData } from './hasura-client';

const { publicKey, signature } = await signData(mnemonic, {
    exerciseName: 'Push-ups',
    reps: 20
});
```

### Отправка в Hasura

```typescript
const response = await fetch('https://your-hasura.app/v1/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        query: `mutation AddWorkout($publicKey: String!, $signature: String!, $data: WorkoutInput!) {
            addWorkout(publicKey: $publicKey, signature: $signature, data: $data) {
                id
                publicKey
                exerciseName
                reps
            }
        }`,
        variables: { publicKey, signature, data }
    })
});
```

## 🔒 Безопасность

### Что защищено

- ✅ Невозможно создать запись от имени другого пользователя
- ✅ Невозможно подделать данные (подпись не совпадёт)
- ✅ Приватный ключ никогда не покидает устройство пользователя

### Что НЕ защищено (опционально)

- ⚠️ Replay атаки (можно добавить timestamp)
- ⚠️ Rate limiting (можно добавить в Vercel Function)

## 💰 Стоимость

**Бесплатно!**

- Vercel: 100,000 запросов/месяц
- Hasura Cloud: бесплатный tier
- PostgreSQL: Supabase/Neon бесплатный tier

## 🤝 Альтернативы Vercel

- **Cloudflare Workers** - 100k запросов/день
- **Netlify Functions** - 125k запросов/месяц
- **Supabase Edge Functions** - безлимит

Все бесплатные!

## 📝 Лицензия

MIT
