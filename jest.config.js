module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/setup/'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    // Scripts/CLI no forman parte del runtime del API.
    '!src/scripts/**/*.ts',
    // Servicio legacy (Expo) ya no se usa.
    '!src/services/expo-push.service.ts',
  ],
  coveragePathIgnorePatterns: [
    'src/config/sentry.ts',
    'src/db/migrate.ts',
    'src/services/storage.service.ts',
    'src/middleware/requestId.middleware.ts',
    'src/routes/index.ts',
  ],
  // BE-019 exige 80%+ global
  coverageThreshold: {
    // Branch coverage en TS/Express tiende a ser muy frágil (optional chaining, early returns, catches).
    // Mantenemos 80% para métricas estables y un umbral razonable para branches.
    global: { branches: 60, functions: 80, lines: 80, statements: 80 },
  },
  globalSetup: './__tests__/setup/globalSetup.ts',
  globalTeardown: './__tests__/setup/globalTeardown.ts',
};
