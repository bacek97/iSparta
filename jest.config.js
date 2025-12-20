module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(@scure|@noble)/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        '@babel/preset-typescript',
      ],
    }],
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
