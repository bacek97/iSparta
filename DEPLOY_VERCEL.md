# Деплой на Vercel БЕЗ своего сервера

## 🚀 Быстрый старт (3 минуты)

### Шаг 1: Установить зависимости

```bash
npm install
```

### Шаг 2: Тестировать локально (опционально)

```bash
npm run dev
# Откроется на http://localhost:3000
```

Тест:
```bash
curl -X POST http://localhost:3000/api/verify-signature \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "publicKey": "test",
      "signature": "test",
      "data": {"exerciseName": "Push-ups", "reps": 20}
    }
  }'
```

### Шаг 3: Задеплоить на Vercel

```bash
# Установить Vercel CLI (если ещё не установлен)
npm i -g vercel

# Войти в Vercel
vercel login

# Задеплоить
vercel --prod
```

После деплоя вы получите URL:
```
https://your-project.vercel.app
```

### Шаг 4: Настроить Hasura Action

1. Откройте Hasura Console
2. Перейдите в **Actions** → **Create**
3. Вставьте:

**Action Definition:**
```graphql
type Mutation {
  addWorkout(
    publicKey: String!
    signature: String!
    data: WorkoutInput!
  ): Workout
}

input WorkoutInput {
  exerciseName: String!
  reps: Int!
}

type Workout {
  publicKey: String!
  exerciseName: String!
  reps: Int!
  verifiedAt: String!
}
```

**Handler:**
```
https://your-project.vercel.app/api/verify-signature
```

4. Сохраните

### Шаг 5: Использовать в клиенте

```typescript
import { signData } from './hasura-client';

const mnemonic = 'mountain pilot push';
const data = { exerciseName: 'Push-ups', reps: 20 };

const { publicKey, signature } = await signData(mnemonic, data);

const response = await fetch('https://your-hasura.app/v1/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        query: `
            mutation AddWorkout(
                $publicKey: String!
                $signature: String!
                $data: WorkoutInput!
            ) {
                addWorkout(
                    publicKey: $publicKey
                    signature: $signature
                    data: $data
                ) {
                    publicKey
                    exerciseName
                    reps
                    verifiedAt
                }
            }
        `,
        variables: { publicKey, signature, data }
    })
});

const result = await response.json();
console.log(result.data.addWorkout);
```

## ✅ Готово!

Теперь у вас есть:
- ✅ Serverless функция на Vercel (бесплатно)
- ✅ Автоматический деплой из Git
- ✅ HTTPS из коробки
- ✅ Проверка подписи перед записью в БД
- ✅ Никакого своего сервера

## 📊 Лимиты Vercel (бесплатный план)

- 100,000 запросов в месяц
- 100 GB bandwidth
- Автоматический SSL
- Глобальный CDN

Для большинства проектов этого более чем достаточно!

## 🔄 Автоматический деплой

Подключите GitHub репозиторий к Vercel:
1. Зайдите на vercel.com
2. Import Git Repository
3. Выберите ваш репозиторий
4. Каждый push в main → автоматический деплой

## 🐛 Отладка

Логи доступны в Vercel Dashboard:
- Перейдите на vercel.com
- Выберите проект
- Вкладка "Logs"

## 💡 Альтернативы

Если Vercel не подходит, используйте:
- **Cloudflare Workers** (100k запросов/день)
- **Netlify Functions** (125k запросов/месяц)
- **Supabase Edge Functions** (безлимит)

Все бесплатные!
