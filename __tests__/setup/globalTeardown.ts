export default async function globalTeardown(): Promise<void> {
  // Per-suite DB teardown is handled in each integration test's afterAll
}
