# Настройка Hasura для Проверки Подписи

## Архитектура

```
┌─────────┐         ┌──────────────┐         ┌──────────┐
│ Клиент  │────────>│ Hasura       │────────>│ Actions  │
│         │         │ GraphQL API  │         │ Server   │
└─────────┘         └──────────────┘         └──────────┘
                           │                       │
                           │                       │
                           ▼                       ▼
                    ┌──────────────┐        ┌──────────┐
                    │  PostgreSQL  │<───────│ Verify   │
                    │  Database    │        │ Signature│
                    └──────────────┘        └──────────┘
```

## Шаг 1: Создание SQL Схемы

```sql
-- Таблица пользователей
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_key TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица challenges (для защиты от replay-атак)
CREATE TABLE challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 minute'
);

-- Индекс для быстрого поиска
CREATE INDEX idx_challenges_public_key ON challenges(public_key);
CREATE INDEX idx_challenges_expires_at ON challenges(expires_at);

-- Автоматическое удаление истёкших challenges
CREATE OR REPLACE FUNCTION delete_expired_challenges()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM challenges WHERE expires_at < NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_delete_expired_challenges
    BEFORE INSERT ON challenges
    EXECUTE FUNCTION delete_expired_challenges();
```

## Шаг 2: Настройка Hasura Actions

### 2.1 Определение Actions в Hasura Console

Перейдите в Hasura Console → Actions → Create

#### Action 1: generateChallenge

**Definition:**
```graphql
type Mutation {
  generateChallenge(publicKey: String!): ChallengeOutput
}
```

**Type Configuration:**
```graphql
type ChallengeOutput {
  challenge: String!
  expiresIn: Int!
}
```

**Handler URL:**
```
http://your-actions-server:3000/actions/generate-challenge
```

**Request Transform:**
```json
{
  "template": "POST",
  "url": "{{$base_url}}/actions/generate-challenge",
  "body": {
    "input": {
      "publicKey": "{{$body.input.publicKey}}"
    },
    "session_variables": "{{$session_variables}}"
  }
}
```

---

#### Action 2: registerUser

**Definition:**
```graphql
type Mutation {
  registerUser(
    publicKey: String!
    challenge: String!
    signature: String!
  ): RegisterOutput
}
```

**Type Configuration:**
```graphql
type RegisterOutput {
  id: uuid!
  publicKey: String!
  createdAt: timestamptz!
}
```

**Handler URL:**
```
http://your-actions-server:3000/actions/register-user
```

---

#### Action 3: loginUser

**Definition:**
```graphql
type Mutation {
  loginUser(
    publicKey: String!
    challenge: String!
    signature: String!
  ): LoginOutput
}
```

**Type Configuration:**
```graphql
type LoginOutput {
  token: String!
  publicKey: String!
}
```

**Handler URL:**
```
http://your-actions-server:3000/actions/login-user
```

## Шаг 3: Настройка Permissions

### Таблица `users`

**Role: anonymous**
- Select: ❌ (нет доступа)
- Insert: ❌ (только через Action)
- Update: ❌
- Delete: ❌

**Role: user**
- Select: ✅ (только свои данные)
  ```json
  {
    "public_key": {
      "_eq": "X-Hasura-User-Id"
    }
  }
  ```
- Insert: ❌
- Update: ✅ (только свои данные)
- Delete: ❌

### Таблица `challenges`

**Role: anonymous**
- Select: ❌
- Insert: ❌ (только через Action с admin secret)
- Update: ❌
- Delete: ❌

## Шаг 4: Настройка JWT

В Hasura Environment Variables добавьте:

```yaml
HASURA_GRAPHQL_JWT_SECRET: |
  {
    "type": "HS256",
    "key": "your-super-secret-jwt-key-min-32-characters-long"
  }
```

## Шаг 5: Использование на Клиенте

### Регистрация

