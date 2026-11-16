import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DAY_MS, todayInIndia, validateCalendarDate } from '../../common/form-validation';
import { DataStore } from '../../store/data.store';
import { CreateAssignmentDto, SubmitAssignmentDto, UpdateAssignmentDto } from './dto';

function checkDueDate(date: string) {
  const deadline = validateCalendarDate(date, 'Due date');
  const today = Date.parse(todayInIndia() + 'T00:00:00Z');
  if (deadline < today || deadline > today + 365 * DAY_MS) {
    throw new BadRequestException('Due date must be today or within the next 365 days (IST).');
  }
}

type Actor = { id: string; role: string };

@Injectable()
export class AssignmentsService {
  constructor(private readonly db: DataStore) {}

  findAll(actor: Actor) {
    if (actor.role === 'learner') return this.findByLearner(actor.id);
    if (actor.role === 'instructor') return this.db.assignments.filter(a => a.instructorId === actor.id);
    if (actor.role === 'provider') return this.db.assignments.filter(a => a.providerId === actor.id);
    return this.db.assignments;
  }

  findOne(id: string, actor: Actor) {
    const row = this.findAll(actor).find(a => a.id === id);
    if (!row) throw new NotFoundException('Assignment not found.');
    return row;
  }

  findByLearner(learnerId: string) {
    return this.db.assignments.filter(a => this.isAssigned(a, learnerId)).map(a => this.presentForLearner(a, learnerId));
  }

  create(body: CreateAssignmentDto, actor: Actor) {
    checkDueDate(body.dueDate);
    const studentIds = this.checkParticipants(body, actor);
    const row = {
      id: this.db.id('a'), completedIds: [], status: 'active', ...body, studentIds,
      createdAt: new Date().toISOString(),
    };
    this.db.assignments.push(row);
    this.db.audit('ASSIGNMENT_CREATED', actor.id, { assignmentId: row.id, title: row.title });
    return row;
  }

  update(id: string, body: UpdateAssignmentDto, actor: Actor) {
    const row = this.findOne(id, actor);
    const updated = { ...row, ...body };
    if (updated.dueDate !== row.dueDate) checkDueDate(updated.dueDate);
    if (updated.courseId !== row.courseId || updated.providerId !== row.providerId ||
        updated.instructorId !== row.instructorId || body.studentIds !== undefined) {
      if ((row.submissions || []).length &&
          (updated.courseId !== row.courseId || updated.providerId !== row.providerId || updated.instructorId !== row.instructorId ||
          (row.submissions || []).some(s => !updated.courseId && !updated.studentIds?.includes(s.learnerId)))) {
        throw new ConflictException('An assignment with submissions cannot be moved to a different owner, course, or learner group.');
      }
      updated.studentIds = this.checkParticipants(updated, actor);
    }
    Object.assign(row, updated);
    this.db.audit('ASSIGNMENT_UPDATED', actor.id, { assignmentId: id, title: row.title });
    return row;
  }

  submit(id: string, body: SubmitAssignmentDto, actor: Actor) {
    const row = this.db.assignments.find(a => a.id === id);
    if (!row || !this.isAssigned(row, body.learnerId)) throw new NotFoundException('Assignment not found for this learner.');
    if ((row.completedIds || []).includes(body.learnerId)) throw new ConflictException('This assignment was already approved.');
    const previous = (row.submissions || []).find(s => s.learnerId === body.learnerId);
    if (previous && previous.status !== 'rejected') throw new ConflictException('Assignment already submitted by this learner.');
    const submission = { ...body, submittedAt: new Date().toISOString(), status: 'pending' };
    row.submissions = [...(row.submissions || []).filter(s => s.learnerId !== body.learnerId), submission];
    this.db.audit(previous ? 'ASSIGNMENT_RESUBMITTED' : 'ASSIGNMENT_SUBMITTED', actor.id, {
      assignmentId: id, learnerId: body.learnerId,
    });
    return this.presentForLearner(row, body.learnerId);
  }

