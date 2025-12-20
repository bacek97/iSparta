import { ed25519 } from '@noble/curves/ed25519';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';

// ============================================
// КЛИЕНТ для Ed25519 (БЕЗ внешнего хостинга)
// ============================================

/**
 * Получить Ed25519 ключи из BIP39 мнемоники
 * Используем другой путь деривации для Ed25519
 */
async function getEd25519Keys(mnemonic: string): Promise<{
    privateKey: Uint8Array;
    publicKey: Uint8Array;
}> {
    // 1. Получить seed из мнемоники
    const seed = await bip39.mnemonicToSeed(mnemonic, '');

    // 2. Для Ed25519 используем первые 32 байта seed как приватный ключ
    const privateKey = seed.slice(0, 32);

    // 3. Получить публичный ключ из приватного
    const publicKey = ed25519.getPublicKey(privateKey);

    return { privateKey, publicKey };
}

/**
 * Подписать данные Ed25519
 */
export async function signDataEd25519(mnemonic: string, data: any): Promise<{
    publicKey: string;
    signature: string;
}> {
    // 1. Получить ключи
    const { privateKey, publicKey } = await getEd25519Keys(mnemonic);

    // 2. Создать сообщение
    const message = JSON.stringify(data);
    const messageBytes = new TextEncoder().encode(message);

    // 3. Подписать
    const signature = ed25519.sign(messageBytes, privateKey);

    return {
        publicKey: '\\x' + Buffer.from(publicKey).toString('hex'),
        signature: '\\x' + Buffer.from(signature).toString('hex')
    };
}

/**
 * Отправить в Hasura с Ed25519 подписью
 */
export async function addWorkoutEd25519(
    hasuraUrl: string,
    mnemonic: string,
    exerciseName: string,
    reps: number
) {
    const data = { exerciseName, reps };
    const { publicKey, signature } = await signDataEd25519(mnemonic, data);

    const mutation = `
        mutation AddWorkout(
            $publicKey: bytea!
            $signature: bytea!
            $exerciseName: String!
            $reps: Int!
        ) {
            add_workout_verified(
                args: {
                    p_public_key: $publicKey
                    p_signature: $signature
                    p_exercise_name: $exerciseName
                    p_reps: $reps
                }
            ) {
                id
                public_key
                exercise_name
                reps
                verified_at
            }
        }
    `;

    const response = await fetch(hasuraUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: mutation,
            variables: { publicKey, signature, exerciseName, reps }
        })
    });

    const result = await response.json();

    if (result.errors) {
        throw new Error(result.errors[0].message);
    }

    return result.data.add_workout_verified[0];
}

// ============================================
// ДЕМОНСТРАЦИЯ
// ============================================

async function demo() {
    console.log('\n=== Ed25519 БЕЗ ВНЕШНЕГО ХОСТИНГА ===\n');

    const mnemonic = 'mountain pilot push';
    const { publicKey } = await getEd25519Keys(mnemonic);

    console.log('Публичный ключ (Ed25519):', Buffer.from(publicKey).toString('hex'));

    const data = { exerciseName: 'Push-ups', reps: 20 };
    const signed = await signDataEd25519(mnemonic, data);

    console.log('\nПодпись:', signed.signature);
    console.log('\nДанные готовы для отправки в Hasura!');
}

// await demo();

export { signDataEd25519, addWorkoutEd25519, demo };
