import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, OptionalAuth, Public } from '../auth/decorators.js';
import { UserRole } from '../auth/roles.js';
import { ChatRequestDto } from './assistant.dto.js';
import { AssistantRateLimitGuard } from './assistant.rate-limit.js';
import { AssistantService } from './assistant.service.js';
import type { AssistantContact, AssistantReply } from './assistant.types.js';

/** SCRUM-113. Rally, the shopping assistant. */
@Controller('assistant')
export class AssistantController {
  constructor(
    @Inject(AssistantService) private readonly assistant: AssistantService,
  ) {}

  /** Open to guests. A signed-in customer's session lets Rally look up that customer's orders. */
  @OptionalAuth()
  @UseGuards(AssistantRateLimitGuard)
  @Post('chat')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  chat(
    @CurrentUser() user: AuthUser | undefined,
    @Body() body: ChatRequestDto,
  ): Promise<AssistantReply> {
    return this.assistant.chat(body.messages, {
      customerId: user?.role === UserRole.customer ? user.id : null,
    });
  }

  /** "Talk to a person": phone, email and opening hours. No AI involved. */
  @Public()
  @Get('contact')
  contact(): AssistantContact {
    return this.assistant.contact();
  }
}
