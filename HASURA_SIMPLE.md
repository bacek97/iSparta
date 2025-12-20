# Простая Проверка Подписи в Hasura

## Минимальная схема БД

```sql
-- Любая ваша таблица, например workouts
CREATE TABLE workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_key TEXT NOT NULL,  -- Кто создал запись
    exercise_name TEXT NOT NULL,
    reps INT NOT NULL,
    verified_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Hasura Action

### Определение в Hasura Console

**Actions → Create Action**

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
  id: uuid!
  publicKey: String!
  exerciseName: String!
  reps: Int!
  verifiedAt: timestamptz!
}
```

**Handler URL:**
```
http://localhost:3000/actions/verify-and-insert
```

## Использование на Клиенте

```typescript
import * as bip39 from '@scure/bip39';
import { HDKey } from '@scure/bip32';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

// Функция для подписи данных
async function signData(mnemonic: string, data: any): Promise<{
    publicKey: string;
    signature: string;
}> {
    // 1. Получить ключи из мнемоники
    const seed = await bip39.mnemonicToSeed(mnemonic, '');
    const hdKey = HDKey.fromMasterSeed(seed);
    const derivedKey = hdKey.derive("m/44'/0'/0'/0/0");
    
    const privateKey = derivedKey.privateKey!;
    const publicKey = derivedKey.publicKey!;
    
    // 2. Подписать данные
    const message = JSON.stringify(data);
    const messageHash = sha256(Buffer.from(message));
    const signature = secp256k1.sign(messageHash, privateKey);
    
    return {
        publicKey: Buffer.from(publicKey).toString('hex'),
        signature: signature.toCompactHex()
    };
}

// Добавление workout с проверкой подписи
async function addWorkout(mnemonic: string, exerciseName: string, reps: number) {
    // 1. Данные для записи
    const data = {
        exerciseName,
        reps
    };
    
    // 2. Подписать данные
    const { publicKey, signature } = await signData(mnemonic, data);
    
    // 3. Отправить в Hasura
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
                        id
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
    
    if (result.errors) {
        console.error('Error:', result.errors[0].message);
        return null;
    }
    
    return result.data.addWorkout;
}

// Использование
const mnemonic = 'mountain pilot push';
const workout = await addWorkout(mnemonic, 'Push-ups', 20);
console.log('Workout added:', workout);
```

## Как это работает

```
1. Клиент создаёт данные:
   data = { exerciseName: "Push-ups", reps: 20 }

2. Клиент подписывает данные своим приватным ключом:
   signature = sign(data, privateKey)

3. Клиент отправляет в Hasura:
   { publicKey, signature, data }

4. Hasura вызывает Action сервер

5. Action сервер проверяет подпись:
   verify(signature, data, publicKey) === true?

6. Если ОК → возвращает данные для вставки в БД
   Если НЕТ → ошибка 400

7. Hasura вставляет данные в БД
```

## Безопасность

✅ **Что защищено:**
- Никто не может создать запись от имени другого пользователя
- Данные нельзя подделать (подпись не совпадёт)
- publicKey автоматически привязывается к записи

❌ **Что НЕ защищено (и это нормально):**
- Нет защиты от повторной отправки (replay attack)
  - Если нужно: добавьте timestamp в data и проверяйте его
- Нет rate limiting
  - Если нужно: добавьте в Action сервер

## Пример с защитой от replay

```typescript
// Клиент добавляет timestamp
const data = {
    exerciseName: 'Push-ups',
    reps: 20,
    timestamp: Date.now()
};

// Action сервер проверяет timestamp
const { timestamp } = data;
const age = Date.now() - timestamp;

if (age > 60000) { // Старше 1 минуты
    return res.status(400).json({
        message: "Request too old"
    });
}
```

## Запуск

```bash
# Установить зависимости
npm install express @noble/curves @noble/hashes

# Запустить Action сервер
npx tsx hasura-simple-action.ts
```

## Итого

- ✅ Нет регистрации
- ✅ Нет JWT
- ✅ Нет лишних таблиц
- ✅ Просто проверка подписи перед записью
- ✅ publicKey передаётся с каждым запросом
