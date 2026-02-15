import React, { useEffect, useMemo, useState } from "react";
import Layout from "../../components/Layout";
import { useSchool } from "../../context/SchoolContext";
import { db } from "../../services/mockDb";
import { CLASSES_LIST } from "../../constants";
import { Search, Filter, GraduationCap, Users, Eye, X } from "lucide-react";

type StudentArchiveItem = {
  id: string;
  schoolId: string;
  name: string;
  gender: "Male" | "Female";
  dob: string;
  classId: string;
  guardianName: string;
  guardianPhone: string;
  archivedAt?: number;
  archivedReason?: string;
  archivedAttendanceSummary?: {
    total: number;
    present: number;
    percentage: number;
  };
  archivedAssessments?: any[];
  archivedRemarks?: any[];
  archivedSkills?: any[];
  archivedAdminRemarks?: any[];
};

const StudentHistory = () => {
  const { school } = useSchool();
  const schoolId = school?.id || null;
  const [students, setStudents] = useState<StudentArchiveItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterReason, setFilterReason] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [viewStudent, setViewStudent] = useState<StudentArchiveItem | null>(
    null,
  );
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [details, setDetails] = useState<{
    attendance: { total: number; present: number; percentage: number } | null;
    assessments: any[];
    remarks: any[];
    skills: any[];
    adminRemarks: any[];
  } | null>(null);

  useEffect(() => {
    if (!schoolId) {
      setStudents([]);
      return;
    }

    const loadHistory = async () => {
      setIsLoading(true);
      try {
        const data = await db.getStudentHistory(schoolId);
        setStudents(data as StudentArchiveItem[]);
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory();
  }, [schoolId]);

  const filteredStudents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return students
      .filter((student) =>
        filterClass === "all" ? true : student.classId === filterClass,
      )
      .filter((student) =>
        filterReason === "all" ? true : student.archivedReason === filterReason,
      )
      .filter((student) => {
        if (!term) return true;
        return [
          student.name,
          student.id,
          student.guardianName,
          student.guardianPhone,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));
  }, [students, searchTerm, filterClass, filterReason]);

  const totalCount = students.length;
  const filteredCount = filteredStudents.length;

  const handleViewDetails = async (student: StudentArchiveItem) => {
    if (!schoolId) return;
    setViewStudent(student);
    setDetailsLoading(true);
    try {
      setDetails({
        attendance: student.archivedAttendanceSummary || {
          total: 0,
          present: 0,
          percentage: 0,
        },
        assessments: student.archivedAssessments || [],
        remarks: student.archivedRemarks || [],
        skills: student.archivedSkills || [],
        adminRemarks: student.archivedAdminRemarks || [],
      });
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setViewStudent(null);
    setDetails(null);
  };

  return (
    <Layout title="Student History">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-indigo-50 via-white to-emerald-50 p-6 shadow-sm">
          <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-indigo-200/40 blur-3xl" />
          <div className="absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-emerald-200/40 blur-3xl" />
          <div className="relative flex flex-col gap-2">
            <h1 className="text-3xl font-bold text-slate-900">
              Student History
            </h1>
            <p className="text-sm text-slate-600">
              Archived student profiles for graduates and leavers.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 font-medium text-slate-700 shadow-sm">
                <Users className="h-4 w-4 text-indigo-500" />
                Total Archived: {totalCount}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700 shadow-sm">
                <GraduationCap className="h-4 w-4" />
                Showing: {filteredCount}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, ID, guardian..."
                  className="pl-9 pr-3 py-2 rounded-full border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none"
                />
              </div>
              <select
                className="border border-slate-200 rounded-full px-4 py-2 text-sm bg-white text-slate-700 shadow-sm focus:ring-2 focus:ring-emerald-200"
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
              >
                <option value="all">All Classes</option>
                {CLASSES_LIST.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                className="border border-slate-200 rounded-full px-4 py-2 text-sm bg-white text-slate-700 shadow-sm focus:ring-2 focus:ring-emerald-200"
                value={filterReason}
                onChange={(e) => setFilterReason(e.target.value)}
              >
                <option value="all">All Reasons</option>
                <option value="manual_delete">Manual Delete</option>
                <option value="class_reset">Class Reset</option>
              </select>
            </div>
            <div className="inline-flex items-center gap-2 text-xs text-slate-500">
              <Filter className="h-4 w-4" />
              Filters update the archived list.
            </div>
          </div>

          <div className="p-4">
            {isLoading ? (
              <div className="px-6 py-10 text-center text-slate-400">
                Loading archived students...
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="px-6 py-10 text-center text-slate-400">
                No archived students found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredStudents.map((student) => {
                  const className =
                    CLASSES_LIST.find((c) => c.id === student.classId)?.name ||
                    student.classId;
                  const archivedDate = student.archivedAt
                    ? new Date(student.archivedAt).toLocaleDateString()
                    : "-";
                  return (
                    <div
                      key={`${student.id}-${student.archivedAt || ""}`}
                      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="absolute -top-14 -right-14 h-28 w-28 rounded-full bg-indigo-100/60 blur-2xl" />
                      <div className="absolute -bottom-16 -left-10 h-32 w-32 rounded-full bg-emerald-100/60 blur-2xl" />

                      <div className="relative flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold">
                            {student.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">
                              {student.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              ID: {student.id}
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {className}
                        </span>
                      </div>

                      <div className="relative mt-4 grid grid-cols-2 gap-3 text-xs text-slate-600">
                        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                          <p className="text-[11px] uppercase tracking-wide text-slate-400">
                            Guardian
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">
                            {student.guardianName || "-"}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {student.guardianPhone || ""}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                          <p className="text-[11px] uppercase tracking-wide text-slate-400">
                            Archived
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">
                            {archivedDate}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {student.archivedReason || "-"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 flex flex-col justify-between">
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">
                              Archived
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">
                              {archivedDate}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {student.archivedReason || "-"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleViewDetails(student)}
                            className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                          >
                            <Eye size={14} />
                            View Details
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {viewStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {viewStudent.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Archived student details
                </p>
              </div>
              <button
                onClick={closeDetails}
                className="text-slate-400 hover:text-slate-700 bg-white p-2 rounded-full shadow-sm"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {detailsLoading || !details ? (
                <div className="text-center text-slate-400">
                  Loading student records...
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        Attendance
                      </p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">
                        {details.attendance?.percentage ?? 0}%
                      </p>
                      <p className="text-xs text-slate-500">
                        {details.attendance?.present ?? 0}/
                        {details.attendance?.total ?? 0} days
                      </p>
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                      <p className="text-xs uppercase tracking-wide text-emerald-500">
                        Assessments
                      </p>
                      <p className="mt-2 text-2xl font-bold text-emerald-700">
                        {details.assessments.length}
                      </p>
                      <p className="text-xs text-emerald-600">Records found</p>
                    </div>
                    <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-4">
                      <p className="text-xs uppercase tracking-wide text-sky-500">
                        Remarks
                      </p>
                      <p className="mt-2 text-2xl font-bold text-sky-700">
                        {details.remarks.length + details.adminRemarks.length}
                      </p>
                      <p className="text-xs text-sky-600">Teacher + Admin</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-white p-4">
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">
                      Assessment Records
                    </h4>
                    {details.assessments.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        No assessment records found.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-[240px] overflow-y-auto text-sm">
                        {details.assessments.map((assessment, index) => (
                          <div
                            key={`${assessment.id || index}`}
                            className="flex items-center justify-between border-b border-slate-100 pb-2"
                          >
                            <div>
                              <p className="font-semibold text-slate-800">
                                {assessment.subject}
                              </p>
                              <p className="text-xs text-slate-500">
                                Term {assessment.term} ·{" "}
                                {assessment.academicYear}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-slate-700">
                              {assessment.total ?? 0}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-white p-4">
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">
                      Remarks
                    </h4>
                    {details.remarks.length === 0 &&
                    details.adminRemarks.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        No remarks found.
                      </p>
                    ) : (
                      <div className="space-y-2 text-sm">
                        {details.remarks.map((remark, index) => (
                          <div
                            key={`${remark.id || index}`}
                            className="rounded-lg border border-slate-100 bg-slate-50/60 p-3"
                          >
                            <p className="font-semibold text-slate-800">
                              Teacher Remark
                            </p>
                            <p className="text-xs text-slate-500">
                              Term {remark.term} · {remark.academicYear}
                            </p>
                            <p className="text-sm text-slate-700 mt-1">
                              {remark.remark}
                            </p>
                          </div>
                        ))}
                        {details.adminRemarks.map((remark, index) => (
                          <div
                            key={`${remark.id || index}`}
                            className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3"
                          >
                            <p className="font-semibold text-emerald-700">
                              Admin Remark
                            </p>
                            <p className="text-xs text-emerald-600">
                              Term {remark.term} · {remark.academicYear}
                            </p>
                            <p className="text-sm text-slate-700 mt-1">
                              {remark.remark}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-white p-4">
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">
                      Skills & Behaviour
                    </h4>
                    {details.skills.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        No skills records found.
                      </p>
                    ) : (
                      <div className="space-y-2 text-sm">
                        {details.skills.map((skill, index) => (
                          <div
                            key={`${skill.id || index}`}
                            className="rounded-lg border border-slate-100 bg-slate-50/60 p-3"
                          >
                            <p className="text-xs text-slate-500">
                              Term {skill.term} · {skill.academicYear}
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 text-xs text-slate-600">
                              <span>Punctuality: {skill.punctuality}</span>
                              <span>Neatness: {skill.neatness}</span>
                              <span>Conduct: {skill.conduct}</span>
                              <span>Attitude: {skill.attitudeToWork}</span>
                              <span>
                                Participation: {skill.classParticipation}
                              </span>
                              <span>Homework: {skill.homeworkCompletion}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default StudentHistory;
