import { BadRequestException, Body, Controller, Delete, Get, Header, Headers, Param, Patch, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { Roles } from '../../common/roles.decorator';
import { ApiRoleHeader } from '../../common/swagger-role-header';
import { FileInterceptor } from '@nestjs/platform-express';
import { documentText, ImportFile, importFileOptions } from '../../common/import-document';
import { parseLearnerList, readGoogleSheet } from './learner-import';
import { BulkLearnersDto, CreateUserDto, DeleteUserDto, UpdateUserDto } from './dto';

@ApiTags('Users')
@Controller('users')
@ApiRoleHeader()
export class UsersController {
  constructor(private readonly service:UsersService){}

  @Get() @Roles('superuser','admin','instructor') @ApiOperation({summary:'List users'})
  all(@Headers('x-user-id') uid?:string){return {success:true,data:this.service.findAll(uid)};}

  @Get('role/:role') @Roles('superuser','admin','instructor') @ApiOperation({summary:'List users by role'})
  byRole(@Param('role') role:string,@Headers('x-user-id') uid?:string){return {success:true,data:this.service.findByRole(role,uid)};}

  @Get(':id') @Roles('superuser','admin','instructor','learner','provider') @ApiOperation({summary:'Get user by id'})
  one(@Param('id') id:string){return {success:true,data:this.service.findOne(id)};}

  @Post('bulk-learners/preview') @Roles('superuser','admin')
  @UseInterceptors(FileInterceptor('file', importFileOptions))
  async previewLearners(@UploadedFile() file: ImportFile, @Body('sheetUrl') link: unknown, @Req() req: any) {
    const actorId = req.user.id;
    this.service.requireLearnerImporter(actorId);
    if (file && link) throw new BadRequestException('Choose a file or a Google Sheets link.');
    const text = file ? await documentText(file, ['.csv', '.pdf']) :
      typeof link === 'string' && link.trim() ? await readGoogleSheet(link.trim()) : '';
    if (!text) throw new BadRequestException('Choose a CSV or PDF file, or paste a Google Sheets link.');
    const rows = this.service.prepareLearnerImport(parseLearnerList(text, /\.pdf$/i.test(file?.originalname || '')), actorId);
    return { success: true, data: rows.map(({ firstName, lastName, email, institution, studentId }) =>
      ({ firstName, lastName, email, institution, studentId })) };
  }

  @Post('bulk-learners') @Roles('superuser','admin')
  @Header('Cache-Control', 'no-store')
  importLearners(@Body() dto: BulkLearnersDto, @Req() req: any) {
    return { success: true, data: this.service.importLearners(dto.rows, req.user.id) };
  }

  @Post() @Roles('superuser','admin') @ApiOperation({summary:'Create user'}) @ApiBody({type:CreateUserDto})
  create(@Body() dto:CreateUserDto,@Headers('x-user-id') uid?:string){return {success:true,data:this.service.create(dto,false,uid)};}

  @Patch(':id') @Roles('superuser','admin','instructor') @ApiOperation({summary:'Update user'}) @ApiBody({type:UpdateUserDto})
  update(@Param('id') id:string,@Body() dto:UpdateUserDto,@Headers('x-user-id') uid?:string){return {success:true,data:this.service.update(id,dto,uid)};}

  @Delete(':id') @Roles('superuser','admin') @ApiOperation({summary:'Delete user'})
  async remove(@Param('id') id:string,@Body() dto:DeleteUserDto,@Headers('x-user-id') uid?:string){return {success:true,data:await this.service.remove(id,dto?.reason,uid)};}

  @Get(':id/portfolio') @Roles('superuser','admin','instructor','learner') @ApiOperation({summary:'Get learner portfolio, holdings and trades'})
  portfolio(@Param('id') id:string){return {success:true,data:this.service.portfolio(id)};}
}
