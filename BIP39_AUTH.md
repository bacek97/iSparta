# Авторизация с использованием BIP39

## Обзор

Этот документ описывает процесс авторизации пользователей с использованием мнемонических фраз BIP39 и получения публичного ключа для хранения на сервере.

## Процесс

### 1. Регистрация

```typescript
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';

// Шаг 1: Генерация мнемонической фразы
const mnemonic = bip39.generateMnemonic(wordlist, 128); // 12 слов
// Или для 3 слов:
// const mnemonic = bip39.generateMnemonic(wordlist, 32);

// Шаг 2: Конвертация мнемоники в seed
const seed = await bip39.mnemonicToSeed(mnemonic, ''); // можно добавить пароль

// Шаг 3: Создание HD кошелька
const hdKey = HDKey.fromMasterSeed(seed);

// Шаг 4: Деривация ключа по стандартному пути
const derivedKey = hdKey.derive("m/44'/0'/0'/0/0");

// Шаг 5: Получение публичного ключа
const publicKey = derivedKey.publicKey;
const publicKeyHex = Buffer.from(publicKey!).toString('hex');

// Шаг 6: Отправка публичного ключа на сервер
// POST /api/register
// { publicKey: publicKeyHex }
```

### 2. Авторизация

```typescript
// Шаг 1: Пользователь вводит мнемонику
const inputMnemonic = "word1 word2 word3 ...";

// Шаг 2: Генерация публичного ключа из мнемоники
const seed = await bip39.mnemonicToSeed(inputMnemonic, '');
const hdKey = HDKey.fromMasterSeed(seed);
const derivedKey = hdKey.derive("m/44'/0'/0'/0/0");
const publicKeyHex = Buffer.from(derivedKey.publicKey!).toString('hex');

// Шаг 3: Отправка публичного ключа на сервер для проверки
// POST /api/login
// { publicKey: publicKeyHex }

// Шаг 4: Сервер сравнивает с сохраненным публичным ключом
// SELECT * FROM users WHERE public_key = publicKeyHex
```

## Что хранить на сервере

### Вариант 1: Публичный ключ (рекомендуется)

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    public_key VARCHAR(66) UNIQUE NOT NULL, -- hex формат
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Преимущества:**
- Простота
- Один ключ = один пользователь
- Безопасность (невозможно получить приватный ключ)

### Вариант 2: Extended Public Key (xpub)

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    extended_public_key VARCHAR(111) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Преимущества:**
- Можно генерировать множество адресов для одного пользователя
- Полезно для криптовалютных приложений

**Недостатки:**
- Более сложная реализация
- Требует дополнительной логики на сервере

## Пути деривации (BIP44)

Стандартный формат: `m / purpose' / coin_type' / account' / change / address_index`

### Популярные пути:

- **Bitcoin**: `m/44'/0'/0'/0/0`
- **Ethereum**: `m/44'/60'/0'/0/0`
- **Litecoin**: `m/44'/2'/0'/0/0`
- **Dogecoin**: `m/44'/3'/0'/0/0`

### Объяснение:
- `m` - master key
- `44'` - BIP44 (апостроф означает hardened derivation)
- `0'` - Bitcoin coin type
- `0'` - account number
- `0` - external chain (0) или internal chain (1)
- `0` - address index

## Безопасность

### ✅ Что безопасно:

1. **Хранение публичного ключа на сервере** - из него невозможно получить приватный ключ
2. **Передача публичного ключа по HTTPS** - ключ не секретный
3. **Использование пароля** - дополнительный уровень защиты:
   ```typescript
   const seed = await bip39.mnemonicToSeed(mnemonic, 'user-password');
   ```

### ❌ Что НЕ безопасно:

1. **Хранение мнемоники на сервере** - никогда не делайте этого!
2. **Хранение seed на сервере** - никогда!
3. **Хранение приватного ключа** - никогда!
4. **Передача мнемоники по сети** - только публичный ключ!

## Пример API

### Регистрация

