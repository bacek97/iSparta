# Почему Web Crypto API не соответствует BIP39?

## 🔑 Ключевое отличие

**BIP39** - это не алгоритм подписи, а **стандарт генерации ключей** из мнемонических фраз.

```
BIP39 (мнемоника) → Seed → BIP32 (HD кошелёк) → BIP44 (путь) → secp256k1 (ключи)
```

Web Crypto API **не поддерживает** эту цепочку, потому что:

1. ❌ Нет функции `mnemonicToSeed()`
2. ❌ Нет BIP32 деривации ключей
3. ❌ Нет поддержки secp256k1 кривой
4. ❌ Генерирует ключи случайно, а не из мнемоники

---

## 📊 Сравнение подходов

### BIP39 подход (с библиотеками):

```typescript
// 1. Мнемоника → Seed
const mnemonic = "mountain pilot push";
const seed = await bip39.mnemonicToSeed(mnemonic);

// 2. Seed → HD ключ
const hdKey = HDKey.fromMasterSeed(seed);

// 3. Деривация по пути
const derivedKey = hdKey.derive("m/44'/0'/0'/0/0");

// 4. Получение ключей
const privateKey = derivedKey.privateKey;  // secp256k1
const publicKey = derivedKey.publicKey;    // secp256k1
```

**Результат:** Одна и та же мнемоника → одни и те же ключи (детерминированно)

---

### Web Crypto API подход (без библиотек):

```typescript
// 1. Генерация случайных ключей
const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
);

// 2. Ключи готовы
const privateKey = keyPair.privateKey;  // P-256
const publicKey = keyPair.publicKey;    // P-256
```

**Результат:** Каждый раз новые случайные ключи (недетерминированно)

---

## 🤔 Почему я выбрал ECDSA?

### Доступные алгоритмы в Web Crypto API:

| Алгоритм | Тип | Для подписи | Скорость | Размер ключа |
|----------|-----|-------------|----------|--------------|
| **ECDSA** | Асимметричный | ✅ | Быстро | Маленький |
| **RSA-PSS** | Асимметричный | ✅ | Медленно | Большой |
| **RSASSA-PKCS1-v1_5** | Асимметричный | ✅ | Медленно | Большой |
| **HMAC** | Симметричный | ✅ | Очень быстро | Средний |
| **Ed25519** | Асимметричный | ✅ | Очень быстро | Маленький |
| **X25519** | Асимметричный | ❌ (только шифрование) | - | - |

### Почему ECDSA:

1. ✅ **Асимметричная криптография** - публичный ключ можно хранить на сервере
2. ✅ **Маленький размер** ключей (91 байт vs 256+ для RSA)
3. ✅ **Быстрая** генерация и проверка
4. ✅ **Широкая поддержка** - работает везде

### Почему НЕ другие:

**HMAC:**
- ❌ Симметричный - нужно хранить секретный ключ на сервере
- ❌ Если сервер скомпрометирован, злоумышленник может подписывать данные

**RSA-PSS / RSASSA-PKCS1-v1_5:**
- ❌ Медленнее ECDSA
- ❌ Большие ключи (256+ байт)
- ❌ Больше вычислений

**Ed25519:**
- ✅ Самый быстрый и современный
- ❌ **НЕ поддерживается** в Web Crypto API (пока)
- ❌ Только в новых браузерах (Chrome 113+, экспериментально)

---

## 🆕 Ed25519 в Web Crypto API

**Хорошая новость:** Ed25519 добавлен в спецификацию, но поддержка ограничена!

### Поддержка Ed25519:

| Платформа | Поддержка | Версия |
|-----------|-----------|--------|
| Chrome | ✅ Экспериментально | 113+ (с флагом) |
| Firefox | ❌ Нет | - |
| Safari | ❌ Нет | - |
| Deno | ✅ Да | 1.37+ |
| Node.js | ✅ Да | 19+ |

### Код с Ed25519:

```typescript
// Работает в Deno и новых Chrome
const keyPair = await crypto.subtle.generateKey(
    "Ed25519",  // Вместо ECDSA
    true,
    ["sign", "verify"]
);

const signature = await crypto.subtle.sign(
    "Ed25519",
    privateKey,
    messageBytes
);

const isValid = await crypto.subtle.verify(
    "Ed25519",
    publicKey,
    signature,
    messageBytes
);
```

**Проблема:** Не работает в большинстве браузеров (пока).

---

## 📋 Детальное сравнение кривых

### ECDSA P-256 (Web Crypto):

```typescript
{
    name: "ECDSA",
    namedCurve: "P-256"  // Также известна как secp256r1
}
```

**Характеристики:**
- Кривая: NIST P-256 (secp256r1)
- Размер ключа: 256 бит
- Стандарт: FIPS 186-4
- Используется: TLS, JWT, HTTPS

### secp256k1 (Bitcoin):

```typescript
// Нужна библиотека @noble/curves
import { secp256k1 } from '@noble/curves/secp256k1';
```

**Характеристики:**
- Кривая: secp256k1
- Размер ключа: 256 бит
- Стандарт: SEC 2
- Используется: Bitcoin, Ethereum

### Математическое отличие:

