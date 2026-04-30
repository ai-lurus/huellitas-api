import { AppError, NotFoundError } from '../../../src/utils/errors';

describe('AppError', () => {
  it('defaults message to code when message omitted', () => {
    const e = new AppError('X', 400);
    expect(e.message).toBe('X');
  });

  it('uses provided message when present', () => {
    const e = new AppError('X', 400, 'hola');
    expect(e.message).toBe('hola');
  });

  it('subclasses use default message param', () => {
    const e = new NotFoundError();
    expect(e.statusCode).toBe(404);
    expect(e.message).toBe('Resource not found');
  });
});