```typescript
// Клиент
async function register(mnemonic: string, password: string = '') {
    const seed = await bip39.mnemonicToSeed(mnemonic, password);
    const hdKey = HDKey.fromMasterSeed(seed);
    const derivedKey = hdKey.derive("m/44'/0'/0'/0/0");
    const publicKey = Buffer.from(derivedKey.publicKey!).toString('hex');
    
    const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey })
    });
    
    return response.json();
}

// Сервер (Node.js/Express)
app.post('/api/register', async (req, res) => {
    const { publicKey } = req.body;
    
    // Проверка, что ключ еще не зарегистрирован
    const existing = await db.query(
        'SELECT id FROM users WHERE public_key = $1',
        [publicKey]
    );
    
    if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'User already exists' });
    }
    
    // Создание пользователя
    const result = await db.query(
        'INSERT INTO users (public_key) VALUES ($1) RETURNING id',
        [publicKey]
    );
    
    const userId = result.rows[0].id;
    const token = generateJWT({ userId, publicKey });
    
    res.json({ token, userId });
});
```

### Авторизация

```typescript
// Клиент
async function login(mnemonic: string, password: string = '') {
    const seed = await bip39.mnemonicToSeed(mnemonic, password);
    const hdKey = HDKey.fromMasterSeed(seed);
    const derivedKey = hdKey.derive("m/44'/0'/0'/0/0");
    const publicKey = Buffer.from(derivedKey.publicKey!).toString('hex');
    
    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey })
    });
    
    return response.json();
}

// Сервер (Node.js/Express)
app.post('/api/login', async (req, res) => {
    const { publicKey } = req.body;
    
    // Поиск пользователя по публичному ключу
    const result = await db.query(
        'SELECT id FROM users WHERE public_key = $1',
        [publicKey]
    );
    
    if (result.rows.length === 0) {
        return res.status(401).json({ error: 'User not found' });
    }
    
    const userId = result.rows[0].id;
    const token = generateJWT({ userId, publicKey });
    
    res.json({ token, userId });
});
```

## Дополнительные возможности

### Подпись сообщений

Для дополнительной безопасности можно использовать подпись сообщений:

```typescript
import { secp256k1 } from '@noble/curves/secp256k1';

// Клиент: подписание сообщения
async function signMessage(mnemonic: string, message: string) {
    const seed = await bip39.mnemonicToSeed(mnemonic, '');
    const hdKey = HDKey.fromMasterSeed(seed);
    const derivedKey = hdKey.derive("m/44'/0'/0'/0/0");
    
    const privateKey = derivedKey.privateKey!;
    const messageHash = sha256(message);
    const signature = secp256k1.sign(messageHash, privateKey);
    
    return {
        message,
        signature: Buffer.from(signature.toCompactRawBytes()).toString('hex'),
        publicKey: Buffer.from(derivedKey.publicKey!).toString('hex')
    };
}

// Сервер: проверка подписи
function verifySignature(message: string, signature: string, publicKey: string): boolean {
    const messageHash = sha256(message);
    const sig = secp256k1.Signature.fromCompact(Buffer.from(signature, 'hex'));
    return secp256k1.verify(sig, messageHash, Buffer.from(publicKey, 'hex'));
}
```

## Тестирование

Запустите тесты:

```bash
npm test auth.spec.ts
```

Тесты покрывают:
- Генерацию публичного ключа
- Верификацию пользователя
- Работу с паролями
- Работу с 3-словными мнемониками
- Extended public keys
- Полный сценарий регистрации и авторизации

## Заключение

Использование BIP39 для авторизации предоставляет:

✅ **Безопасность** - приватные ключи никогда не покидают клиент  
✅ **Удобство** - пользователь запоминает только мнемонику  
✅ **Совместимость** - стандарт BIP39/BIP32/BIP44  
✅ **Гибкость** - поддержка паролей и разных путей деривации  

Публичный ключ безопасно хранится на сервере и используется для идентификации пользователя.
