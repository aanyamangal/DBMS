// DEMO DATA LAYER (simulated database). Stored in localStorage; replace with fetch('/api/...') calls during DB integration.
const KEY='oems_demo_v1';
const grade=p=>p>=90?'A+':p>=80?'A':p>=70?'B':p>=60?'C':p>=50?'D':p>=40?'E':'F';
const iso=h=>new Date(Date.now()+h*36e5).toISOString().slice(0,16);
function seed(){
 const d={users:[],subjects:[],enrollments:[],exams:[],questions:[],attempts:[],notifications:[],announcements:[],audit:[],settings:{siteName:'OEMS',defaultDuration:30,passPercent:40,allowRetake:false,maintenance:false},nid:1000};
 d.users.push({id:1,role:'admin',name:'Admin 01',email:'admin@exam.demo',password:'Admin@123',status:'active'},{id:2,role:'admin',name:'Admin 02',email:'admin2@exam.demo',password:'Admin@123',status:'active'});
 const dp=['CSE','IT','ECE'];
 for(let i=1;i<=24;i++)d.users.push({id:2+i,role:'student',name:'Student '+String(i).padStart(2,'0'),email:`student${i}@exam.demo`,password:'Student@123',roll:'R'+(1000+i),dept:dp[i%3],phone:'90000000'+String(i).padStart(2,'0'),status:i%11?'active':'inactive'});
 [['DBMS','Database Management Systems',4],['OS','Operating Systems',3],['CN','Computer Networks',3],['DSA','Data Structures',4],['SE','Software Engineering',3],['WEB','Web Technologies',3]].forEach((s,i)=>d.subjects.push({id:i+1,code:s[0],title:s[1],credits:s[2]}));
 d.users.filter(u=>u.role=='student').forEach(u=>[1,2,3].forEach(s=>d.enrollments.push({uid:u.id,sid:s})));
 const ex=[['DBMS Mid-Term',1,-24,720,30,-1],['OS Quiz 1',2,-2,48,20,-1],['CN Unit Test',3,48,72,25,-1],['DSA Practice Test',4,72,96,30,-1],['SE Quiz',5,-300,-290,20,1],['WEB Basics Test',6,-200,-190,20,1]];
 ex.forEach((e,i)=>d.exams.push({id:i+1,title:e[0],sid:e[1],start:iso(e[2]),end:iso(e[3]),duration:e[4],pass:40,published:i==4,total:0}));
 const bank={1:[['Which normal form removes transitive dependency?',['1NF','2NF','3NF','BCNF'],2],['Which SQL clause filters grouped rows?',['WHERE','HAVING','ORDER BY','LIMIT'],1],['Which ACID property means all-or-nothing?',['Atomicity','Consistency','Isolation','Durability'],0],['A foreign key enforces...',['Uniqueness','Referential integrity','Indexing','Encryption'],1],['Which join returns unmatched left rows?',['INNER','LEFT','CROSS','SELF'],1]]};
 let qid=1;d.exams.forEach(e=>{const b=bank[e.id]||[0,1,2,3,4].map(n=>[`Sample demo question ${n+1} for ${d.subjects[e.sid-1].code}?`,['Option A','Option B','Option C','Option D'],n%4]);
  b.forEach(q=>{d.questions.push({id:qid++,eid:e.id,type:'mcq',text:q[0],options:q[1],ans:q[2],marks:1});e.total++});
  d.questions.push({id:qid++,eid:e.id,type:'descriptive',text:`Explain a key concept of ${d.subjects[e.sid-1].title} with an example.`,marks:5});e.total+=5});
 for(let u=3;u<=14;u++)[5,6].forEach(eid=>{const m=2+(u*eid)%4,ds=1+(u+eid)%5,tot=m+ds;d.attempts.push({id:d.nid++,eid,uid:u,answers:{},mcq:m,desc:ds,evaluated:true,status:'submitted',at:iso(-200)});});
 d.attempts.push({id:d.nid++,eid:1,uid:5,answers:{},mcq:3,desc:0,evaluated:false,status:'submitted',at:iso(-3)});
 d.attempts.find(a=>a.eid==1).answers={[d.questions.find(q=>q.eid==1&&q.type=='descriptive').id]:{text:'Demo descriptive answer awaiting evaluation.'}};
 d.announcements.push({id:1,title:'Welcome',body:'Demo announcement: the DBMS Mid-Term is open.',date:iso(-48)});
 d.notifications.push({id:1,uid:0,msg:'Demo: DBMS Mid-Term is now open.',date:iso(-24),read:false});
 d.audit.push({id:1,user:'Admin 01',action:'SEED',detail:'Demo data loaded',date:iso(-1)});
 return d;}
let DB=JSON.parse(localStorage.getItem(KEY)||'null')||seed();
const save=()=>localStorage.setItem(KEY,JSON.stringify(DB));
const resetDemo=()=>{localStorage.removeItem(KEY);location.reload()};
const nid=()=>++DB.nid;
const log=(action,detail)=>{const u=me();DB.audit.unshift({id:nid(),user:u?u.name:'System',action,detail,date:new Date().toISOString().slice(0,16)});save()};
const me=()=>{const id=sessionStorage.getItem('uid');return DB.users.find(u=>u.id==id)};
const notify=(uid,msg)=>{DB.notifications.unshift({id:nid(),uid,msg,date:new Date().toISOString().slice(0,16),read:false});save()};
const examStatus=e=>{const n=iso(0);return n<e.start?'Upcoming':n>e.end?'Closed':'Open'};
const resultOf=a=>{const e=DB.exams.find(x=>x.id==a.eid),t=a.mcq+a.desc,p=+(t*100/e.total).toFixed(1);return{total:t,pct:p,grade:grade(p),pass:p>=e.pass,e}};
