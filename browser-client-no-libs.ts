// ============================================
// КЛИЕНТ ДЛЯ БРАУЗЕРА БЕЗ БИБЛИОТЕК
// Использует только встроенный Web Crypto API
// ============================================

/**
 * Генерация ключевой пары и сохранение в localStorage
 */
async function generateAndSaveKeys(): Promise<string> {
    // 1. Генерация ключевой пары
    const keyPair = await crypto.subtle.generateKey(
        {
            name: "ECDSA",
            namedCurve: "P-256",
        },
        true,
        ["sign", "verify"]
    );

    // 2. Экспорт ключей для сохранения
    const publicKeyExported = await crypto.subtle.exportKey("spki", keyPair.publicKey);
    const privateKeyExported = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

    const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyExported)));
    const privateKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(privateKeyExported)));

    // 3. Сохранение в localStorage
    localStorage.setItem('publicKey', publicKeyBase64);
    localStorage.setItem('privateKey', privateKeyBase64);

    console.log('✅ Ключи сгенерированы и сохранены!');
    console.log('Публичный ключ:', publicKeyBase64.substring(0, 50) + '...');

    return publicKeyBase64;
}

/**
 * Загрузка приватного ключа из localStorage
 */
async function loadPrivateKey(): Promise<CryptoKey> {
    const privateKeyBase64 = localStorage.getItem('privateKey');

    if (!privateKeyBase64) {
        throw new Error('Приватный ключ не найден. Сначала вызовите generateAndSaveKeys()');
    }

    const binaryString = atob(privateKeyBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return await crypto.subtle.importKey(
        "pkcs8",
        bytes,
        {
            name: "ECDSA",
            namedCurve: "P-256",
        },
        true,
        ["sign"]
    );
}

/**
 * Получить публичный ключ из localStorage
 */
function getPublicKey(): string {
    const publicKey = localStorage.getItem('publicKey');
    if (!publicKey) {
        throw new Error('Публичный ключ не найден. Сначала вызовите generateAndSaveKeys()');
    }
    return publicKey;
}

/**
 * Подписать данные
 */
async function signData(data: any): Promise<{
    publicKey: string;
    signature: string;
}> {
    // 1. Загрузить приватный ключ
    const privateKey = await loadPrivateKey();
    const publicKey = getPublicKey();

    // 2. Подготовить сообщение
    const message = JSON.stringify(data);
    const encoder = new TextEncoder();
    const messageBytes = encoder.encode(message);

    // 3. Подписать
    const signatureBytes = await crypto.subtle.sign(
        {
            name: "ECDSA",
            hash: { name: "SHA-256" },
        },
        privateKey,
        messageBytes
    );

    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

    return { publicKey, signature };
}

/**
 * Отправить workout в Hasura
 */
async function addWorkout(exerciseName: string, reps: number) {
    const HASURA_URL = 'https://your-hasura.app/v1/graphql';

    // 1. Подготовить данные
    const data = { exerciseName, reps };

    // 2. Подписать данные
    const { publicKey, signature } = await signData(data);

    // 3. Отправить в Hasura
    const response = await fetch(HASURA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: `
                mutation AddWorkout(
                    $publicKey: String!
                    $signature: String!
                    $data: WorkoutInput!
                ) {
                    addWorkout(
                        publicKey: $publicKey
                        signature: $signature
                        data: $data
                    ) {
                        publicKey
                        exerciseName
                        reps
                        verifiedAt
                    }
                }
            `,
            variables: { publicKey, signature, data }
        })
    });

    const result = await response.json();

    if (result.errors) {
        console.error('❌ Ошибка:', result.errors[0].message);
        return null;
    }

    console.log('✅ Workout добавлен:', result.data.addWorkout);
    return result.data.addWorkout;
}

// ============================================
// ДЕМОНСТРАЦИЯ В БРАУЗЕРЕ
// ============================================

async function browserDemo() {
    console.log('\n=== ДЕМОНСТРАЦИЯ В БРАУЗЕРЕ (БЕЗ БИБЛИОТЕК) ===\n');

    // 1. Генерация ключей (только при первом запуске)
    if (!localStorage.getItem('publicKey')) {
        console.log('1. Генерация ключей...');
        await generateAndSaveKeys();
    } else {
        console.log('1. Ключи уже сгенерированы');
        console.log('   Публичный ключ:', getPublicKey().substring(0, 50) + '...');
    }

    // 2. Подписание данных
    console.log('\n2. Подписание данных...');
    const data = { exerciseName: 'Push-ups', reps: 20 };
    const { publicKey, signature } = await signData(data);
    console.log('   Подпись:', signature.substring(0, 50) + '...');

    // 3. Отправка в Hasura (раскомментируйте когда настроите Hasura)
    // console.log('\n3. Отправка в Hasura...');
    // await addWorkout('Push-ups', 20);
}

// Экспорт для использования
export {
    generateAndSaveKeys,
    loadPrivateKey,
    getPublicKey,
    signData,
    addWorkout,
    browserDemo
};

// Автоматический запуск демонстрации в браузере
if (typeof window !== 'undefined') {
    // Добавляем функции в window для удобства
    (window as any).generateKeys = generateAndSaveKeys;
    (window as any).addWorkout = addWorkout;
    (window as any).demo = browserDemo;

    console.log('💡 Доступные функции:');
    console.log('   generateKeys() - сгенерировать ключи');
    console.log('   addWorkout(name, reps) - добавить workout');
    console.log('   demo() - запустить демонстрацию');
}
