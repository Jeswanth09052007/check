import { randomInt, randomBytes, createHmac, timingSafeEqual } from 'node:crypto';

type OtpMessage = { to: string; subject: string; message: string };

export function createOtpEngine({ send, now = Date.now, cooldown = 30000, ttl = 300000 }: {
  send: (payload: OtpMessage) => Promise<void>;
  now?: () => number;
  cooldown?: number;
  ttl?: number;
}) {
  const challenges = new Map<string, any>();
  const limits = new Map<string, any>();
  const key = randomBytes(32);
  const hash = (id, code) => createHmac('sha256', key).update(id + ':' + code).digest();
  return {
    async request(email: string, client: string, deliver = true) {
      if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
      const time = now();
      for (const [id, item] of challenges) if (item.expires <= time) challenges.delete(id);
      for (const [id, item] of limits) if (time - item.start >= 3600000) limits.delete(id);
      const limit = limits.get(client) || { last: -Infinity, count: 0, start: time };
      if (time - limit.last < cooldown) throw new Error('Please wait 30 seconds before sending again.');
      if (limit.count >= 10) throw new Error('Hourly limit reached. Please try again later.');
      limit.last = time; limit.count++; limits.set(client, limit);
      const id = randomBytes(24).toString('hex');
      const code = String(randomInt(0, 1000000)).padStart(6, '0');
      if (deliver) {
        await send({
          to: email,
          subject: 'IndAI verification code',
          message: `Your IndAI OTP is: ${code}\n\nThis code expires in five minutes. If you did not request it, you can ignore this email.`,
        });
      }
      // A successful resend invalidates older challenges from this browser.
      for (const [oldId, item] of challenges) if (item.client === client) challenges.delete(oldId);
      challenges.set(id, { digest: hash(id, code), email, client, expires: now() + ttl, attempts: 0 });
      return { challengeId: id, expiresIn: ttl / 1000 };
    },
    verify(id, code, client) {
      const item = challenges.get(id);
      if (!item || item.client !== client) throw new Error('Request a new OTP first.');
      if (now() >= item.expires) { challenges.delete(id); throw new Error('OTP expired. Request a new code.'); }
      item.attempts++;
      const valid = typeof code === 'string' && /^\d{6}$/.test(code) && timingSafeEqual(hash(id, code), item.digest);
      if (!valid) {
        if (item.attempts >= 5) { challenges.delete(id); throw new Error('Too many attempts. Request a new code.'); }
        throw new Error('Incorrect OTP. Enter the six-digit code from your email.');
      }
      challenges.delete(id);
      return { email: item.email };
    }
  };
}
