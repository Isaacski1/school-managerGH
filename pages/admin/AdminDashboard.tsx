import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { db } from '../../services/mockDb';
import { 
  Users, 
  GraduationCap, 
  CreditCard, 
  MoreHorizontal, 
  UserPlus,
  BookOpen,
  Settings,
  Bell,
  Eye,
  Edit,
  X,
  Save,
  User as UserIcon,
  ArrowUpRight,
  Calendar,
  BarChart2,
  Trophy,
  RefreshCw,
  AlertOctagon
} from 'lucide-react';
import { Notice, Student } from '../../types';
import { CLASSES_LIST, calculateGrade, getGradeColor, CURRENT_TERM } from '../../constants';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    students: 0,
    teachers: 0,
    classes: CLASSES_LIST.length,
    maleStudents: 0,
    femaleStudents: 0,
    classAttendance: [] as { className: string, percentage: number, id: string }[]
  });
  const [notices, setNotices] = useState<Notice[]>([]);
  const [recentStudents, setRecentStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  
  // Configuration State
  const [schoolConfig, setSchoolConfig] = useState({
      academicYear: '...',
      currentTerm: '...'
  });

  // Performance Stats
  const [gradeDistribution, setGradeDistribution] = useState<Record<string, number>>({ A:0, B:0, C:0, D:0, F:0 });
  const [topStudents, setTopStudents] = useState<{name: string, class: string, avg: number}[]>([]);

  // --- Modal States ---
  const [viewStudent, setViewStudent] = useState<Student | null>(null);
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Student>>({});

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
        const dashboardStats = await db.getDashboardStats();
        const students = await db.getStudents();
        const fetchedNotices = await db.getNotices();
        const config = await db.getSchoolConfig();

        setSchoolConfig({
            academicYear: config.academicYear,
            currentTerm: config.currentTerm
        });
        
        // Use Dynamic Term Number from config string (e.g. "Term 2" -> 2)
        // Fallback to CURRENT_TERM constant if parsing fails
        let dynamicTerm = CURRENT_TERM;
        if (config.currentTerm) {
            const match = config.currentTerm.match(/\d+/);
            if (match) dynamicTerm = parseInt(match[0]);
        }

        // Performance Calculations
        const allAssessments = await db.getAllAssessments();
        
        // 1. Group by Student
        const studentScores: Record<string, { total: number, count: number, name: string, classId: string }> = {};
        
        // Map ID to Name for easier lookup
        const studentMap = new Map(students.map(s => [s.id, s]));

        allAssessments.forEach(a => {
            // Filter using the DYNAMIC term
            if(a.term === dynamicTerm as any && studentMap.has(a.studentId)) {
                if(!studentScores[a.studentId]) {
                    const s = studentMap.get(a.studentId)!;
                    studentScores[a.studentId] = { total: 0, count: 0, name: s.name, classId: s.classId };
                }
                const score = a.total || ((a.testScore||0) + (a.homeworkScore||0) + (a.projectScore||0) + (a.examScore||0));
                studentScores[a.studentId].total += score;
                studentScores[a.studentId].count += 1;
            }
        });

        // 2. Calculate Averages & Grade Distribution
        const counts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
        const averagesList: {name: string, class: string, avg: number}[] = [];

        Object.values(studentScores).forEach(s => {
            const avg = s.count > 0 ? s.total / s.count : 0;
            const { grade } = calculateGrade(avg);
            if(counts[grade as keyof typeof counts] !== undefined) {
                counts[grade as keyof typeof counts]++;
            }
            averagesList.push({
                name: s.name,
                class: CLASSES_LIST.find(c => c.id === s.classId)?.name || 'N/A',
                avg: parseFloat(avg.toFixed(1))
            });
        });

        // 3. Sort for Top Students
        averagesList.sort((a, b) => b.avg - a.avg);

        setStats({
          students: dashboardStats.studentsCount,
          teachers: dashboardStats.teachersCount,
          classes: CLASSES_LIST.length,
          maleStudents: dashboardStats.gender.male,
          femaleStudents: dashboardStats.gender.female,
          classAttendance: dashboardStats.classAttendance
        });
        setNotices(fetchedNotices);
        setRecentStudents(students.slice(-5).reverse());
        
        setGradeDistribution(counts);
        setTopStudents(averagesList.slice(0, 5));
    } catch (err: any) {
        console.error("Dashboard fetch error:", err);
        setError("Failed to load dashboard data. Please check your internet connection or database permissions.");
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
        window.addEventListener('click', handleClickOutside);
    }
    return () => window.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  const handleMenuClick = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setOpenMenuId(openMenuId === id ? null : id);
  };

  // --- Action Handlers ---

  const handleViewDetails = async (student: Student) => {
      setOpenMenuId(null);
      setViewStudent(student);
      setPerformanceData(null);
      try {
          const data = await db.getStudentPerformance(student.id, student.classId);
          setPerformanceData(data);
      } catch (e) {
          console.error(e);
      }
  };

  const handleEditStudent = (student: Student) => {
      setOpenMenuId(null);
      setEditingStudent(student);
      setEditFormData({ ...student });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingStudent || !editFormData.name) return;

      try {
          const updated = { ...editingStudent, ...editFormData } as Student;
          await db.updateStudent(updated);
          
          // Refresh Data
          fetchData();
          setEditingStudent(null);
      } catch(e) {
          alert("Failed to update student");
      }
  };

  // --- Components ---

  const StatCard = ({ title, value, subtext, icon: Icon, colorClass, iconColorClass }: any) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow min-h-[140px]">
      <div className="flex justify-between items-start z-10">
        <div>
           <p className="text-slate-500 text-sm font-semibold uppercase tracking-wider">{title}</p>
           <h3 className="text-3xl font-bold text-slate-800 mt-2">{value}</h3>
           {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
        </div>
      </div>
      <div className={`absolute -right-4 -bottom-4 opacity-10 pointer-events-none transform group-hover:scale-110 transition-transform ${iconColorClass}`}>
         <Icon size={100} />
      </div>
    </div>
  );

  const AttendanceChart = () => {
    const data = stats.classAttendance;
    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full flex flex-col">
             <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="font-bold text-slate-800 text-lg">Class Attendance</h3>
                    <p className="text-xs text-slate-500">Live participation by Class</p>
                </div>
            </div>
            
            <div className="flex-1 flex items-end justify-between gap-1 sm:gap-2 px-1 pb-2 h-64 w-full overflow-x-auto">
                {data.map((item) => {
                    let barColor = 'bg-amber-500'; // Standard Noble Gold
                    if (item.percentage < 50) barColor = 'bg-red-600'; // Warning Red
                    else if (item.percentage >= 80) barColor = 'bg-emerald-500'; // Excellence

                    return (
                        <div key={item.id} className="flex flex-col items-center flex-1 group h-full justify-end min-w-[20px]">
                            <div className="w-full max-w-[30px] bg-slate-50 rounded-t-sm relative flex items-end h-full hover:bg-slate-100 transition-colors">
                                 <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                     {item.className}: {item.percentage}%
                                 </div>
                                 <div 
                                    className={`w-full ${barColor} rounded-t-sm transition-all duration-1000 ease-out relative`}
                                    style={{ height: `${item.percentage}%` }}
                                 ></div>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-2 font-medium truncate w-full text-center">
                                {item.className.replace('Nursery ', 'N').replace('Class ', 'P').replace('Primary ', 'P').replace('KG ', 'K').replace('JHS ', 'J')}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    )
  };

  const GenderDonut = () => {
     const total = stats.maleStudents + stats.femaleStudents || 1;
     const malePct = Math.round((stats.maleStudents / total) * 100);
     const femalePct = Math.round((stats.femaleStudents / total) * 100);

     return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full flex flex-col justify-center items-center">
            <h3 className="font-bold text-slate-800 w-full mb-6">Demographics</h3>
            <div className="relative w-48 h-48">
                <div className="absolute inset-0 rounded-full border-8 border-slate-50"></div>
                <div 
                    className="absolute inset-0 rounded-full"
                    style={{
                        background: `conic-gradient(#7f1d1d 0% ${femalePct}%, #f59e0b ${femalePct}% 100%)`, // Red (Female) and Gold (Male) for Noble Theme
                        mask: 'radial-gradient(transparent 60%, black 61%)',
                        WebkitMask: 'radial-gradient(transparent 60%, black 61%)'
                    }}
                ></div>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <span className="text-3xl font-bold text-slate-800">{stats.students}</span>
                     <span className="text-xs text-slate-500 uppercase tracking-wide">Total</span>
                </div>
            </div>
            <div className="flex w-full justify-between px-6 mt-8">
                <div className="text-center">
                    <p className="text-xs text-slate-400 mb-1">Female</p>
                    <p className="text-xl font-bold text-red-900">{femalePct}%</p>
                </div>
                <div className="w-px bg-slate-100"></div>
                <div className="text-center">
                    <p className="text-xs text-slate-400 mb-1">Male</p>
                    <p className="text-xl font-bold text-amber-500">{malePct}%</p>
                </div>
            </div>
        </div>
     )
  }

  const PerformanceSection = () => {
    const totalGrades = Object.keys(gradeDistribution).reduce((sum, key) => sum + gradeDistribution[key], 0) || 1;
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {/* Grade Distribution Chart */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center">
                    <BarChart2 className="w-5 h-5 mr-2 text-red-700"/> Academic Performance Rate ({schoolConfig.currentTerm})
                </h3>
                <div className="space-y-4">
                    {Object.entries(gradeDistribution).map(([grade, count]: [string, number]) => {
                        const percentage = Math.round((count / totalGrades) * 100);
                        // Standard Grade Colors
                        let barColor = 'bg-emerald-500';
                        if (grade === 'B') barColor = 'bg-blue-500';
                        if (grade === 'C') barColor = 'bg-amber-400';
                        if (grade === 'D') barColor = 'bg-orange-500';
                        if (grade === 'F') barColor = 'bg-red-600';

                        return (
                            <div key={grade} className="flex items-center">
                                <div className="w-8 font-bold text-slate-700">{grade}</div>
                                <div className="flex-1 mx-3 h-3 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full ${barColor} rounded-full transition-all duration-1000`} style={{ width: `${percentage}%` }}></div>
                                </div>
                                <div className="w-16 text-right text-xs text-slate-500">
                                    <span className="font-bold text-slate-800">{count}</span> ({percentage}%)
                                </div>
                            </div>
                        );
                    })}
                    {totalGrades === 1 && Object.values(gradeDistribution).every(v => v === 0) && (
                         <div className="text-center text-slate-400 py-4 text-sm">No academic data available for {schoolConfig.currentTerm}.</div>
                    )}
                </div>
            </div>

            {/* Top Students */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                    <Trophy className="w-5 h-5 mr-2 text-amber-500"/> Top Performers
                </h3>
                <div className="space-y-4">
                    {topStudents.length === 0 ? (
                        <p className="text-sm text-slate-400 italic">No data yet.</p>
                    ) : (
                        topStudents.map((s, i) => (
                            <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                                <div className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${i === 0 ? 'bg-amber-500' : 'bg-slate-300'}`}>
                                        {i + 1}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                                        <p className="text-xs text-slate-400">{s.class}</p>
                                    </div>
                                </div>
                                <span className="text-sm font-bold text-red-900">{s.avg}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
  };

  if (loading) {
      return (
          <Layout title="Dashboard">
              <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)]">
                  <div className="relative">
                      {/* Outer glow */}
                      <div className="absolute inset-0 bg-amber-100 rounded-full blur-xl opacity-50 animate-pulse"></div>
                      
                      {/* Spinner */}
                      <div className="relative w-16 h-16 border-4 border-slate-100 border-t-red-900 rounded-full animate-spin shadow-sm"></div>
                      
                      {/* Inner Icon */}
                      <div className="absolute inset-0 flex items-center justify-center">
                         <div className="w-2 h-2 bg-red-900 rounded-full"></div>
                      </div>
                  </div>
                  
                  <div className="mt-8 text-center space-y-2">
                      <h3 className="text-lg font-bold text-slate-800">Noble Care Academy</h3>
                      <div className="flex items-center justify-center space-x-1">
                          <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                          <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="w-2 h-2 bg-red-800 rounded-full animate-bounce"></div>
                      </div>
                  </div>
              </div>
          </Layout>
      )
  }

  if (error) {
      return (
          <Layout title="Dashboard">
              <div className="flex items-center justify-center h-96 flex-col p-8">
                  <AlertOctagon size={48} className="text-red-400 mb-4"/>
                  <h3 className="text-lg font-bold text-slate-700">Unable to load dashboard</h3>
                  <p className="text-slate-500 text-center max-w-md mb-6">{error}</p>
                  <button onClick={fetchData} className="flex items-center px-4 py-2 bg-red-800 text-white rounded-lg hover:bg-red-900 transition-colors">
                      <RefreshCw size={16} className="mr-2"/> Retry
                  </button>
              </div>
          </Layout>
      )
  }

  return (
    <Layout title="Dashboard">
      {/* Top Welcome Section */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-800">Welcome, Headmistress</h1>
            <p className="text-slate-500 mt-1">Here is what's happening in your school today.</p>
        </div>
        
        {/* Term and Actions */}
        <div className="flex items-center gap-4">
             <div className="text-right mr-2 hidden sm:block">
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Academic Period</p>
                 <p className="text-sm font-bold text-red-900">{schoolConfig.currentTerm} &bull; {schoolConfig.academicYear}</p>
             </div>

             <div className="flex gap-3">
                <Link to="/admin/students" className="flex items-center px-4 py-2 bg-red-900 text-white rounded-lg hover:bg-red-950 transition-colors shadow-sm text-sm font-medium">
                    <UserPlus size={16} className="mr-2" />
                    Add Student
                </Link>
                <Link to="/admin/teachers" className="flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm text-sm font-medium">
                    <Users size={16} className="mr-2" />
                    Add Staff
                </Link>
             </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard 
            title="Students" 
            value={stats.students} 
            subtext="+12 this month"
            icon={GraduationCap} 
            colorClass="bg-red-50"
            iconColorClass="text-red-700"
        />
        <StatCard 
            title="Teachers" 
            value={stats.teachers} 
            subtext="Fully Staffed"
            icon={Users} 
            colorClass="bg-amber-50" 
            iconColorClass="text-amber-600"
        />
        <StatCard 
            title="Notices" 
            value={notices.length} 
            subtext="Active Announcements"
            icon={Bell} 
            colorClass="bg-blue-50" 
            iconColorClass="text-blue-600"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
         <div className="lg:col-span-2 h-96">
            <AttendanceChart />
         </div>
         <div className="h-96">
            <GenderDonut />
         </div>
      </div>

      {/* New Performance Section */}
      <PerformanceSection />

      {/* Bottom Section: Recent Students & Notices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Recent Students Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-visible">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-slate-800">New Admissions</h3>
                    <p className="text-xs text-slate-500">Recently added students</p>
                </div>
                <Link to="/admin/students" className="text-sm text-red-700 hover:text-red-800 font-medium bg-red-50 px-3 py-1 rounded-full transition-colors">View All</Link>
            </div>
            <div className="overflow-x-auto overflow-y-visible">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 font-semibold">
                        <tr>
                            <th className="px-6 py-3">Student Name</th>
                            <th className="px-6 py-3">Assigned Class</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {recentStudents.length === 0 ? (
                             <tr><td colSpan={4} className="p-6 text-center text-slate-400">No students yet.</td></tr>
                        ) : (
                            recentStudents.map((s, i) => (
                                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-800 flex items-center">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs text-white mr-3 shadow-sm ${s.gender === 'Male' ? 'bg-amber-400' : 'bg-red-800'}`}>
                                            {s.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p>{s.name}</p>
                                            <p className="text-[10px] text-slate-400 uppercase">{s.gender}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200">
                                            {CLASSES_LIST.find(c => c.id === s.classId)?.name}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                                            Active
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="relative">
                                            <button 
                                                onClick={(e) => handleMenuClick(e, s.id)}
                                                className={`transition-colors p-1.5 rounded-full hover:bg-slate-200 ${openMenuId === s.id ? 'text-red-600 bg-slate-100' : 'text-slate-400'}`}
                                            >
                                                <MoreHorizontal size={18} />
                                            </button>
                                            
                                            {/* Dropdown Menu */}
                                            {openMenuId === s.id && (
                                                <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-xl border border-slate-100 z-50 py-1 text-left animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                                    <button 
                                                        onClick={() => handleViewDetails(s)}
                                                        className="flex items-center w-full px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-red-600 font-medium transition-colors"
                                                    >
                                                        <Eye size={14} className="mr-2"/> View Details
                                                    </button>
                                                     <button 
                                                        onClick={() => handleEditStudent(s)}
                                                        className="flex items-center w-full px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-blue-600 font-medium transition-colors"
                                                    >
                                                        <Edit size={14} className="mr-2"/> Edit Student
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Notice Board Widget */}
        <div className="bg-gradient-to-br from-red-900 to-slate-900 rounded-2xl shadow-lg border border-red-800 overflow-hidden flex flex-col text-white">
            <div className="p-6 border-b border-red-800 flex justify-between items-center">
                 <div>
                    <h3 className="font-bold text-amber-400">Notice Board</h3>
                    <p className="text-xs text-slate-300">School announcements</p>
                 </div>
                 <Link to="/admin/settings" className="p-2 rounded-lg hover:bg-white/10 text-slate-300 transition-colors"><Settings size={18}/></Link>
            </div>
            <div className="p-4 space-y-4 flex-1 overflow-y-auto max-h-[400px]">
                {notices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                        <Calendar size={40} className="mb-2 opacity-20"/>
                        <p className="text-sm">No new notices</p>
                    </div>
                ) : (
                    notices.map((n, i) => (
                        <div key={n.id} className="group relative pl-4 pb-4 border-l border-slate-700 last:pb-0">
                            <div className={`absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full border-2 border-slate-800 ${n.type === 'urgent' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                            <div>
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded">{n.date}</span>
                                    {n.type === 'urgent' && <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Urgent</span>}
                                </div>
                                <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{n.message}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
            <div className="p-4 bg-slate-900/50 text-center">
                <Link to="/admin/timetable" className="text-xs font-semibold text-amber-400 hover:text-amber-300 uppercase tracking-wide flex items-center justify-center w-full">
                    View Calendar <ArrowUpRight size={12} className="ml-1"/>
                </Link>
            </div>
        </div>
      </div>
      
      {/* Modals for View/Edit (content unchanged, but necessary to keep file valid if copy-pasting full file) */}
      {viewStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
              
              <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
                  <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center text-2xl font-bold text-slate-500 shadow-inner">
                          {viewStudent.name.charAt(0)}
                      </div>
                      <div>
                          <h2 className="text-xl font-bold text-slate-900">{viewStudent.name}</h2>
                          <div className="flex gap-2 text-sm text-slate-500 mt-1">
                             <span className="flex items-center"><UserIcon size={14} className="mr-1"/> {viewStudent.gender}</span>
                             <span>•</span>
                             <span>{CLASSES_LIST.find(c => c.id === viewStudent.classId)?.name}</span>
                          </div>
                      </div>
                  </div>
                  <button onClick={() => setViewStudent(null)} className="text-slate-400 hover:text-slate-700 transition-colors bg-white p-2 rounded-full shadow-sm hover:shadow">
                      <X size={20} />
                  </button>
              </div>

              <div className="p-6 space-y-8">
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <div className="p-3 bg-amber-100 rounded-full text-amber-600">
                              <Calendar size={24} />
                          </div>
                          <div>
                              <h4 className="font-semibold text-amber-900">Attendance Overview</h4>
                              <p className="text-sm text-amber-700">Current Term Participation</p>
                          </div>
                      </div>
                      <div className="text-right">
                          <span className="text-3xl font-bold text-amber-600">
                              {performanceData ? `${performanceData.attendance.percentage}%` : '...'}
                          </span>
                          <p className="text-xs text-amber-700 font-medium mt-1">
                              {performanceData ? `${performanceData.attendance.present}/${performanceData.attendance.total} Days` : 'Loading'}
                          </p>
                      </div>
                  </div>

                  <div>
                      <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                          <BookOpen size={20} className="mr-2 text-red-800"/> Academic Performance ({schoolConfig.currentTerm})
                      </h3>
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                          <table className="w-full text-sm text-left">
                              <thead className="bg-slate-100 text-slate-600 font-semibold">
                                  <tr>
                                      <th className="px-4 py-3">Subject</th>
                                      <th className="px-4 py-3 text-center">Score</th>
                                      <th className="px-4 py-3 text-center">Grade</th>
                                      <th className="px-4 py-3 text-right">Remark</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                  {performanceData ? performanceData.grades.map((g: any, i: number) => {
                                      const score = g.total || ((g.testScore||0) + (g.homeworkScore||0) + (g.projectScore||0) + (g.examScore||0));
                                      const { grade, remark } = calculateGrade(score);
                                      return (
                                          <tr key={i} className="hover:bg-slate-50">
                                              <td className="px-4 py-3 font-medium text-slate-800">{g.subject}</td>
                                              <td className="px-4 py-3 text-center">{score > 0 ? score : '-'}</td>
                                              <td className="px-4 py-3 text-center">
                                                  <span className={`px-2 py-1 rounded text-xs font-bold ${getGradeColor(grade)}`}>
                                                      {score > 0 ? grade : '-'}
                                                  </span>
                                              </td>
                                              <td className="px-4 py-3 text-right text-slate-500">{score > 0 ? remark : 'N/A'}</td>
                                          </tr>
                                      );
                                  }) : (
                                      <tr><td colSpan={4} className="p-4 text-center text-slate-400 italic">Fetching academic records...</td></tr>
                                  )}
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
           </div>
        </div>
      )}

      {editingStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b pb-2">
                <h3 className="text-lg font-bold text-slate-900">Edit Student Details</h3>
                <button onClick={() => setEditingStudent(null)} className="text-slate-400 hover:text-slate-700">
                    <X size={20}/>
                </button>
            </div>
            
            <form onSubmit={handleSaveEdit} className="space-y-5">
              <div className="space-y-4">
                  <h4 className="text-xs font-bold text-red-800 uppercase tracking-wide">Personal Information</h4>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Full Name</label>
                    <input 
                      type="text" 
                      required
                      className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-red-800 outline-none transition-all placeholder-slate-400"
                      value={editFormData.name || ''}
                      onChange={e => setEditFormData({...editFormData,name: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Gender</label>
                      <select 
                        className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-red-800 outline-none bg-white text-slate-900"
                        value={editFormData.gender}
                        onChange={e => setEditFormData({...editFormData, gender: e.target.value as any})}
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Date of Birth</label>
                      <input 
                        type="date"
                        className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-red-800 outline-none"
                        value={editFormData.dob || ''}
                        onChange={e => setEditFormData({...editFormData, dob: e.target.value})}
                      />
                    </div>
                  </div>
              </div>

              <div className="space-y-4 pt-2 border-t border-slate-50 mt-2">
                 <h4 className="text-xs font-bold text-red-800 uppercase tracking-wide">Academic Info</h4>
                 <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Assigned Class</label>
                    <select 
                        className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-red-800 outline-none bg-white text-slate-900"
                        value={editFormData.classId}
                        onChange={e => setEditFormData({...editFormData, classId: e.target.value})}
                    >
                        {CLASSES_LIST.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
              </div>

              <div className="space-y-4 pt-2 border-t border-slate-50 mt-2">
                 <h4 className="text-xs font-bold text-red-800 uppercase tracking-wide">Guardian Information</h4>
                 <div className="grid grid-cols-1 gap-4">
                     <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Guardian Name</label>
                      <input 
                        type="text" 
                        className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-red-800 outline-none placeholder-slate-400"
                        value={editFormData.guardianName || ''}
                        onChange={e => setEditFormData({...editFormData, guardianName: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Phone Number</label>
                      <input 
                        type="tel" 
                        className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-red-800 outline-none placeholder-slate-400"
                        value={editFormData.guardianPhone || ''}
                        onChange={e => setEditFormData({...editFormData, guardianPhone: e.target.value})}
                      />
                    </div>
                 </div>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setEditingStudent(null)}
                  className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex items-center px-5 py-2.5 bg-red-800 text-white rounded-lg hover:bg-red-900 font-medium shadow-sm transition-colors"
                >
                  <Save size={18} className="mr-2"/> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </Layout>
  );
};

export default AdminDashboard;