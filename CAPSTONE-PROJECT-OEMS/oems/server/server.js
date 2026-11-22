// OEMS backend. Frontend (public/) works standalone in demo mode; these routes are the MySQL integration layer.
require('dotenv').config();
const express=require('express'),cors=require('cors'),jwt=require('jsonwebtoken'),crypto=require('crypto'),path=require('path'),mysql=require('mysql2/promise');
const app=express();app.use(cors(),express.json());
app.use(express.static(path.join(__dirname,'..','public')));
const pool=mysql.createPool({host:process.env.DB_HOST||'localhost',user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME||'oems',waitForConnections:true,connectionLimit:10});
const SECRET=process.env.JWT_SECRET||'dev-secret';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const Q=async(sql,p=[])=>(await pool.query(sql,p))[0];
const guard=role=>(req,res,next)=>{try{const u=jwt.verify((req.headers.authorization||'').replace('Bearer ',''),SECRET);if(role&&u.role!==role)return res.status(403).json({error:'Forbidden'});req.user=u;next()}catch{res.status(401).json({error:'Unauthorized'})}};
const audit=(uid,a,d)=>Q('INSERT INTO audit_logs(user_id,action,detail) VALUES(?,?,?)',[uid,a,d]);
const wrap=f=>(req,res)=>f(req,res).catch(e=>{console.error(e);res.status(500).json({error:e.message})});
const grade=p=>p>=90?'A+':p>=80?'A':p>=70?'B':p>=60?'C':p>=50?'D':p>=40?'E':'F';

app.get('/api/health',wrap(async(req,res)=>{await Q('SELECT 1');res.json({ok:true,db:'connected'})}));
app.post('/api/auth/login',wrap(async(req,res)=>{
  const {email,password}=req.body;if(!email||!password)return res.status(400).json({error:'Email and password required'});
  const [u]=await Q('SELECT * FROM users WHERE email=? AND password_hash=? AND status="active"',[email,sha(password)]);
  if(!u)return res.status(401).json({error:'Invalid credentials'});
  await audit(u.id,'LOGIN',email);
  res.json({token:jwt.sign({id:u.id,role:u.role},SECRET,{expiresIn:'4h'}),user:{id:u.id,name:u.name,role:u.role}});
}));

// ---- Student routes
const S=express.Router();S.use(guard('student'));
S.get('/subjects',wrap(async(req,res)=>res.json(await Q('SELECT s.*,(e.user_id IS NOT NULL) enrolled FROM subjects s LEFT JOIN enrollments e ON e.subject_id=s.id AND e.user_id=?',[req.user.id]))));
S.post('/enroll/:sid',wrap(async(req,res)=>{await Q('INSERT IGNORE INTO enrollments(user_id,subject_id) VALUES(?,?)',[req.user.id,req.params.sid]);res.json({ok:true})}));
S.get('/exams',wrap(async(req,res)=>res.json(await Q('SELECT x.*,s.code FROM exams x JOIN subjects s ON s.id=x.subject_id JOIN enrollments e ON e.subject_id=s.id AND e.user_id=? ORDER BY start_time',[req.user.id]))));
S.get('/exams/:id/questions',wrap(async(req,res)=>res.json(await Q('SELECT id,type,text,options,marks FROM questions WHERE exam_id=?',[req.params.id])))); // correct_option never sent
S.post('/exams/:id/submit',wrap(async(req,res)=>{ // body: {answers:{qid:{selected,text,marked}}}
  const qs=await Q('SELECT * FROM questions WHERE exam_id=?',[req.params.id]);let mcq=0,hasDesc=false;
  const conn=await pool.getConnection();try{await conn.beginTransaction();
    const [r]=await conn.query('INSERT INTO attempts(exam_id,user_id,started_at,submitted_at,status) VALUES(?,?,NOW(),NOW(),"submitted")',[req.params.id,req.user.id]);
    for(const q of qs){const a=(req.body.answers||{})[q.id]||{};let m=0;
      if(q.type==='mcq'&&a.selected===q.correct_option){m=q.marks;mcq+=m}if(q.type==='descriptive')hasDesc=true;
      await conn.query('INSERT INTO answers VALUES(?,?,?,?,?,?)',[r.insertId,q.id,a.selected??null,a.text??null,!!a.marked,m]);}
    await conn.query('UPDATE attempts SET mcq_score=?,eval_status=? WHERE id=?',[mcq,hasDesc?'pending':'done',r.insertId]);
    await conn.commit();res.json({attemptId:r.insertId,mcqScore:mcq,pendingEvaluation:hasDesc});
  }catch(e){await conn.rollback();throw e}finally{conn.release()}
}));
S.get('/results',wrap(async(req,res)=>res.json(await Q('SELECT r.*,x.title FROM results r JOIN exams x ON x.id=r.exam_id WHERE r.user_id=? AND r.published=1',[req.user.id]))));
S.get('/notifications',wrap(async(req,res)=>res.json(await Q('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC',[req.user.id]))));
app.use('/api/student',S);