  review(id: string, learnerId: string, actor: Actor, decision: 'approved' | 'rejected', remark?: string) {
    const row = this.findOne(id, actor);
    const learner = this.db.getUser(learnerId);
    if (!learner || learner.role !== 'learner') throw new NotFoundException('Learner not found.');
    if ((row.completedIds || []).includes(learnerId)) {
      if (decision === 'approved') return row;
      throw new ConflictException('This submission was already approved.');
    }
    const submission = (row.submissions || []).find(s => s.learnerId === learnerId);
    if (!submission) throw new BadRequestException('Learner must submit work before review.');
    if (submission.status === 'rejected') throw new ConflictException('This submission has already been rejected. Wait for the learner to resubmit.');
    Object.assign(submission, { status: decision, remark, reviewedBy: actor.id, reviewedAt: new Date().toISOString() });
    if (decision === 'approved') {
      row.completedIds = [...(row.completedIds || []), learnerId];
      learner.skillPoints = (learner.skillPoints || 0) + (row.skillPoints || 0);
    }
    this.db.notifications.push({
      id: this.db.id('n'), userId: learnerId, read: false, type: decision === 'approved' ? 'success' : 'info',
      message: `Your submission for "${row.title}" was ${decision}.${remark ? ' Remark: ' + remark : ''}`,
      createdAt: new Date().toISOString(),
    });
    this.db.audit(decision === 'approved' ? 'ASSIGNMENT_APPROVED' : 'ASSIGNMENT_REJECTED', actor.id, {
      assignmentId: id, title: row.title, learnerId, remark,
    });
    return row;
  }

  remove(id: string, actor: Actor) {
    const row = this.findOne(id, actor);
    this.db.assignments.splice(this.db.assignments.indexOf(row), 1);
    this.db.audit('ASSIGNMENT_REMOVED', actor.id, { assignmentId: id, title: row.title });
    return { id };
  }

  private presentForLearner(row: any, learnerId: string) {
    return {
      ...row,
      studentIds: (row.studentIds || []).filter(id => id === learnerId),
      submissions: (row.submissions || []).filter(submission => submission.learnerId === learnerId),
      completedIds: (row.completedIds || []).filter(id => id === learnerId),
    };
  }

  private isAssigned(row: any, learnerId: string) {
    return row.courseId ? this.db.enrollments.some(e => e.courseId === row.courseId && e.learnerId === learnerId) :
      (row.studentIds || []).includes(learnerId);
  }

  private checkParticipants(body: CreateAssignmentDto, actor: Actor) {
    if ((actor.role === 'provider' && body.providerId !== actor.id) ||
        (actor.role === 'instructor' && (body.instructorId !== actor.id || body.providerId))) {
      throw new ForbiddenException('You can manage assignments only for your own account.');
    }
    if (body.providerId) {
      const provider = this.db.getUser(body.providerId);
      const course = this.db.courses.find(c => c.id === body.courseId);
      if (body.instructorId || !provider || provider.role !== 'provider' || !course || course.providerId !== provider.id) {
        throw new BadRequestException('Select a course belonging to the provider.');
      }
      return this.db.enrollments.filter(e => e.courseId === course.id).map(e => e.learnerId);
    }
    const instructor = this.db.getUser(body.instructorId);
    if (body.courseId || !instructor || instructor.role !== 'instructor' || instructor.status !== 'active') {
      throw new BadRequestException('Select an active instructor.');
    }
    const students = body.studentIds || [];
    for (const id of students) {
      const learner = this.db.getUser(id);
      if (!learner || learner.role !== 'learner' || learner.status !== 'active' || learner.instructorId !== instructor.id) {
        throw new BadRequestException('Assignment learners must be active and assigned to the selected instructor.');
      }
    }
    return students;
  }
}
