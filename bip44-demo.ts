import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';

// Демонстрация BIP44 путей деривации

async function demo() {
    console.log('='.repeat(80));
    console.log('BIP44 ПУТЬ ДЕРИВАЦИИ: ПРАКТИЧЕСКИЕ ПРИМЕРЫ');
    console.log('='.repeat(80));

    // Генерируем одну мнемонику для всех примеров
    const mnemonic = bip39.generateMnemonic(wordlist, 128);
    console.log('\n📝 Мнемоническая фраза:', mnemonic);

    const seed = await bip39.mnemonicToSeed(mnemonic, '');
    const masterKey = HDKey.fromMasterSeed(seed);

    console.log('\n' + '='.repeat(80));
    console.log('РАЗБОР ПУТИ: m/44\'/0\'/0\'/0/0');
    console.log('='.repeat(80));

    // Демонстрация каждого уровня
    console.log('\n1️⃣  m - Master Key (Корневой ключ)');
    console.log('   Генерируется из seed');
    console.log('   Это начало всей иерархии');

    console.log('\n2️⃣  44\' - Purpose (Цель)');
    console.log('   44 = BIP44 стандарт');
    console.log('   Апостроф (\') = hardened derivation (усиленная деривация)');

    console.log('\n3️⃣  0\' - Coin Type (Тип криптовалюты)');
    console.log('   0 = Bitcoin');
    console.log('   60 = Ethereum');
    console.log('   2 = Litecoin');
    console.log('   Полный список: https://github.com/satoshilabs/slips/blob/master/slip-0044.md');

    console.log('\n4️⃣  0\' - Account (Номер аккаунта)');
    console.log('   0 = Первый аккаунт');
    console.log('   1 = Второй аккаунт');
    console.log('   Используется для разделения средств (личные, бизнес и т.д.)');

    console.log('\n5️⃣  0 - Change (Тип адреса)');
    console.log('   0 = External (внешний, для получения платежей)');
    console.log('   1 = Internal (внутренний, для сдачи)');

    console.log('\n6️⃣  0 - Address Index (Индекс адреса)');
    console.log('   0 = Первый адрес');
    console.log('   1 = Второй адрес');
    console.log('   Можно генерировать до 2^31 - 1 адресов');

    // Пример 1: Разные криптовалюты
    console.log('\n' + '='.repeat(80));
    console.log('ПРИМЕР 1: МУЛЬТИВАЛЮТНЫЙ КОШЕЛЕК');
    console.log('='.repeat(80));

    const coins = [
        { name: 'Bitcoin', type: 0, path: "m/44'/0'/0'/0/0" },
        { name: 'Ethereum', type: 60, path: "m/44'/60'/0'/0/0" },
        { name: 'Litecoin', type: 2, path: "m/44'/2'/0'/0/0" },
        { name: 'Dogecoin', type: 3, path: "m/44'/3'/0'/0/0" },
        { name: 'Solana', type: 501, path: "m/44'/501'/0'/0/0" }
    ];

    coins.forEach(coin => {
        const key = masterKey.derive(coin.path);
        const pubKey = Buffer.from(key.publicKey!).toString('hex');
        console.log(`\n${coin.name}:`);
        console.log(`  Путь: ${coin.path}`);
        console.log(`  Публичный ключ: ${pubKey}`);
    });

    // Пример 2: Несколько адресов для одной криптовалюты
    console.log('\n' + '='.repeat(80));
    console.log('ПРИМЕР 2: НЕСКОЛЬКО BITCOIN АДРЕСОВ (для приватности)');
    console.log('='.repeat(80));

    for (let i = 0; i < 5; i++) {
        const path = `m/44'/0'/0'/0/${i}`;
        const key = masterKey.derive(path);
        const pubKey = Buffer.from(key.publicKey!).toString('hex');
        console.log(`\nАдрес ${i}:`);
        console.log(`  Путь: ${path}`);
        console.log(`  Публичный ключ: ${pubKey.substring(0, 20)}...`);
    }

    // Пример 3: Разные аккаунты
    console.log('\n' + '='.repeat(80));
    console.log('ПРИМЕР 3: РАЗНЫЕ АККАУНТЫ (разделение средств)');
    console.log('='.repeat(80));

    const accounts = [
        { name: 'Личные средства', account: 0, path: "m/44'/0'/0'/0/0" },
        { name: 'Бизнес', account: 1, path: "m/44'/0'/1'/0/0" },
        { name: 'Сбережения', account: 2, path: "m/44'/0'/2'/0/0" },
        { name: 'Инвестиции', account: 3, path: "m/44'/0'/3'/0/0" }
    ];

    accounts.forEach(acc => {
        const key = masterKey.derive(acc.path);
        const pubKey = Buffer.from(key.publicKey!).toString('hex');
        console.log(`\n${acc.name}:`);
        console.log(`  Путь: ${acc.path}`);
        console.log(`  Публичный ключ: ${pubKey.substring(0, 20)}...`);
    });

    // Пример 4: External vs Internal (Change)
    console.log('\n' + '='.repeat(80));
    console.log('ПРИМЕР 4: EXTERNAL vs INTERNAL (CHANGE) АДРЕСА');
    console.log('='.repeat(80));

    console.log('\nExternal адреса (для получения платежей):');
    for (let i = 0; i < 3; i++) {
        const path = `m/44'/0'/0'/0/${i}`;
        const key = masterKey.derive(path);
        const pubKey = Buffer.from(key.publicKey!).toString('hex');
        console.log(`  ${path} → ${pubKey.substring(0, 20)}...`);
    }

    console.log('\nInternal адреса (для сдачи):');
    for (let i = 0; i < 3; i++) {
        const path = `m/44'/0'/0'/1/${i}`;
        const key = masterKey.derive(path);
        const pubKey = Buffer.from(key.publicKey!).toString('hex');
        console.log(`  ${path} → ${pubKey.substring(0, 20)}...`);
    }

    // Пример 5: Для авторизации
    console.log('\n' + '='.repeat(80));
    console.log('ПРИМЕР 5: ДЛЯ АВТОРИЗАЦИИ (ваш случай)');
    console.log('='.repeat(80));

    const authPath = "m/44'/0'/0'/0/0";
    const authKey = masterKey.derive(authPath);
    const authPubKey = Buffer.from(authKey.publicKey!).toString('hex');

    console.log('\nДля авторизации используйте один фиксированный путь:');
    console.log(`  Путь: ${authPath}`);
    console.log(`  Публичный ключ: ${authPubKey}`);
    console.log('\nЭтот публичный ключ можно безопасно хранить на сервере!');
    console.log('Каждый пользователь будет иметь свою уникальную мнемонику');
    console.log('и, соответственно, свой уникальный публичный ключ.');

    // Визуализация иерархии
    console.log('\n' + '='.repeat(80));
    console.log('ВИЗУАЛИЗАЦИЯ ИЕРАРХИИ');
    console.log('='.repeat(80));

    console.log(`
Master Seed (из мнемоники)
│
└─ m (Master Key)
   │
   └─ m/44' (BIP44)
      │
      ├─ m/44'/0' (Bitcoin)
      │  │
      │  ├─ m/44'/0'/0' (Account 0 - Личные)
      │  │  │
      │  │  ├─ m/44'/0'/0'/0 (External - для получения)
      │  │  │  │
      │  │  │  ├─ m/44'/0'/0'/0/0 (Address 0) ← ДЛЯ АВТОРИЗАЦИИ
      │  │  │  ├─ m/44'/0'/0'/0/1 (Address 1)
      │  │  │  └─ m/44'/0'/0'/0/2 (Address 2)
      │  │  │
      │  │  └─ m/44'/0'/0'/1 (Internal - для сдачи)
      │  │     │
      │  │     ├─ m/44'/0'/0'/1/0 (Change Address 0)
      │  │     └─ m/44'/0'/0'/1/1 (Change Address 1)
      │  │
      │  ├─ m/44'/0'/1' (Account 1 - Бизнес)
      │  │  └─ m/44'/0'/1'/0/0
      │  │
      │  └─ m/44'/0'/2' (Account 2 - Сбережения)
      │     └─ m/44'/0'/2'/0/0
      │
      ├─ m/44'/60' (Ethereum)
      │  └─ m/44'/60'/0'/0/0
      │
      └─ m/44'/2' (Litecoin)
         └─ m/44'/2'/0'/0/0
`);

    // Сравнение hardened vs non-hardened
    console.log('='.repeat(80));
    console.log('HARDENED vs NON-HARDENED DERIVATION');
    console.log('='.repeat(80));

    console.log(`
HARDENED (с апострофом '):
  m/44'/0'/0'
      ↑  ↑  ↑
  
  ✅ Высокая безопасность
  ✅ Невозможно вывести родительский приватный ключ
  ✅ Используется для: Purpose, Coin Type, Account
  ❌ Нельзя генерировать публичные ключи без приватного

NON-HARDENED (без апострофа):
  m/44'/0'/0'/0/0
              ↑ ↑
  
  ✅ Можно генерировать публичные ключи без приватного (xpub)
  ✅ Используется для: Change, Address Index
  ⚠️  Средняя безопасность
  ⚠️  Если утечет приватный ключ + xpub → можно вывести другие ключи
`);

    // Практические рекомендации
    console.log('='.repeat(80));
    console.log('РЕКОМЕНДАЦИИ ДЛЯ ВАШЕГО ПРОЕКТА');
    console.log('='.repeat(80));

    console.log(`
1️⃣  ДЛЯ ПРОСТОЙ АВТОРИЗАЦИИ:
   Используйте: m/44'/0'/0'/0/0
   
   const AUTH_PATH = "m/44'/0'/0'/0/0";
   const publicKey = getPublicKey(mnemonic, AUTH_PATH);
   
   ✅ Один путь для всех пользователей
   ✅ Каждый пользователь = уникальная мнемоника
   ✅ Каждый пользователь = уникальный публичный ключ

2️⃣  ДЛЯ МУЛЬТИВАЛЮТНОГО ПРИЛОЖЕНИЯ:
   Используйте разные coin types:
   
   Bitcoin:  m/44'/0'/0'/0/0
   Ethereum: m/44'/60'/0'/0/0
   Solana:   m/44'/501'/0'/0/0

3️⃣  ДЛЯ РАЗДЕЛЕНИЯ ПО АККАУНТАМ:
   Используйте разные account numbers:
   
   Личные:    m/44'/0'/0'/0/0
   Бизнес:    m/44'/0'/1'/0/0
   Сбережения: m/44'/0'/2'/0/0

4️⃣  ДЛЯ ГЕНЕРАЦИИ МНОЖЕСТВА АДРЕСОВ:
   Используйте разные address indexes:
   
   Адрес 0: m/44'/0'/0'/0/0
   Адрес 1: m/44'/0'/0'/0/1
   Адрес 2: m/44'/0'/0'/0/2
   ...
`);


    console.log('='.repeat(80));
    console.log('ГОТОВО! 🎉');
    console.log('='.repeat(80));

    return { mnemonic, masterKey, authPath, authPubKey };
}

// Запускаем демонстрацию
demo().catch(console.error);
