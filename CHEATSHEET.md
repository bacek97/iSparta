# 🚀 Шпаргалка: Web Crypto API для Hasura

## ⚡ Быстрый старт (30 секунд)

### В браузере (консоль):

```javascript
// 1. Генерация ключей
const k = await crypto.subtle.generateKey(
    {name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]
);

// 2. Подпись
const d = {exerciseName:"Push-ups",reps:20};
const s = await crypto.subtle.sign(
    {name:"ECDSA",hash:"SHA-256"},
    k.privateKey,
    new TextEncoder().encode(JSON.stringify(d))
);

// 3. Проверка
const v = await crypto.subtle.verify(
    {name:"ECDSA",hash:"SHA-256"},
    k.publicKey,
    s,
    new TextEncoder().encode(JSON.stringify(d))
);
console.log(v); // true
```

---

## 📋 Сравнение: secp256k1 vs P-256

| | secp256k1 | P-256 (Web Crypto) |
|---|---|---|
| **Библиотека** | @noble/curves (50 KB) | Встроено (0 KB) |
| **BIP39** | ✅ | ❌ |
| **Браузер** | ❌ Нужна библиотека | ✅ Встроено |
| **Deno** | ❌ Нужна библиотека | ✅ Встроено |
| **Скорость** | Средняя | Быстрая |
| **Для Hasura** | ✅ Работает | ✅ **Лучше** |

---

## 🎯 Рекомендация

### Используйте **P-256 (Web Crypto API)**

**Причины:**
- ✅ 0 KB зависимостей
- ✅ Быстрее
- ✅ Проще
- ✅ Встроено везде

**Когда НЕ использовать:**
- ❌ Нужна совместимость с Bitcoin/Ethereum
- ❌ Нужен BIP39/BIP44

---

## 📦 Файлы

### БЕЗ библиотек (рекомендуется):
- `web-crypto-demo.html` ⭐ - Интерактивная демонстрация
- `browser-client-no-libs.ts` - Клиент
- `deno-deploy/main-no-libs.ts` - Сервер

### С библиотеками:
- `secure-auth.ts` - BIP39 генерация
- `hasura-client.ts` - Клиент
- `deno-deploy/main.ts` - Сервер

---

## 🔧 Команды

### Демонстрация:
```bash
# Открыть в браузере
start web-crypto-demo.html
```

### Деплой:
```bash
# Deno Deploy
deployctl deploy --project=hasura-verify deno-deploy/main-no-libs.ts
```

### Hasura Action:
```
Handler: https://your-project.deno.dev
```

---

## 💡 Ключевые моменты

1. **Web Crypto API** встроен в браузер и Deno
2. **P-256** быстрее и проще чем secp256k1
3. **0 KB** зависимостей
4. **Безопасно** как secp256k1

---

## 📚 Документация

- `FINAL_ANSWERS.md` - Ответы на все вопросы
- `ALGORITHM_COMPARISON.md` - Детальное сравнение
- `MODERN_ALTERNATIVES.md` - Serverless платформы
