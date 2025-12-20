# Варианты проверки подписи в Hasura БЕЗ своего сервера

## ❌ Проблема с PostgreSQL функциями

PostgreSQL **не поддерживает** ECDSA secp256k1 из коробки. Доступные расширения:
- `pgcrypto` - только HMAC, RSA, но НЕТ secp256k1
- `pgsodium` - только Ed25519, но НЕТ secp256k1

**Вывод**: Для BIP39 (secp256k1) нужен отдельный сервер.

---

## ✅ Варианты БЕЗ своего сервера

### Вариант 1: Serverless Functions (Рекомендую) ⭐

Используйте бесплатные serverless платформы:

#### **A. Vercel Functions** (Бесплатно)

```typescript
// api/verify-signature.ts
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

export default async function handler(req, res) {
    const { publicKey, signature, data } = req.body.input;
    
    try {
        const message = JSON.stringify(data);
        const messageHash = sha256(Buffer.from(message));
        const isValid = secp256k1.verify(signature, messageHash, publicKey);
        
        if (!isValid) {
            return res.status(400).json({ message: "Invalid signature" });
        }
        
        return res.json({
            ...data,
            publicKey,
            verifiedAt: new Date().toISOString()
        });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
}
```

**Деплой:**
```bash
# 1. Установить Vercel CLI
npm i -g vercel

# 2. Задеплоить
vercel

# Получите URL: https://your-project.vercel.app/api/verify-signature
```

**Hasura Action URL:**
```
https://your-project.vercel.app/api/verify-signature
```

---

#### **B. Cloudflare Workers** (Бесплатно)

```typescript
// worker.ts
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

export default {
    async fetch(request) {
        if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
        }
        
        const { input } = await request.json();
        const { publicKey, signature, data } = input;
        
        try {
            const message = JSON.stringify(data);
            const messageHash = sha256(new TextEncoder().encode(message));
            const isValid = secp256k1.verify(signature, messageHash, publicKey);
            
            if (!isValid) {
                return new Response(
                    JSON.stringify({ message: "Invalid signature" }),
                    { status: 400 }
                );
            }
            
            return new Response(JSON.stringify({
                ...data,
                publicKey,
                verifiedAt: new Date().toISOString()
            }));
        } catch (error) {
            return new Response(
                JSON.stringify({ message: error.message }),
                { status: 400 }
            );
        }
    }
};
```

**Деплой:**
```bash
npm create cloudflare@latest
# Выберите: Workers
# Задеплоить: npm run deploy
```

---

#### **C. Netlify Functions** (Бесплатно)

```typescript
// netlify/functions/verify-signature.ts
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

export async function handler(event) {
    const { publicKey, signature, data } = JSON.parse(event.body).input;
    
    try {
        const message = JSON.stringify(data);
        const messageHash = sha256(Buffer.from(message));
        const isValid = secp256k1.verify(signature, messageHash, publicKey);
        
        if (!isValid) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Invalid signature" })
            };
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                ...data,
                publicKey,
                verifiedAt: new Date().toISOString()
            })
        };
    } catch (error) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: error.message })
        };
    }
}
```

---

#### **D. Supabase Edge Functions** (Бесплатно)

```typescript
// supabase/functions/verify-signature/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { secp256k1 } from "npm:@noble/curves@1.2.0/secp256k1"
import { sha256 } from "npm:@noble/hashes@1.3.2/sha256"

serve(async (req) => {
    const { publicKey, signature, data } = (await req.json()).input;
    
    try {
        const message = JSON.stringify(data);
        const messageHash = sha256(new TextEncoder().encode(message));
        const isValid = secp256k1.verify(signature, messageHash, publicKey);
        
        if (!isValid) {
            return new Response(
                JSON.stringify({ message: "Invalid signature" }),
                { status: 400 }
            );
        }
        
        return new Response(JSON.stringify({
            ...data,
            publicKey,
            verifiedAt: new Date().toISOString()
        }));
    } catch (error) {
        return new Response(
            JSON.stringify({ message: error.message }),
            { status: 400 }
        );
    }
})
```

---

### Вариант 2: Hasura Cloud + Remote Schema

Создайте GraphQL сервер на serverless платформе и добавьте его как Remote Schema в Hasura.

---

### Вариант 3: Упрощённая схема (без ECDSA)

Если вам не критична именно ECDSA secp256k1, можно использовать **Ed25519** (поддерживается в PostgreSQL через `pgsodium`):

```sql
-- Установить pgsodium
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Функция проверки Ed25519 подписи
CREATE OR REPLACE FUNCTION verify_ed25519(
    p_public_key BYTEA,
    p_message BYTEA,
    p_signature BYTEA
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN pgsodium.crypto_sign_verify_detached(
        p_signature,
        p_message,
        p_public_key
    );
END;
$$ LANGUAGE plpgsql;
```

Но это требует изменения клиентской части на Ed25519 вместо secp256k1.

---

## 🎯 Рекомендация

**Используйте Vercel Functions** - это:
- ✅ Бесплатно (100k запросов/месяц)
- ✅ Автоматический деплой из Git
- ✅ HTTPS из коробки
- ✅ Поддержка TypeScript
- ✅ Простая настройка

---

## 📦 Быстрый старт с Vercel

1. Создайте проект:
```bash
mkdir hasura-verify
cd hasura-verify
npm init -y
npm install @noble/curves @noble/hashes
```

2. Создайте `api/verify-signature.ts` (код выше)

3. Создайте `vercel.json`:
```json
{
  "functions": {
    "api/verify-signature.ts": {
      "memory": 128,
      "maxDuration": 10
    }
  }
}
```

4. Задеплойте:
```bash
vercel
```

5. Используйте URL в Hasura Actions:
```
https://your-project.vercel.app/api/verify-signature
```

---

## Сравнение платформ

| Платформа | Бесплатный лимит | Деплой | TypeScript | Рекомендация |
|-----------|------------------|--------|------------|--------------|
| **Vercel** | 100k req/мес | ⭐⭐⭐ | ✅ | ⭐ Лучший |
| **Cloudflare Workers** | 100k req/день | ⭐⭐ | ✅ | Отлично |
| **Netlify** | 125k req/мес | ⭐⭐⭐ | ✅ | Отлично |
| **Supabase** | Безлимит | ⭐⭐ | ✅ (Deno) | Хорошо |

Все варианты бесплатные и не требуют своего сервера!
