import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/mockDb';
import { TeacherAttendanceRecord } from '../../types';
import { Calendar, CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react';

const TeacherAttendance = () => {
  const { user } = useAuth();
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, TeacherAttendanceRecord>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [schoolConfig, setSchoolConfig] = useState<any>(null);
  const [missedAttendanceAlert, setMissedAttendanceAlert] = useState<string | null>(null);

  // Get today's date
  const today = new Date().toISOString().split('T')[0];

  // Get current week's Monday to Friday dates
  const getCurrentWeekDates = () => {
    const now = new Date();
    const currentDay = now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay; // Adjust to get Monday
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);

    const weekDates: string[] = [];
    for (let i = 0; i < 5; i++) { // Monday to Friday
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      weekDates.push(date.toISOString().split('T')[0]);
    }
    return weekDates;
  };

  const weekDates = getCurrentWeekDates();

  // Get yesterday for backwards compatibility
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Get school re-opening date and check if school is open
  const getSchoolReopeningDate = async () => {
    try {
      const config = await db.getSchoolConfig();
      setSchoolConfig(config);
      return config.schoolReopenDate;
    } catch (error) {
      console.error('Error fetching school config:', error);
      return null;
    }
  };

  // Check if a date is valid for attendance (after school reopening)
  const isValidAttendanceDate = (date: string, reopenDate?: string) => {
    if (!reopenDate) return true; // If no reopen date set, allow all dates
    return date >= reopenDate;
  };

  // Check for missed attendance
  const checkMissedAttendance = async () => {
    if (!user?.id) return;

    const reopenDate = await getSchoolReopeningDate();
    if (!reopenDate) return;

    const today = new Date();
    const reopenDateObj = new Date(reopenDate);

    // Only check if school has reopened
    if (today < reopenDateObj) return;

    try {
      const yesterdayRecord = await db.getTeacherAttendance(user.id, yesterday);
      if (!yesterdayRecord && yesterday >= reopenDate) {
        setMissedAttendanceAlert(yesterday);
      }
    } catch (error) {
      console.error('Error checking missed attendance:', error);
    }
  };

  // Fetch attendance records for today and yesterday
  useEffect(() => {
    const fetchAttendance = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const records: Record<string, TeacherAttendanceRecord> = {};

        // Fetch records for the current week (Monday to Friday)
        const datesToCheck = weekDates;
        for (const date of datesToCheck) {
          const record = await db.getTeacherAttendance(user.id, date);
          if (record) {
            records[date] = record;
          }
        }

        setAttendanceRecords(records);

        // Check for missed attendance
        await checkMissedAttendance();

      } catch (error) {
        console.error('Error fetching attendance:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, [user?.id]);

  const handleMarkAttendance = async (date: string, status: 'present' | 'absent') => {
    if (!user?.id) return;

    setSaving(prev => ({ ...prev, [date]: true }));

    try {
      const record: TeacherAttendanceRecord = {
        id: `${user.id}_${date}`,
        date,
        teacherId: user.id,
        status
      };

      await db.saveTeacherAttendance(record);
      setAttendanceRecords(prev => ({ ...prev, [date]: record }));

      // Clear missed attendance alert if marking yesterday
      if (date === missedAttendanceAlert) {
        setMissedAttendanceAlert(null);
      }

      // Notification
      await db.addSystemNotification(
        `${user.name} marked attendance as ${status} for ${date}`,
        'attendance'
      );
    } catch (error) {
      console.error('Error saving attendance:', error);
    } finally {
      setSaving(prev => ({ ...prev, [date]: false }));
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatShortDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  // Check if school is open today
  const isSchoolOpen = () => {
    if (!schoolConfig?.schoolReopenDate) return true;
    const today = new Date().toISOString().split('T')[0];
    return today >= schoolConfig.schoolReopenDate;
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Daily Attendance</h1>
        <p className="text-slate-600">Mark your attendance for today and catch up on missed days</p>
      </div>

      {/* Missed Attendance Alert */}
      {missedAttendanceAlert && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-amber-600 mt-0.5" size={20} />
            <div>
              <h4 className="font-semibold text-amber-900">Missed Attendance Alert</h4>
              <p className="text-sm text-amber-800 mt-1">
                You haven't marked your attendance for {formatShortDate(missedAttendanceAlert)}.
                Please mark it below to keep your records up to date.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* School Status */}
      {!isSchoolOpen() && schoolConfig?.schoolReopenDate && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Clock className="text-blue-600" size={20} />
            <div>
              <h4 className="font-semibold text-blue-900">School Not Yet Open</h4>
              <p className="text-sm text-blue-800">
                Attendance marking will be available starting from {formatDate(schoolConfig.schoolReopenDate)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Today's Attendance */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-500">Loading attendance...</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {weekDates.map((date, index) => {
              const isToday = date === today;
              const isPast = date < today;
              const isFuture = date > today;
              const record = attendanceRecords[date];
              const canMark = isValidAttendanceDate(date, schoolConfig?.schoolReopenDate) && !isFuture;

              return (
                <div key={date} className={`p-6 ${isToday ? 'bg-blue-50' : isPast ? 'bg-white' : 'bg-slate-50'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        isToday ? 'bg-blue-100 text-blue-600' :
                        isPast ? 'bg-slate-100 text-slate-600' :
                        'bg-slate-100 text-slate-400'
                      }`}>
                        <Calendar size={20} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800">
                          {formatDate(date)}
                          {isToday && <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-1 rounded-full">Today</span>}
                          {isPast && <span className="ml-2 text-xs bg-slate-600 text-white px-2 py-1 rounded-full">Past</span>}
                          {isFuture && <span className="ml-2 text-xs bg-slate-400 text-white px-2 py-1 rounded-full">Future</span>}
                        </h3>
                        {record ? (
                          <p className="text-sm text-slate-500">
                            Marked as <span className={`font-medium ${
                              record.status === 'present' ? 'text-emerald-600' : 'text-red-600'
                            }`}>
                              {record.status.toUpperCase()}
                            </span>
                          </p>
                        ) : (
                          <p className="text-sm text-slate-400">
                            {isFuture ? 'Not yet available' : 'Not marked yet'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      {canMark && !record && (
                        <>
                          <button
                            onClick={() => handleMarkAttendance(date, 'present')}
                            disabled={saving[date]}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {saving[date] ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                              <CheckCircle size={16} />
                            )}
                            Present
                          </button>

                          <button
                            onClick={() => handleMarkAttendance(date, 'absent')}
                            disabled={saving[date]}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {saving[date] ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                              <XCircle size={16} />
                            )}
                            Absent
                          </button>
                        </>
                      )}

                      {record && (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <CheckCircle size={16} className={record.status === 'present' ? 'text-emerald-500' : 'text-red-500'} />
                          Marked
                        </div>
                      )}

                      {!canMark && !record && (
                        <div className="text-sm text-slate-400">
                          {isFuture ? 'Future date' : 'Before school opened'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">How it works:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Mark your attendance daily when you arrive at school</li>
          <li>• If you forget to mark attendance, you'll be reminded the next day</li>
          <li>• The admin will be notified of any missed attendance</li>
          <li>• Attendance dates start from the school's re-opening date</li>
        </ul>
      </div>
    </div>
  );
};

export default TeacherAttendance;