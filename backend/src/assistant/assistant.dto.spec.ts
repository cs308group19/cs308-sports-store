import { type ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { ChatRequestDto, MAX_MESSAGE_LENGTH } from './assistant.dto.js';

/** SCRUM-113. What POST /api/assistant/chat accepts; everything else is a 400. */
describe('ChatRequestDto', () => {
  // The same settings as app.setup.ts.
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: ChatRequestDto,
  };
  const validate = (body: unknown) =>
    pipe.transform(body, metadata) as Promise<ChatRequestDto>;
  const user = (content: unknown) => ({ role: 'user', content });
  const assistant = (content: string) => ({ role: 'assistant', content });

  it('accepts a conversation that ends with the user, trimming each message', async () => {
    const body = await validate({
      messages: [user('hi'), assistant('Hey!'), user('  running shoes  ')],
    });
    expect(body.messages.map((message) => message.content)).toEqual([
      'hi',
      'Hey!',
      'running shoes',
    ]);
  });

  it('accepts exactly 20 messages of exactly 2000 characters', async () => {
    const messages = Array.from({ length: 20 }, () =>
      user('a'.repeat(MAX_MESSAGE_LENGTH)),
    );
    await expect(validate({ messages })).resolves.toBeDefined();
  });

  it('counts the length after trimming', async () => {
    await expect(
      validate({
        messages: [user(`   ${'a'.repeat(MAX_MESSAGE_LENGTH)}   `)],
      }),
    ).resolves.toBeDefined();
  });

  it.each([
    ['no body', {}],
    ['messages that are not a list', { messages: 'hello' }],
    ['an empty list', { messages: [] }],
    ['too many messages', { messages: Array(21).fill(user('hi')) }],
    ['an empty message', { messages: [user('')] }],
    ['a message of only spaces', { messages: [user('   \n ')] }],
    [
      'a message over 2000 characters',
      { messages: [user('a'.repeat(MAX_MESSAGE_LENGTH + 1))] },
    ],
    ['a message that is not text', { messages: [user(42)] }],
    ['a message without content', { messages: [{ role: 'user' }] }],
    ['an unknown role', { messages: [{ role: 'system', content: 'x' }] }],
    [
      'a last message from the assistant',
      { messages: [user('a'), assistant('b')] },
    ],
    [
      'an extra field in a message',
      { messages: [{ ...user('a'), name: 'x' }] },
    ],
    ['an extra field in the body', { messages: [user('a')], model: 'x' }],
    ['a null message', { messages: [null] }],
    ['a null before the last message', { messages: [null, user('a')] }],
    ['a nested list', { messages: [[user('a')]] }],
    ['a text instead of a message', { messages: ['hi'] }],
  ])('rejects %s with 400', async (_name, body) => {
    await expect(validate(body)).rejects.toMatchObject({ status: 400 });
  });
});
