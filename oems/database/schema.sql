-- OEMS schema (MySQL 8). Run: mysql -u root -p < database/schema.sql
CREATE DATABASE IF NOT EXISTS oems; USE oems;
DROP TABLE IF EXISTS answers,results,attempts,questions,exams,enrollments,subjects,notifications,announcements,audit_logs,settings,users;
CREATE TABLE users(id INT AUTO_INCREMENT PRIMARY KEY,role ENUM('student','admin') NOT NULL,name VARCHAR(80) NOT NULL,email VARCHAR(120) UNIQUE NOT NULL,password_hash CHAR(64) NOT NULL,roll_no VARCHAR(20),dept VARCHAR(30),phone VARCHAR(20),status ENUM('active','inactive') DEFAULT 'active',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE subjects(id INT AUTO_INCREMENT PRIMARY KEY,code VARCHAR(10) UNIQUE NOT NULL,title VARCHAR(120) NOT NULL,credits TINYINT DEFAULT 3);
CREATE TABLE enrollments(user_id INT,subject_id INT,enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,subject_id),FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE);
CREATE TABLE exams(id INT AUTO_INCREMENT PRIMARY KEY,subject_id INT NOT NULL,title VARCHAR(120) NOT NULL,start_time DATETIME NOT NULL,end_time DATETIME NOT NULL,duration_min INT NOT NULL,total_marks INT NOT NULL,pass_percent INT DEFAULT 40,results_published BOOLEAN DEFAULT FALSE,FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE);
CREATE TABLE questions(id INT AUTO_INCREMENT PRIMARY KEY,exam_id INT NOT NULL,type ENUM('mcq','descriptive') NOT NULL,text TEXT NOT NULL,options JSON,correct_option TINYINT,marks INT DEFAULT 1,FOREIGN KEY(exam_id) REFERENCES exams(id) ON DELETE CASCADE);
CREATE TABLE attempts(id INT AUTO_INCREMENT PRIMARY KEY,exam_id INT NOT NULL,user_id INT NOT NULL,started_at DATETIME,submitted_at DATETIME,status ENUM('in_progress','submitted') DEFAULT 'in_progress',mcq_score INT DEFAULT 0,desc_score INT DEFAULT 0,eval_status ENUM('pending','done') DEFAULT 'pending',UNIQUE(exam_id,user_id),FOREIGN KEY(exam_id) REFERENCES exams(id) ON DELETE CASCADE,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
CREATE TABLE answers(attempt_id INT,question_id INT,selected_option TINYINT,answer_text TEXT,marked BOOLEAN DEFAULT FALSE,marks_awarded INT DEFAULT 0,PRIMARY KEY(attempt_id,question_id),FOREIGN KEY(attempt_id) REFERENCES attempts(id) ON DELETE CASCADE,FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE);
CREATE TABLE results(attempt_id INT PRIMARY KEY,exam_id INT,user_id INT,total INT,percentage DECIMAL(5,2),grade VARCHAR(3),published BOOLEAN DEFAULT FALSE,FOREIGN KEY(attempt_id) REFERENCES attempts(id) ON DELETE CASCADE);
CREATE TABLE notifications(id INT AUTO_INCREMENT PRIMARY KEY,user_id INT,message VARCHAR(255),is_read BOOLEAN DEFAULT FALSE,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
CREATE TABLE announcements(id INT AUTO_INCREMENT PRIMARY KEY,title VARCHAR(120),body TEXT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE audit_logs(id INT AUTO_INCREMENT PRIMARY KEY,user_id INT,action VARCHAR(60),detail VARCHAR(255),created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE settings(k VARCHAR(40) PRIMARY KEY,v VARCHAR(255));
CREATE INDEX idx_attempt_user ON attempts(user_id); CREATE INDEX idx_exam_time ON exams(start_time,end_time);
-- SAMPLE DATA (DEMO ONLY: SHA-256 password hashes)
INSERT INTO users(role,name,email,password_hash,roll_no,dept) VALUES
('admin','Admin 01','admin@exam.demo',SHA2('Admin@123',256),NULL,NULL),
('admin','Admin 02','admin2@exam.demo',SHA2('Admin@123',256),NULL,NULL);
INSERT INTO users(role,name,email,password_hash,roll_no,dept,phone) VALUES
('student','Student 01','student1@exam.demo',SHA2('Student@123',256),'R1001','CSE','9000000001'),
('student','Student 02','student2@exam.demo',SHA2('Student@123',256),'R1002','IT','9000000002'),
('student','Student 03','student3@exam.demo',SHA2('Student@123',256),'R1003','ECE','9000000003'),
('student','Student 04','student4@exam.demo',SHA2('Student@123',256),'R1004','CSE','9000000004');
INSERT INTO subjects(code,title,credits) VALUES('DBMS','Database Management Systems',4),('OS','Operating Systems',3),('CN','Computer Networks',3),('DSA','Data Structures',4);
INSERT INTO enrollments(user_id,subject_id) VALUES(3,1),(3,2),(4,1),(5,1);
INSERT INTO exams(subject_id,title,start_time,end_time,duration_min,total_marks,pass_percent) VALUES
(1,'DBMS Mid-Term',NOW()-INTERVAL 1 DAY,NOW()+INTERVAL 30 DAY,30,8,40),(2,'OS Quiz 1',NOW()+INTERVAL 3 DAY,NOW()+INTERVAL 4 DAY,20,4,40);
INSERT INTO questions(exam_id,type,text,options,correct_option,marks) VALUES
(1,'mcq','Which normal form removes transitive dependency?','["1NF","2NF","3NF","BCNF"]',2,1),
(1,'mcq','Which SQL clause filters grouped rows?','["WHERE","HAVING","ORDER BY","LIMIT"]',1,1),
(1,'mcq','Which property ensures all-or-nothing execution?','["Atomicity","Consistency","Isolation","Durability"]',0,1),
(1,'mcq','A foreign key enforces...','["Uniqueness","Referential integrity","Indexing","Encryption"]',1,1),
(1,'descriptive','Explain ACID properties with an example.',NULL,NULL,4);
INSERT INTO announcements(title,body) VALUES('Welcome','Demo announcement: the DBMS Mid-Term is open.');
INSERT INTO settings VALUES('passPercent','40'),('allowRetake','false'),('maintenance','false');