```typescript
import { signChallenge } from './secure-auth';

async function register(mnemonic: string) {
    // 1. Получить challenge
    const challengeResponse = await fetch('https://your-hasura.app/v1/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: `
                mutation GenerateChallenge($publicKey: String!) {
                    generateChallenge(publicKey: $publicKey) {
                        challenge
                        expiresIn
                    }
                }
            `,
            variables: {
                publicKey: await getPublicKey(mnemonic)
            }
        })
    });

    const { data } = await challengeResponse.json();
    const challenge = data.generateChallenge.challenge;

    // 2. Подписать challenge
    const { publicKey, signature } = await signChallenge(mnemonic, challenge);

    // 3. Зарегистрироваться
    const registerResponse = await fetch('https://your-hasura.app/v1/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: `
                mutation RegisterUser(
                    $publicKey: String!
                    $challenge: String!
                    $signature: String!
                ) {
                    registerUser(
                        publicKey: $publicKey
                        challenge: $challenge
                        signature: $signature
                    ) {
                        id
                        publicKey
                        createdAt
                    }
                }
            `,
            variables: { publicKey, challenge, signature }
        })
    });

    const result = await registerResponse.json();
    console.log('Registered:', result.data.registerUser);
}
```

### Вход

```typescript
async function login(mnemonic: string) {
    // 1. Получить challenge
    const publicKey = await getPublicKey(mnemonic);
    
    const challengeResponse = await fetch('https://your-hasura.app/v1/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: `
                mutation GenerateChallenge($publicKey: String!) {
                    generateChallenge(publicKey: $publicKey) {
                        challenge
                        expiresIn
                    }
                }
            `,
            variables: { publicKey }
        })
    });

    const { data } = await challengeResponse.json();
    const challenge = data.generateChallenge.challenge;

    // 2. Подписать challenge
    const { signature } = await signChallenge(mnemonic, challenge);

    // 3. Войти
    const loginResponse = await fetch('https://your-hasura.app/v1/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: `
                mutation LoginUser(
                    $publicKey: String!
                    $challenge: String!
                    $signature: String!
                ) {
                    loginUser(
                        publicKey: $publicKey
                        challenge: $challenge
                        signature: $signature
                    ) {
                        token
                        publicKey
                    }
                }
            `,
            variables: { publicKey, challenge, signature }
        })
    });

    const result = await loginResponse.json();
    const token = result.data.loginUser.token;

    // 4. Сохранить токен для последующих запросов
    localStorage.setItem('hasura_token', token);
    
    return token;
}
```

### Использование токена

```typescript
// После входа используйте токен для всех запросов
async function getUserData() {
    const token = localStorage.getItem('hasura_token');
    
    const response = await fetch('https://your-hasura.app/v1/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            query: `
                query GetUser {
                    users {
                        id
                        publicKey
                        createdAt
                    }
                }
            `
        })
    });

    const { data } = await response.json();
    return data.users;
}
```

## Альтернатива: Event Triggers (не рекомендуется для этого случая)

Event Triggers срабатывают **после** вставки в БД, поэтому не подходят для проверки **перед** вставкой.

## Альтернатива: Remote Schema

Можно создать отдельный GraphQL сервер с проверкой подписи и добавить его как Remote Schema в Hasura.

## Безопасность

### ✅ Что делает этот подход безопасным:

1. **Проверка подписи** - только владелец приватного ключа может создать валидную подпись
2. **Challenge-response** - защита от replay-атак
3. **Expiring challenges** - challenge истекает через 1 минуту
4. **JWT токены** - после входа используются стандартные JWT
5. **Hasura Permissions** - дополнительный уровень защиты на уровне БД

### 🔒 Дополнительные меры:

1. **Rate limiting** - ограничить количество попыток входа
2. **HTTPS обязательно** - весь трафик должен быть зашифрован
3. **Логирование** - записывать все попытки входа
4. **Мониторинг** - отслеживать подозрительную активность

## Переменные окружения

```env
# .env файл для Actions сервера
PORT=3000
HASURA_GRAPHQL_URL=https://your-hasura.app/v1/graphql
HASURA_ADMIN_SECRET=your-admin-secret
HASURA_JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
```

## Запуск

```bash
# Установить зависимости
npm install express @noble/curves @noble/hashes jsonwebtoken

# Запустить Actions сервер
npx tsx hasura-auth-action.ts
```
