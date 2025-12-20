// ============================================
// HASURA ACTION HANDLER для проверки подписи
// ============================================

import express from 'express';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

const app = express();
app.use(express.json());

/**
 * Hasura Action: registerUser
 * Проверяет подпись и создаёт пользователя
 */
app.post('/actions/register-user', async (req, res) => {
    try {
        // Hasura отправляет данные в формате:
        const { input, session_variables } = req.body;
        const { publicKey, challenge, signature } = input;

        // 1. Проверка подписи
        const isValid = verifySignature(challenge, publicKey, signature);

        if (!isValid) {
            return res.status(400).json({
                message: "Invalid signature"
            });
        }

        // 2. Если подпись валидна, возвращаем данные для вставки
        // Hasura автоматически вставит это в БД
        return res.json({
            id: generateUserId(), // или используйте UUID
            publicKey: publicKey,
            createdAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error in register-user action:', error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
});

/**
 * Hasura Action: loginUser
 * Проверяет подпись для входа
 */
app.post('/actions/login-user', async (req, res) => {
    try {
        const { input } = req.body;
        const { publicKey, challenge, signature } = input;

        // 1. Получить challenge из БД (через Hasura GraphQL)
        const storedChallenge = await getStoredChallenge(publicKey);

        if (!storedChallenge) {
            return res.status(400).json({
                message: "Challenge not found or expired"
            });
        }

        // 2. Проверить, что challenge совпадает
        if (challenge !== storedChallenge.value) {
            return res.status(400).json({
                message: "Challenge mismatch"
            });
        }

        // 3. Проверить, что challenge не истёк
        const now = Date.now();
        const challengeAge = now - new Date(storedChallenge.createdAt).getTime();
        if (challengeAge > 60000) { // 1 минута
            return res.status(400).json({
                message: "Challenge expired"
            });
        }

        // 4. Проверить подпись
        const isValid = verifySignature(challenge, publicKey, signature);

        if (!isValid) {
            return res.status(400).json({
                message: "Invalid signature"
            });
        }

        // 5. Создать JWT токен для Hasura
        const token = generateHasuraJWT(publicKey);

        return res.json({
            token: token,
            publicKey: publicKey
        });

    } catch (error) {
        console.error('Error in login-user action:', error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
});

/**
 * Hasura Action: generateChallenge
 * Генерирует challenge для входа
 */
app.post('/actions/generate-challenge', async (req, res) => {
    try {
        const { input } = req.body;
        const { publicKey } = input;

        // Генерируем challenge
        const challenge = generateChallenge();

        // Сохраняем challenge в БД через Hasura GraphQL
        await saveChallenge(publicKey, challenge);

        return res.json({
            challenge: challenge,
            expiresIn: 60 // секунд
        });

    } catch (error) {
        console.error('Error in generate-challenge action:', error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
});

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function verifySignature(
    challenge: string,
    publicKey: string,
    signature: string
): boolean {
    try {
        const messageHash = sha256(Buffer.from(challenge, 'hex'));
        return secp256k1.verify(signature, messageHash, publicKey);
    } catch (error) {
        console.error('Signature verification error:', error);
        return false;
    }
}

function generateChallenge(): string {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    return Buffer.from(randomBytes).toString('hex');
}

function generateUserId(): string {
    return crypto.randomUUID();
}

function generateHasuraJWT(publicKey: string): string {
    const jwt = require('jsonwebtoken');

    const payload = {
        "https://hasura.io/jwt/claims": {
            "x-hasura-allowed-roles": ["user"],
            "x-hasura-default-role": "user",
            "x-hasura-user-id": publicKey,
        }
    };

    return jwt.sign(payload, process.env.HASURA_JWT_SECRET!, {
        algorithm: 'HS256',
        expiresIn: '7d'
    });
}

// Hasura GraphQL запросы
async function saveChallenge(publicKey: string, challenge: string) {
    const query = `
        mutation InsertChallenge($publicKey: String!, $challenge: String!) {
            insert_challenges_one(object: {
                public_key: $publicKey,
                value: $challenge,
                created_at: "now()"
            }, on_conflict: {
                constraint: challenges_public_key_key,
                update_columns: [value, created_at]
            }) {
                id
            }
        }
    `;

    await fetch(process.env.HASURA_GRAPHQL_URL!, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET!
        },
        body: JSON.stringify({
            query,
            variables: { publicKey, challenge }
        })
    });
}

async function getStoredChallenge(publicKey: string) {
    const query = `
        query GetChallenge($publicKey: String!) {
            challenges_by_pk(public_key: $publicKey) {
                value
                created_at
            }
        }
    `;

    const response = await fetch(process.env.HASURA_GRAPHQL_URL!, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET!
        },
        body: JSON.stringify({
            query,
            variables: { publicKey }
        })
    });

    const data = await response.json();
    return data.data?.challenges_by_pk;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Hasura Actions server running on port ${PORT}`);
});
