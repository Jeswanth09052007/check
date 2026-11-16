import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DAY_MS, HOUR_MS, validateCalendarDate } from '../../common/form-validation';
import { DataStore } from '../../store/data.store';
import { CreateSessionDto, UpdateSessionDto } from './dto';

function sessionStart(date: string, time: string) {
  validateCalendarDate(date, 'Session date');
  return Date.parse(`${date}T${time}:00+05:30`);
}

function checkStart(date: string, time: string) {
  const start = sessionStart(date, time);
  const now = Date.now();
  if (!Number.isFinite(start) || start < now + HOUR_MS || start > now + 365 * DAY_MS) {
    throw new BadRequestException('Session must start at least one hour from now and within 365 days (IST).');
  }
}

@Injectable()
export class SessionsService {
  constructor(private readonly db: DataStore) {}

  findAll(actor: { id: string; role: string }) {
    if (['superuser', 'admin'].includes(actor.role)) return this.db.sessions;
    if (actor.role === 'instructor') return this.db.sessions.filter(s => s.instructorId === actor.id);
    if (actor.role === 'learner') return this.findByLearner(actor.id);
    return [];
  }

  findOne(id: string, actor: { id: string; role: string }) {
    const row = this.findAll(actor).find(s => s.id === id);
    if (!row) throw new NotFoundException('Session not found.');
    return row;
  }

  findByLearner(learnerId: string) {
    return this.db.sessions.filter(s =>
      !['pending', 'rejected'].includes(s.approvalStatus) && (s.studentIds || []).includes(learnerId),
    ).map(({ approvalRemark, ...session }) => ({ ...session, studentIds: [learnerId] }));
  }

  create(body: CreateSessionDto, actor: { id: string; role: string }) {
    checkStart(body.date, body.time);
    this.checkParticipants(body.instructorId, body.studentIds);
    const needsApproval = actor.role !== 'instructor';
    const row = {
      id: this.db.id('s'), ...body, createdBy: actor.id, createdAt: new Date().toISOString(),
      status: needsApproval ? 'pending' : body.status || 'scheduled',
      approvalStatus: needsApproval ? 'pending' : undefined,
      approvalRevision: needsApproval ? this.db.id('sr') : undefined,
    };
    this.db.sessions.push(row);
    this.db.audit(needsApproval ? 'SESSION_ASSIGNED' : 'SESSION_SCHEDULED', actor.id, this.details(row));
    if (needsApproval) {
      this.notify(row.instructorId, `Session "${row.title}" was assigned to you. Accept or reject it in Sessions.`);
      this.notify(actor.id, `Session "${row.title}" was assigned and is awaiting instructor approval.`);
    }
    return row;
  }

  update(id: string, body: UpdateSessionDto, actor: { id: string; role: string }) {
    const row = this.findOne(id, actor);
    this.checkEditor(row, actor);
    const instructorId = body.instructorId ?? row.instructorId;
    const date = body.date ?? row.date;
    const time = body.time ?? row.time;
    const changedSchedule = date !== row.date || time !== row.time || instructorId !== row.instructorId ||
      (body.duration !== undefined && body.duration !== (row.duration ?? 60));
    const needsApproval = changedSchedule && (Boolean(row.approvalStatus) || instructorId !== row.instructorId);
    if (changedSchedule) checkStart(date, time);
    if (instructorId !== row.instructorId || body.studentIds !== undefined) {
      this.checkParticipants(instructorId, body.studentIds ?? row.studentIds);
    }
    if (body.status !== undefined && (needsApproval ||
        (row.approvalStatus && (row.approvalStatus !== 'accepted' || !['scheduled', 'active', 'completed', 'cancelled'].includes(body.status))))) {
      throw new BadRequestException('Use the instructor decision to change session approval.');
    }
    const previousInstructorId = row.instructorId;
    Object.assign(row, body);
    if (needsApproval) {
      Object.assign(row, { status: 'pending', approvalStatus: 'pending', createdBy: row.createdBy || actor.id, approvalRevision: this.db.id('sr'), approvalRemark: undefined, decidedAt: undefined });
      if (previousInstructorId !== instructorId) {
        this.notify(previousInstructorId, `Session "${row.title}" was reassigned to another instructor.`);
      }
      this.notify(instructorId, `Session "${row.title}" was updated. Accept or reject the updated schedule in Sessions.`);
      this.notify(row.createdBy, `Session "${row.title}" is awaiting instructor approval for the updated schedule.`);
    }
    this.db.audit(needsApproval ? 'SESSION_REASSIGNED' : 'SESSION_UPDATED', actor.id, this.details(row));
    return row;
  }

  decide(id: string, instructorId: string, decision: 'accepted' | 'rejected', remark?: string, expectedRevision?: string) {
    const row = this.findOne(id, { id: instructorId, role: 'instructor' });
    if (row.approvalStatus !== 'pending') throw new ConflictException('This session has no pending decision.');
    if (expectedRevision && row.approvalRevision !== expectedRevision) {
      throw new ConflictException('The session schedule changed. Refresh the session and review it again.');
    }
    if (decision === 'accepted' && sessionStart(row.date, row.time) <= Date.now()) {
      throw new ConflictException('This session has already started. Ask the organizer to reschedule it.');
    }
    Object.assign(row, {
      status: decision === 'accepted' ? 'scheduled' : 'rejected',
      approvalStatus: decision,
      approvalRemark: remark,
      decidedAt: new Date().toISOString(),
    });
    this.db.audit(decision === 'accepted' ? 'SESSION_ACCEPTED' : 'SESSION_REJECTED', instructorId, {
      ...this.details(row), remark,
    });
    const message = `Session "${row.title}" was ${decision}.${remark ? ' Remark: ' + remark : ''}`;
    this.notify(instructorId, message);
    this.notify(row.createdBy, message);
    return row;
  }

  remove(id: string, actor: { id: string; role: string }) {
    const row = this.findOne(id, actor);
    this.checkEditor(row, actor);
    this.db.sessions.splice(this.db.sessions.indexOf(row), 1);
    this.db.audit('SESSION_REMOVED', actor.id, this.details(row));
    if (row.approvalStatus) {
      this.notify(row.instructorId, `Session "${row.title}" was removed.`);
      if (row.createdBy !== actor.id) this.notify(row.createdBy, `Session "${row.title}" was removed.`);
    }
    return { id };
  }

  private checkEditor(row: any, actor: { role: string }) {
    if (actor.role === 'instructor' && row.approvalStatus) {
      throw new ForbiddenException('Only an administrator can edit or remove an assigned session.');
    }
  }

  private checkParticipants(instructorId: string, studentIds: string[] = []) {
    const instructor = this.db.getUser(instructorId);
    if (!instructor || instructor.role !== 'instructor' || instructor.status !== 'active') {
      throw new BadRequestException('Select an active instructor.');
    }
    for (const id of studentIds) {
      const learner = this.db.getUser(id);
      if (!learner || learner.role !== 'learner' || learner.status !== 'active' || learner.instructorId !== instructorId) {
        throw new BadRequestException('Session learners must be active and assigned to the selected instructor.');
      }
    }
  }

  private details(row: any) {
    return { sessionId: row.id, title: row.title, instructorId: row.instructorId, creatorId: row.createdBy,
      date: row.date, time: row.time, status: row.status };
  }

  private notify(userId: string, message: string) {
    if (this.db.getUser(userId)) {
      this.db.notifications.push({ id: this.db.id('n'), userId, message, read: false, type: 'info', createdAt: new Date().toISOString() });
    }
  }
}
