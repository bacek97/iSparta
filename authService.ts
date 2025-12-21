/**
 * Authentication Service
 * Handles BIP39 mnemonic generation, NEAR key derivation, and account management
 */

// IMPORTANT: This polyfill MUST be imported FIRST, before any crypto libraries
import 'react-native-get-random-values';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';
import { ed25519 } from '@noble/curves/ed25519.js';
import { base58 } from '@scure/base';

const STORAGE_KEYS = {
    MNEMONIC: 'auth_mnemonic',
    PUBLIC_KEY: 'auth_public_key',
    NICKNAME: 'auth_nickname',
    NETWORK: 'auth_network',
};

const NEAR_DERIVATION_PATH = "m/44'/397'/0'";

// Hasura configuration
const HASURA_URL = process.env.HASURA_URL || 'https://select-bull-98.hasura.app/v1/graphql';
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET || 'Lv7tPSDlxnO8oGbBsB0uIXkkHp7yYO8Z1JGu5SJjuPHun43ZQNT825gEUhdNAYnh';

export type NetworkType = 'mainnet' | 'testnet';
export type FMSCategory = 'JUNIOR' | 'SENIOR' | 'MASTER';

export interface UserData {
    publicKey: string;
    nickname: string;
    network: NetworkType;
}

export interface HasuraUser {
    ed25519_public_key: string;
    fms_category: FMSCategory;
}

/**
 * Generate a new BIP39 mnemonic with 32 bits of entropy (3 words)
 * Uses crypto.getRandomValues (polyfilled by react-native-get-random-values)
 */
export function generateMnemonic(): string {
    // 32 bits = 4 bytes of entropy for 3-word mnemonic
    const entropy = new Uint8Array(4);
    crypto.getRandomValues(entropy);
    return bip39.entropyToMnemonic(entropy, wordlist);
}

/**
 * Validate a BIP39 mnemonic
 */
export function validateMnemonic(mnemonic: string): boolean {
    return bip39.validateMnemonic(mnemonic, wordlist);
}

/**
 * Derive NEAR keys from a BIP39 mnemonic
 * @param mnemonic - BIP39 mnemonic phrase
 * @param derivationPath - BIP32 derivation path (default: m/44'/397'/0')
 * @returns Object with publicKey and secretKey in ed25519:base58 format
 */
export function deriveNearKeys(
    mnemonic: string,
    derivationPath: string = NEAR_DERIVATION_PATH
): { publicKey: string; secretKey: string } {
    // Convert mnemonic to seed
    const seed = bip39.mnemonicToSeedSync(mnemonic);

    // Derive key using BIP32
    const hdKey = HDKey.fromMasterSeed(seed);
    const derivedKey = hdKey.derive(derivationPath);

    if (!derivedKey.privateKey) {
        throw new Error('Failed to derive private key');
    }

    // Get ed25519 public key from private key
    const publicKeyBytes = ed25519.getPublicKey(derivedKey.privateKey);

    // Encode to base58 with ed25519: prefix
    const publicKey = `ed25519:${base58.encode(publicKeyBytes)}`;
    const secretKey = `ed25519:${base58.encode(derivedKey.privateKey)}`;

    return { publicKey, secretKey };
}

/**
 * Register user in Hasura database
 * This function is idempotent - safe to call multiple times
 * @param publicKey - User's ed25519 public key
 * @param fmsCategory - User's FMS category (default: JUNIOR)
 * @returns Created or existing user data
 */
export async function registerUserInHasura(
    publicKey: string,
    fmsCategory: FMSCategory = 'JUNIOR'
): Promise<HasuraUser> {
    try {
        // Try to insert user, use on_conflict to handle existing users
        const mutation = `
            mutation RegisterUser($publicKey: String!, $fmsCategory: String!) {
                insert_users_one(
                    object: {
                        ed25519_public_key: $publicKey
                        fms_category: $fmsCategory
                    }
                    on_conflict: {
                        constraint: users_pkey
                        update_columns: [fms_category]
                    }
                ) {
                    ed25519_public_key
                    fms_category
                }
            }
        `;

        const response = await fetch(HASURA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hasura-admin-secret': HASURA_ADMIN_SECRET
            },
            body: JSON.stringify({
                query: mutation,
                variables: {
                    publicKey,
                    fmsCategory
                }
            })
        });

        const result = await response.json();

        if (result.errors) {
            console.error('[authService] Hasura error:', result.errors);
            throw new Error(`Failed to register user: ${result.errors[0].message}`);
        }

        console.log('[authService] registerUserInHasura result:', JSON.stringify(result));

        return result.data.insert_users_one;
    } catch (error) {
        console.error('[authService] registerUserInHasura error:', error);
        throw error;
    }
}

/**
 * Check if a NEAR account nickname is available
 * @param accountId - Account ID to check (without .testnet/.near suffix)
 * @param network - Network to check on (mainnet or testnet)
 * @returns true if available, false if taken
 */
