import {
  Module,
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Req,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsEmail,
} from "class-validator";
import { StoreModule } from "../../store/store.module";
import { DataStore } from "../../store/data.store";
import { hashPassword, verifyPassword } from "../../common/password.util";
import { PASSWORD_REGEX } from "../../common/validation.constants";
import { Trim, WhenSupplied } from "../../common/form-validation";
import { Public } from "../../common/public.decorator";
class ProfileDto {
  @Trim() @IsString() @MinLength(2) firstName: string;
  @Trim() @IsString() @MinLength(2) lastName: string;
  @Trim() @IsEmail() email: string;
  @WhenSupplied() @Trim() @IsString() institution?: string;
  @WhenSupplied() @Trim() @IsString() major?: string;
}
class PasswordDto {
  @IsString() currentPassword: string;
  @Matches(PASSWORD_REGEX) newPassword: string;
  @IsString() confirmPassword: string;
}
class ContactDto {
  @Trim() @IsString() @MinLength(3) @MaxLength(200) name: string;
  @Trim() @IsEmail() email: string;
  @Trim() @IsString() @MinLength(10) @MaxLength(5000) message: string;
}
@Controller("account")
class AccountController {
  constructor(private db: DataStore) {}
  @Patch("profile") profile(@Req() req: any, @Body() b: ProfileDto) {
    const u = this.db.getUser(req.user.id);
    const existing = this.db.findUserByEmail(b.email);
    if (existing && existing.id !== u.id)
      throw new BadRequestException("Email already registered.");
    Object.assign(u, b, { email: b.email.toLowerCase() });
    return { success: true, data: this.db.safeUser(u) };
  }
  @Post("password") password(@Req() req: any, @Body() b: PasswordDto) {
    const u = this.db.getUser(req.user.id);
    if (!verifyPassword(b.currentPassword, u.password))
      throw new UnauthorizedException("Current password is incorrect.");
    if (b.newPassword !== b.confirmPassword)
      throw new BadRequestException("Passwords do not match.");
    u.password = hashPassword(b.newPassword);
    for (const s of this.db.refreshSessions.filter((s) => s.userId === u.id)) {
      s.revokedAt = new Date().toISOString();
      s.revokedReason = "PASSWORD_CHANGED";
    }
    return { success: true, data: { changed: true } };
  }
}
@Controller("public")
class PublicController {
  @Public() @Get("config") config() {
    return {
      success: true,
      data: { demoMode: process.env.DEMO_MODE !== "false", upstoxConfigured:Boolean(process.env.UPSTOX_ANALYTICS_TOKEN?.trim()) },
    };
  }
}
@Controller("contact")
class ContactController {
  constructor(private db: DataStore) {}
  @Public() @Post() contact(@Body() b: ContactDto) {
    this.db.audit("CONTACT_REQUEST", "PUBLIC", b);
    return { success: true, data: { received: true } };
  }
}
@Module({
  imports: [StoreModule],
  controllers: [AccountController, ContactController, PublicController],
})
export class AccountModule {}
