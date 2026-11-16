import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataStore, User } from './data.store';

@Injectable()
export class MappingService {
  constructor(private readonly db: DataStore) {}
  isAdmin(u: User) { return u?.role === 'superuser' || (u?.role === 'admin' && u.adminTeam === 'USER_ADMIN'); }
  private person(id: string, role: string) {
    const u = this.db.getUser(id);
    if (!u || u.role !== role || u.status !== 'active') throw new BadRequestException(`Active ${role} account required.`);
    return u;
  }
  private name(u: User) { return `${u.firstName} ${u.lastName}`; }
  private notify(userId: string, message: string, request?: any) {
    this.db.notifications.unshift({ id: this.db.id('n'), userId, message, type: 'info', read: false, createdAt: new Date().toISOString(), ...(request ? { mappingRequestId: request.id } : {}) });
  }
  private notifyAdmins(message: string, request?: any) { for (const u of this.db.users.filter(u => this.isAdmin(u) && u.status === 'active')) this.notify(u.id, message, request); }
  list(actor: User) {
    return this.db.mappingRequests.filter(r => this.isAdmin(actor) || (actor.role === 'instructor' && r.instructorId === actor.id)).map(r => ({ ...r, learnerName: this.db.getUser(r.learnerId) ? this.name(this.db.getUser(r.learnerId)!) : 'Deleted student', instructorName: this.db.getUser(r.instructorId) ? this.name(this.db.getUser(r.instructorId)!) : 'Deleted instructor' }));
  }
  assign(learnerId: string, instructorId: string, actor: User) {
    if (!this.isAdmin(actor)) throw new ForbiddenException('User Admin or Super Admin access required.');
    const learner = this.person(learnerId, 'learner'), instructor = this.person(instructorId, 'instructor');
    if (learner.instructorId === instructorId) throw new ConflictException('Student is already assigned to this instructor.');
    return this.create('ASSIGN', learner, instructor, actor);
  }
  guidance(actor: User) {
    const learner = this.person(actor.id, 'learner');
    const eligible = this.db.hasPro(learner.id);
    const requests = this.db.mappingRequests.filter(r => r.learnerId === learner.id && r.kind === 'ASSIGN');
    const active = learner.instructorId ? this.db.getUser(learner.instructorId) : undefined;
    return {
      eligible,
      instructor: active?.status === 'active' ? { id: active.id, name: this.name(active) } : null,
      pending: requests.some(r => r.status === 'PENDING'),
      latestRequest: requests[0] ? {
        status: requests[0].status,
        instructorName: this.db.getUser(requests[0].instructorId)
          ? this.name(this.db.getUser(requests[0].instructorId)!)
          : 'Previous instructor',
      } : null,
      instructors: eligible ? this.db.users
        .filter(u => u.role === 'instructor' && u.status === 'active')
        .map(u => ({ id: u.id, name: this.name(u), expertise: u.expertise || '' })) : [],
    };
  }
  requestInstructor(instructorId: string, actor: User) {
    const learner = this.person(actor.id, 'learner');
    if (!this.db.hasPro(learner.id)) throw new ForbiddenException('An active Pro plan is required to request an instructor.');
    const instructor = this.person(instructorId, 'instructor');
    if (learner.instructorId === instructor.id) throw new ConflictException('This instructor is already assigned to you.');
    return this.create('ASSIGN', learner, instructor, actor);
  }
  requestRemoval(learnerId: string, actor: User) {
    if (actor.role !== 'instructor') throw new ForbiddenException('Instructor access required.');
    const learner = this.person(learnerId, 'learner');
    if (learner.instructorId !== actor.id) throw new ForbiddenException('You can only request removal of your own students.');
    return this.create('REMOVE', learner, actor, actor);
  }
  private create(kind: string, learner: User, instructor: User, actor: User) {
    if (this.db.mappingRequests.some(r => r.learnerId === learner.id && r.status === 'PENDING')) throw new ConflictException('This student already has a pending mapping request.');
    const r = { id: this.db.id('map'), kind, learnerId: learner.id, instructorId: instructor.id, previousInstructorId: learner.instructorId || null, status: 'PENDING', requestedBy: actor.id, createdAt: new Date().toISOString() };
    this.db.mappingRequests.unshift(r);
    if (kind === 'ASSIGN') this.notify(instructor.id, `Please accept or decline the assignment of ${this.name(learner)} to your class.`, r);
    else this.notifyAdmins(`${this.name(instructor)} requests removal of ${this.name(learner)}. Please approve or reject.`, r);
    this.db.audit('MAPPING_REQUESTED', actor.id, r);
    return r;
  }
  decide(id: string, decision: string, actor: User) {
    const r = this.db.mappingRequests.find(r => r.id === id);
    if (!r) throw new NotFoundException('Mapping request not found.');
    if (r.kind === 'ASSIGN' ? actor.role !== 'instructor' || actor.id !== r.instructorId : !this.isAdmin(actor)) throw new ForbiddenException('You cannot decide this request.');
    if (r.status !== 'PENDING') throw new ConflictException('This request has already been resolved.');
    if (!['accept', 'reject'].includes(decision)) throw new BadRequestException('Choose accept or reject.');
    const learner = this.person(r.learnerId, 'learner'), instructor = this.person(r.instructorId, 'instructor');
    if ((learner.instructorId || null) !== r.previousInstructorId) throw new ConflictException('The mapping changed; this request is stale.');
    if (decision === 'accept' && r.kind === 'ASSIGN' && r.requestedBy === learner.id && !this.db.hasPro(learner.id)) {
      throw new ConflictException('The learner needs an active Pro plan to accept this request.');
    }
    if (decision === 'accept') {
      if (learner.instructorId) {
        const old = this.db.getUser(learner.instructorId);
        if (old) old.studentIds = (old.studentIds || []).filter(id => id !== learner.id);
      }
      if (r.kind === 'ASSIGN') {
        learner.instructorId = instructor.id;
        instructor.studentIds = [...new Set([...(instructor.studentIds || []), learner.id])];
        this.notify(learner.id, `You have been assigned to ${this.name(instructor)}.`, r);
        this.notify(instructor.id, `${this.name(learner)} is now assigned to your class.`, r);
        this.notifyAdmins(`${this.name(instructor)} accepted ${this.name(learner)}. Mapping completed.`, r);
        if (r.previousInstructorId && r.previousInstructorId !== instructor.id) this.notify(r.previousInstructorId, `${this.name(learner)} has been reassigned to ${this.name(instructor)}.`, r);
      } else {
        delete learner.instructorId;
        this.notify(learner.id, `Admin approved your removal from ${this.name(instructor)}'s class. You are awaiting a new instructor.`, r);
        this.notify(instructor.id, `Admin approved removal of ${this.name(learner)} from your class.`, r);
      }
    } else {
      if (r.kind === 'ASSIGN' && r.requestedBy === learner.id) {
        this.notify(learner.id, `${this.name(instructor)} declined your request. You can choose another instructor.`, r);
      }
      this.notifyAdmins(`${this.name(learner)}: ${r.kind === 'ASSIGN' ? 'instructor declined the assignment' : 'removal request rejected'}.`, r);
      this.notify(instructor.id, `${this.name(learner)}: ${r.kind === 'ASSIGN' ? 'assignment declined' : 'admin rejected removal; student remains in your class'}.`, r);
    }
    r.status = decision === 'accept' ? 'ACCEPTED' : 'REJECTED';
    r.decidedBy = actor.id;
    r.decidedAt = new Date().toISOString();
    this.db.audit('MAPPING_DECIDED', actor.id, r);
    return r;
  }
  unmapped() { return this.db.users.filter(u => u.role === 'learner' && u.status === 'active' && !this.db.users.some(i => i.id === u.instructorId && i.role === 'instructor' && i.status === 'active')); }
}
