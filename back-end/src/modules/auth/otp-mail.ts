import { appendFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { mail } from '../../common/smtp';

const demoAccounts = new Set([
  'superadmin@indai.com',
  'admin@indai.com',
  'paymentadmin@indai.com',
  'instructor@indai.com',
  'provider@indai.com',
  'iiitprovider@iiits.in',
  'learner@indai.com',
]);

export function otpDelivery(email: string): 'local' | 'email' {
  const address = email.trim().toLowerCase();
  const demo = process.env.NODE_ENV !== 'production' && process.env.DEMO_MODE === 'true';
  const forceSmtpInTest = process.env.NODE_ENV === 'test' && process.env.OTP_DELIVERY_MODE === 'smtp';
  return demo && !forceSmtpInTest && (address.endsWith('.test') || demoAccounts.has(address))
    ? 'local'
    : 'email';
}

export async function deliverOtp({ to, subject, message }: {
  to: string;
  subject: string;
  message: string;
}) {
  try {
    if (otpDelivery(to) === 'local') {
      const directory = resolve(process.env.DATA_DIR || join(process.cwd(), 'persistent-data'));
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await appendFile(join(directory, 'demo-otp-inbox.jsonl'), JSON.stringify({
        to, subject, message, sentAt: new Date().toISOString(),
      }) + '\n', { encoding: 'utf8', mode: 0o600 });
      return;
    }
    const delivery = await mail(to, subject, message);
    if (!delivery.accepted?.length) throw new Error('No recipient accepted');
  } catch {
    throw new Error('Verification email could not be sent. Try again later.');
  }
}
