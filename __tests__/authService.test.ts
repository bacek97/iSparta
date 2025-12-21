/**
 * Jest tests for Authentication Service
 * Tests real BIP39 mnemonic generation, key derivation, NEAR account checks, and secure storage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthService from '../authService';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

// Mock AsyncStorage only (not the actual auth logic)
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    multiGet: jest.fn(),
    multiSet: jest.fn(),
    multiRemove: jest.fn(),
}));

// Mock fetch for NEAR RPC calls
global.fetch = jest.fn();

describe('AuthService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('generateMnemonic', () => {
        it('should generate a valid 3-word mnemonic', () => {
            const mnemonic = AuthService.generateMnemonic();
            const words = mnemonic.split(' ');

            expect(words).toHaveLength(3);
            expect(words.every(word => word.length > 0)).toBe(true);
            expect(bip39.validateMnemonic(mnemonic, wordlist)).toBe(true);
        });

        it('should generate different mnemonics on each call', () => {
            const mnemonic1 = AuthService.generateMnemonic();
            const mnemonic2 = AuthService.generateMnemonic();

            expect(mnemonic1).not.toBe(mnemonic2);
        });
    });

    describe('validateMnemonic', () => {
        it('should validate correct mnemonic', () => {
            const mnemonic = AuthService.generateMnemonic();
            expect(AuthService.validateMnemonic(mnemonic)).toBe(true);
        });

        it('should reject invalid mnemonic', () => {
            const invalidMnemonic = 'invalid words here';
            expect(AuthService.validateMnemonic(invalidMnemonic)).toBe(false);
        });
    });

    describe('deriveNearKeys', () => {
        it('should derive ed25519 keys from mnemonic', () => {
            const mnemonic = AuthService.generateMnemonic();
            const { publicKey, secretKey } = AuthService.deriveNearKeys(mnemonic);

            expect(publicKey).toMatch(/^ed25519:[A-HJ-NP-Za-km-z1-9]+$/);
            expect(secretKey).toMatch(/^ed25519:[A-HJ-NP-Za-km-z1-9]+$/);
            expect(publicKey).not.toBe(secretKey);
        });

        it('should derive same keys for same mnemonic', () => {
            const mnemonic = AuthService.generateMnemonic();

            const keys1 = AuthService.deriveNearKeys(mnemonic);
            const keys2 = AuthService.deriveNearKeys(mnemonic);

            expect(keys1.publicKey).toBe(keys2.publicKey);
            expect(keys1.secretKey).toBe(keys2.secretKey);
        });

        it('should use correct derivation path', () => {
            const mnemonic = AuthService.generateMnemonic();
            const customPath = "m/44'/397'/1'";

            const defaultKeys = AuthService.deriveNearKeys(mnemonic);
            const customKeys = AuthService.deriveNearKeys(mnemonic, customPath);

            expect(defaultKeys.publicKey).not.toBe(customKeys.publicKey);
        });
    });

    describe('isNickFree', () => {
        it('should return true for available account on testnet', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => ({
                    error: {
                        cause: { name: 'UNKNOWN_ACCOUNT' }
                    }
                })
            });

            const isAvailable = await AuthService.isNickFree('availableuser123', 'testnet');
            expect(isAvailable).toBe(true);
        });

        it('should return false for taken account', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => ({
                    result: { account_id: 'takenuser.testnet' }
                })
            });

            const isAvailable = await AuthService.isNickFree('takenuser', 'testnet');
            expect(isAvailable).toBe(false);
        });

        it('should check correct RPC endpoint for testnet', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => ({
                    error: { cause: { name: 'UNKNOWN_ACCOUNT' } }
                })
            });

            await AuthService.isNickFree('testuser', 'testnet');

            expect(global.fetch).toHaveBeenCalledWith(
                'https://rpc.testnet.near.org',
                expect.any(Object)
            );
        });

        it('should check correct RPC endpoint for mainnet', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => ({
                    error: { cause: { name: 'UNKNOWN_ACCOUNT' } }
                })
            });

            await AuthService.isNickFree('testuser', 'mainnet');

            expect(global.fetch).toHaveBeenCalledWith(
                'https://rpc.mainnet.near.org',
                expect.any(Object)
            );
        });

        it('should handle network errors', async () => {
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

            await expect(
                AuthService.isNickFree('testuser', 'testnet')
            ).rejects.toThrow('Failed to check account availability');
        });
    });

    describe('register', () => {
        it('should register new user with valid data', async () => {
            const mnemonic = AuthService.generateMnemonic();
            const nickname = 'newuser123';

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => ({
                    error: { cause: { name: 'UNKNOWN_ACCOUNT' } }
                })
            });

            (AsyncStorage.multiSet as jest.Mock).mockResolvedValueOnce(undefined);

            const result = await AuthService.register(nickname, mnemonic, 'testnet');

            expect(result).toBe(true);
            expect(AsyncStorage.multiSet).toHaveBeenCalled();
        });

        it('should reject invalid mnemonic', async () => {
            await expect(
                AuthService.register('user', 'invalid mnemonic', 'testnet')
            ).rejects.toThrow('Invalid mnemonic phrase');
        });

        it('should reject taken nickname', async () => {
            const mnemonic = AuthService.generateMnemonic();

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => ({
                    result: { account_id: 'takenuser.testnet' }
                })
            });

            await expect(
                AuthService.register('takenuser', mnemonic, 'testnet')
            ).rejects.toThrow('Nickname is already taken');
        });
    });

    describe('login', () => {
        it('should login with valid mnemonic', async () => {
            const mnemonic = AuthService.generateMnemonic();

            (AsyncStorage.multiSet as jest.Mock).mockResolvedValueOnce(undefined);

            const result = await AuthService.login(mnemonic);

            expect(result).toBe(true);
            expect(AsyncStorage.multiSet).toHaveBeenCalled();
        });

        it('should reject invalid mnemonic', async () => {
            await expect(
                AuthService.login('invalid words here')
            ).rejects.toThrow('Invalid mnemonic phrase');
        });
    });

    describe('logout', () => {
        it('should clear all stored credentials', async () => {
            (AsyncStorage.multiRemove as jest.Mock).mockResolvedValueOnce(undefined);

            await AuthService.logout();

            expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(
                expect.arrayContaining([
                    'auth_mnemonic',
                    'auth_public_key',
                    'auth_nickname',
                    'auth_network',
                ])
            );
        });
    });

    describe('getCurrentUser', () => {
        it('should return user data if logged in', async () => {
            (AsyncStorage.multiGet as jest.Mock).mockResolvedValueOnce([
                ['auth_public_key', 'ed25519:test123'],
                ['auth_nickname', 'testuser'],
                ['auth_network', 'testnet'],
            ]);

            const user = await AuthService.getCurrentUser();

            expect(user).toEqual({
                publicKey: 'ed25519:test123',
                nickname: 'testuser',
                network: 'testnet',
            });
        });

        it('should return null if not logged in', async () => {
            (AsyncStorage.multiGet as jest.Mock).mockResolvedValueOnce([
                ['auth_public_key', null],
                ['auth_nickname', null],
                ['auth_network', null],
            ]);

            const user = await AuthService.getCurrentUser();

            expect(user).toBeNull();
        });
    });

    describe('getMnemonic', () => {
        it('should retrieve stored mnemonic', async () => {
            const testMnemonic = 'test mnemonic phrase';
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(testMnemonic);

            const mnemonic = await AuthService.getMnemonic();

            expect(mnemonic).toBe(testMnemonic);
            expect(AsyncStorage.getItem).toHaveBeenCalledWith('auth_mnemonic');
        });
    });
});
