import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';

describe('BIP39 Authorization Tests', () => {
    describe('Public Key Derivation', () => {
        it('should derive public key from mnemonic', async () => {
            // Генерация мнемоники
            const mnemonic = bip39.generateMnemonic(wordlist, 128);

            // Конвертация в seed
            const seed = await bip39.mnemonicToSeed(mnemonic, '');

            // Создание HD ключа
            const hdKey = HDKey.fromMasterSeed(seed);
            const derivedKey = hdKey.derive("m/44'/0'/0'/0/0");

            // Получение публичного ключа
            const publicKey = derivedKey.publicKey;

            expect(publicKey).toBeDefined();
            expect(publicKey).toBeInstanceOf(Uint8Array);
            expect(publicKey!.length).toBe(33); // Compressed public key
        });

        it('should generate same public key from same mnemonic', async () => {
            const mnemonic = bip39.generateMnemonic(wordlist, 128);

            // Первая деривация
            const seed1 = await bip39.mnemonicToSeed(mnemonic, '');
            const hdKey1 = HDKey.fromMasterSeed(seed1);
            const derivedKey1 = hdKey1.derive("m/44'/0'/0'/0/0");
            const publicKey1 = Buffer.from(derivedKey1.publicKey!).toString('hex');

            // Вторая деривация
            const seed2 = await bip39.mnemonicToSeed(mnemonic, '');
            const hdKey2 = HDKey.fromMasterSeed(seed2);
            const derivedKey2 = hdKey2.derive("m/44'/0'/0'/0/0");
            const publicKey2 = Buffer.from(derivedKey2.publicKey!).toString('hex');

            expect(publicKey1).toBe(publicKey2);
        });

        it('should generate different public keys for different mnemonics', async () => {
            const mnemonic1 = bip39.generateMnemonic(wordlist, 128);
            const mnemonic2 = bip39.generateMnemonic(wordlist, 128);

            const seed1 = await bip39.mnemonicToSeed(mnemonic1, '');
            const hdKey1 = HDKey.fromMasterSeed(seed1);
            const publicKey1 = Buffer.from(hdKey1.derive("m/44'/0'/0'/0/0").publicKey!).toString('hex');

            const seed2 = await bip39.mnemonicToSeed(mnemonic2, '');
            const hdKey2 = HDKey.fromMasterSeed(seed2);
            const publicKey2 = Buffer.from(hdKey2.derive("m/44'/0'/0'/0/0").publicKey!).toString('hex');

            expect(publicKey1).not.toBe(publicKey2);
        });

        it('should work with different derivation paths', async () => {
            const mnemonic = bip39.generateMnemonic(wordlist, 128);
            const seed = await bip39.mnemonicToSeed(mnemonic, '');
            const hdKey = HDKey.fromMasterSeed(seed);

            // Bitcoin path
            const btcKey = hdKey.derive("m/44'/0'/0'/0/0");
            const btcPublicKey = Buffer.from(btcKey.publicKey!).toString('hex');

            // Ethereum path
            const ethKey = hdKey.derive("m/44'/60'/0'/0/0");
            const ethPublicKey = Buffer.from(ethKey.publicKey!).toString('hex');

            expect(btcPublicKey).not.toBe(ethPublicKey);
            expect(btcPublicKey).toBeDefined();
            expect(ethPublicKey).toBeDefined();
        });
    });

    describe('User Verification', () => {
        async function getPublicKeyFromMnemonic(mnemonic: string, password: string = ''): Promise<string> {
            const seed = await bip39.mnemonicToSeed(mnemonic, password);
            const hdKey = HDKey.fromMasterSeed(seed);
            const derivedKey = hdKey.derive("m/44'/0'/0'/0/0");
            return Buffer.from(derivedKey.publicKey!).toString('hex');
        }

        async function verifyUser(mnemonic: string, storedPublicKey: string, password: string = ''): Promise<boolean> {
            const publicKey = await getPublicKeyFromMnemonic(mnemonic, password);
            return publicKey === storedPublicKey;
        }

        it('should verify user with correct mnemonic', async () => {
            // Регистрация: генерация мнемоники и сохранение публичного ключа
            const mnemonic = bip39.generateMnemonic(wordlist, 128);
            const storedPublicKey = await getPublicKeyFromMnemonic(mnemonic);

            // Авторизация: проверка мнемоники
            const isVerified = await verifyUser(mnemonic, storedPublicKey);

            expect(isVerified).toBe(true);
        });

        it('should reject user with incorrect mnemonic', async () => {
            // Регистрация
            const mnemonic1 = bip39.generateMnemonic(wordlist, 128);
            const storedPublicKey = await getPublicKeyFromMnemonic(mnemonic1);

            // Попытка авторизации с другой мнемоникой
            const mnemonic2 = bip39.generateMnemonic(wordlist, 128);
            const isVerified = await verifyUser(mnemonic2, storedPublicKey);

            expect(isVerified).toBe(false);
        });

        it('should work with password protection', async () => {
            const mnemonic = bip39.generateMnemonic(wordlist, 128);
            const password = 'my-secure-password';

            // Регистрация с паролем
            const storedPublicKey = await getPublicKeyFromMnemonic(mnemonic, password);

            // Авторизация с правильным паролем
            const isVerifiedCorrect = await verifyUser(mnemonic, storedPublicKey, password);
            expect(isVerifiedCorrect).toBe(true);

            // Авторизация с неправильным паролем
            const isVerifiedWrong = await verifyUser(mnemonic, storedPublicKey, 'wrong-password');
            expect(isVerifiedWrong).toBe(false);
        });

        it('should work with 3-word mnemonic', async () => {
            // Генерация короткой мнемоники (32 бита = 3 слова)
            const mnemonic = bip39.generateMnemonic(wordlist, 32);
            const words = mnemonic.split(' ');
            expect(words.length).toBe(3);

            // Регистрация
            const storedPublicKey = await getPublicKeyFromMnemonic(mnemonic);

            // Авторизация
            const isVerified = await verifyUser(mnemonic, storedPublicKey);
            expect(isVerified).toBe(true);
        });
    });

    describe('Extended Public Key', () => {
        it('should derive extended public key', async () => {
            const mnemonic = bip39.generateMnemonic(wordlist, 128);
            const seed = await bip39.mnemonicToSeed(mnemonic, '');
            const hdKey = HDKey.fromMasterSeed(seed);
            const derivedKey = hdKey.derive("m/44'/0'/0'/0/0");

            const extendedPublicKey = derivedKey.publicExtendedKey;

            expect(extendedPublicKey).toBeDefined();
            expect(typeof extendedPublicKey).toBe('string');
            expect(extendedPublicKey).toMatch(/^xpub/);
        });

        it('should derive child keys from extended public key', async () => {
            const mnemonic = bip39.generateMnemonic(wordlist, 128);
            const seed = await bip39.mnemonicToSeed(mnemonic, '');
            const hdKey = HDKey.fromMasterSeed(seed);

            // Получаем account level key
            const accountKey = hdKey.derive("m/44'/0'/0'");
            const extendedPublicKey = accountKey.publicExtendedKey;

            // Создаем новый HDKey из extended public key
            const publicHDKey = HDKey.fromExtendedKey(extendedPublicKey);

            // Деривация дочерних ключей (только non-hardened)
            const childKey0 = publicHDKey.deriveChild(0).deriveChild(0);
            const childKey1 = publicHDKey.deriveChild(0).deriveChild(1);

            const publicKey0 = Buffer.from(childKey0.publicKey!).toString('hex');
            const publicKey1 = Buffer.from(childKey1.publicKey!).toString('hex');

            expect(publicKey0).not.toBe(publicKey1);
            expect(publicKey0).toBeDefined();
            expect(publicKey1).toBeDefined();
        });
    });

    describe('Real-world scenario', () => {
        it('should simulate complete registration and login flow', async () => {
            // === РЕГИСТРАЦИЯ ===
            console.log('\n=== РЕГИСТРАЦИЯ ===');

            // 1. Пользователь генерирует мнемонику (клиент)
            const mnemonic = bip39.generateMnemonic(wordlist, 128);
            console.log('Мнемоническая фраза:', mnemonic);

            // 2. Клиент получает публичный ключ
            const seed = await bip39.mnemonicToSeed(mnemonic, '');
            const hdKey = HDKey.fromMasterSeed(seed);
            const derivedKey = hdKey.derive("m/44'/0'/0'/0/0");
            const publicKeyHex = Buffer.from(derivedKey.publicKey!).toString('hex');
            console.log('Публичный ключ:', publicKeyHex);

            // 3. Публичный ключ отправляется на сервер и сохраняется
            const serverDatabase = {
                userId: 'user123',
                publicKey: publicKeyHex,
                createdAt: new Date().toISOString()
            };
            console.log('Сохранено на сервере:', serverDatabase);

            // === АВТОРИЗАЦИЯ ===
            console.log('\n=== АВТОРИЗАЦИЯ ===');

            // 1. Пользователь вводит мнемонику
            const inputMnemonic = mnemonic; // В реальности пользователь вводит вручную

            // 2. Клиент генерирует публичный ключ из введенной мнемоники
            const loginSeed = await bip39.mnemonicToSeed(inputMnemonic, '');
            const loginHdKey = HDKey.fromMasterSeed(loginSeed);
            const loginDerivedKey = loginHdKey.derive("m/44'/0'/0'/0/0");
            const loginPublicKeyHex = Buffer.from(loginDerivedKey.publicKey!).toString('hex');
            console.log('Публичный ключ при входе:', loginPublicKeyHex);

            // 3. Сервер сравнивает публичные ключи
            const isAuthenticated = loginPublicKeyHex === serverDatabase.publicKey;
            console.log('Авторизация успешна:', isAuthenticated);

            expect(isAuthenticated).toBe(true);
        });
    });
});
