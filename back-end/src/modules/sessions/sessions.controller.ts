import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/roles.decorator';
import { ApiRoleHeader } from '../../common/swagger-role-header';
import { AcceptSessionDto, CreateSessionDto, RejectSessionDto, UpdateSessionDto } from './dto';
import { SessionsService } from './sessions.service';

@ApiTags('Sessions') @Controller('sessions') @ApiRoleHeader()
export class SessionsController {
  constructor(private readonly service: SessionsService) {}

  @Get() @Roles('superuser', 'admin', 'instructor', 'provider', 'learner')
  all(@Req() req: any) {
    return { success: true, data: this.service.findAll(req.user) };
  }

  @Get('learner/:learnerId') @Roles('superuser', 'admin', 'instructor', 'learner')
  byLearner(@Param('learnerId') learnerId: string) {
    return { success: true, data: this.service.findByLearner(learnerId) };
  }

  @Get(':id') @Roles('superuser', 'admin', 'instructor', 'provider', 'learner')
  one(@Param('id') id: string, @Req() req: any) {
    return { success: true, data: this.service.findOne(id, req.user) };
  }

  @Post() @Roles('superuser', 'admin', 'instructor')
  create(@Body() body: CreateSessionDto, @Req() req: any) {
    return { success: true, data: this.service.create(body, req.user) };
  }

  @Patch(':id') @Roles('superuser', 'admin', 'instructor')
  update(@Param('id') id: string, @Body() body: UpdateSessionDto, @Req() req: any) {
    return { success: true, data: this.service.update(id, body, req.user) };
  }

  @Post(':id/accept') @Roles('instructor')
  accept(@Param('id') id: string, @Body() body: AcceptSessionDto, @Req() req: any) {
    return { success: true, data: this.service.decide(id, req.user.id, 'accepted', undefined, body?.expectedRevision) };
  }

  @Post(':id/reject') @Roles('instructor')
  reject(@Param('id') id: string, @Body() body: RejectSessionDto, @Req() req: any) {
    return { success: true, data: this.service.decide(id, req.user.id, 'rejected', body.remark, body.expectedRevision) };
  }

  @Delete(':id') @Roles('superuser', 'admin', 'instructor')
  remove(@Param('id') id: string, @Req() req: any) {
    return { success: true, data: this.service.remove(id, req.user) };
  }
}
