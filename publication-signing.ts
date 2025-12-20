// ============================================
// ПОДПИСЬ ПУБЛИКАЦИИ С УПРАЖНЕНИЯМИ
// Используем Web Crypto API (ECDSA P-256)
// ============================================

import { EXERCISES } from './types';

/**
 * Тип публикации
 */
interface Publication {
    publicKey: string;
    signature: string;
    date: Date;
    text: string;
    exercises: Exercise[];
    image?: string;
}

interface Exercise {
    exercise: EXERCISES;
    sec?: number;
    reps?: number;
    km?: number;
    'svg:path[d]'?: string;
}

/**
 * Генерация и сохранение ключей в localStorage
 */
async function generateAndSaveKeys(): Promise<void> {
    const keyPair = await crypto.subtle.generateKey(
        {
            name: "ECDSA",
            namedCurve: "P-256",
        },
        true,
        ["sign", "verify"]
    );

    // Экспорт ключей
    const publicKeyExported = await crypto.subtle.exportKey("spki", keyPair.publicKey);
    const privateKeyExported = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

    // Сохранение в base64
    const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyExported)));
    const privateKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(privateKeyExported)));

    localStorage.setItem('publicKey', publicKeyBase64);
    localStorage.setItem('privateKey', privateKeyBase64);

    console.log('✅ Ключи сгенерированы и сохранены!');
}

/**
 * Создание и подпись публикации
 */
async function createAndSignPublication(
    text: string,
    exercises: Exercise[],
    image?: string
): Promise<Publication> {
    // 1. Проверка наличия ключей
    const publicKeyBase64 = localStorage.getItem('publicKey');
    const privateKeyBase64 = localStorage.getItem('privateKey');

    if (!publicKeyBase64 || !privateKeyBase64) {
        throw new Error('Ключи не найдены. Сначала вызовите generateAndSaveKeys()');
    }

    // 2. Создание публикации (без подписи)
    const publication: Partial<Publication> = {
        publicKey: publicKeyBase64,
        date: new Date(),
        text,
        exercises,
        image
    };

    // 3. Подготовка данных для подписи
    const dataToSign = {
        date: publication.date,
        text: publication.text,
        exercises: publication.exercises,
        image: publication.image
    };

    const message = JSON.stringify(dataToSign);
    const messageBytes = new TextEncoder().encode(message);

    // 4. Загрузка приватного ключа
    const privateKeyBytes = Uint8Array.from(
        atob(privateKeyBase64),
        c => c.charCodeAt(0)
    );

    const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        privateKeyBytes,
        {
            name: "ECDSA",
            namedCurve: "P-256",
        },
        true,
        ["sign"]
    );

    // 5. Подпись
    const signatureBytes = await crypto.subtle.sign(
        {
            name: "ECDSA",
            hash: { name: "SHA-256" },
        },
        privateKey,
        messageBytes
    );

    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

    // 6. Добавление подписи к публикации
    return {
        ...publication,
        signature
    } as Publication;
}

/**
 * Проверка подписи публикации
 */
async function verifyPublication(publication: Publication): Promise<boolean> {
    try {
        // 1. Загрузка публичного ключа
        const publicKeyBytes = Uint8Array.from(
            atob(publication.publicKey),
            c => c.charCodeAt(0)
        );

        const publicKey = await crypto.subtle.importKey(
            "spki",
            publicKeyBytes,
            {
                name: "ECDSA",
                namedCurve: "P-256",
            },
            true,
            ["verify"]
        );

        // 2. Подготовка данных для проверки
        const dataToVerify = {
            date: publication.date,
            text: publication.text,
            exercises: publication.exercises,
            image: publication.image
        };

        const message = JSON.stringify(dataToVerify);
        const messageBytes = new TextEncoder().encode(message);

        // 3. Декодирование подписи
        const signatureBytes = Uint8Array.from(
            atob(publication.signature),
            c => c.charCodeAt(0)
        );

        // 4. Проверка подписи
        return await crypto.subtle.verify(
            {
                name: "ECDSA",
                hash: { name: "SHA-256" },
            },
            publicKey,
            signatureBytes,
            messageBytes
        );
    } catch (error) {
        console.error('Ошибка проверки подписи:', error);
        return false;
    }
}

/**
 * Отправка публикации в Hasura
 */
async function sendPublicationToHasura(
    publication: Publication,
    hasuraUrl: string
): Promise<any> {
    const mutation = `
        mutation AddPublication(
            $publicKey: String!
            $signature: String!
            $data: PublicationInput!
        ) {
            addPublication(
                publicKey: $publicKey
                signature: $signature
                data: $data
            ) {
                id
                publicKey
                date
                text
                exercises
                image
                verifiedAt
            }
        }
    `;

    const data = {
        date: publication.date.toISOString(),
        text: publication.text,
        exercises: publication.exercises,
        image: publication.image
    };

    const response = await fetch(hasuraUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: mutation,
            variables: {
                publicKey: publication.publicKey,
                signature: publication.signature,
                data
            }
        })
    });

    const result = await response.json();

    if (result.errors) {
        throw new Error(result.errors[0].message);
    }

    return result.data.addPublication;
}

// ============================================
// ДЕМОНСТРАЦИЯ
// ============================================

async function demo() {
    console.log('\n=== ДЕМОНСТРАЦИЯ ПОДПИСИ ПУБЛИКАЦИИ ===\n');

    // 1. Генерация ключей (только при первом запуске)
    if (!localStorage.getItem('publicKey')) {
        console.log('1. Генерация ключей...');
        await generateAndSaveKeys();
    } else {
        console.log('1. Ключи уже сгенерированы');
    }

    // 2. Создание публикации
    console.log('\n2. Создание публикации...');
    const publication = await createAndSignPublication(
        'Great workout today! 💪',
        [
            {
                exercise: EXERCISES.SQUATS,
                sec: 30,
                reps: 10,
            },
            {
                exercise: EXERCISES.RUNNING,
                sec: 30,
                km: 10,
                'svg:path[d]': 'M10 10 L100 100',
            }
        ],
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    );

    console.log('   Публикация создана:');
    console.log('   - Текст:', publication.text);
    console.log('   - Упражнений:', publication.exercises.length);
    console.log('   - Подпись:', publication.signature.substring(0, 50) + '...');

    // 3. Проверка подписи
    console.log('\n3. Проверка подписи...');
    const isValid = await verifyPublication(publication);
    console.log('   Подпись валидна:', isValid ? '✅' : '❌');

    // 4. Попытка подделки
    console.log('\n4. Попытка подделки данных...');
    const fakePublication = {
        ...publication,
        text: 'Hacked! 😈',
        exercises: [
            {
                exercise: EXERCISES.SQUATS,
                sec: 30,
                reps: 999999, // Подделка!
            }
        ]
    };

    const isFakeValid = await verifyPublication(fakePublication);
    console.log('   Поддельная публикация валидна:', isFakeValid ? '⚠️' : '✅ Провалилась');

    // 5. Отправка в Hasura (раскомментируйте когда настроите)
    // console.log('\n5. Отправка в Hasura...');
    // const result = await sendPublicationToHasura(
    //     publication,
    //     'https://your-hasura.app/v1/graphql'
    // );
    // console.log('   Результат:', result);
}

// Экспорт для использования
export {
    generateAndSaveKeys,
    createAndSignPublication,
    verifyPublication,
    sendPublicationToHasura,
    demo
};

// Автоматический запуск демонстрации
// await demo();
