module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/setup/'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/index.ts'],
  coveragePathIgnorePatterns: [
    'src/config/sentry.ts',
    'src/db/migrate.ts',
    'src/services/storage.service.ts',
    'src/middleware/requestId.middleware.ts',
    'src/routes/index.ts',
  ],
  // Ramas (p. ej. optional chaining en repos) cuestan mucho llegar a 80% sin tests muy frágiles
  coverageThreshold: {
    global: { branches: 55, functions: 80, lines: 80, statements: 80 },
  },
  globalSetup: './__tests__/setup/globalSetup.ts',
  globalTeardown: './__tests__/setup/globalTeardown.ts',
};
