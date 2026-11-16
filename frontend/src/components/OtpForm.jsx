import { useEffect, useState } from 'react';
export default function OtpForm({onSubmit,onResend,challenge,busy=false,label='Verify & continue'}) {
  const [otp,setOtp]=useState(''),[error,setError]=useState(''),[wait,setWait]=useState(30),[sending,setSending]=useState(false);
  useEffect(()=>{setOtp('');setError('');setWait(challenge?.resendAfter??30);},[challenge?.challengeId]);
  useEffect(()=>{if(wait<=0)return;const t=setTimeout(()=>setWait(v=>v-1),1000);return()=>clearTimeout(t);},[wait]);
  return <form onSubmit={async e=>{e.preventDefault();if(!/^[0-9]{6}$/.test(otp)){setError('Enter exactly six digits.');return;}setError('');try{await onSubmit(otp);}catch(e){setError(e.message);}}}>
    <p>{challenge?.demoOtp?'Test verification: enter any six-digit number.':'OTP sent to the email inbox connected to IndAI’s Formspree form. Enter that exact six-digit code.'}</p>
    <label className="form-label" htmlFor="verification-otp">Enter OTP</label>
    <input autoFocus id="verification-otp" className="form-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={otp} onChange={e=>{if(/^[0-9]{0,6}$/.test(e.target.value))setOtp(e.target.value);}} />
    <p className="card-subtitle">Valid for five minutes. Up to five attempts.</p>
    {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
    <div className="modal-footer">
      {onResend&&<button type="button" className="btn btn-secondary" disabled={busy||sending||wait>0} onClick={async()=>{setSending(true);setError('');try{await onResend();setOtp('');setWait(30);}catch(e){setError(e.message);}finally{setSending(false);}}}>{sending?'Sending…':wait>0?`Resend in ${wait}s`:'Resend OTP'}</button>}
      <button className="btn btn-primary" disabled={busy||sending||!/^[0-9]{6}$/.test(otp)}>{busy?'Please wait…':label}</button>
    </div>
  </form>;
}
