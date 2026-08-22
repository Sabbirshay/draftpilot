import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { MacrosService } from './macros.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { CreateMacroDto } from './dto/create-macro.dto';
import { UpdateMacroDto } from './dto/update-macro.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Macros')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('macros')
export class MacrosController {
  constructor(private readonly macrosService: MacrosService) {}

  @Get()
  async findAll(@CurrentUser() user: any) {
    return await this.macrosService.findAll(user.team_id);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return await this.macrosService.findOne(user.team_id, id);
  }

  @Post()
  async create(@CurrentUser() user: any, @Body() dto: CreateMacroDto) {
    return await this.macrosService.create(user.team_id, dto);
  }

  @Put(':id')
  async update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateMacroDto) {
    return await this.macrosService.update(user.team_id, id, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    return await this.macrosService.remove(user.team_id, id);
  }
}