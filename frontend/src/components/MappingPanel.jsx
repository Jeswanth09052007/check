import { useState } from 'react';
import { api } from '../services/api';
import { useResource } from '../hooks/useResource';
import { Card, Notice, Table } from './Common';
export default function MappingPanel({user,notify}) {
  const admin=user.role==='superuser'||(user.role==='admin'&&user.adminTeam==='USER_ADMIN');
  const requests=useResource('/admin/mapping-requests',[],5000), users=useResource('/users',[],5000);
  const [selection,setSelection]=useState({}),[busy,setBusy]=useState(''),[error,setError]=useState('');
  async function run(key,fn) {if(busy)return;setBusy(key);setError('');try{await fn();requests.reload();users.reload();notify('Request updated.');}catch(e){setError(e.message);}finally{setBusy('');}}
  const pending=requests.data.filter(r=>r.status==='PENDING');
  const learners=users.data.filter(u=>u.role==='learner'&&u.status==='active'&&(admin||u.instructorId===user.id));
  const instructors=users.data.filter(u=>u.role==='instructor'&&u.status==='active');
  return <>
    <Card title="Class mapping & approvals" subtitle="Assignments require instructor acceptance. Removals require admin approval.">
      <Notice error={error||requests.error||users.error}/>
      {pending.length===0&&<p>No pending mapping requests.</p>}
      {pending.map(r=><div key={r.id} className="card" style={{padding:16,marginBottom:10}}>
        <p><strong>{r.learnerName}</strong> · {r.kind==='ASSIGN'?'Assign to':'Remove from'} {r.instructorName}</p>
        {(r.kind==='ASSIGN'&&user.role==='instructor'||r.kind==='REMOVE'&&admin)?<div style={{display:'flex',gap:8}}>{['accept','reject'].map(d=><button key={d} className={'btn '+(d==='accept'?'btn-primary':'btn-secondary')} disabled={!!busy} onClick={()=>run(r.id,()=>api('/admin/mapping-requests/'+r.id+'/'+d,'POST',{}))}>{d==='accept'?(r.kind==='ASSIGN'?'Accept student':'Approve removal'):(r.kind==='ASSIGN'?'Decline':'Reject removal')}</button>)}</div>:<p>{r.kind==='ASSIGN'?'Waiting for instructor acceptance.':'Waiting for admin approval.'}</p>}
      </div>)}
      <Table heads={['Student','Instructor','Action']} rows={learners.map(s=>{
        const current=instructors.find(i=>i.id===s.instructorId), waiting=pending.some(r=>r.learnerId===s.id);
        return [s.firstName+' '+s.lastName,current?current.firstName+' '+current.lastName:<strong style={{color:'#b91c1c'}}>Unmapped — please assign</strong>,waiting?<span>Approval pending</span>:admin?<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <select className="form-select" aria-label={'Choose instructor for '+s.email} value={selection[s.id]||''} onChange={e=>setSelection({...selection,[s.id]:e.target.value})}><option value="">Choose instructor</option>{instructors.filter(i=>i.id!==s.instructorId).map(i=><option key={i.id} value={i.id}>{i.firstName} {i.lastName}</option>)}</select>
          <button className="btn btn-primary btn-sm" disabled={!!busy||!selection[s.id]} onClick={()=>run(s.id,()=>api('/admin/assign-instructor','POST',{learnerId:s.id,instructorId:selection[s.id]}))}>Request assignment</button>
        </div>:<button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={()=>run(s.id,()=>api('/admin/remove-student/'+s.id,'POST',{}))}>Request removal</button>];
      })}/>
      <details><summary>Resolved requests ({requests.data.length-pending.length})</summary>{requests.data.filter(r=>r.status!=='PENDING').map(r=><p key={r.id}>{r.learnerName} · {r.kind} · {r.instructorName} · {r.status}</p>)}</details>
    </Card>
  </>;
}
