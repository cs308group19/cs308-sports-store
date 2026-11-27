import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsObject,
  IsString,
  MaxLength,
  MinLength,
  ValidateBy,
  ValidateNested,
} from 'class-validator';

export const MAX_MESSAGES = 20;
export const MAX_MESSAGE_LENGTH = 2000;
/** Room for the largest valid conversation (20 × 2000 characters, 3 bytes each) and no more. */
export const ASSISTANT_BODY_LIMIT = '128kb';

export const CHAT_ROLES = ['user', 'assistant'] as const;
export type ChatRole = (typeof CHAT_ROLES)[number];

export class ChatMessageDto {
  @IsIn(CHAT_ROLES)
  role: ChatRole;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_MESSAGE_LENGTH)
  content: string;
}

/** The conversation must end with something for Rally to answer. */
function LastMessageFromUser() {
  return ValidateBy({
    name: 'lastMessageFromUser',
    validator: {
      validate: (value: unknown) =>
        Array.isArray(value) &&
        (value.at(-1) as { role?: unknown } | null | undefined)?.role ===
          'user',
      defaultMessage: () => 'The last message must be from the user.',
    },
  });
}

/** Body of POST /api/assistant/chat. The server keeps no conversation: the browser sends it. */
export class ChatRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_MESSAGES)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  @LastMessageFromUser()
  messages: ChatMessageDto[];
}
