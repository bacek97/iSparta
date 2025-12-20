import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

// ============================================
// КЛИЕНТ: Подпись и отправка данных в Hasura
// ============================================

/**
 * Подписать любые данные приватным ключом
 */
export async function signData(mnemonic: string, data: any): Promise<{
    publicKey: string;
    signature: string;
}> {
    // 1. Получить ключи из мнемоники
    const seed = await bip39.mnemonicToSeed(mnemonic, '');
    const hdKey = HDKey.fromMasterSeed(seed);
    const derivedKey = hdKey.derive("m/44'/0'/0'/0/0");

    const privateKey = derivedKey.privateKey!;
    const publicKey = derivedKey.publicKey!;

    // 2. Подписать данные
    const message = JSON.stringify(data);
    const messageHash = sha256(Buffer.from(message));
    const signature = secp256k1.sign(messageHash, privateKey);

    return {
        publicKey: Buffer.from(publicKey).toString('hex'),
        signature: signature.toCompactHex()
    };
}

/**
 * Получить только публичный ключ
 */
export async function getPublicKey(mnemonic: string): Promise<string> {
    const seed = await bip39.mnemonicToSeed(mnemonic, '');
    const hdKey = HDKey.fromMasterSeed(seed);
    const derivedKey = hdKey.derive("m/44'/0'/0'/0/0");
    return Buffer.from(derivedKey.publicKey!).toString('hex');
}

/**
 * Отправить данные в Hasura с проверкой подписи
 */
export async function sendToHasura(
    hasuraUrl: string,
    mnemonic: string,
    mutation: string,
    data: any
): Promise<any> {
    // 1. Подписать данные
    const { publicKey, signature } = await signData(mnemonic, data);

    // 2. Отправить в Hasura
    const response = await fetch(hasuraUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: mutation,
            variables: { publicKey, signature, data }
        })
    });

    const result = await response.json();

    if (result.errors) {
        throw new Error(result.errors[0].message);
    }

    return result.data;
}

// ============================================
// ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ
// ============================================

const HASURA_URL = 'http://localhost:8080/v1/graphql';
const mnemonic = 'mountain pilot push';

/**
 * Пример 1: Добавить workout
 */
async function addWorkout(exerciseName: string, reps: number) {
    const mutation = `
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
                id
                publicKey
                exerciseName
                reps
                verifiedAt
            }
        }
    `;

    const data = { exerciseName, reps };

    try {
        const result = await sendToHasura(HASURA_URL, mnemonic, mutation, data);
        console.log('✅ Workout added:', result.addWorkout);
        return result.addWorkout;
    } catch (error) {
        console.error('❌ Error:', error.message);
        return null;
    }
}

/**
 * Пример 2: Добавить любые данные с timestamp (защита от replay)
 */
async function addDataWithTimestamp(exerciseName: string, reps: number) {
    const mutation = `
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
                id
                publicKey
                exerciseName
                reps
                verifiedAt
            }
        }
    `;

    // Добавляем timestamp для защиты от повторной отправки
    const data = {
        exerciseName,
        reps,
        timestamp: Date.now()
    };

    try {
        const result = await sendToHasura(HASURA_URL, mnemonic, mutation, data);
        console.log('✅ Workout added:', result.addWorkout);
        return result.addWorkout;
    } catch (error) {
        console.error('❌ Error:', error.message);
        return null;
    }
}

/**
 * Пример 3: Получить данные пользователя (без подписи)
 */
async function getMyWorkouts() {
    const publicKey = await getPublicKey(mnemonic);

    const query = `
        query GetWorkouts($publicKey: String!) {
            workouts(where: { public_key: { _eq: $publicKey } }) {
                id
                exerciseName
                reps
                verifiedAt
                createdAt
            }
        }
    `;

    const response = await fetch(HASURA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query,
            variables: { publicKey }
        })
    });

    const result = await response.json();

    if (result.errors) {
        console.error('❌ Error:', result.errors[0].message);
        return [];
    }

    console.log('✅ My workouts:', result.data.workouts);
    return result.data.workouts;
}

// ============================================
// ДЕМОНСТРАЦИЯ
// ============================================

async function demo() {
    console.log('\n=== ДЕМОНСТРАЦИЯ РАБОТЫ С HASURA ===\n');

    // 1. Показать публичный ключ
    const publicKey = await getPublicKey(mnemonic);
    console.log('1. Мой публичный ключ:', publicKey.substring(0, 32) + '...\n');

    // 2. Добавить workout
    console.log('2. Добавляем workout...');
    await addWorkout('Push-ups', 20);

    console.log('\n3. Добавляем ещё один workout...');
    await addWorkout('Squats', 30);

    // 3. Получить все workouts
    console.log('\n4. Получаем все мои workouts...');
    await getMyWorkouts();

    // 4. Попытка подделки (для демонстрации)
    console.log('\n5. ПОПЫТКА ПОДДЕЛКИ (изменим данные после подписи)...');
    try {
        const { publicKey, signature } = await signData(mnemonic, {
            exerciseName: 'Pull-ups',
            reps: 10
        });

        // Подделываем данные
        const fakeData = {
            exerciseName: 'Pull-ups',
            reps: 999999 // Изменили количество!
        };

        const mutation = `
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
                    id
                }
            }
        `;

        const response = await fetch(HASURA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: mutation,
                variables: { publicKey, signature, data: fakeData }
            })
        });

        const result = await response.json();

        if (result.errors) {
            console.log('   ❌ ПОДДЕЛКА ПРОВАЛИЛАСЬ:', result.errors[0].message);
        } else {
            console.log('   ⚠️ ВНИМАНИЕ: Подделка прошла! Проверьте сервер!');
        }
    } catch (error) {
        console.log('   ❌ ПОДДЕЛКА ПРОВАЛИЛАСЬ:', error.message);
    }
}

// Раскомментируйте для запуска демонстрации
// await demo();

export { addWorkout, getMyWorkouts, demo };
