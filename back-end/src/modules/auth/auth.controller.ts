import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto';
import { ResendOtpDto, OtpDto, ForgotPasswordDto, ResetPasswordDto, LoginDto } from './dto';
import { Public } from '../../common/public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly refreshCookie = 'indai_refresh_token';

  constructor(private readonly service: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Validate credentials and email a six-digit OTP to the configured Formspree owner inbox. Verify OTP to receive tokens.' })
  @ApiBody({ type: LoginDto })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return { success: true, data: this.attachRefreshCookie(await this.service.login(dto), res) };
  }

  @Public()
  @Post('login/password')
  @ApiOperation({ summary: 'Sign in to an active account using email and password and receive an authenticated session.' })
  @ApiBody({ type: LoginDto })
  loginWithPassword(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return { success: true, data: this.attachRefreshCookie(this.service.loginWithPassword(dto), res) };
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Start registration OTP challenge. The account is created only after OTP verification.' })
  @ApiBody({ type: CreateUserDto })
  async register(@Body() dto: CreateUserDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.service.register(dto);
    return { success: true, data: this.attachRefreshCookie(result, res) };
  }

  @Public() @Post('verify-otp')
  verifyOtp(@Body() dto: OtpDto,@Res({passthrough:true}) res:Response){return {success:true,data:this.attachRefreshCookie(this.service.verifyOtp(dto),res)};}
  @Public() @Post('forgot-password')
  async forgot(@Body() dto:ForgotPasswordDto){return {success:true,data:await this.service.forgotPassword(dto.email)};}
  @Public() @Post('resend-otp')
  async resend(@Body() dto:ResendOtpDto){return {success:true,data:await this.service.resendOtp(dto.challengeId)};}
  @Public() @Post('reset-password')
  reset(@Body() dto:ResetPasswordDto){return {success:true,data:this.service.resetPassword(dto)};}

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate the HttpOnly refresh token and issue a fresh short-lived access JWT.' })
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = this.readCookie(req, this.refreshCookie);
    return { success: true, data: this.attachRefreshCookie(this.service.refresh(token), res) };
  }

  @Post('logout')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Revoke the current refresh session and clear the refresh cookie.' })
  logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const token = this.readCookie(req, this.refreshCookie);
    const result = this.service.logout(token, req.user?.id);
    res.clearCookie(this.refreshCookie, this.cookieOptions(0));
    return { success: true, data: result };
  }

  @Get('me')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get the authenticated JWT user profile.' })
  me(@Req() req: any) {
    return { success: true, data: this.service.meAs(req.user.id) };
  }

  @Get('me/:userId')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Compatibility profile route. Non-admin learners/providers can only read themselves.' })
  meById(@Req() req: any, @Param('userId') userId: string) {
    return { success: true, data: this.service.meAs(req.user.id, userId) };
  }

  private attachRefreshCookie(result: any, res: Response) {
    if (!result?.refreshToken) return result;
    const { refreshToken, refreshTokenExpiresIn, ...safe } = result;
    res.cookie(this.refreshCookie, refreshToken, this.cookieOptions(Number(refreshTokenExpiresIn || 0) * 1000));
    return safe;
  }

  private cookieOptions(maxAge: number): any {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true',
      path: '/api/auth',
      ...(maxAge > 0 ? { maxAge } : {}),
    };
  }

  private readCookie(req: Request, name: string) {
    const cookie = String(req.headers.cookie || '');
    for (const part of cookie.split(';')) {
      const idx = part.indexOf('=');
      if (idx < 0) continue;
      const key = part.slice(0, idx).trim();
      if (key === name) return decodeURIComponent(part.slice(idx + 1).trim());
    }
    return '';
  }
}
