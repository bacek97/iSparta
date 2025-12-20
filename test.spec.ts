import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

describe('BIP39 Mnemonic Tests', () => {
    describe('generateMnemonic', () => {
        it('should generate a valid mnemonic with 32 bits of entropy', () => {
            const mnemonic = bip39.generateMnemonic(wordlist, 32);

            expect(mnemonic).toBeDefined();
            expect(typeof mnemonic).toBe('string');

            // 32 bits should generate 3 words (32 / 11 ≈ 3)
            const words = mnemonic.split(' ');
            expect(words.length).toBe(3);

            // Each word should be from the wordlist
            words.forEach(word => {
                expect(wordlist).toContain(word);
            });
        });

        it('should generate different mnemonics on each call', () => {
            const mnemonic1 = bip39.generateMnemonic(wordlist, 32);
            const mnemonic2 = bip39.generateMnemonic(wordlist, 32);

            expect(mnemonic1).not.toBe(mnemonic2);
        });

        it('should generate valid mnemonics with different entropy sizes', () => {
            const testCases = [
                { bits: 128, expectedWords: 12 },
                { bits: 160, expectedWords: 15 },
                { bits: 192, expectedWords: 18 },
                { bits: 224, expectedWords: 21 },
                { bits: 256, expectedWords: 24 },
            ];

            testCases.forEach(({ bits, expectedWords }) => {
                const mnemonic = bip39.generateMnemonic(wordlist, bits);
                const words = mnemonic.split(' ');
                expect(words.length).toBe(expectedWords);
            });
        });
    });

    describe('mnemonicToEntropy', () => {
        it('should convert mnemonic to entropy', () => {
            const mnemonic = bip39.generateMnemonic(wordlist, 32);
            const entropy = bip39.mnemonicToEntropy(mnemonic, wordlist);

            expect(entropy).toBeDefined();
            expect(entropy).toBeInstanceOf(Uint8Array);

            // 32 bits = 4 bytes
            expect(entropy.length).toBe(4);
        });

        it('should produce consistent entropy for the same mnemonic', () => {
            const mnemonic = bip39.generateMnemonic(wordlist, 128);
            const entropy1 = bip39.mnemonicToEntropy(mnemonic, wordlist);
            const entropy2 = bip39.mnemonicToEntropy(mnemonic, wordlist);

            expect(entropy1).toEqual(entropy2);
        });

        it('should throw error for invalid mnemonic', () => {
            const invalidMnemonic = 'invalid mnemonic phrase test';

            expect(() => {
                bip39.mnemonicToEntropy(invalidMnemonic, wordlist);
            }).toThrow();
        });
    });

    describe('entropyToMnemonic', () => {
        it('should convert entropy back to mnemonic', () => {
            const originalMnemonic = bip39.generateMnemonic(wordlist, 32);
            const entropy = bip39.mnemonicToEntropy(originalMnemonic, wordlist);
            const recoveredMnemonic = bip39.entropyToMnemonic(entropy, wordlist);

            expect(recoveredMnemonic).toBe(originalMnemonic);
        });

        it('should create valid mnemonic from random entropy', () => {
            // Create 16 bytes (128 bits) of entropy
            const entropy = new Uint8Array(16);
            crypto.getRandomValues(entropy);

            const mnemonic = bip39.entropyToMnemonic(entropy, wordlist);

            expect(mnemonic).toBeDefined();
            expect(typeof mnemonic).toBe('string');
            expect(mnemonic.split(' ').length).toBe(12);
        });
    });

    describe('validateMnemonic', () => {
        it('should validate a correct mnemonic', () => {
            const mnemonic = bip39.generateMnemonic(wordlist, 128);
            const isValid = bip39.validateMnemonic(mnemonic, wordlist);

            expect(isValid).toBe(true);
        });

        it('should invalidate incorrect mnemonics', () => {
            const invalidCases = [
                'invalid mnemonic phrase',
                'abandon abandon abandon',
                'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12',
                '',
            ];

            invalidCases.forEach(invalidMnemonic => {
                const isValid = bip39.validateMnemonic(invalidMnemonic, wordlist);
                expect(isValid).toBe(false);
            });
        });

        it('should validate mnemonics of different lengths', () => {
            const testCases = [128, 160, 192, 224, 256];

            testCases.forEach(bits => {
                const mnemonic = bip39.generateMnemonic(wordlist, bits);
                const isValid = bip39.validateMnemonic(mnemonic, wordlist);
                expect(isValid).toBe(true);
            });
        });
    });

    describe('mnemonicToSeed', () => {
        it('should generate seed from mnemonic without password', async () => {
            const mnemonic = bip39.generateMnemonic(wordlist, 128);
            const seed = await bip39.mnemonicToSeed(mnemonic);

            expect(seed).toBeDefined();
            expect(seed).toBeInstanceOf(Uint8Array);
            expect(seed.length).toBe(64); // BIP39 seeds are always 64 bytes
        });

        it('should generate seed from mnemonic with password', async () => {
            const mnemonic = bip39.generateMnemonic(wordlist, 128);
            const seed = await bip39.mnemonicToSeed(mnemonic, 'password');

            expect(seed).toBeDefined();
            expect(seed).toBeInstanceOf(Uint8Array);
            expect(seed.length).toBe(64);
        });

        it('should generate different seeds with different passwords', async () => {
            const mnemonic = bip39.generateMnemonic(wordlist, 128);
            const seed1 = await bip39.mnemonicToSeed(mnemonic, 'password1');
            const seed2 = await bip39.mnemonicToSeed(mnemonic, 'password2');

            expect(seed1).not.toEqual(seed2);
        });

        it('should generate same seed for same mnemonic and password', async () => {
            const mnemonic = bip39.generateMnemonic(wordlist, 128);
            const seed1 = await bip39.mnemonicToSeed(mnemonic, 'password');
            const seed2 = await bip39.mnemonicToSeed(mnemonic, 'password');

            expect(seed1).toEqual(seed2);
        });
    });

    describe('mnemonicToSeedSync', () => {
        it('should generate seed synchronously', () => {
            const mnemonic = bip39.generateMnemonic(wordlist, 128);
            const seed = bip39.mnemonicToSeedSync(mnemonic, 'password');

            expect(seed).toBeDefined();
            expect(seed).toBeInstanceOf(Uint8Array);
            expect(seed.length).toBe(64);
        });

        it('should generate same seed as async version', async () => {
            const mnemonic = bip39.generateMnemonic(wordlist, 128);
            const seedAsync = await bip39.mnemonicToSeed(mnemonic, 'password');
            const seedSync = bip39.mnemonicToSeedSync(mnemonic, 'password');

            expect(seedSync).toEqual(seedAsync);
        });
    });

    describe('mnemonicToSeedWebcrypto', () => {
        it('should generate seed using WebCrypto API', async () => {
            const mnemonic = bip39.generateMnemonic(wordlist, 128);
            const seed = await bip39.mnemonicToSeedWebcrypto(mnemonic, 'password');

            expect(seed).toBeDefined();
            expect(seed).toBeInstanceOf(Uint8Array);
            expect(seed.length).toBe(64);
        });

        it('should generate same seed as standard async version', async () => {
            const mnemonic = bip39.generateMnemonic(wordlist, 128);
            const seedStandard = await bip39.mnemonicToSeed(mnemonic, 'password');
            const seedWebcrypto = await bip39.mnemonicToSeedWebcrypto(mnemonic, 'password');

            expect(seedWebcrypto).toEqual(seedStandard);
        });
    });

    describe('Integration: Full workflow', () => {
        it('should complete full mnemonic generation and seed derivation workflow', async () => {
            // 1. Generate mnemonic
            const mnemonic = bip39.generateMnemonic(wordlist, 32);
            expect(mnemonic).toBeDefined();

            // 2. Validate mnemonic
            const isValid = bip39.validateMnemonic(mnemonic, wordlist);
            expect(isValid).toBe(true);

            // 3. Convert to entropy
            const entropy = bip39.mnemonicToEntropy(mnemonic, wordlist);
            expect(entropy).toBeDefined();

            // 4. Convert back to mnemonic
            const recoveredMnemonic = bip39.entropyToMnemonic(entropy, wordlist);
            expect(recoveredMnemonic).toBe(mnemonic);

            // 5. Generate seeds using all three methods
            const seed1 = await bip39.mnemonicToSeed(mnemonic, 'password');
            const seed2 = bip39.mnemonicToSeedSync(mnemonic, 'password');
            const seed3 = await bip39.mnemonicToSeedWebcrypto(mnemonic, 'password');

            // All seeds should be identical
            expect(seed1).toEqual(seed2);
            expect(seed2).toEqual(seed3);
        });
    });
});
