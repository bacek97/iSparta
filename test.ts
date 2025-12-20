import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';

// window.bip39 = bip39;
// window.wordlist = wordlist;

// ============================================
// ПОЛНЫЙ ПРИМЕР: От мнемоники до публичного ключа
// ============================================

// 1. Генерация мнемонической фразы (3 слова = 32 бита энтропии)
const mn = 'mountain pilot push';
// const mn = bip39.generateMnemonic(wordlist, 32);
console.log('Мнемоническая фраза:', mn);

// 2. Валидация мнемоники
const isValid = bip39.validateMnemonic(mn, wordlist);
console.log('Мнемоника валидна:', isValid);

// 3. Конвертация мнемоники в seed (64 байта)
// Можно добавить пароль для дополнительной безопасности
const seed = await bip39.mnemonicToSeed(mn, ''); // пустой пароль или можно добавить свой
console.log('Seed (hex):', Buffer.from(seed).toString('hex'));

// 4. Создание HD кошелька из seed
const hdKey = HDKey.fromMasterSeed(seed);

// 5. Деривация ключа по стандартному пути BIP44
// m/44'/0'/0'/0/0 - стандартный путь для Bitcoin (можно изменить для других криптовалют)
// m/44'/60'/0'/0/0 - для Ethereum
const path = "m/44'/0'/0'/0/0";
const derivedKey = hdKey.derive(path);

// 6. Получение публичного ключа
const publicKey = derivedKey.publicKey;
const publicKeyHex = Buffer.from(publicKey!).toString('hex');
console.log('Публичный ключ (hex):', publicKeyHex);
console.log('Публичный ключ (base64):', Buffer.from(publicKey!).toString('base64'));

// 7. Получение расширенного публичного ключа (xpub)
const extendedPublicKey = derivedKey.publicExtendedKey;
console.log('Extended Public Key (xpub):', extendedPublicKey);

// ============================================
// ЧТО ХРАНИТЬ НА СЕРВЕРЕ:
// ============================================
// Вариант 1: Публичный ключ в hex формате (рекомендуется)
console.log('\n=== ДЛЯ ХРАНЕНИЯ НА СЕРВЕРЕ ===');
console.log('Public Key (hex):', publicKeyHex);

// Вариант 2: Extended Public Key (если нужно генерировать много адресов)
console.log('Extended Public Key:', extendedPublicKey);

// ============================================
// ПРИМЕР ВОССТАНОВЛЕНИЯ (для проверки авторизации)
// ============================================
async function verifyUser(mnemonic: string, storedPublicKey: string): Promise<boolean> {
    const seed = await bip39.mnemonicToSeed(mnemonic, '');
    const hdKey = HDKey.fromMasterSeed(seed);
    const derivedKey = hdKey.derive("m/44'/0'/0'/0/0");
    const publicKey = Buffer.from(derivedKey.publicKey!).toString('hex');

    return publicKey === storedPublicKey;
}

// Экспорт для использования в других модулях
export { mn, publicKeyHex, extendedPublicKey, verifyUser };