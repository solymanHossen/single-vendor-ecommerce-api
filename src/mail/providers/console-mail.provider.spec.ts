import { ConsoleMailProvider } from './console-mail.provider';

describe('ConsoleMailProvider', () => {
  let provider: ConsoleMailProvider;

  beforeEach(() => {
    provider = new ConsoleMailProvider();
  });

  it('resolves without throwing (no real delivery)', async () => {
    await expect(
      provider.send({
        to: 'user@example.com',
        subject: 'Reset your password',
        html: '<p>reset</p>',
        text: 'reset',
      }),
    ).resolves.toBeUndefined();
  });
});
