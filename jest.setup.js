// Jest setup file

// Mock react-native-get-random-values for Jest environment
jest.mock('react-native-get-random-values', () => {
    // Polyfill is already handled by Node's crypto.webcrypto
    return {};
});

// Mock crypto for Node environment
if (typeof global.crypto === 'undefined') {
    global.crypto = require('crypto').webcrypto;
}
