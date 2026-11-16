const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
(async()=>{
 const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'indai-mapping-ui-')),port=34860,base=`http://127.0.0.1:${port}`,errors=[];
 const server=spawn(process.execPath,['dist/main.js'],{cwd:path.join(root,'back-end'),env:{...process.env, OTP_DELIVERY_MODE:'demo',NODE_ENV:'test',DATA_DIR:dir,PORT:String(port),DEMO_MODE:'true',COOKIE_SECURE:'false',SMTP_HOST:'',UPSTOX_ANALYTICS_TOKEN:'',RATE_LIMIT_SENSITIVE_MAX:'5000',RATE_LIMIT_GENERAL_MAX:'20000'},stdio:'ignore'});
 let browser;
 async function login(email,password){const c=await browser.newContext({viewport:{width:1440,height:1000}}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/login.html');await p.locator('#email').fill(email);await p.locator('#password').fill(password);await p.locator('#login-btn').click();const otp=p.locator('#verification-otp');await otp.waitFor();const verify=p.getByRole('button',{name:'Verify & continue',exact:true});assert.equal(await verify.isDisabled(),true);await otp.fill('12345');assert.equal(await verify.isDisabled(),true);await otp.fill('000000');await verify.click();await p.waitForURL('**/*dashboard');return p;}
 async function panel(p){await p.getByRole('button',{name:'Class mapping & approvals',exact:true}).click();return p.getByRole('dialog');}
 async function api(p,route,body){return p.evaluate(async({route,body})=>{const r=await fetch('/api'+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+sessionStorage.getItem('indai_token'),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const j=await r.json();if(!r.ok)throw Error(JSON.stringify(j));return j.data;},{route,body});}
 try{
  for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
  const admin=await login('admin@indai.com','Admin@1234'),teacher=await login('instructor@indai.com','Inst@1234');
  const s=await api(admin,'/users',{firstName:'Browser',lastName:'Student',email:'browser-map@example.in',role:'learner',password:'Test@1234',status:'active'});
  await admin.reload();await admin.getByRole('alert').filter({hasText:'unmapped student'}).waitFor();
  let ad=await panel(admin);await ad.getByLabel('Choose instructor for '+s.email).selectOption('u3');await ad.getByRole('row').filter({hasText:'Browser Student'}).getByRole('button',{name:'Request assignment',exact:true}).click();await ad.getByText('Waiting for instructor acceptance.',{exact:true}).waitFor();
  let td=await panel(teacher);await td.getByRole('button',{name:'Accept student',exact:true}).click();await td.getByText('No pending mapping requests.',{exact:true}).waitFor();
  const student=await login('browser-map@example.in','Test@1234');const inbox=await api(student,'/notifications/user/'+s.id);assert.ok(inbox.some(n=>n.message.includes('assigned to')));
  const row=td.getByRole('row').filter({hasText:'Browser Student'});await row.getByRole('button',{name:'Request removal',exact:true}).click();await td.getByText('Waiting for admin approval.',{exact:true}).waitFor();
  await ad.getByRole('button',{name:'Approve removal',exact:true}).waitFor();await ad.getByRole('button',{name:'Approve removal',exact:true}).click();await ad.getByText('No pending mapping requests.',{exact:true}).waitFor();assert.equal((await api(admin,'/users/'+s.id)).instructorId,undefined);
  console.log('PASS UI: six-digit OTP, red alert, assignment acceptance, student notification, removal approval');
  const reset=await browser.newPage();await reset.goto(base+'/login.html');await reset.getByText('Forgot password?',{exact:true}).click();await reset.locator('#reset-email').fill('browser-map@example.in');await reset.getByRole('button',{name:'Enter OTP',exact:true}).click();await reset.locator('#reset-password').fill('Changed@1234');await reset.locator('#reset-confirm').fill('Changed@1234');await reset.locator('#verification-otp').fill('999999');await reset.getByRole('button',{name:'Reset password',exact:true}).click();await reset.getByText('Password reset. Sign in using your new password.',{exact:true}).waitFor({timeout:5000}).catch(async e=>{console.log(await reset.locator('body').innerText());throw e;});await login('browser-map@example.in','Changed@1234');
  console.log('PASS UI: forgot password and new-password login');assert.deepEqual(errors,[]);console.log('PASS No browser runtime errors');
 }finally{if(browser)await browser.close();await new Promise(r=>{if(server.exitCode!==null)return r();server.once('exit',r);server.kill();});fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
