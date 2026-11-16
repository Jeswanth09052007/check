import test from 'node:test';
import assert from 'node:assert/strict';
import { createOtpEngine } from '../back-end/dist/modules/auth/otp-engine.js';

function fixture() {
  let clock = 1000, payload;
  const engine = createOtpEngine({ send: async value => { payload = value; }, now: () => clock });
  return { engine, advance: ms => { clock += ms; }, payload: () => payload, code: () => payload.message.match(/OTP is: (\d{6})/)[1] };
}
test('verification email goes to the account address and the code is single use', async () => {
  const f = fixture(); const c = await f.engine.request('demo@example.com', 'a');
  assert.match(f.code(), /^\d{6}$/); assert.equal(f.payload().to, 'demo@example.com'); assert.equal(f.payload().password, undefined);
  assert.throws(() => f.engine.verify(c.challengeId, '12345', 'a'));
  assert.throws(() => f.engine.verify(c.challengeId, f.code(), 'b'));
  assert.deepEqual(f.engine.verify(c.challengeId, f.code(), 'a'), { email: 'demo@example.com' });
  assert.throws(() => f.engine.verify(c.challengeId, f.code(), 'a'));
});
test('expiry and resend cooldown', async () => {
  const f = fixture(); const c = await f.engine.request('demo@example.com', 'a');
  await assert.rejects(f.engine.request('demo@example.com', 'a'), /wait/);
  f.advance(300000); assert.throws(() => f.engine.verify(c.challengeId, f.code(), 'a'), /expired/);
});
test('five incorrect attempts lock challenge', async () => {
  const f = fixture(); const c = await f.engine.request('demo@example.com', 'a');
  for (let i = 0; i < 4; i++) assert.throws(() => f.engine.verify(c.challengeId, 'abcdef', 'a'), /Incorrect/);
  assert.throws(() => f.engine.verify(c.challengeId, 'abcdef', 'a'), /Too many/);
  assert.throws(() => f.engine.verify(c.challengeId, f.code(), 'a'), /new OTP/);
});
test('successful resend invalidates previous code', async () => {
  const f = fixture(); const old = await f.engine.request('demo@example.com', 'a'); f.advance(30000);
  const fresh = await f.engine.request('demo@example.com', 'a');
  assert.throws(() => f.engine.verify(old.challengeId, f.code(), 'a'));
  assert.ok(f.engine.verify(fresh.challengeId, f.code(), 'a'));
});
test('delivery failures do not create a challenge', async () => {
  const engine = createOtpEngine({ send: async () => { throw new Error('Delivery failed'); } });
  await assert.rejects(engine.request('demo@example.com', 'a'), /Delivery failed/);
});
