describe('Sentry init', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('skips init when SENTRY_DSN is not set', async () => {
    delete process.env['SENTRY_DSN'];
    const init = jest.fn();
    jest.doMock('@sentry/node', () => ({ init }));

    await import('../../../src/config/sentry');
    expect(init).not.toHaveBeenCalled();
  });

  it('calls init when SENTRY_DSN is set', async () => {
    process.env['SENTRY_DSN'] = 'https://examplePublicKey@o0.ingest.sentry.io/0';
    const init = jest.fn();
    jest.doMock('@sentry/node', () => ({ init }));

    await import('../../../src/config/sentry');
    expect(init).toHaveBeenCalledWith(expect.objectContaining({ tracesSampleRate: 0.1 }));
  });
});
