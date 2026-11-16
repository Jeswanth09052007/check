import { RejectionRemarkDto } from '../../common/form-validation';
import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataStore } from '../../store/data.store';
import { Roles } from '../../common/roles.decorator';
import { ApiRoleHeader } from '../../common/swagger-role-header';

@ApiTags('Superuser')
@Controller('superuser')
@ApiRoleHeader()
export class SuperuserController {
  constructor(private readonly db: DataStore) {}

  @Get('overview')
  @Roles('superuser')
  @ApiOperation({ summary: 'Super Admin system overview' })
  overview() {
    return { success: true, data: { users: this.db.users.length, courses: this.db.courses.length, trades: this.db.trades.length, notifications: this.db.notifications.length } };
  }

  @Get('all-data')
  @Roles('superuser')
  @ApiOperation({ summary: 'Super Admin full in-memory repository snapshot' })
  allData() {
    const users = this.db.users.map(u => this.db.safeUser(u));
    return { success: true, data: { ...this.db, users } };
  }

  @Get('audit-logs')
  @Roles('superuser')
  @ApiOperation({ summary: 'Super Admin platform activity log' })
  audit(@Query('page') pageValue?: string, @Query('search') searchValue?: string) {
    const events = this.db.auditLogs.slice().reverse();
    if (pageValue === undefined) return { success: true, data: events.slice(0, 200) };
    const page = Number(pageValue);
    if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000) {
      throw new BadRequestException('Page must be a positive integer.');
    }
    const search = typeof searchValue === 'string' ? searchValue.trim().slice(0, 150).toLowerCase() : '';
    const users = new Map(this.db.users.map(u => [u.id, u]));
    const named = (event: any) => {
      const actor = users.get(event.actorId);
      return { ...event, actorName: event.actorName || (actor ? `${actor.firstName} ${actor.lastName}` : event.actorId) };
    };
    const filtered = search ? events.filter(event => {
      const entry = named(event);
      return [entry.action.replaceAll('_', ' '), entry.action, entry.actorName, entry.actorId, entry.createdAt,
        JSON.stringify(entry.details)].some(value => String(value).toLowerCase().includes(search));
    }) : events;
    const offset = (page - 1) * 50;
    return { success: true, data: { events: filtered.slice(offset, offset + 50).map(named), total: filtered.length } };
  }

  private canReview(actor: { role: string; adminTeam?: string }, role: string) {
    return actor.role === 'superuser' || (role === 'learner' &&
      actor.role === 'admin' && actor.adminTeam === 'USER_ADMIN');
  }

  @Get('pending-approvals')
  @Roles('superuser', 'admin')
  @ApiOperation({ summary: 'List pending account requests visible to the reviewer' })
  pendingApprovals(@Req() req: any) {
    if (!this.canReview(req.user, 'learner')) throw new ForbiddenException('User Admin or Super Admin required.');
    const pending = this.db.users
      .filter(u => u.status === 'pending' && u.role !== 'superuser' && this.canReview(req.user, u.role))
      .map(u => this.db.safeUser(u));
    return { success: true, data: pending };
  }

  @Post('approvals/:userId/approve')
  @Roles('superuser', 'admin')
  @ApiOperation({ summary: 'Approve a pending account request. Admin requests keep their selected division.' })
  approve(@Param('userId') userId: string, @Req() req: any) {
    const user = this.db.getUser(userId);
    if (!user) throw new NotFoundException('Pending account request not found.');
    if (user.role === 'superuser') throw new BadRequestException('The protected Super Admin account is not part of the approval workflow.');
    if (!this.canReview(req.user, user.role)) throw new ForbiddenException('You cannot review this account request.');
    if (user.status !== 'pending') throw new BadRequestException('This account request is no longer pending.');
    if (user.role === 'admin' && !['USER_ADMIN', 'PAYMENT_ADMIN'].includes(String(user.adminTeam || ''))) {
      throw new BadRequestException('Admin request does not have a valid division.');
    }
    user.status = 'active';
    const now = new Date().toISOString();
    user.approvedAt = now;
    this.db.notifications.push({ id: this.db.id('n'), userId: user.id, message: `Your ${user.role === 'admin' ? (user.adminTeam === 'PAYMENT_ADMIN' ? 'Payment Admin' : 'User Admin') : user.role} account has been approved and is ready to use.`, type: 'success', read: false, createdAt: now });
    this.db.audit('ACCOUNT_APPROVED', req.user.id, { targetUserId: user.id, role: user.role, adminTeam: user.adminTeam || null });
    return { success: true, data: this.db.safeUser(user) };
  }

  @Post('approvals/:userId/reject')
  @Roles('superuser', 'admin')
  @ApiOperation({ summary: 'Reject a pending account request' })
  reject(@Param('userId') userId: string, @Body() body: RejectionRemarkDto, @Req() req: any) {
    const idx = this.db.users.findIndex(u => u.id === userId);
    if (idx < 0) throw new NotFoundException('Pending account request not found.');
    const user = this.db.users[idx];
    if (user.role === 'superuser') throw new BadRequestException('The protected Super Admin account cannot be rejected or removed.');
    if (!this.canReview(req.user, user.role)) throw new ForbiddenException('You cannot review this account request.');
    if (user.status !== 'pending') throw new BadRequestException('This account request is no longer pending.');
    if (user.role === 'learner') user.status = 'rejected';
    else this.db.users.splice(idx, 1);
    this.db.audit('ACCOUNT_REJECTED', req.user.id, { remark: body.remark, targetUserId: user.id, email: user.email, role: user.role, adminTeam: user.adminTeam || null });
    return { success: true, data: { id: userId, email: user.email, role: user.role, adminTeam: user.adminTeam || null } };
  }

  @Post('reset-demo-data')
  @Roles('superuser')
  @ApiOperation({ summary: 'Reset demo data by restarting in-memory seed' })
  reset() {
    this.db.onModuleInit();
    return { success: true, message: 'Demo data reset' };
  }
}
