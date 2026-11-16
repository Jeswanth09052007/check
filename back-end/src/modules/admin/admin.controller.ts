import { MappingService } from '../../store/mapping.service';
import { Param, Req } from '@nestjs/common';
import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, NotFoundException, Patch, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataStore } from '../../store/data.store';
import { Roles } from '../../common/roles.decorator';
import { ApiRoleHeader } from '../../common/swagger-role-header';
import { AssignInstructorDto, UpdateConfigDto } from './dto';

@ApiTags('Admin')
@Controller('admin')
@ApiRoleHeader()
export class AdminController {
  constructor(private readonly db: DataStore, private readonly mapping: MappingService) {}

  private requireUserAdmin(userId?:string){ const u=userId?this.db.getUser(userId):null; if(!u || !((u.role==='admin'&&u.adminTeam==='USER_ADMIN')||u.role==='superuser')) throw new ForbiddenException('User Admin or Super Admin access required.'); }
  private requireSuper(userId?:string){ const u=userId?this.db.getUser(userId):null; if(!u || u.role!=='superuser') throw new ForbiddenException('Super Admin access required.'); }

  @Get('config')
  @Roles('superuser','admin')
  @ApiOperation({summary:'Get platform config'})
  config(){
    return {success:true,data:this.db.config};
  }

  @Patch('config')
  @Roles('superuser','admin')
  @ApiOperation({summary:'Update platform config'})
  @ApiBody({type:UpdateConfigDto})
  updateConfig(@Body() body:UpdateConfigDto, @Headers('x-user-id') userId?:string){
    this.requireSuper(userId);
    if (!body || Object.keys(body).length === 0) throw new BadRequestException('At least one config field is required.');
    Object.assign(this.db.config, body);
    return {success:true,data:this.db.config};
  }

  @Post('assign-instructor')
  @Roles('superuser','admin')
  @ApiOperation({summary:'Assign instructor to learner'})
  @ApiBody({type:AssignInstructorDto})
  assign(@Body() body:AssignInstructorDto, @Headers('x-user-id') userId?:string){
    this.requireUserAdmin(userId);
    return {success:true,data:this.mapping.assign(body.learnerId,body.instructorId,this.db.getUser(userId!)!)};
  }
  @Get('course-coordination') @Roles('learner','instructor','admin','superuser')
  courseCoordination(@Req() req: any) {
    const actor = req.user;
    const profile = (user: { id: string; firstName: string; lastName: string }) =>
      ({ id: user.id, name: `${user.firstName} ${user.lastName}` });
    if (actor.role === 'learner') {
      const learner = this.db.getUser(actor.id)!;
      const eligible = this.db.hasPlus(learner.id);
      const coordinator = eligible && learner.courseCoordinatorId ? this.db.getUser(learner.courseCoordinatorId) : undefined;
      return { success:true, data:{ eligible, coordinator: coordinator?.status === 'active' ? profile(coordinator) : null } };
    }
    if (actor.role !== 'instructor') this.requireUserAdmin(actor.id);
    const learners = this.db.users.filter(user => user.role === 'learner' && user.status === 'active' &&
      (actor.role !== 'instructor' || user.courseCoordinatorId === actor.id) && this.db.hasPlus(user.id));
    if (actor.role === 'instructor') return { success:true, data:{ learners: learners.map(profile) } };
    const instructors = this.db.users.filter(user => user.role === 'instructor' && user.status === 'active').map(profile);
    return { success:true, data:{ instructors, learners: learners.map(user => ({ ...profile(user), coordinatorId: user.courseCoordinatorId })) } };
  }

  @Post('course-coordination/:learnerId/:coordinatorId') @Roles('admin','superuser')
  assignCoordinator(@Param('learnerId') learnerId: string, @Param('coordinatorId') coordinatorId: string, @Req() req: any) {
    this.requireUserAdmin(req.user.id);
    const learner = this.db.getUser(learnerId);
    const coordinator = this.db.getUser(coordinatorId);
    if (!learner || learner.role !== 'learner' || learner.status !== 'active' || !this.db.hasPlus(learnerId)) {
      throw new BadRequestException('Select an active Plus learner.');
    }
    if (!coordinator || coordinator.role !== 'instructor' || coordinator.status !== 'active') {
      throw new BadRequestException('Select an active instructor to coordinate courses.');
    }
    if (learner.courseCoordinatorId !== coordinatorId) {
      learner.courseCoordinatorId = coordinatorId;
      const createdAt = new Date().toISOString();
      for (const [userId, message] of [
        [learnerId, `${coordinator.firstName} ${coordinator.lastName} is your course coordinator.`],
        [coordinatorId, `You are the course coordinator for ${learner.firstName} ${learner.lastName}.`],
      ]) this.db.notifications.push({ id: this.db.id('n'), userId, message, createdAt, read:false, type:'info' });
      this.db.audit('COORDINATOR_ASSIGNED', req.user.id, { learnerId, coordinatorId });
    }
    return { success:true, data:{ learnerId, coordinatorId } };
  }

  @Get('learner-guidance') @Roles('learner')
  guidance(@Req() req: any) {
    return { success: true, data: this.mapping.guidance(req.user) };
  }

  @Post('learner-guidance/:instructorId') @Roles('learner')
  requestInstructor(@Param('instructorId') id: string, @Req() req: any) {
    return { success: true, data: this.mapping.requestInstructor(id, req.user) };
  }

  @Get('mapping-requests') @Roles('superuser','admin','instructor')
  requests(@Req() req:any){
    if(req.user.role==='admin')this.requireUserAdmin(req.user.id);
    return {success:true,data:this.mapping.list(req.user)};
  }
  @Get('unmapped-students') @Roles('superuser','admin')
  unmapped(@Req() req:any){this.requireUserAdmin(req.user.id);return {success:true,data:this.mapping.unmapped().map(u=>this.db.safeUser(u))};}
  @Post('remove-student/:learnerId') @Roles('instructor')
  removeStudent(@Param('learnerId') id:string,@Req() req:any){return {success:true,data:this.mapping.requestRemoval(id,req.user)};}
  @Post('mapping-requests/:id/:decision') @Roles('superuser','admin','instructor')
  decide(@Param('id') id:string,@Param('decision') decision:string,@Req() req:any){return {success:true,data:this.mapping.decide(id,decision,req.user)};}
}
