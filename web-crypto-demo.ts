// ============================================
// БЕЗ БИБЛИОТЕК! Используем Web Crypto API
// Работает в браузере и Deno из коробки
// ============================================

/**
 * Генерация ключевой пары ECDSA P-256 (встроено в браузер!)
 */
async function generateKeyPair(): Promise<CryptoKeyPair> {
    return await crypto.subtle.generateKey(
        {
            name: "ECDSA",
            namedCurve: "P-256", // Встроенная кривая (не secp256k1, но тоже ECDSA)
        },
        true, // extractable
        ["sign", "verify"]
    );
}

/**
 * Экспорт публичного ключа в формат для хранения
 */
async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey("spki", publicKey);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

/**
 * Импорт публичного ключа из строки
 */
async function importPublicKey(publicKeyString: string): Promise<CryptoKey> {
    const binaryString = atob(publicKeyString);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return await crypto.subtle.importKey(
        "spki",
        bytes,
        {
            name: "ECDSA",
            namedCurve: "P-256",
        },
        true,
        ["verify"]
    );
}

/**
 * Подписать данные приватным ключом
 */
async function signData(privateKey: CryptoKey, data: any): Promise<string> {
    const message = JSON.stringify(data);
    const encoder = new TextEncoder();
    const messageBytes = encoder.encode(message);

    const signature = await crypto.subtle.sign(
        {
            name: "ECDSA",
            hash: { name: "SHA-256" },
        },
        privateKey,
        messageBytes
    );

    return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Проверить подпись публичным ключом
 */
async function verifySignature(
    publicKey: CryptoKey,
    signature: string,
    data: any
): Promise<boolean> {
    const message = JSON.stringify(data);
    const encoder = new TextEncoder();
    const messageBytes = encoder.encode(message);

    // Декодировать подпись из base64
    const binaryString = atob(signature);
    const signatureBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        signatureBytes[i] = binaryString.charCodeAt(i);
    }

    return await crypto.subtle.verify(
        {
            name: "ECDSA",
            hash: { name: "SHA-256" },
        },
        publicKey,
        signatureBytes,
        messageBytes
    );
}

// ============================================
// ДЕМОНСТРАЦИЯ
// ============================================

async function demo() {
    console.log('\n=== WEB CRYPTO API (БЕЗ БИБЛИОТЕК) ===\n');

    // 1. Генерация ключевой пары
    console.log('1. Генерация ключевой пары...');
    const keyPair = await generateKeyPair();
    const publicKeyString = await exportPublicKey(keyPair.publicKey);
    console.log('   Публичный ключ:', publicKeyString.substring(0, 50) + '...');

    // 2. Подписание данных
    console.log('\n2. Подписание данных...');
    const data = { exerciseName: 'Push-ups', reps: 20 };
    const signature = await signData(keyPair.privateKey, data);
    console.log('   Подпись:', signature.substring(0, 50) + '...');

    // 3. Проверка подписи
    console.log('\n3. Проверка подписи...');
    const isValid = await verifySignature(keyPair.publicKey, signature, data);
    console.log('   Подпись валидна:', isValid);

    // 4. Попытка подделки
    console.log('\n4. Попытка подделки данных...');
    const fakeData = { exerciseName: 'Push-ups', reps: 999999 };
    const isFakeValid = await verifySignature(keyPair.publicKey, signature, fakeData);
    console.log('   Поддельные данные валидны:', isFakeValid);

    // 5. Сохранение и восстановление ключа
    console.log('\n5. Сохранение и восстановление публичного ключа...');
    const restoredPublicKey = await importPublicKey(publicKeyString);
    const isRestoredValid = await verifySignature(restoredPublicKey, signature, data);
    console.log('   Восстановленный ключ работает:', isRestoredValid);
}

// Запуск демонстрации
await demo();

export {
    generateKeyPair,
    exportPublicKey,
    importPublicKey,
    signData,
    verifySignature
};
