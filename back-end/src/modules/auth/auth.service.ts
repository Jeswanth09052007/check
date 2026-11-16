import { createOtpEngine } from './otp-engine';
import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { DataStore, User } from '../../store/data.store';
import { normalizeRole } from '../../common/roles.decorator';
import { hashPassword, verifyPassword } from '../../common/password.util';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto';
import { LoginDto } from './dto';
import { deliverOtp, otpDelivery } from './otp-mail';
import { JwtTokenService } from './jwt-token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DataStore,
    private readonly usersService: UsersService,
    private readonly tokens: JwtTokenService,
  ) {}

  private challenges = new Map<string, any>();
  // The permissive path is exclusively for the pre-existing isolated test suite.
  private readonly demoOtp = process.env.NODE_ENV === 'test' && process.env.OTP_DELIVERY_MODE === 'demo';
  private readonly otpEngine = createOtpEngine({ send: deliverOtp });

  private async challenge(purpose: string, data: any, email: string) {
    for(const [id,c] of this.challenges) if(c.expiresAt <= Date.now()) this.challenges.delete(id);
    const client = purpose + ':' + email.toLowerCase().trim();
    let sent: {challengeId:string;expiresIn:number};
    try {
      sent = this.demoOtp ? {challengeId:randomBytes(32).toString('hex'),expiresIn:300} : await this.otpEngine.request(email, client, purpose !== 'reset' || Boolean(data.userId));
    } catch(e) { throw new BadRequestException(e.message || 'Verification email could not be sent. Try again.'); }
    // Only a successful send replaces an earlier challenge.
    for(const [id,c] of this.challenges) if(c.client===client) this.challenges.delete(id);
    this.challenges.set(sent.challengeId,{purpose,data,email,client,expiresAt:Date.now()+sent.expiresIn*1000});
    return {otpRequired:true,...sent,demoOtp:this.demoOtp,delivery:this.demoOtp ? 'test' : otpDelivery(email),resendAfter:30};
  }
  async resendOtp(challengeId: string) {
    const c=this.challenges.get(challengeId);
    if(!c || c.expiresAt<=Date.now()) throw new BadRequestException('Request a new OTP from the sign-in or registration page.');
    return this.challenge(c.purpose,c.data,c.email);
  }
  private consume(challengeId: string, otp: string, purpose: string) {
    if(typeof otp !== 'string' || !/^[0-9]{6}$/.test(otp)) throw new BadRequestException('OTP must contain exactly six digits.');
    const c=this.challenges.get(challengeId);
    if(!c || c.purpose!==purpose || c.expiresAt<=Date.now()) throw new UnauthorizedException('OTP request expired. Please start again.');
    if(!this.demoOtp) {
      try { this.otpEngine.verify(challengeId,otp,c.client); }
      catch(e) { throw new BadRequestException(e.message); }
    }
    this.challenges.delete(challengeId);
    return c.data;
  }
  verifyOtp(dto: {challengeId:string;otp:string}) {
    const c=this.challenges.get(dto.challengeId);
    if(c?.purpose==='register') {
      const data=this.consume(dto.challengeId,dto.otp,'register');
      return this.completeRegistration(data);
    }
    const {userId}=this.consume(dto.challengeId,dto.otp,'login');
    const user=this.db.getUser(userId);
    if(!user || user.status!=='active') throw new UnauthorizedException('Account is not active.');
    return this.createAuthenticatedSession(user);
  }
  forgotPassword(email: string) {
    const user=this.db.findUserByEmail(email);
    return this.challenge('reset',{userId:user?.id},email);
  }
  resetPassword(dto: {challengeId:string;otp:string;password:string;confirmPassword:string}) {
    if(dto.password!==dto.confirmPassword) throw new BadRequestException('Passwords must match.');
    const {userId}=this.consume(dto.challengeId,dto.otp,'reset');
    const user=this.db.getUser(userId);
    if(!user) throw new BadRequestException('Unable to reset this account. Check the registered email.');
    user.password=hashPassword(dto.password);
    for(const [id,c] of this.challenges)if(c.data?.userId===user.id)this.challenges.delete(id);
    for(const s of this.db.refreshSessions) if(s.userId===user.id && !s.revokedAt){s.revokedAt=new Date().toISOString();s.revokedReason='PASSWORD_RESET';}
    this.db.audit('PASSWORD_RESET',user.id,{otpDelivery:this.demoOtp ? 'test' : otpDelivery(user.email)});
    return {reset:true};
  }
  login(dto: LoginDto) {
    const user = this.verifyCredentials(dto);
    return this.challenge('login', { userId: user.id }, user.email);
  }

  loginWithPassword(dto: LoginDto) {
    return this.createAuthenticatedSession(this.verifyCredentials(dto));
  }

  private verifyCredentials(dto: LoginDto) {
    const user = this.db.findUserByEmail(dto.email);
    if (!user || !verifyPassword(dto.password, user.password)) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (user.status === 'pending') throw new UnauthorizedException(user.role === 'learner'
      ? 'Your application is awaiting approval. Trading opens after a User Admin approves it.'
      : 'Account is pending Super Admin approval.');
    if (user.status !== 'active') throw new UnauthorizedException('Account is not active.');

    const requestedRole = normalizeRole(dto.role);
    if (requestedRole && requestedRole !== user.role) {
      throw new BadRequestException(`These credentials belong to a '${user.role}' account. Select the correct role.`);
    }

    return user;
  }

  register(dto: CreateUserDto) {
    if(this.db.findUserByEmail(dto.email)) throw new BadRequestException('Email already registered.');
    this.usersService.validateCreate(dto, true);
    return this.challenge('register',dto,dto.email);
  }

  private completeRegistration(dto: CreateUserDto) {
    const user = this.usersService.create(dto, true) as User;
    const reviewerRole = user.role === 'learner' ? 'User Admin' : 'Super Admin';
    const now = new Date().toISOString();
    for (const reviewer of this.db.users) {
      if (reviewer.status !== 'active') continue;
      if (reviewer.role !== 'superuser' && !(user.role === 'learner' &&
        reviewer.role === 'admin' && reviewer.adminTeam === 'USER_ADMIN')) continue;
      this.db.notifications.push({
        id: this.db.id('n'), userId: reviewer.id, type: 'info', read: false, createdAt: now,
        title: 'Account awaiting approval',
        message: `${user.firstName} ${user.lastName} applied for a ${user.role} account.`,
      });
    }
    return { user, pendingApproval: true, reviewerRole };
  }

  refresh(refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException('Refresh token cookie is missing. Please sign in again.');
    const payload = this.tokens.verifyRefresh(refreshToken);
    const session = this.db.refreshSessions.find((s:any) => s.jti === payload.jti && s.userId === payload.sub);
    if (!session || session.revokedAt) throw new UnauthorizedException('Refresh session is no longer valid.');
    if (new Date(session.expiresAt).getTime() <= Date.now()) throw new UnauthorizedException('Refresh session has expired.');
    if (session.tokenHash !== this.hashToken(refreshToken)) throw new UnauthorizedException('Refresh token does not match the active session.');

    const user = this.db.getUser(payload.sub);
    if (!user || user.status !== 'active') throw new UnauthorizedException('Account is not active.');
    if (user.role !== payload.role || (user.adminTeam || '') !== (payload.adminTeam || '')) {
      throw new UnauthorizedException('Account permissions changed. Please sign in again.');
    }

    session.revokedAt = new Date().toISOString();
    session.revokedReason = 'ROTATED';
    return this.createAuthenticatedSession(user, payload.jti);
  }

  logout(refreshToken?: string, userId?: string) {
    let revoked = 0;
    if (refreshToken) {
      try {
        const payload = this.tokens.verifyRefresh(refreshToken);
        for (const session of this.db.refreshSessions) {
          if (session.jti === payload.jti && !session.revokedAt) {
            session.revokedAt = new Date().toISOString();
            session.revokedReason = 'LOGOUT';
            revoked++;
          }
        }
      } catch {
        // Logout is idempotent: an expired/invalid refresh cookie can still be cleared.
      }
    }
    if (!refreshToken && userId) {
      for (const session of this.db.refreshSessions) {
        if (session.userId === userId && !session.revokedAt) {
          session.revokedAt = new Date().toISOString();
          session.revokedReason = 'LOGOUT_ALL';
          revoked++;
        }
      }
    }
    if (userId) this.db.audit('USER_LOGOUT', userId, { revokedRefreshSessions: revoked });
    return { loggedOut: true, revokedRefreshSessions: revoked };
  }

  private accountProfile(user: User) {
    if (user.role !== 'learner') return this.db.safeUser(user);
    const learningAccess = this.db.hasLearningAccess(user.id);
    return { ...this.db.safeUser(user), learningAccess };
  }

  me(userId: string) {
    const user = this.db.getUser(userId);
    if (!user) throw new BadRequestException('User not found.');
    return this.accountProfile(user);
  }

  meAs(requesterId: string, targetId?: string) {
    const requester = this.db.getUser(requesterId);
    if (!requester || requester.status !== 'active') throw new UnauthorizedException('Authenticated user is not active.');
    if (!targetId || targetId === requesterId) return this.accountProfile(requester);
    if (!['superuser', 'admin', 'instructor'].includes(requester.role)) {
      throw new ForbiddenException('You can only view your own authenticated profile.');
    }
    return this.me(targetId);
  }

  private createAuthenticatedSession(user: User, rotatedFromJti?: string) {
    const pair = this.tokens.issueTokenPair(user);
    this.db.refreshSessions.push({
      id: this.db.id('refresh'),
      userId: user.id,
      jti: pair.refreshPayload.jti,
      tokenHash: this.hashToken(pair.refreshToken),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(pair.refreshPayload.exp * 1000).toISOString(),
      rotatedFromJti: rotatedFromJti || null,
      revokedAt: null,
    });
    this.cleanupRefreshSessions(user.id);
    this.db.audit('JWT_SESSION_ISSUED', user.id, {
      accessJti: pair.accessPayload.jti,
      refreshJti: pair.refreshPayload.jti,
      accessExpiresAt: new Date(pair.accessPayload.exp * 1000).toISOString(),
    });
    return {
      user: this.accountProfile(user),
      session: {
        userId: user.id,
        role: user.role,
        adminTeam: user.adminTeam || null,
        email: user.email,
        loginAt: new Date().toISOString(),
      },
      accessToken: pair.accessToken,
      accessTokenExpiresIn: pair.accessExpiresIn,
      refreshToken: pair.refreshToken,
      refreshTokenExpiresIn: pair.refreshExpiresIn,
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private cleanupRefreshSessions(userId: string) {
    const now = Date.now();
    this.db.refreshSessions = this.db.refreshSessions.filter((s:any) => {
      if (s.userId !== userId) return true;
      const expired = new Date(s.expiresAt).getTime() <= now;
      const oldRevoked = s.revokedAt && now - new Date(s.revokedAt).getTime() > 24 * 60 * 60 * 1000;
      return !expired && !oldRevoked;
    });
  }
}
