import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RejectionRemarkDto } from '../../common/form-validation';
import { Roles } from '../../common/roles.decorator';
import { ApiRoleHeader } from '../../common/swagger-role-header';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto, SubmitAssignmentDto, UpdateAssignmentDto } from './dto';

@ApiTags('Assignments') @Controller('assignments') @ApiRoleHeader()
export class AssignmentsController {
  constructor(private readonly service: AssignmentsService) {}

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

  @Post() @Roles('superuser', 'admin', 'instructor', 'provider')
  create(@Body() body: CreateAssignmentDto, @Req() req: any) {
    return { success: true, data: this.service.create(body, req.user) };
  }

  @Patch(':id') @Roles('superuser', 'admin', 'instructor', 'provider')
  update(@Param('id') id: string, @Body() body: UpdateAssignmentDto, @Req() req: any) {
    return { success: true, data: this.service.update(id, body, req.user) };
  }

  @Post(':id/submit') @Roles('superuser', 'learner')
  submit(@Param('id') id: string, @Body() body: SubmitAssignmentDto, @Req() req: any) {
    return { success: true, data: this.service.submit(id, body, req.user) };
  }

  @Post(':id/approve/:learnerId') @Roles('superuser', 'admin', 'instructor', 'provider')
  approve(@Param('id') id: string, @Param('learnerId') learnerId: string, @Req() req: any) {
    return { success: true, data: this.service.review(id, learnerId, req.user, 'approved') };
  }

  @Post(':id/reject/:learnerId') @Roles('superuser', 'admin', 'instructor', 'provider')
  reject(@Param('id') id: string, @Param('learnerId') learnerId: string, @Body() body: RejectionRemarkDto, @Req() req: any) {
    return { success: true, data: this.service.review(id, learnerId, req.user, 'rejected', body.remark) };
  }

  @Delete(':id') @Roles('superuser', 'admin', 'instructor', 'provider')
  remove(@Param('id') id: string, @Req() req: any) {
    return { success: true, data: this.service.remove(id, req.user) };
  }
}
