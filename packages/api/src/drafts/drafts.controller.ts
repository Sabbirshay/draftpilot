import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { DraftsService } from './drafts.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { GenerateDraftDto } from './dto/generate-draft.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Drafts')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('drafts')
export class DraftsController {
  constructor(private readonly draftsService: DraftsService) {}

  @Post('generate')
  async generate(@CurrentUser() user: any, @Body() dto: GenerateDraftDto) {
    return await this.draftsService.generateDraft(user, dto);
  }
}