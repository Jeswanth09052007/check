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
