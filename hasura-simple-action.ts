// ============================================
// ПРОСТОЙ HASURA ACTION для проверки подписи
// ============================================

import express from 'express';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

const app = express();
app.use(express.json());

/**
 * Универсальный Action для любой операции с проверкой подписи
 * Проверяет подпись и возвращает данные для вставки в БД
 */
app.post('/actions/verify-and-insert', async (req, res) => {
    try {
        const { input } = req.body;
        const { publicKey, signature, data } = input;

        // 1. Создаём сообщение для подписи из данных
        const message = JSON.stringify(data);
        const messageHash = sha256(Buffer.from(message));

        // 2. Проверяем подпись
        const isValid = secp256k1.verify(signature, messageHash, publicKey);

        if (!isValid) {
            return res.status(400).json({
                message: "Invalid signature"
            });
        }

        // 3. Если подпись валидна, возвращаем данные + publicKey
        return res.json({
            ...data,
            publicKey: publicKey,
            verifiedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(400).json({
            message: error.message || "Verification failed"
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Actions server running on port ${PORT}`);
});
