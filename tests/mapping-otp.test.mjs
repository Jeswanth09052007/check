import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('OTP, password reset and instructor mapping lifecycle',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'indai-mapping-')), port=34859,base=`http://127.0.0.1:${port}/api`;
 const env={...process.env, OTP_DELIVERY_MODE:'demo',NODE_ENV:'test',COOKIE_SECURE:'false',DATA_DIR:dir,PORT:String(port),DEMO_MODE:'true',SMTP_HOST:'',UPSTOX_ANALYTICS_TOKEN:'',JWT_SECRET:'a'.repeat(64),JWT_REFRESH_SECRET:'b'.repeat(64),RATE_LIMIT_SENSITIVE_MAX:'5000',RATE_LIMIT_GENERAL_MAX:'20000'};
 let server,logs='';
 async function start(){server=spawn(process.execPath,['dist/main.js'],{cwd:path.join(root,'back-end'),env,stdio:['ignore','pipe','pipe']});server.stderr.on('data',d=>logs+=d);server.stdout.on('data',d=>logs+=d);for(let i=0;i<100;i++){try{if((await fetch(base+'/public/config')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error(logs);}
 async function stop(){if(server&&server.exitCode===null)await new Promise(r=>{server.once('exit',r);server.kill();});}
 async function req(route,token,body,method=body?'POST':'GET'){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});const j=await r.json();return{status:r.status,data:j.data??j,cookie:r.headers.get('set-cookie')};}
 async function ok(route,token,body,method){const r=await req(route,token,body,method);assert.ok(r.status<300,JSON.stringify(r));return r.data;}
 async function login(email,password,otp='000000'){const c=await ok('/auth/login',null,{email,password});assert.equal(c.accessToken,undefined);assert.ok(c.challengeId);return ok('/auth/verify-otp',null,{challengeId:c.challengeId,otp});}
 try{
  await start();
  let admin,teacher,pay,learner,student,assignment,removal;
  await t.test('Credentials alone issue no session; only six numeric digits and a one-use challenge work',async()=>{
   assert.equal((await req('/auth/login',null,{email:'learner@indai.com',password:'wrong'})).status,401);
   const c=await req('/auth/login',null,{email:'learner@indai.com',password:'Learn@1234'});assert.equal(c.data.accessToken,undefined);assert.equal(c.cookie,null);
   for(const otp of ['12345','1234567','12a456',' 12345',123456])assert.equal((await req('/auth/verify-otp',null,{challengeId:c.data.challengeId,otp})).status,400);
   const verified=await req('/auth/verify-otp',null,{challengeId:c.data.challengeId,otp:'000001'});assert.ok(verified.data.accessToken);assert.ok(verified.cookie?.includes('HttpOnly'));
   assert.equal((await req('/auth/verify-otp',null,{challengeId:c.data.challengeId,otp:'000001'})).status,401);
   assert.equal((await req('/auth/verify-otp',null,{challengeId:'missing',otp:'123456'})).status,401);
   admin=await login('admin@indai.com','Admin@1234');teacher=await login('instructor@indai.com','Inst@1234');pay=await login('paymentadmin@indai.com','Pay@1234');learner=await login('learner@indai.com','Learn@1234');
  });
  await t.test('Registration waits for OTP and preserves pending account approval',async()=>{
   const body={firstName:'Newbie',lastName:'Student',email:'newbie@example.in',password:'Test@1234',confirmPassword:'Test@1234',role:'learner',phone:'9876543210',dateOfBirth:'2007-05-09'};
   const c=await ok('/auth/register',null,body);assert.equal(c.user,undefined);
   assert.equal((await req('/auth/login',null,{email:body.email,password:body.password})).status,401);
   const r=await ok('/auth/verify-otp',null,{challengeId:c.challengeId,otp:'987654'});assert.equal(r.user.role,'learner');assert.ok(r.accessToken);
   const pending=await ok('/auth/register',null,{...body,email:'pending@example.in',role:'instructor',institution:'Test Institute',expertise:'Trading',yearsExp:'3'});
   const p=await ok('/auth/verify-otp',null,{challengeId:pending.challengeId,otp:'111111'});assert.equal(p.pendingApproval,true);assert.equal(p.accessToken,undefined);
  });
  await t.test('Admin account edits create requests; alerts persist until instructor acceptance',async()=>{
   student=await ok('/users',admin.accessToken,{firstName:'Mapping',lastName:'Student',email:'mapping@example.in',role:'learner',password:'Test@1234',status:'active'});
   let inbox=await ok('/notifications/user/'+admin.user.id,admin.accessToken);assert.ok(inbox.some(n=>n.learnerId===student.id&&n.type==='error'&&n.persistent));
   await ok('/users/'+student.id,admin.accessToken,{instructorId:teacher.user.id},'PATCH');
   assert.equal((await ok('/users/'+student.id,admin.accessToken)).instructorId,undefined);
   assignment=(await ok('/admin/mapping-requests',teacher.accessToken)).find(r=>r.learnerId===student.id);assert.equal(assignment.status,'PENDING');
   assert.ok((await ok('/notifications/user/'+teacher.user.id,teacher.accessToken)).some(n=>n.mappingRequestId===assignment.id));
   assert.equal((await req('/admin/assign-instructor',admin.accessToken,{learnerId:student.id,instructorId:teacher.user.id})).status,409);
   assert.equal((await req('/admin/mapping-requests/'+assignment.id+'/accept',admin.accessToken,{})).status,403);
   assert.equal((await req('/admin/mapping-requests/'+assignment.id+'/accept',learner.accessToken,{})).status,403);
   assert.equal((await req('/admin/mapping-requests',pay.accessToken)).status,403);
   await ok('/admin/mapping-requests/'+assignment.id+'/accept',teacher.accessToken,{});
   assert.equal((await ok('/users/'+student.id,admin.accessToken)).instructorId,teacher.user.id);
   assert.ok((await ok('/users/'+teacher.user.id,admin.accessToken)).studentIds.includes(student.id));
   inbox=await ok('/notifications/user/'+admin.user.id,admin.accessToken);assert.ok(!inbox.some(n=>n.learnerId===student.id&&n.persistent));
   const s=await login('mapping@example.in','Test@1234');assert.ok((await ok('/notifications/user/'+student.id,s.accessToken)).some(n=>n.message.includes('assigned to')));
   assert.equal((await req('/admin/mapping-requests/'+assignment.id+'/accept',teacher.accessToken,{})).status,409);
  });
  await t.test('Removal requires admin approval, rejects foreign users, and survives restart',async()=>{
   removal=await ok('/admin/remove-student/'+student.id,teacher.accessToken,{});
   assert.equal((await ok('/users/'+student.id,admin.accessToken)).instructorId,teacher.user.id);
   assert.equal((await req('/admin/mapping-requests/'+removal.id+'/accept',teacher.accessToken,{})).status,403);
   assert.equal((await req('/admin/mapping-requests/'+removal.id+'/accept',pay.accessToken,{})).status,403);
   await stop();await start();assert.equal((await ok('/admin/mapping-requests',admin.accessToken)).find(r=>r.id===removal.id).status,'PENDING');
   await ok('/admin/mapping-requests/'+removal.id+'/reject',admin.accessToken,{});
   assert.equal((await ok('/users/'+student.id,admin.accessToken)).instructorId,teacher.user.id);
   removal=await ok('/admin/remove-student/'+student.id,teacher.accessToken,{});
   await ok('/admin/mapping-requests/'+removal.id+'/accept',admin.accessToken,{});
   assert.equal((await ok('/users/'+student.id,admin.accessToken)).instructorId,undefined);
   assert.ok(!(await ok('/users/'+teacher.user.id,admin.accessToken)).studentIds.includes(student.id));
   assert.ok((await ok('/notifications/user/'+admin.user.id,admin.accessToken)).some(n=>n.learnerId===student.id&&n.persistent));
   const s=await login('mapping@example.in','Test@1234');for(const u of [s,teacher])assert.ok((await ok('/notifications/user/'+u.user.id,u.accessToken)).some(n=>n.message.toLowerCase().includes('approved')&&n.mappingRequestId===removal.id));
   assert.equal((await req('/admin/remove-student/'+student.id,teacher.accessToken,{})).status,403);
  });
  await t.test('Declining an assignment leaves student unmapped; create-account mapping also waits',async()=>{
   const a=await ok('/admin/assign-instructor',admin.accessToken,{learnerId:student.id,instructorId:teacher.user.id});await ok('/admin/mapping-requests/'+a.id+'/reject',teacher.accessToken,{});assert.equal((await ok('/users/'+student.id,admin.accessToken)).instructorId,undefined);
   const s=await ok('/users',admin.accessToken,{firstName:'Created',lastName:'Mapped',email:'created-map@example.in',role:'learner',status:'active',password:'Test@1234',instructorId:teacher.user.id});assert.equal(s.instructorId,undefined);assert.ok((await ok('/admin/mapping-requests',teacher.accessToken)).some(r=>r.learnerId===s.id&&r.status==='PENDING'));
  });
  await t.test('Reassignment waits for the new instructor and cleans the old roster',async()=>{
   const target=await ok('/users',admin.accessToken,{firstName:'Second',lastName:'Instructor',email:'second-teacher@example.in',role:'instructor',status:'active',password:'Test@1234',institution:'Test Institute',expertise:'Trading',yearsExp:'3'});
   const second=await login('second-teacher@example.in','Test@1234');
   const a=await ok('/admin/assign-instructor',admin.accessToken,{learnerId:'u6',instructorId:target.id});
   assert.equal((await ok('/users/u6',admin.accessToken)).instructorId,teacher.user.id);
   assert.equal((await req('/admin/mapping-requests/'+a.id+'/accept',teacher.accessToken,{})).status,403);
   await ok('/admin/mapping-requests/'+a.id+'/accept',second.accessToken,{});
   assert.equal((await ok('/users/u6',admin.accessToken)).instructorId,target.id);
   assert.ok(!(await ok('/users/'+teacher.user.id,admin.accessToken)).studentIds.includes('u6'));
   assert.ok((await ok('/users/'+target.id,admin.accessToken)).studentIds.includes('u6'));
  });
  await t.test('Password reset validates OTP and matching passwords, then replaces the password',async()=>{
   const c=await ok('/auth/forgot-password',null,{email:'mapping@example.in'});
   assert.equal((await req('/auth/reset-password',null,{challengeId:c.challengeId,otp:'12345',password:'Reset@1234',confirmPassword:'Reset@1234'})).status,400);
   assert.equal((await req('/auth/reset-password',null,{challengeId:c.challengeId,otp:'123456',password:'Reset@1234',confirmPassword:'Other@1234'})).status,400);
   await ok('/auth/reset-password',null,{challengeId:c.challengeId,otp:'000000',password:'Reset@1234',confirmPassword:'Reset@1234'});
   assert.equal((await req('/auth/login',null,{email:'mapping@example.in',password:'Test@1234'})).status,401);assert.ok((await login('mapping@example.in','Reset@1234')).accessToken);
   assert.equal((await req('/auth/reset-password',null,{challengeId:c.challengeId,otp:'000000',password:'Reset@1234',confirmPassword:'Reset@1234'})).status,401);
  });
 }finally{await stop();await rm(dir,{recursive:true,force:true});}
});
