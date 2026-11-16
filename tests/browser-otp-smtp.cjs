const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {startSmtp}=require('./fixtures/smtp-sink.cjs');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
(async()=>{
 const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'indai-smtp-ui-')),port=34862,base=`http://127.0.0.1:${port}`,errors=[];
 const smtp=await startSmtp();
 const server=spawn(process.execPath,['dist/main.js'],{cwd:path.join(root,'back-end'),env:{...process.env,NODE_ENV:'test',...smtp.env,DATA_DIR:dir,PORT:String(port),DEMO_MODE:'true',COOKIE_SECURE:'false',UPSTOX_ANALYTICS_TOKEN:'',RATE_LIMIT_SENSITIVE_MAX:'5000',RATE_LIMIT_GENERAL_MAX:'20000'},stdio:'ignore'});
 const code=()=>smtp.messages.at(-1).message.match(/OTP is: (\d{6})/)[1];
 let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
  smtp.setReject(true);
  let superToken;
  for (const [email, password, dashboard] of [
    ['learner@indai.com', 'Learn@1234', 'learner'],
    ['instructor@indai.com', 'Inst@1234', 'instructor'],
    ['provider@indai.com', 'Prov@1234', 'provider'],
    ['admin@indai.com', 'Admin@1234', 'user-admin'],
    ['paymentadmin@indai.com', 'Pay@1234', 'payment-admin'],
    ['superadmin@indai.com', 'Admin@1234', 'superuser'],
  ]) {
    const direct = await browser.newPage();
    direct.on('pageerror', error => errors.push(error.message));
    await direct.goto(base + '/login');
    await direct.locator('#email').fill(email);
    if (dashboard === 'learner') {
      await direct.locator('#password').fill('wrong-password');
      await direct.getByRole('button', {name:'Sign In with Password', exact:true}).click();
      await direct.getByRole('alert').filter({hasText:'Invalid email or password.'}).waitFor();
    }
    await direct.locator('#password').fill(password);
    if (dashboard === 'learner') await direct.locator('#password').press('Enter');
    else await direct.getByRole('button', {name:'Sign In with Password', exact:true}).click();
    await direct.waitForURL(`**/${dashboard}-dashboard`);
    await direct.waitForFunction(() => Boolean(sessionStorage.getItem('indai_token')));
    const token = await direct.evaluate(() => sessionStorage.getItem('indai_token'));
    const me = await direct.request.get(base + '/api/auth/me', {headers:{Authorization:'Bearer ' + token}});
    assert.equal((await me.json()).data.email, email);
    assert.equal((await direct.locator('#verification-otp').count()), 0);
    if (dashboard === 'superuser') superToken = token;
    await direct.close();
  }
  const pending = await fetch(base + '/api/users', {
    method:'POST', headers:{Authorization:'Bearer ' + superToken, 'Content-Type':'application/json'},
    body:JSON.stringify({email:'pending-provider@example.in', password:'Pending@1234', role:'provider',
      firstName:'Pending', lastName:'Provider', organization:'IndAI Tests'}),
  });
  assert.equal(pending.status, 201);
  const denied = await fetch(base + '/api/auth/login/password', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email:'pending-provider@example.in', password:'Pending@1234'}),
  });
  assert.equal(denied.status, 401);
  assert.match((await denied.json()).message, /pending Super Admin approval/);
  assert.equal(denied.headers.has('set-cookie'), false);
  assert.equal(smtp.messages.length, 0);
  smtp.setReject(false);
  console.log('PASS Password sign-in reaches all six dashboards with no SMTP messages and rejects invalid or pending credentials');
  const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/pages/login.html');assert.ok(p.url().endsWith('/login'));await p.getByText('Welcome Back to Your',{exact:false}).waitFor();assert.equal(await p.locator('.login-left').count(),1);
  await p.locator('#email').fill('learner@indai.com');await p.locator('#password').fill('Learn@1234');await p.locator('#login-btn').click();await p.locator('#verification-otp').waitFor();
  await p.getByText('Enter the six-digit code sent to your email address.',{exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:/Resend in/}).isDisabled(),true);
  const actual=code();await p.locator('#verification-otp').fill(actual==='999999'?'111111':'999999');await p.getByRole('button',{name:'Verify & continue',exact:true}).click();await p.getByRole('dialog').getByText(/Incorrect OTP/).waitFor();assert.ok(p.url().endsWith('/login'));
  await p.locator('#verification-otp').fill(actual);await p.getByRole('button',{name:'Verify & continue',exact:true}).click();await p.waitForURL('**/learner-dashboard');
  console.log('PASS Original IndAI login UI with registered-email notice, wrong-code rejection and exact-code sign-in');
  const reset=await browser.newPage();await reset.goto(base+'/login.html');await reset.getByText('Forgot password?',{exact:true}).click();await reset.locator('#reset-email').fill('learner@indai.com');await reset.getByRole('button',{name:'Enter OTP',exact:true}).click();await reset.locator('#verification-otp').waitFor();await reset.locator('#reset-password').fill('Changed@1234');await reset.locator('#reset-confirm').fill('Changed@1234');await reset.locator('#verification-otp').fill(code());await reset.getByRole('button',{name:'Reset password',exact:true}).click();await reset.getByText('Password reset. Sign in using your new password.',{exact:true}).waitFor();
  console.log('PASS Exact-code password reset in original IndAI modal styling');assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();await new Promise(r=>{if(server.exitCode!==null)return r();server.once('exit',r);server.kill();});await smtp.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
