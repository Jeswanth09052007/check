import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DataStore, User } from '../../store/data.store';
import { normalizeRole } from '../../common/roles.decorator';
import { CreateUserDto, UpdateUserDto } from './dto';
import { MappingService } from '../../store/mapping.service';
import { todayInIndia, validateCalendarDate } from '../../common/form-validation';
import { hashPassword } from '../../common/password.util';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { randomBytes } from 'node:crypto';
import { writeCsv } from '../institutes/csv';
import { mail } from '../../common/smtp';

function ageFromDate(dateString?: string) {
  if (!dateString) return null;
  const dob = new Date(validateCalendarDate(dateString, 'Date of birth'));
  if (!Number.isFinite(dob.getTime())) return null;
  const today = new Date(todayInIndia());
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const m = today.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

@Injectable()
export class UsersService {
  constructor(private readonly db: DataStore, private readonly mapping: MappingService) {}

  private actor(actorId?:string){ return actorId ? this.db.getUser(actorId) : null; }
  private enforceAdminUserScope(actorId?:string){
    const actor=this.actor(actorId);
    if(actor?.role==='admin' && actor.adminTeam!=='USER_ADMIN') throw new ForbiddenException('User management belongs to User Admin.');
    return actor;
  }

  findAll(actorId?:string){ this.enforceAdminUserScope(actorId); return this.db.users.map(u => this.db.safeUser(u)); }

  findByRole(role: string,actorId?:string) {
    this.enforceAdminUserScope(actorId);
    const normalized = normalizeRole(role);
    if (!normalized) throw new BadRequestException('Invalid role.');
    return this.db.users.filter(u => u.role === normalized).map(u => this.db.safeUser(u));
  }

  findOne(id:string){
    const user = this.db.getUser(id);
    if (!user) throw new NotFoundException('User not found.');
    return this.db.safeUser(user);
  }

  validateCreate(dto:CreateUserDto, publicRegistration = false, actorId?:string){
    const role = normalizeRole(dto.role);
    if (!role) throw new BadRequestException('Invalid role.');
    // IndAI has exactly one provisioned Super Admin. Runtime/public creation of another Super Admin is never allowed.
    if (role === 'superuser') throw new ForbiddenException('IndAI has a single protected Super Admin account. Another Super Admin cannot be created.');
    if (publicRegistration && !dto.phone) throw new BadRequestException('Phone number is required for public registration.');
    if (publicRegistration && !dto.dateOfBirth) throw new BadRequestException('Date of Birth is required for public registration.');
    if (!publicRegistration && role !== 'admin') {
      const actor=this.actor(actorId);
      if(!actor || !['superuser','admin'].includes(actor.role)) throw new ForbiddenException('User Admin or Super Admin access required to create users.');
      if(actor.role==='admin' && actor.adminTeam!=='USER_ADMIN') throw new ForbiddenException('User creation belongs to User Admin.');
    }
    const normalizedEmail = dto.email.toLowerCase().trim();
    if (this.db.findUserByEmail(normalizedEmail)) throw new ConflictException('Email already registered.');
    if (dto.confirmPassword !== undefined && dto.confirmPassword !== dto.password) {
      throw new BadRequestException('Passwords do not match.');
    }

    if (dto.dateOfBirth && ageFromDate(dto.dateOfBirth)! < 10) {
      throw new BadRequestException('You must be at least 10 years old.');
    }

    if (role === 'learner') {
      if (dto.institution && !dto.studentId) throw new BadRequestException('Student ID is required when an institution is provided.');
      if (dto.studentId && !dto.institution) throw new BadRequestException('Institution is required when a Student ID is provided.');
      if (dto.institution && dto.studentId) {
        const institution = dto.institution.trim().toLowerCase();
        const studentId = dto.studentId.trim().toLowerCase();
        const duplicateStudent = this.db.users.some(u => u.role === 'learner' && String((u as any).institution || '').trim().toLowerCase() === institution && String((u as any).studentId || '').trim().toLowerCase() === studentId);
        if (duplicateStudent) throw new ConflictException('Student ID already exists for this institution.');
      }
    }

    if (role === 'instructor') {
      if (!dto.institution) throw new BadRequestException('Institution / Organization is required for instructors.');
      if (!dto.expertise) throw new BadRequestException('Expertise / Specialization is required for instructors.');
      if (!dto.yearsExp && !(dto as any).yearsOfExperience) throw new BadRequestException('Years of experience is required for instructors.');
    }

    if (role === 'provider') {
      if (!dto.organization) throw new BadRequestException('Organization name is required for course providers.');
      if (publicRegistration && !dto.contentType) throw new BadRequestException('Content type is required for course providers.');
    }

    if (role === 'admin') {
      if (!dto.adminTeam || !['USER_ADMIN','PAYMENT_ADMIN'].includes(dto.adminTeam)) throw new BadRequestException('Choose USER_ADMIN or PAYMENT_ADMIN for the admin request.');
      if (publicRegistration) {
        const expectedCode = String(process.env.ADMIN_REGISTRATION_CODE || 'ADMIN2024').trim();
        if (!dto.authCode || String(dto.authCode).trim() !== expectedCode) {
          throw new ForbiddenException('Invalid Admin authorization code.');
        }
      } else {
        const actor=actorId?this.db.getUser(actorId):null;
        if (!actor || actor.role !== 'superuser') throw new ForbiddenException('Only Super Admin can directly create User Admin or Payment Admin accounts.');
      }
    }

    if (publicRegistration && (dto.instructorId || dto.studentIds?.length)) throw new ForbiddenException('Only an admin can request instructor mapping.');
    if (dto.studentIds?.length) throw new BadRequestException('Assign students individually through mapping requests.');
    if (dto.instructorId) {
      const instructor = this.db.getUser(dto.instructorId);
      if (!instructor || instructor.role !== 'instructor' || instructor.status !== 'active') throw new NotFoundException('Active instructor not found.');
    }

    return { role, normalizedEmail };
  }

  create(dto: CreateUserDto, publicRegistration = false, actorId?: string) {
    const { role, normalizedEmail } = this.validateCreate(dto, publicRegistration, actorId);
    const startingBalance = dto.startingBalance ?? (role === 'learner' ? 100000 : 0);
    const { confirmPassword, authCode: _authCode, role: _rawRole, status: _rawStatus, password: _rawPassword, firstName: _rawFirstName, lastName: _rawLastName, email: _rawEmail, ...profileDto } = dto as any;
    const user: User = {
      ...profileDto,
      id: this.db.id('u'),
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      email: normalizedEmail,
      password: hashPassword(dto.password),
      role,
      status: String(publicRegistration && ['instructor','provider','admin'].includes(role) ? 'pending' : (dto.status || (role === 'provider' ? 'pending' : 'active'))).toLowerCase(),
      skillPoints: Number(dto.skillPoints || 0),
      startingBalance,
      virtualBalance: dto.virtualBalance ?? startingBalance,
      portfolioValue: dto.portfolioValue ?? startingBalance,
      tradingLimit: dto.tradingLimit ?? (role === 'learner' ? Number(this.db.config.defaultTradingLimit||150000) : 0),
      instructorId: undefined,
      studentIds: role === 'instructor' ? [] : undefined,
      organization: dto.organization,
      expertise: dto.expertise,
      learnerLevel: (dto as any).experienceLevel || dto.tradingExperience || (dto as any).experience,
      providerVerified: role === 'provider' ? false : undefined,
      subscriptionTier: role === 'learner' ? 'FREE' : undefined,
      adminTeam: role === 'admin' ? dto.adminTeam : undefined,
      createdAt: new Date().toISOString(),
    };
    if (dto.instructorId && (role !== 'learner' || !this.mapping.isAdmin(this.actor(actorId)!))) throw new ForbiddenException('Only admins can request learner mapping.');
    if(dto.instructorId && user.status!=='active') throw new BadRequestException('Activate the learner before requesting an instructor.');
    this.db.users.push(user);
    if (dto.instructorId) this.mapping.assign(user.id, dto.instructorId, this.actor(actorId)!);
    this.db.audit('USER_CREATED',actorId||user.id,{targetUserId:user.id,role:user.role,adminTeam:user.adminTeam||null,publicRegistration});
    return this.db.safeUser(user);
  }

  update(id:string,dto:UpdateUserDto,actorId?:string){
    const user = this.db.getUser(id);
    if(!user) throw new NotFoundException('User not found.');
    if (this.deletions.has(id)) throw new ConflictException('Account deletion is already in progress.');
    const actor=actorId?this.db.getUser(actorId):null;
    if(actor?.role==='admin' && actor.adminTeam!=='USER_ADMIN') throw new ForbiddenException('User updates belong to User Admin.');
    if(user.role==='admin' && actor?.role!=='superuser') throw new ForbiddenException('Only Super Admin can modify admin-team accounts.');
    if(dto.adminTeam!==undefined && actor?.role!=='superuser') throw new ForbiddenException('Only Super Admin can change an admin division.');
    if(dto.providerVerified!==undefined && !actor) throw new ForbiddenException('User Admin or Super Admin identity is required for provider verification.');
    if(dto.providerVerified!==undefined && !(actor.role==='superuser' || (actor.role==='admin'&&actor.adminTeam==='USER_ADMIN'))) throw new ForbiddenException('Provider verification belongs to User Admin or Super Admin.');
    if(user.role==='provider' && dto.status==='active' && user.status!=='active' && actor?.role!=='superuser') throw new ForbiddenException('Super Admin must approve the provider account before activation.');
    if(user.role==='provider' && dto.providerVerified===true && user.status!=='active') throw new ForbiddenException('Provider account must be approved and active before verification.');
    if (dto.email) {
      const existing = this.db.findUserByEmail(dto.email);
      if (existing && existing.id !== id) throw new ConflictException('Email already registered.');
      dto.email = dto.email.toLowerCase().trim();
    }
    if (dto.instructorId) {
      const instructor = this.db.getUser(dto.instructorId);
      if (!instructor || instructor.role !== 'instructor' || instructor.status !== 'active') throw new NotFoundException('Active instructor not found.');
    }
    if(user.role==='learner'&&(dto.studentId!==undefined||(dto.institution!==undefined&&dto.institution!==user.institution))){
      const institution=(dto.institution??user.institution??'').trim().toLowerCase(),studentId=(dto.studentId??user.studentId??'').trim().toLowerCase();
      if(Boolean(institution)!==Boolean(studentId))throw new BadRequestException('Institution and Student ID must be provided together.');
      if(institution&&this.db.users.some(other=>other.id!==id&&other.role==='learner'&&String(other.institution||'').trim().toLowerCase()===institution&&String(other.studentId||'').trim().toLowerCase()===studentId))throw new ConflictException('Student ID already exists in this institution.');
    }
    if(dto.instructorId!==undefined && dto.instructorId!==user.instructorId && dto.status && dto.status!=='active') throw new BadRequestException('Activate the learner before requesting an instructor.');
    const {instructorId, ...profile} = dto;
    if(instructorId !== undefined && instructorId !== user.instructorId) this.mapping.assign(user.id, instructorId, actor!);
    Object.assign(user,profile);
    this.db.audit('USER_UPDATED',actorId,{targetUserId:id,fields:Object.keys(dto)});
    return this.db.safeUser(user);
  }

  requireLearnerImporter(actorId: string) {
    const actor = this.enforceAdminUserScope(actorId);
    if (!actor || !['superuser', 'admin'].includes(actor.role)) {
      throw new ForbiddenException('User Admin or Super Admin access required.');
    }
  }

  prepareLearnerImport(rows: unknown[], actorId: string) {
    this.requireLearnerImporter(actorId);
    const emails = new Set<string>();
    const students = new Set<string>();

    return rows.map((raw, index) => {
      const row = raw as Record<string, unknown>;
      const input = Object.fromEntries(['firstName', 'lastName', 'email', 'institution', 'studentId']
        .map(field => [field, row?.[field]]).filter(([, value]) => value !== undefined && value !== ''));
      const dto = plainToInstance(CreateUserDto, {
        ...input,
        role: 'learner',
        password: 'Ind@1' + randomBytes(16).toString('hex'),
      });
      try {
        const errors = validateSync(dto);
        if (errors.length) throw new BadRequestException(errors.flatMap(error => Object.values(error.constraints || {})).join(' '));
        const { normalizedEmail } = this.validateCreate(dto, false, actorId);
        if (emails.has(normalizedEmail)) throw new ConflictException('Email is repeated in this import.');
        emails.add(normalizedEmail);
        if (dto.institution && dto.studentId) {
          const key = JSON.stringify([dto.institution.toLowerCase(), dto.studentId.toLowerCase()]);
          if (students.has(key)) throw new ConflictException('Student ID is repeated for this institution.');
          students.add(key);
        }
        dto.email = normalizedEmail;
        return dto;
      } catch (error) {
        throw new BadRequestException(`Row ${index + 2}: ${error.message}`);
      }
    });
  }

  importLearners(rows: unknown[], actorId: string) {
    const accounts = this.prepareLearnerImport(rows, actorId);
    const originalUsers = this.db.users.length;
    const originalAudit = this.db.auditLogs.length;
    try {
      for (const account of accounts) this.create(account, false, actorId);
    } catch (error) {
      this.db.users.length = originalUsers;
      this.db.auditLogs.length = originalAudit;
      throw error;
    }
    return {
      count: accounts.length,
      csv: writeCsv([
        ['firstName', 'lastName', 'email', 'password'],
        ...accounts.map(account => [account.firstName, account.lastName, account.email, account.password]),
      ]),
    };
  }

  private readonly deletions = new Set<string>();

  async remove(id: string, reason: string, actorId?: string) {
    const target = this.db.getUser(id);
    const actor = this.actor(actorId);
    if (!target) throw new NotFoundException('User not found.');
    if(!actor || !['superuser','admin'].includes(actor.role)) throw new ForbiddenException('User Admin or Super Admin access required.');
    if(target.role==='superuser') throw new ForbiddenException('Super Admin cannot be deleted through this endpoint.');
    if(target.role==='admin' && actor.role!=='superuser') throw new ForbiddenException('Only Super Admin can delete admin-team accounts.');
    if(actor.role==='admin' && actor.adminTeam!=='USER_ADMIN') throw new ForbiddenException('User deletion belongs to User Admin.');
    if (!reason?.trim()) throw new BadRequestException('Enter a reason for deleting this account.');
    if (this.deletions.has(id)) throw new ConflictException('Account deletion is already in progress.');
    const email = target.email;
    this.deletions.add(id);
    try {
      let delivery;
      try {
        delivery = await mail(email, 'Your IndAI account removal notice',
          `Your IndAI account has been removed by an administrator.\n\nReason: ${reason}`);
      } catch (error) {
        if (error instanceof ServiceUnavailableException) throw error;
        throw new ServiceUnavailableException('The deletion email could not be sent. The account was kept.');
      }
      if (!delivery.accepted?.some((address: string) => address.toLowerCase() === email.toLowerCase())) {
        throw new ServiceUnavailableException('The email server did not accept the deletion notice. The account was kept.');
      }
      this.db.users = this.db.users.filter(user => user.id !== id);
      this.db.audit('USER_DELETED', actorId, { targetUserId: id, role: target.role, adminTeam: target.adminTeam || null, reason });
      return { id };
    } finally {
      this.deletions.delete(id);
    }
  }

  portfolio(id:string){
    const portfolio = this.db.refreshPortfolio(id);
    if (!portfolio) throw new NotFoundException('Learner not found.');
    return portfolio;
  }
}
