import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

// ============================================
// БЕЗОПАСНАЯ АВТОРИЗАЦИЯ С КРИПТОГРАФИЧЕСКОЙ ПОДПИСЬЮ
// ============================================

/**
 * РЕГИСТРАЦИЯ (выполняется один раз)
 * Клиент отправляет публичный ключ на сервер для сохранения
 */
export async function registerUser(mnemonic: string): Promise<string> {
    const seed = await bip39.mnemonicToSeed(mnemonic, '');
    const hdKey = HDKey.fromMasterSeed(seed);
    const derivedKey = hdKey.derive("m/44'/0'/0'/0/0");
    const publicKey = Buffer.from(derivedKey.publicKey!).toString('hex');

    // Отправить publicKey на сервер для сохранения
    return publicKey;
}

/**
 * СЕРВЕР: Генерация случайного challenge
 * Это должно выполняться на сервере при каждой попытке входа
 */
export function generateChallenge(): string {
    // Генерируем случайные 32 байта
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    return Buffer.from(randomBytes).toString('hex');
}

/**
 * КЛИЕНТ: Подписание challenge приватным ключом
 * Доказывает владение приватным ключом без его раскрытия
 */
export async function signChallenge(mnemonic: string, challenge: string): Promise<{
    publicKey: string;
    signature: string;
}> {
    // 1. Восстановление ключей из мнемоники
    const seed = await bip39.mnemonicToSeed(mnemonic, '');
    const hdKey = HDKey.fromMasterSeed(seed);
    const derivedKey = hdKey.derive("m/44'/0'/0'/0/0");

    // 2. Получение приватного и публичного ключей
    const privateKey = derivedKey.privateKey!;
    const publicKey = derivedKey.publicKey!;

    // 3. Хеширование challenge
    const messageHash = sha256(Buffer.from(challenge, 'hex'));

    // 4. Подпись хеша приватным ключом
    const signature = secp256k1.sign(messageHash, privateKey);

    return {
        publicKey: Buffer.from(publicKey).toString('hex'),
        signature: signature.toCompactHex()
    };
}

/**
 * СЕРВЕР: Проверка подписи
 * Проверяет, что подпись была создана владельцем приватного ключа
 */
export function verifySignature(
    challenge: string,
    publicKey: string,
    signature: string
): boolean {
    try {
        // 1. Хеширование challenge (должно совпадать с клиентским)
        const messageHash = sha256(Buffer.from(challenge, 'hex'));

        // 2. Проверка подписи с использованием публичного ключа
        const isValid = secp256k1.verify(
            signature,
            messageHash,
            publicKey
        );

        return isValid;
    } catch (error) {
        console.error('Ошибка проверки подписи:', error);
        return false;
    }
}

/**
 * ПОЛНЫЙ FLOW АВТОРИЗАЦИИ
 */
async function demonstrateSecureAuth() {
    console.log('\n=== ДЕМОНСТРАЦИЯ БЕЗОПАСНОЙ АВТОРИЗАЦИИ ===\n');

    // 1. РЕГИСТРАЦИЯ (один раз)
    console.log('1. РЕГИСТРАЦИЯ');
    const userMnemonic = 'mountain pilot push';
    const userPublicKey = await registerUser(userMnemonic);
    console.log('   Публичный ключ сохранён на сервере:', userPublicKey);

    // 2. ВХОД В СИСТЕМУ
    console.log('\n2. ПОПЫТКА ВХОДА');

    // Сервер генерирует challenge
    const challenge = generateChallenge();
    console.log('   Сервер отправил challenge:', challenge.substring(0, 32) + '...');

    // Клиент подписывает challenge
    const { publicKey, signature } = await signChallenge(userMnemonic, challenge);
    console.log('   Клиент отправил публичный ключ:', publicKey.substring(0, 32) + '...');
    console.log('   Клиент отправил подпись:', signature.substring(0, 32) + '...');

    // 3. ПРОВЕРКА НА СЕРВЕРЕ
    console.log('\n3. ПРОВЕРКА НА СЕРВЕРЕ');

    // Проверяем, что публичный ключ совпадает с сохранённым
    const publicKeyMatches = publicKey === userPublicKey;
    console.log('   Публичный ключ совпадает:', publicKeyMatches);

    // Проверяем подпись
    const signatureValid = verifySignature(challenge, publicKey, signature);
    console.log('   Подпись валидна:', signatureValid);

    // Авторизация успешна только если оба условия выполнены
    const authSuccess = publicKeyMatches && signatureValid;
    console.log('\n   ✅ АВТОРИЗАЦИЯ:', authSuccess ? 'УСПЕШНА' : 'ОТКЛОНЕНА');

    // 4. ДЕМОНСТРАЦИЯ АТАКИ (перехват публичного ключа)
    console.log('\n4. ПОПЫТКА АТАКИ (злоумышленник перехватил публичный ключ)');
    const attackerChallenge = generateChallenge();
    const fakeSignature = 'deadbeef'.repeat(16); // Поддельная подпись

    const attackerSignatureValid = verifySignature(attackerChallenge, userPublicKey, fakeSignature);
    console.log('   Подпись злоумышленника валидна:', attackerSignatureValid);
    console.log('   ❌ АТАКА ПРОВАЛИЛАСЬ - нужен приватный ключ для создания подписи!');
}

// Запуск демонстрации
await demonstrateSecureAuth();
