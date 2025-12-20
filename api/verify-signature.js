import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

/**
 * Vercel Serverless Function для проверки подписи
 * Деплоится автоматически на Vercel
 */
export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        // Hasura отправляет данные в формате { input: {...}, session_variables: {...} }
        const { input } = req.body;
        const { publicKey, signature, data } = input;

        if (!publicKey || !signature || !data) {
            return res.status(400).json({
                message: 'Missing required fields: publicKey, signature, data'
            });
        }

        // 1. Создаём сообщение из данных
        const message = JSON.stringify(data);
        const messageHash = sha256(Buffer.from(message));

        // 2. Проверяем подпись
        const isValid = secp256k1.verify(signature, messageHash, publicKey);

        if (!isValid) {
            return res.status(400).json({
                message: 'Invalid signature'
            });
        }

        // 3. Если подпись валидна, возвращаем данные для вставки
        return res.status(200).json({
            ...data,
            publicKey: publicKey,
            verifiedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(400).json({
            message: error.message || 'Verification failed'
        });
    }
}
