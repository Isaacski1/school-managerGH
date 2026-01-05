import { firestore } from './firebase';
import { 
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, query, where, orderBy, limit 
} from 'firebase/firestore';
import { User, UserRole, Student, AttendanceRecord, TeacherAttendanceRecord, Assessment, Notice, ClassTimetable, SystemNotification, MonthlyTeacherAttendance, TeacherAttendanceAnalytics, StudentRemark, StudentSkills } from "../types";
import { DEFAULT_SUBJECTS, CURRENT_TERM, ACADEMIC_YEAR, CLASSES_LIST } from "../constants";

class FirestoreService {
  // Helper to get array from collection
  private async getCollection<T>(collectionName: string): Promise<T[]> {
    const querySnapshot = await getDocs(collection(firestore, collectionName));
    return querySnapshot.docs.map(doc => doc.data() as T);
  }

  // --- Config ---
  async getSchoolConfig() {
      const docRef = doc(firestore, 'settings', 'schoolConfig');
      const snap = await getDoc(docRef);
      if (snap.exists()) return snap.data() as any;
      return {
          schoolName: 'Noble Care Academy',
          academicYear: ACADEMIC_YEAR,
          currentTerm: `Term ${CURRENT_TERM}`,
          headTeacherRemark: 'An outstanding performance. The school is proud of you.',
          termEndDate: '2024-12-20'
      };
  }

  async updateSchoolConfig(config: any) {
      await setDoc(doc(firestore, 'settings', 'schoolConfig'), config);
  }

  // --- Users ---
  async getUsers(): Promise<User[]> {
      return this.getCollection<User>('users');
  }

  async addUser(user: User): Promise<void> {
      await setDoc(doc(firestore, 'users', user.id), user);
  }

  async deleteUser(id: string): Promise<void> {
      await deleteDoc(doc(firestore, 'users', id));
  }

  // --- Students ---
  async getStudents(classId?: string): Promise<Student[]> {
      const studentsRef = collection(firestore, 'students');
      if (classId) {
          const q = query(studentsRef, where('classId', '==', classId));
          const snap = await getDocs(q);
          return snap.docs.map(d => d.data() as Student);
      }
      return this.getCollection<Student>('students');
  }

  async addStudent(student: Student): Promise<void> {
      await setDoc(doc(firestore, 'students', student.id), student);
  }

  async updateStudent(student: Student): Promise<void> {
      await updateDoc(doc(firestore, 'students', student.id), { ...student });
  }

  async deleteStudent(id: string): Promise<void> {
      await deleteDoc(doc(firestore, 'students', id));
  }

  // --- Subjects ---
  async getSubjects(): Promise<string[]> {
      const docRef = doc(firestore, 'settings', 'subjects');
      const snap = await getDoc(docRef);
      if (snap.exists()) return snap.data().list;
      // Initialize if empty
      await setDoc(docRef, { list: DEFAULT_SUBJECTS });
      return DEFAULT_SUBJECTS;
  }

  async addSubject(name: string): Promise<void> {
      const current = await this.getSubjects();
      if (!current.includes(name)) {
          await setDoc(doc(firestore, 'settings', 'subjects'), { list: [...current, name] });
      }
  }
  
  async updateSubject(oldName: string, newName: string): Promise<void> {
       const current = await this.getSubjects();
       const idx = current.indexOf(oldName);
       if (idx !== -1) {
           current[idx] = newName;
           await setDoc(doc(firestore, 'settings', 'subjects'), { list: current });
       }
  }

  async deleteSubject(name: string): Promise<void> {
      const current = await this.getSubjects();
      const updated = current.filter(s => s !== name);
      await setDoc(doc(firestore, 'settings', 'subjects'), { list: updated });
  }

  // --- Attendance ---
  async getAttendance(classId: string, date: string): Promise<AttendanceRecord | undefined> {
      const id = `${classId}_${date}`;
      const snap = await getDoc(doc(firestore, 'attendance', id));
      return snap.exists() ? snap.data() as AttendanceRecord : undefined;
  }

