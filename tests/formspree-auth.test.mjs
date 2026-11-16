import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile,writeFile,unlink} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('Formspree owner-inbox integration requires the exact emailed code',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'indai-formspree-')),port=34861,base=`http://127.0.0.1:${port}/api`;
 const server=spawn(process.execPath,['--require',path.join(root,'tests/fixtures/formspree-mock.cjs'),'dist/main.js'],{cwd:path.join(root,'back-end'),env:{...process.env,NODE_ENV:'test',OTP_DELIVERY_MODE:'formspree',FORMSPREE_TEST_DIR:dir,FORMSPREE_FORM_ID:'maeeoaow',DATA_DIR:dir,PORT:String(port),DEMO_MODE:'true',COOKIE_SECURE:'false',SMTP_HOST:'',UPSTOX_ANALYTICS_TOKEN:'',RATE_LIMIT_SENSITIVE_MAX:'5000',RATE_LIMIT_GENERAL_MAX:'20000'},stdio:'ignore'});
 async function req(route,body){const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();return{status:r.status,data:j.data??j,cookie:r.headers.get('set-cookie')};}
 async function mail(){const rows=(await readFile(path.join(dir,'mail.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);return rows.at(-1);}
 async function code(){return (await mail()).payload.message.match(/OTP is: (\d{6})/)[1];}
 try{
  for(let i=0;i<100;i++){try{if((await fetch(base+'/public/config')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  await t.test('Login sends only OTP/account identifier to the owner form and rejects a wrong code',async()=>{
   const c=await req('/auth/login',{email:'learner@indai.com',password:'Learn@1234'});assert.equal(c.status,201);assert.equal(c.data.demoOtp,false);assert.equal(c.data.expiresIn,300);assert.equal(c.cookie,null);assert.equal(c.data.accessToken,undefined);
   const m=await mail();assert.equal(m.url,'https://formspree.io/f/maeeoaow');assert.equal(m.payload.test_email,'learner@indai.com');assert.equal(m.payload.email,undefined);assert.equal(m.payload.password,undefined);assert.ok(!JSON.stringify(m).includes('Learn@1234'));
   const actual=await code(),wrong=actual==='999999'?'111111':'999999';assert.equal((await req('/auth/verify-otp',{challengeId:c.data.challengeId,otp:wrong})).status,400);
   const r=await req('/auth/verify-otp',{challengeId:c.data.challengeId,otp:actual});assert.ok(r.data.accessToken);assert.ok(r.cookie.includes('HttpOnly'));assert.equal((await req('/auth/verify-otp',{challengeId:c.data.challengeId,otp:actual})).status,401);
  });
  await t.test('Resend respects cooldown; five wrong codes lock the challenge',async()=>{
   const c=await req('/auth/login',{email:'instructor@indai.com',password:'Inst@1234'});assert.equal((await req('/auth/resend-otp',{challengeId:c.data.challengeId})).status,400);
   const actual=await code(),wrong=actual==='999999'?'111111':'999999';for(let i=0;i<5;i++)assert.equal((await req('/auth/verify-otp',{challengeId:c.data.challengeId,otp:wrong})).status,400);assert.equal((await req('/auth/verify-otp',{challengeId:c.data.challengeId,otp:actual})).status,400);
  });
  await t.test('Registration and password reset use the same exact-code engine',async()=>{
   const c=await req('/auth/register',{email:'formspree-new@example.in',password:'Test@1234',confirmPassword:'Test@1234',firstName:'Email',lastName:'Student',role:'learner',phone:'9876543210',dateOfBirth:'2007-05-09'});assert.equal(c.status,201);
   assert.ok(!JSON.stringify(await mail()).includes('Test@1234'));
   const created=await req('/auth/verify-otp',{challengeId:c.data.challengeId,otp:await code()});assert.ok(created.data.accessToken);
   const reset=await req('/auth/forgot-password',{email:'formspree-new@example.in'});assert.equal(reset.status,201);const actual=await code();
   const done=await req('/auth/reset-password',{challengeId:reset.data.challengeId,otp:actual,password:'Changed@1234',confirmPassword:'Changed@1234'});assert.equal(done.data.reset,true);
   assert.equal((await req('/auth/login',{email:'formspree-new@example.in',password:'Test@1234'})).status,401);
  });
  await t.test('Delivery failure does not grant a session or report a successful challenge',async()=>{
   await writeFile(path.join(dir,'fail'),'1');const c=await req('/auth/login',{email:'provider@indai.com',password:'Prov@1234'});assert.equal(c.status,400);assert.equal(c.data.accessToken,undefined);assert.equal(c.data.challengeId,undefined);assert.equal(c.cookie,null);await unlink(path.join(dir,'fail'));
  });
 }finally{await new Promise(r=>{if(server.exitCode!==null)return r();server.once('exit',r);server.kill();});await rm(dir,{recursive:true,force:true});}
});
