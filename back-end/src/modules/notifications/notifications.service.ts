import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MappingService } from '../../store/mapping.service';
import { DataStore } from '../../store/data.store';
import { CreateNotificationDto, SendNotificationsDto, UpdateNotificationDto } from './dto';
@Injectable()
export class NotificationsService { constructor(private readonly db:DataStore,private readonly mapping:MappingService){}
 send(actor:any,b:SendNotificationsDto){
  const eligible=this.db.users.filter(u=>u.role==='learner'&&u.status==='active'&&(actor.role!=='instructor'||u.instructorId===actor.id));
  const ids=b.all?eligible.map(u=>u.id):(b.userIds||[]);
  if(!ids.length)throw new BadRequestException('Select at least one active learner.');
  if(ids.some(id=>!eligible.some(u=>u.id===id)))throw new ForbiddenException('You can notify only your assigned active learners.');
  const rows=ids.map(userId=>({...this.create({userId,message:b.message,title:b.title,type:'info'}),senderId:actor.id}));
  for(const row of rows)Object.assign(this.db.notifications.find(n=>n.id===row.id),{senderId:actor.id});
  return {count:rows.length};
 }
 findAll(){ return this.db.notifications; }
 findByUser(userId:string){
  const user=this.db.getUser(userId);
  const alerts=user&&this.mapping.isAdmin(user)?this.mapping.unmapped().map(u=>({id:'unmapped-'+u.id,userId,type:'error',persistent:true,read:false,title:'Student needs an instructor',message:`${u.firstName} ${u.lastName} (${u.email}) is unmapped. Please assign an instructor.`,createdAt:u.createdAt||'',learnerId:u.id})):[];
  return [...alerts,...this.db.notifications.filter((n:any)=>n.userId===userId).reverse().map(n=>({...n,mappingStatus:n.mappingRequestId?this.db.mappingRequests.find(r=>r.id===n.mappingRequestId)?.status:undefined}))];
 }
 findOne(id:string){ const row=this.db.notifications.find((x:any)=>x.id===id); if(!row) throw new NotFoundException('Notification not found.'); return row; }
 create(body:CreateNotificationDto){ const user=this.db.getUser(body.userId); if(!user) throw new NotFoundException('User not found.'); const row={id:this.db.id('n'),read:false,type:'info',...body,message:body.message.trim(),createdAt:new Date().toISOString()}; this.db.notifications.push(row); return row; }
 update(id:string, body:UpdateNotificationDto){ const row=this.findOne(id); Object.assign(row, body); return row; }
 markRead(id:string){ const row=this.findOne(id); row.read=true; return row; }
 remove(id:string){ const idx=this.db.notifications.findIndex((x:any)=>x.id===id); if(idx===-1) throw new NotFoundException('Notification not found.'); this.db.notifications.splice(idx,1); return {id}; }
}
