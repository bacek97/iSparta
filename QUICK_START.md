# Быстрая шпаргалка: BIP39 Авторизация

## Установка зависимостей

```bash
npm install @scure/bip39 @scure/bip32
npm install --save-dev @types/node
```

## Регистрация пользователя

```typescript
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';

// 1. Генерация мнемоники (клиент)
const mnemonic = bip39.generateMnemonic(wordlist, 128); // 12 слов
// или для 3 слов: bip39.generateMnemonic(wordlist, 32);

// 2. Получение публичного ключа (клиент)
const seed = await bip39.mnemonicToSeed(mnemonic, ''); // можно добавить пароль
const hdKey = HDKey.fromMasterSeed(seed);
const derivedKey = hdKey.derive("m/44'/0'/0'/0/0");
const publicKey = Buffer.from(derivedKey.publicKey!).toString('hex');

// 3. Отправка публичного ключа на сервер
await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicKey })
});

// 4. Сохранение мнемоники (клиент - локально, безопасно!)
// ВАЖНО: Пользователь должен сохранить мнемонику!
console.log('Сохраните эту фразу:', mnemonic);
```

## Авторизация пользователя

```typescript
// 1. Пользователь вводит мнемонику
const inputMnemonic = "word1 word2 word3 ...";

// 2. Получение публичного ключа из мнемоники
const seed = await bip39.mnemonicToSeed(inputMnemonic, '');
const hdKey = HDKey.fromMasterSeed(seed);
const derivedKey = hdKey.derive("m/44'/0'/0'/0/0");
const publicKey = Buffer.from(derivedKey.publicKey!).toString('hex');

// 3. Отправка на сервер для проверки
const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicKey })
});

const { token } = await response.json();
```

## Серверная часть (Node.js/Express)

### Регистрация

```javascript
app.post('/api/register', async (req, res) => {
    const { publicKey } = req.body;
    
    // Проверка уникальности
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
    const token = jwt.sign({ userId, publicKey }, JWT_SECRET);
    
    res.json({ token, userId });
});
```

### Авторизация

```javascript
app.post('/api/login', async (req, res) => {
    const { publicKey } = req.body;
    
    // Поиск пользователя
    const result = await db.query(
        'SELECT id FROM users WHERE public_key = $1',
        [publicKey]
    );
    
    if (result.rows.length === 0) {
        return res.status(401).json({ error: 'User not found' });
    }
    
    const userId = result.rows[0].id;
    const token = jwt.sign({ userId, publicKey }, JWT_SECRET);
    
    res.json({ token, userId });
});
```

## База данных

### PostgreSQL

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    public_key VARCHAR(66) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_public_key ON users(public_key);
```

### MongoDB

```javascript
const userSchema = new mongoose.Schema({
    publicKey: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});
```

## Вспомогательные функции

```typescript
// Получение публичного ключа из мнемоники
async function getPublicKey(mnemonic: string, password: string = ''): Promise<string> {
    const seed = await bip39.mnemonicToSeed(mnemonic, password);
    const hdKey = HDKey.fromMasterSeed(seed);
    const derivedKey = hdKey.derive("m/44'/0'/0'/0/0");
    return Buffer.from(derivedKey.publicKey!).toString('hex');
}

// Валидация мнемоники
function isValidMnemonic(mnemonic: string): boolean {
    return bip39.validateMnemonic(mnemonic, wordlist);
}

// Генерация мнемоники с заданным количеством слов
function generateMnemonic(wordCount: 12 | 15 | 18 | 21 | 24 | 3): string {
    const entropyBits = {
        3: 32,   // Не стандарт, но работает
        12: 128,
        15: 160,
        18: 192,
        21: 224,
        24: 256
    };
    
    return bip39.generateMnemonic(wordlist, entropyBits[wordCount]);
}
```

## Пути деривации (BIP44)

```typescript
// Bitcoin
const btcPath = "m/44'/0'/0'/0/0";

// Ethereum
const ethPath = "m/44'/60'/0'/0/0";

// Litecoin
const ltcPath = "m/44'/2'/0'/0/0";

// Универсальная функция
function getPublicKeyForCoin(mnemonic: string, coinType: number): Promise<string> {
    const path = `m/44'/${coinType}'/0'/0/0`;
    const seed = await bip39.mnemonicToSeed(mnemonic, '');
    const hdKey = HDKey.fromMasterSeed(seed);
    const derivedKey = hdKey.derive(path);
    return Buffer.from(derivedKey.publicKey!).toString('hex');
}
```

## Безопасность

### ✅ Делайте:
- Храните публичный ключ на сервере
- Используйте HTTPS для всех запросов
- Добавляйте пароль для дополнительной защиты
- Валидируйте мнемонику на клиенте

### ❌ НЕ делайте:
- НЕ храните мнемонику на сервере
- НЕ храните seed на сервере
- НЕ храните приватный ключ
- НЕ передавайте мнемонику по сети

## Тестирование

```bash
npm test auth.spec.ts
```

## Формат публичного ключа

```
Hex: 0235c92b1391b40d229cfe9d257bfdd1bc3e699185be1d7d13dc5dc92b2ce5d4e3
Длина: 66 символов (33 байта в compressed формате)
```

## Пример полного flow

```typescript
// === КЛИЕНТ: Регистрация ===
const mnemonic = bip39.generateMnemonic(wordlist, 128);
alert(`Сохраните эту фразу: ${mnemonic}`);

const publicKey = await getPublicKey(mnemonic);
await registerUser(publicKey);

// === КЛИЕНТ: Авторизация ===
const inputMnemonic = prompt('Введите вашу мнемоническую фразу:');
const publicKey = await getPublicKey(inputMnemonic);
const token = await loginUser(publicKey);

localStorage.setItem('token', token);
```

## Дополнительно: Extended Public Key

Если нужно генерировать много адресов для одного пользователя:

```typescript
// Получение xpub
const accountKey = hdKey.derive("m/44'/0'/0'");
const xpub = accountKey.publicExtendedKey;

// Деривация дочерних адресов из xpub
const publicHDKey = HDKey.fromExtendedKey(xpub);
const address0 = publicHDKey.deriveChild(0).deriveChild(0);
const address1 = publicHDKey.deriveChild(0).deriveChild(1);
```

---

**Готово!** Теперь у вас есть полноценная система авторизации на основе BIP39! 🎉
