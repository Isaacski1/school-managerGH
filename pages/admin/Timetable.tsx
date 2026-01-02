import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { CLASSES_LIST } from '../../constants';
import { db } from '../../services/mockDb';
import { TimeSlot, ClassTimetable } from '../../types';
import { Save, Plus, Trash2, Clock, Coffee, Sparkles, DoorOpen } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const Timetable = () => {
    const [selectedClass, setSelectedClass] = useState(CLASSES_LIST[0].id);
    const [timetable, setTimetable] = useState<Record<string, TimeSlot[]>>({});
    const [loading, setLoading] = useState(false);
    const [activeDay, setActiveDay] = useState(DAYS[0]);
    const [subjects, setSubjects] = useState<string[]>([]);

    // Form State for new slot
    const [newSlot, setNewSlot] = useState<Partial<TimeSlot>>({
        startTime: '08:00',
        endTime: '09:00',
        subject: '',
        type: 'lesson'
    });

    // Fetch Subjects and Current Timetable
    useEffect(() => {
        const loadInitialData = async () => {
            const subs = await db.getSubjects();
            setSubjects(subs);
            if (subs.length > 0) setNewSlot(prev => ({ ...prev, subject: subs[0] }));
        };
        loadInitialData();
    }, []);

    useEffect(() => {
        const fetchTimetable = async () => {
            setLoading(true);
            const data = await db.getTimetable(selectedClass);
            
            // Initialize empty structure if none exists
            const schedule = data?.schedule || {};
            DAYS.forEach(day => {
                if (!schedule[day]) schedule[day] = [];
            });
            
            setTimetable(schedule);
            setLoading(false);
        };
        fetchTimetable();
    }, [selectedClass]);

    const handleAddSlot = () => {
        if (!newSlot.startTime || !newSlot.endTime || !newSlot.subject) return;
        if (newSlot.startTime >= newSlot.endTime) {
            alert("End time must be after start time");
            return;
        }

        const slot: TimeSlot = {
            id: Math.random().toString(36).substr(2, 9),
            startTime: newSlot.startTime,
            endTime: newSlot.endTime,
            subject: newSlot.subject,
            type: newSlot.type as 'lesson' | 'break' | 'worship' | 'closing'
        };

        const updatedSchedule = { ...timetable };
        updatedSchedule[activeDay] = [...updatedSchedule[activeDay], slot].sort((a, b) => a.startTime.localeCompare(b.startTime));
        
        setTimetable(updatedSchedule);
        // Don't reset time for easier consecutive entry
    };

    const handleDeleteSlot = (id: string) => {
        const updatedSchedule = { ...timetable };
        updatedSchedule[activeDay] = updatedSchedule[activeDay].filter(s => s.id !== id);
        setTimetable(updatedSchedule);
    };

    const handleSave = async () => {
        setLoading(true);
        const data: ClassTimetable = {
            classId: selectedClass,
            schedule: timetable
        };
        await db.saveTimetable(data);
        setLoading(false);
        alert('Timetable saved successfully!');
    };

    const getClosingTime = (day: string) => {
        const slots = timetable[day];
        if (!slots || slots.length === 0) return 'N/A';
        // Since we sort on add, last one is closing
        return slots[slots.length - 1].endTime;
    };

    const getSlotStyles = (type: string) => {
        switch(type) {
            case 'break': return { bg: 'bg-amber-50', border: 'border-amber-100', icon: Coffee, iconColor: 'text-amber-600', badge: 'text-amber-600 border-amber-200' };
            case 'worship': return { bg: 'bg-purple-50', border: 'border-purple-100', icon: Sparkles, iconColor: 'text-purple-600', badge: 'text-purple-600 border-purple-200' };
            case 'closing': return { bg: 'bg-slate-100', border: 'border-slate-200', icon: DoorOpen, iconColor: 'text-slate-600', badge: 'text-slate-600 border-slate-300' };
            default: return { bg: 'bg-white', border: 'border-slate-100', icon: Clock, iconColor: 'text-emerald-600', badge: 'text-slate-600 border-slate-200' };
        }
    };

    return (
        <Layout title="Manage Timetable">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col h-[calc(100vh-8rem)]">
                
                {/* Header Controls */}
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between md:items-center gap-4 bg-slate-50">
                    <div className="flex items-center gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Class</label>
                            <select 
                                className="border border-slate-300 rounded-md px-3 py-2 text-sm w-48"
                                value={selectedClass}
                                onChange={e => setSelectedClass(e.target.value)}
                            >
                                {CLASSES_LIST.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <button 
                        onClick={handleSave}
                        disabled={loading}
                        className="flex items-center bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                        <Save size={18} className="mr-2" />
                        {loading ? 'Saving...' : 'Save Schedule'}
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="flex flex-1 overflow-hidden">
                    
                    {/* Days Sidebar (Tabs) */}
                    <div className="w-40 border-r border-slate-100 bg-white flex flex-col overflow-y-auto">
                        {DAYS.map(day => {
                             const count = timetable[day]?.length || 0;
                             return (
                                <button
                                    key={day}
                                    onClick={() => setActiveDay(day)}
                                    className={`p-4 text-left border-l-4 transition-colors hover:bg-slate-50 ${activeDay === day ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-medium' : 'border-transparent text-slate-600'}`}
                                >
                                    <span className="block">{day}</span>
                                    <span className="text-xs text-slate-400">{count} Slots</span>
                                </button>
                             );
                        })}
                    </div>

                    {/* Editor Area */}
                    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
                        {/* Day Header */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">{activeDay} Schedule</h2>
                                <p className="text-sm text-slate-500">Closing Time: <span className="font-semibold text-slate-800">{getClosingTime(activeDay)}</span></p>
                            </div>
                        </div>

                        {/* Slots List */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-3">
                            {timetable[activeDay]?.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                    No classes or breaks scheduled for {activeDay}.
                                </div>
                            ) : (
                                timetable[activeDay]?.map((slot) => {
                                    const styles = getSlotStyles(slot.type);
                                    const Icon = styles.icon;
                                    return (
                                        <div key={slot.id} className={`flex items-center p-4 rounded-lg border shadow-sm ${styles.bg} ${styles.border}`}>
                                            <div className="flex items-center justify-center w-12 h-12 rounded-full mr-4 bg-white shadow-sm text-slate-500">
                                                <Icon size={20} className={styles.iconColor}/>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                     <span className="font-mono text-sm font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{slot.startTime} - {slot.endTime}</span>
                                                     {slot.type !== 'lesson' && (
                                                         <span className={`text-[10px] uppercase font-bold border px-1 rounded ${styles.badge}`}>{slot.type}</span>
                                                     )}
                                                </div>
                                                <p className="text-lg font-bold text-slate-800">{slot.subject}</p>
                                            </div>
                                            <button onClick={() => handleDeleteSlot(slot.id)} className="text-slate-300 hover:text-red-500 p-2 transition-colors">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Add Slot Form */}
                        <div className="p-4 bg-white border-t border-slate-200">
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Add Time Slot</h4>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                <div className="md:col-span-2">
                                    <label className="block text-xs text-slate-500 mb-1">Start</label>
                                    <input 
                                        type="time" 
                                        className="w-full border p-2 rounded text-sm"
                                        value={newSlot.startTime}
                                        onChange={e => setNewSlot({...newSlot, startTime: e.target.value})}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs text-slate-500 mb-1">End</label>
                                    <input 
                                        type="time" 
                                        className="w-full border p-2 rounded text-sm"
                                        value={newSlot.endTime}
                                        onChange={e => setNewSlot({...newSlot, endTime: e.target.value})}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                     <label className="block text-xs text-slate-500 mb-1">Type</label>
                                     <select 
                                        className="w-full border p-2 rounded text-sm"
                                        value={newSlot.type}
                                        onChange={e => {
                                            const type = e.target.value as 'lesson'|'break'|'worship'|'closing';
                                            let subject = '';
                                            if (type === 'break') subject = 'Break';
                                            else if (type === 'worship') subject = 'Worship';
                                            else if (type === 'closing') subject = 'Closing';
                                            else subject = subjects[0] || '';
                                            
                                            setNewSlot({...newSlot, type, subject})
                                        }}
                                     >
                                         <option value="lesson">Lesson</option>
                                         <option value="break">Break</option>
                                         <option value="worship">Worship</option>
                                         <option value="closing">Closing</option>
                                     </select>
                                </div>
                                <div className="md:col-span-4">
                                    <label className="block text-xs text-slate-500 mb-1">Activity/Subject</label>
                                    {newSlot.type === 'lesson' ? (
                                        <select 
                                            className="w-full border p-2 rounded text-sm"
                                            value={newSlot.subject}
                                            onChange={e => setNewSlot({...newSlot, subject: e.target.value})}
                                        >
                                            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                                            {subjects.length === 0 && <option value="">No Subjects Found</option>}
                                        </select>
                                    ) : (
                                        <input 
                                            type="text" 
                                            className="w-full border p-2 rounded text-sm"
                                            value={newSlot.subject}
                                            onChange={e => setNewSlot({...newSlot, subject: e.target.value})}
                                        />
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    <button 
                                        onClick={handleAddSlot}
                                        className="w-full bg-blue-600 text-white p-2 rounded text-sm font-medium hover:bg-blue-700"
                                    >
                                        <Plus size={16} className="inline mr-1"/> Add
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Timetable;