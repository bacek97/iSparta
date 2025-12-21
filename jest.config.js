module.exports = {
  preset: 'react-native',
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(@scure|@noble|react-native|@react-native|@react-navigation|react-native-svg|@react-native-async-storage|react-native-geolocation-service|react-native-reanimated)/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