// ---- Admin routes
const A=express.Router();A.use(guard('admin'));
const crud=(name,table,cols)=>{
  A.get('/'+name,wrap(async(req,res)=>{const {search='',page=1,size=10}=req.query;
    res.json(await Q(`SELECT * FROM ${table} WHERE CONCAT_WS(' ',${cols.join(',')}) LIKE ? ORDER BY id DESC LIMIT ? OFFSET ?`,[`%${search}%`,+size,(page-1)*size]))}));
  A.post('/'+name,wrap(async(req,res)=>{const c=cols.filter(k=>k in req.body);
    const [r]=await pool.query(`INSERT INTO ${table}(${c.join(',')}) VALUES(${c.map(()=>'?').join(',')})`,c.map(k=>req.body[k]));await audit(req.user.id,'CREATE '+table,String(r.insertId));res.json({id:r.insertId})}));
  A.put('/'+name+'/:id',wrap(async(req,res)=>{const c=cols.filter(k=>k in req.body);
    await Q(`UPDATE ${table} SET ${c.map(k=>k+'=?').join(',')} WHERE id=?`,[...c.map(k=>req.body[k]),req.params.id]);await audit(req.user.id,'UPDATE '+table,req.params.id);res.json({ok:true})}));
  A.delete('/'+name+'/:id',wrap(async(req,res)=>{await Q(`DELETE FROM ${table} WHERE id=?`,[req.params.id]);await audit(req.user.id,'DELETE '+table,req.params.id);res.json({ok:true})}));
};
crud('users','users',['role','name','email','roll_no','dept','phone','status']);
crud('subjects','subjects',['code','title','credits']);
crud('exams','exams',['subject_id','title','start_time','end_time','duration_min','total_marks','pass_percent']);
crud('questions','questions',['exam_id','type','text','options','correct_option','marks']);
crud('announcements','announcements',['title','body']);
A.get('/stats',wrap(async(req,res)=>{const [s]=await Q('SELECT (SELECT COUNT(*) FROM users WHERE role="student") students,(SELECT COUNT(*) FROM exams) exams,(SELECT COUNT(*) FROM attempts) attempts,(SELECT COALESCE(AVG(percentage),0) FROM results) avgScore');res.json(s)}));
A.get('/monitor',wrap(async(req,res)=>res.json(await Q('SELECT a.*,u.name FROM attempts a JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 100'))));
A.post('/evaluate/:attemptId',wrap(async(req,res)=>{ // body:{marks:{qid:n}}
  let d=0;for(const [qid,m] of Object.entries(req.body.marks||{})){await Q('UPDATE answers SET marks_awarded=? WHERE attempt_id=? AND question_id=?',[m,req.params.attemptId,qid]);d+=+m}
  await Q('UPDATE attempts SET desc_score=?,eval_status="done" WHERE id=?',[d,req.params.attemptId]);
  const [a]=await Q('SELECT a.*,x.total_marks FROM attempts a JOIN exams x ON x.id=a.exam_id WHERE a.id=?',[req.params.attemptId]);
  const total=a.mcq_score+d,pct=+(total*100/a.total_marks).toFixed(2);
  await Q('REPLACE INTO results VALUES(?,?,?,?,?,?,0)',[a.id,a.exam_id,a.user_id,total,pct,grade(pct)]);await audit(req.user.id,'EVALUATE',req.params.attemptId);res.json({total,pct,grade:grade(pct)})}));
A.post('/exams/:id/publish',wrap(async(req,res)=>{await Q('UPDATE results SET published=1 WHERE exam_id=?',[req.params.id]);await Q('UPDATE exams SET results_published=1 WHERE id=?',[req.params.id]);
  await Q('INSERT INTO notifications(user_id,message) SELECT user_id,"Results published" FROM results WHERE exam_id=?',[req.params.id]);await audit(req.user.id,'PUBLISH',req.params.id);res.json({ok:true})}));
A.get('/audit',wrap(async(req,res)=>res.json(await Q('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200'))));
A.get('/export/results.csv',wrap(async(req,res)=>{const rows=await Q('SELECT u.roll_no,x.title,r.total,r.percentage,r.grade FROM results r JOIN users u ON u.id=r.user_id JOIN exams x ON x.id=r.exam_id');
  res.type('text/csv').send(['roll_no,exam,total,percentage,grade',...rows.map(r=>Object.values(r).join(','))].join('\n'))}));
A.get('/settings',wrap(async(req,res)=>res.json(await Q('SELECT * FROM settings'))));
A.put('/settings/:k',wrap(async(req,res)=>{await Q('REPLACE INTO settings VALUES(?,?)',[req.params.k,req.body.v]);res.json({ok:true})}));
app.use('/api/admin',A);

const port=process.env.PORT||3000;app.listen(port,()=>console.log(`OEMS running at http://localhost:${port}`));