  async getClassAttendance(classId: string): Promise<AttendanceRecord[]> {
      const q = query(collection(firestore, 'attendance'), where('classId', '==', classId));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as AttendanceRecord);
  }

  async saveAttendance(record: AttendanceRecord): Promise<void> {
      // ID convention: classId_date
      await setDoc(doc(firestore, 'attendance', record.id), record);
  }

  // --- Assessments ---
  async getAssessments(classId: string, subject: string): Promise<Assessment[]> {
      // NOTE: Removed compound query to avoid index requirements error. 
      // Filter by classId first (high selectivity), then filter subject in memory.
      const q = query(collection(firestore, 'assessments'), where('classId', '==', classId));
      const snap = await getDocs(q);
      const all = snap.docs.map(d => d.data() as Assessment);
      return all.filter(a => a.subject === subject);
  }

  async getAllAssessments(): Promise<Assessment[]> {
      return this.getCollection<Assessment>('assessments');
  }

  async saveAssessment(assessment: Assessment): Promise<void> {
      await setDoc(doc(firestore, 'assessments', assessment.id), assessment);
  }

  /**
   * Remove all assessments for a given class. Optionally seed default zeroed
   * assessments for every student in the class across configured subjects.
   */
  async resetAssessmentsForClass(classId: string, seedDefaults = false): Promise<void> {
      const q = query(collection(firestore, 'assessments'), where('classId', '==', classId));
      const snap = await getDocs(q);
      const deletions = snap.docs.map(d => deleteDoc(doc(firestore, 'assessments', d.id)));
      await Promise.all(deletions);

      if (seedDefaults) {
          const students = await this.getStudents(classId);
          const subjects = await this.getSubjects();
          const ops: Promise<void>[] = [];

          for (const student of students) {
              for (const subject of subjects) {
                  const id = `${student.id}_${subject}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
                  const assessment: Assessment = {
                      id,
                      studentId: student.id,
                      classId,
                      term: CURRENT_TERM as 1 | 2 | 3,
                      academicYear: ACADEMIC_YEAR,
                      subject,
                      testScore: 0,
                      homeworkScore: 0,
                      projectScore: 0,
                      examScore: 0,
                      total: 0
                  };
                  ops.push(setDoc(doc(firestore, 'assessments', id), assessment));
              }
          }
          await Promise.all(ops);
      }
  }

  // --- Notices ---
  async getNotices(): Promise<Notice[]> {
      const q = query(collection(firestore, 'notices')); 
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as Notice);
  }

  async addNotice(notice: Notice): Promise<void> {
      await setDoc(doc(firestore, 'notices', notice.id), notice);
  }

  async deleteNotice(id: string): Promise<void> {
      await deleteDoc(doc(firestore, 'notices', id));
  }

  // --- Notifications (Admin Activity Log) ---
  async addSystemNotification(message: string, type: 'attendance' | 'assessment' | 'system'): Promise<void> {
      const id = Date.now().toString();
      const notification: SystemNotification = {
          id,
          message,
          createdAt: Date.now(),
          isRead: false,
          type
      };
      await setDoc(doc(firestore, 'admin_notifications', id), notification);
  }

  async getSystemNotifications(): Promise<SystemNotification[]> {
      const q = query(collection(firestore, 'admin_notifications'), orderBy('createdAt', 'desc'), limit(20));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as SystemNotification);
  }

  async markNotificationAsRead(id: string): Promise<void> {
      await updateDoc(doc(firestore, 'admin_notifications', id), { isRead: true });
  }

  async deleteSystemNotification(id: string): Promise<void> {
      await deleteDoc(doc(firestore, 'admin_notifications', id));
  }

  // --- Timetables ---
  async getTimetable(classId: string): Promise<ClassTimetable | undefined> {
      const snap = await getDoc(doc(firestore, 'timetables', classId));
      return snap.exists() ? snap.data() as ClassTimetable : undefined;
  }

  async saveTimetable(timetable: ClassTimetable): Promise<void> {
      await setDoc(doc(firestore, 'timetables', timetable.classId), timetable);
  }
  
  // --- Dashboard/Aggregates ---
  async getStudentPerformance(studentId: string, classId: string) {
    // Fetch all attendance for class
    const attendanceRecords = await this.getClassAttendance(classId);
    
    const totalDays = attendanceRecords.length;
    const presentDays = attendanceRecords.filter(r => r.presentStudentIds.includes(studentId)).length;
    const attendancePercentage = totalDays === 0 ? 0 : Math.round((presentDays / totalDays) * 100);

    const schoolDates = attendanceRecords.map(r => r.date).sort();
    const presentDates = attendanceRecords
        .filter(r => r.presentStudentIds.includes(studentId))
        .map(r => r.date)
        .sort();

    // Fetch assessments for student
    // NOTE: Removed compound query (studentId + term) to avoid index error
    const q = query(collection(firestore, 'assessments'), where('studentId', '==', studentId));
    const snap = await getDocs(q);
    const allAssessments = snap.docs
        .map(d => d.data() as Assessment)
        .filter(a => true); // Show assessments from all terms
    
    const subjects = await this.getSubjects();

    const grades = subjects.map(subject => {
        const found = allAssessments.find(a => a.subject === subject);
        if (found) return found;
        return { subject, total: 0 } as Partial<Assessment>;
    });

    return {
        attendance: { 
            total: totalDays, 
            present: presentDays, 
            percentage: attendancePercentage,
            schoolDates,
            presentDates
        },
        grades
    };
  }

  async getDashboardStats() {
    // Parallel fetch for dashboard speed
    const [studentsSnap, usersSnap, attendanceSnap] = await Promise.all([
        getDocs(collection(firestore, 'students')),
        getDocs(collection(firestore, 'users')),
        getDocs(collection(firestore, 'attendance'))
    ]);

    const students = studentsSnap.docs.map(d => d.data() as Student);
    const users = usersSnap.docs.map(d => d.data() as User);
    const attendance = attendanceSnap.docs.map(d => d.data() as AttendanceRecord);

    const male = students.filter(s => s.gender === 'Male').length;
    const female = students.filter(s => s.gender === 'Female').length;

    const classAttendance = CLASSES_LIST.map(cls => {
        const records = attendance.filter(r => r.classId === cls.id);
        const studentsInClass = students.filter(s => s.classId === cls.id);
        
        if (records.length > 0 && studentsInClass.length > 0) {
            const totalPossible = records.length * studentsInClass.length;
            const totalPresent = records.reduce((sum, r) => sum + r.presentStudentIds.length, 0);
            const pct = Math.round((totalPresent / totalPossible) * 100);
            return { className: cls.name, percentage: pct, id: cls.id };
        }
        
        return { className: cls.name, percentage: 0, id: cls.id };
    });

    return {
        studentsCount: students.length,
        teachersCount: users.filter(u => u.role === UserRole.TEACHER).length,
        gender: { male, female },
        classAttendance
    };
  }

  // --- Teacher Attendance ---
  async getTeacherAttendance(teacherId: string, date: string): Promise<TeacherAttendanceRecord | undefined> {
      const id = `${teacherId}_${date}`;
      const snap = await getDoc(doc(firestore, 'teacher_attendance', id));
      return snap.exists() ? snap.data() as TeacherAttendanceRecord : undefined;
  }

  async getAllTeacherAttendance(date: string): Promise<TeacherAttendanceRecord[]> {
      const q = query(collection(firestore, 'teacher_attendance'), where('date', '==', date));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as TeacherAttendanceRecord);
  }

  async saveTeacherAttendance(record: TeacherAttendanceRecord): Promise<void> {
      // ID convention: teacherId_date
      await setDoc(doc(firestore, 'teacher_attendance', record.id), record);
  }

  async getAllTeacherAttendanceRecords(): Promise<TeacherAttendanceRecord[]> {
      return this.getCollection<TeacherAttendanceRecord>('teacher_attendance');
  }

    // --- Student Remarks ---
    async getStudentRemarks(classId: string): Promise<StudentRemark[]> {
        const q = query(collection(firestore, 'student_remarks'), where('classId', '==', classId));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as StudentRemark);
    }

    async saveStudentRemark(remark: StudentRemark): Promise<void> {
        await setDoc(doc(firestore, 'student_remarks', remark.id), remark);
    }
    
    // --- Student Skills ---
    async getStudentSkills(classId: string): Promise<StudentSkills[]> {
        const q = query(collection(firestore, 'student_skills'), where('classId', '==', classId));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as StudentSkills);
    }

    async saveStudentSkills(skills: StudentSkills): Promise<void> {
        await setDoc(doc(firestore, 'student_skills', skills.id), skills);
    }

   // --- Teacher Attendance Analytics ---
   async getTeacherAttendanceAnalytics(termStartDate?: string, vacationDate?: string): Promise<TeacherAttendanceAnalytics[]> {
       const teachers = await this.getUsers();
       const teacherUsers = teachers.filter(t => t.role === UserRole.TEACHER);
       const allRecords = await this.getAllTeacherAttendanceRecords();
        const config = await this.getSchoolConfig();


       // Use term start date or default to current academic year start
       const startDate = termStartDate || config.schoolReopenDate || `${ACADEMIC_YEAR.split('-')[0]}-09-01`; // September 1st
       const endDate = vacationDate || new Date().toISOString().split('T')[0]; // Today or vacation date

       const analytics: TeacherAttendanceAnalytics[] = [];

       for (const teacher of teacherUsers) {
           const teacherRecords = allRecords.filter(r => r.teacherId === teacher.id);

           // Filter records within the date range
           const recordsInRange = teacherRecords.filter(r => {
               return r.date >= startDate && r.date <= endDate;
           });

           // Group records by month
           const monthlyData: Record<string, { total: number, present: number }> = {};

           recordsInRange.forEach(record => {
               const date = new Date(record.date);
               const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

               if (!monthlyData[monthKey]) {
                   monthlyData[monthKey] = { total: 0, present: 0 };
               }

               monthlyData[monthKey].total += 1;
               if (record.status === 'present') {
                   monthlyData[monthKey].present += 1;
               }
           });

           // Calculate monthly breakdown
           const monthlyBreakdown: MonthlyTeacherAttendance[] = Object.entries(monthlyData)
               .map(([month, data]) => {
                   const [year, monthNum] = month.split('-');
                   const attendanceRate = data.total > 0 ? Math.round((data.present / data.total) * 100) : 0;

                   return {
                       teacherId: teacher.id,
                       teacherName: teacher.name,
                       month,
                       year: parseInt(year),
                       totalWorkingDays: data.total,
                       presentDays: data.present,
                       absentDays: data.total - data.present,
                       attendanceRate,
                       trend: 'stable' as const // Will be calculated based on previous months
                   };
               })
               .sort((a, b) => a.month.localeCompare(b.month));

           // Calculate trend for each month
           for (let i = 0; i < monthlyBreakdown.length; i++) {
               if (i > 0) {
                   const current = monthlyBreakdown[i].attendanceRate;
                   const previous = monthlyBreakdown[i - 1].attendanceRate;
                   if (current > previous + 5) {
                       monthlyBreakdown[i].trend = 'improving';
                   } else if (current < previous - 5) {
                       monthlyBreakdown[i].trend = 'declining';
                   } else {
                       monthlyBreakdown[i].trend = 'stable';
                   }
               }
           }

           // Calculate overall attendance
           const totalDays = monthlyBreakdown.reduce((sum, month) => sum + month.totalWorkingDays, 0);
           const totalPresent = monthlyBreakdown.reduce((sum, month) => sum + month.presentDays, 0);
           const overallAttendance = totalDays > 0 ? Math.round((totalPresent / totalDays) * 100) : 0;

           analytics.push({
               teacherId: teacher.id,
               teacherName: teacher.name,
               overallAttendance,
               monthlyBreakdown,
               termStartDate: startDate,
               vacationDate: endDate !== new Date().toISOString().split('T')[0] ? endDate : undefined
           });
       }

       return analytics;
   }
}
export const db = new FirestoreService();