```
P-256:     y² = x³ - 3x + b  (mod p)
secp256k1: y² = x³ + 7      (mod p)
```

**Безопасность:** Обе одинаково безопасны (256 бит)

**Скорость:** P-256 быстрее в Web Crypto API (нативная реализация)

---

## 🎯 Что выбрать для вашего проекта?

### Вариант 1: ECDSA P-256 (Web Crypto API) ⭐ РЕКОМЕНДУЮ

**Используйте, если:**
- ✅ Нужна только авторизация в вашем приложении
- ✅ Не нужна совместимость с криптовалютами
- ✅ Хотите 0 KB зависимостей
- ✅ Важна поддержка всех браузеров

**Код:**
```typescript
const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
);
```

---

### Вариант 2: Ed25519 (Web Crypto API) - БУДУЩЕЕ

**Используйте, если:**
- ✅ Работаете только с Deno/Node.js
- ✅ Не нужна поддержка старых браузеров
- ✅ Хотите максимальную скорость

**Код:**
```typescript
const keyPair = await crypto.subtle.generateKey(
    "Ed25519",
    true,
    ["sign", "verify"]
);
```

**Проблема:** Не работает в большинстве браузеров (пока).

---

### Вариант 3: secp256k1 (BIP39) - ДЛЯ КРИПТОВАЛЮТ

**Используйте, если:**
- ✅ Нужна совместимость с Bitcoin/Ethereum
- ✅ Хотите использовать мнемонические фразы как в криптовалютах
- ✅ Планируете интеграцию с криптовалютными кошельками

**Код:**
```typescript
import { secp256k1 } from '@noble/curves/secp256k1';
import * as bip39 from '@scure/bip39';

const mnemonic = "mountain pilot push";
const seed = await bip39.mnemonicToSeed(mnemonic);
// ... BIP32 деривация
```

**Недостаток:** Нужна библиотека (~50 KB).

---

## 💡 Можно ли использовать мнемонику с Web Crypto API?

**Да, но не по стандарту BIP39!**

### Упрощённый подход:

```typescript
// 1. Мнемоника → Seed (простой хеш)
async function mnemonicToSeed(mnemonic: string): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const data = encoder.encode(mnemonic);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hashBuffer);
}

// 2. Seed → Ключи (через importKey)
const mnemonic = "mountain pilot push";
const seed = await mnemonicToSeed(mnemonic);

const privateKey = await crypto.subtle.importKey(
    "raw",
    seed,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
);
```

**Проблема:** Это **НЕ BIP39**! Не совместимо с криптовалютными кошельками.

---

## 📊 Итоговое сравнение

| Критерий | ECDSA P-256 | Ed25519 | secp256k1 (BIP39) |
|----------|-------------|---------|-------------------|
| **Библиотека** | 0 KB | 0 KB | 50 KB |
| **Браузеры** | ✅ Все | ⚠️ Новые | ❌ Нужна библиотека |
| **Deno** | ✅ | ✅ | ❌ Нужна библиотека |
| **Скорость** | Быстро | Очень быстро | Средне |
| **BIP39** | ❌ | ❌ | ✅ |
| **Криптовалюты** | ❌ | ❌ | ✅ |
| **Для Hasura** | ✅ **Лучший** | ✅ Хорошо | ✅ Работает |

---

## ✅ Моя рекомендация

### Для вашего проекта (публикации тренировок):

**Используйте ECDSA P-256 (Web Crypto API)**

**Почему:**
1. ✅ **0 KB зависимостей**
2. ✅ **Работает везде** (все браузеры, Deno, Node.js)
3. ✅ **Быстро**
4. ✅ **Просто**
5. ✅ **Безопасно**

**Когда НЕ использовать:**
- ❌ Нужна совместимость с Bitcoin/Ethereum кошельками
- ❌ Пользователи должны использовать те же ключи для криптовалют

---

## 🚀 Пример для вашей публикации

```typescript
// Генерация ключей (один раз)
const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
);

// Сохранение в localStorage
const publicKeyExported = await crypto.subtle.exportKey("spki", keyPair.publicKey);
const privateKeyExported = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

localStorage.setItem('publicKey', btoa(String.fromCharCode(...new Uint8Array(publicKeyExported))));
localStorage.setItem('privateKey', btoa(String.fromCharCode(...new Uint8Array(privateKeyExported))));

// Подпись публикации
const publication = {
    publicKey: localStorage.getItem('publicKey'),
    date: new Date(),
    text: 'Great workout today!',
    exercises: [
        { exercise: 'SQUATS', sec: 30, reps: 10 },
        { exercise: 'RUNNING', sec: 30, km: 10, 'svg:path[d]': 'M10 10 L100 100' }
    ],
    image: 'base64/png'
};

// Подпись
const message = JSON.stringify(publication);
const messageBytes = new TextEncoder().encode(message);

const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(localStorage.getItem('privateKey')), c => c.charCodeAt(0)),
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
);

const signatureBytes = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    messageBytes
);

publication.signature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

// Отправка в Hasura
// Hasura проверит подпись и вставит в БД
```

Нужна ли демонстрация именно для вашей структуры публикации?