export async function isNickFree(
    accountId: string,
    network: NetworkType = 'testnet'
): Promise<boolean> {
    const rpcUrl = network === 'mainnet'
        ? 'https://rpc.mainnet.near.org'
        : 'https://rpc.testnet.near.org';

    const fullAccountId = network === 'mainnet'
        ? `${accountId}.near`
        : `${accountId}.testnet`;

    try {
        const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 'dontcare',
                method: 'query',
                params: {
                    request_type: 'view_account',
                    finality: 'final',
                    account_id: fullAccountId,
                },
            }),
        });

        const data = await response.json();

        // If account exists, it will return account data
        // If account doesn't exist, it will return an error with UNKNOWN_ACCOUNT
        if (data.error && data.error.cause?.name === 'UNKNOWN_ACCOUNT') {
            return true; // Account is available
        }

        return false; // Account exists
    } catch (error) {
        console.error('Error checking NEAR account:', error);
        throw new Error('Failed to check account availability');
    }
}

/**
 * Register a new user with mnemonic and nickname
 */
export async function register(
    nickname: string,
    mnemonic: string,
    network: NetworkType = 'testnet'
): Promise<boolean> {
    // Validate mnemonic
    if (!validateMnemonic(mnemonic)) {
        throw new Error('Invalid mnemonic phrase');
    }

    // Check if nickname is available
    const isAvailable = await isNickFree(nickname, network);
    if (!isAvailable) {
        throw new Error('Nickname is already taken');
    }

    // Derive keys
    const { publicKey } = deriveNearKeys(mnemonic);

    // Store credentials
    await AsyncStorage.multiSet([
        [STORAGE_KEYS.MNEMONIC, mnemonic],
        [STORAGE_KEYS.PUBLIC_KEY, publicKey],
        [STORAGE_KEYS.NICKNAME, nickname],
        [STORAGE_KEYS.NETWORK, network],
    ]);

    return true;
}

/**
 * Login with existing mnemonic
 */
export async function login(mnemonic: string): Promise<boolean> {
    // Validate mnemonic
    if (!validateMnemonic(mnemonic)) {
        throw new Error('Invalid mnemonic phrase');
    }

    // Derive keys
    const { publicKey } = deriveNearKeys(mnemonic);

    // Store the mnemonic and public key
    await AsyncStorage.multiSet([
        [STORAGE_KEYS.MNEMONIC, mnemonic],
        [STORAGE_KEYS.PUBLIC_KEY, publicKey],
    ]);

    return true;
}

/**
 * Logout and clear all stored credentials
 */
export async function logout(): Promise<void> {
    await AsyncStorage.multiRemove([
        STORAGE_KEYS.MNEMONIC,
        STORAGE_KEYS.PUBLIC_KEY,
        STORAGE_KEYS.NICKNAME,
        STORAGE_KEYS.NETWORK,
    ]);
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
    const mnemonic = await AsyncStorage.getItem(STORAGE_KEYS.MNEMONIC);
    const publicKey = await AsyncStorage.getItem(STORAGE_KEYS.PUBLIC_KEY);
    return !!(mnemonic && publicKey);
}

/**
 * Get current logged in user data
 */
export async function getCurrentUser(): Promise<UserData | null> {
    const [publicKey, nickname, network] = await AsyncStorage.multiGet([
        STORAGE_KEYS.PUBLIC_KEY,
        STORAGE_KEYS.NICKNAME,
        STORAGE_KEYS.NETWORK,
    ]);

    if (!publicKey[1]) {
        return null;
    }

    return {
        publicKey: publicKey[1],
        nickname: nickname[1] || '',
        network: (network[1] as NetworkType) || 'testnet',
    };
}

/**
 * Get stored mnemonic (use with caution!)
 */
export async function getMnemonic(): Promise<string | null> {
    return await AsyncStorage.getItem(STORAGE_KEYS.MNEMONIC);
}

/**
 * Check if user exists on server and return their data
 * @param publicKey - User's ed25519 public key
 * @returns User data if exists, null otherwise
 */
export async function checkUserExistsOnServer(publicKey: string): Promise<HasuraUser | null> {
    try {
        const query = `
            query GetUser($publicKey: String!) {
                users_by_pk(ed25519_public_key: $publicKey) {
                    ed25519_public_key
                    fms_category
                }
            }
        `;

        const response = await fetch(HASURA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hasura-admin-secret': HASURA_ADMIN_SECRET
            },
            body: JSON.stringify({
                query,
                variables: { publicKey }
            })
        });

        const result = await response.json();

        if (result.errors) {
            console.error('[authService] checkUserExistsOnServer error:', result.errors);
            return null;
        }

        return result.data.users_by_pk || null;
    } catch (error) {
        console.error('[authService] checkUserExistsOnServer network error:', error);
        return null;
    }
}
