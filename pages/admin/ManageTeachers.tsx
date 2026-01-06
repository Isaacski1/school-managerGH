import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { showToast } from '../../services/toast';
import { db } from '../../services/mockDb';
import { User, UserRole } from '../../types';
import { CLASSES_LIST } from '../../constants';
import { Plus, Trash2, UserPlus, Mail, AlertTriangle, CheckSquare, Square, Lock, Loader2 } from 'lucide-react';

// Firebase imports for creating users
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { firebaseConfig, firestore } from '../../services/firebase';
import * as firebaseApp from 'firebase/app';
import { deleteDoc, doc } from 'firebase/firestore';

const ManageTeachers = () => {
  const [teachers, setTeachers] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<Partial<User> & { password?: string }>({
    role: UserRole.TEACHER,
    assignedClassIds: [],
    password: ''
  });

  // Delete State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = async () => {
    const users = await db.getUsers();
    setTeachers(users.filter(u => u.role === UserRole.TEACHER));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) {
        showToast("Please fill in all fields including password.", { type: 'error' });
        return;
    }
    
    if (formData.password.length < 6) {
        showToast("Password must be at least 6 characters.", { type: 'error' });
        return;
    }

    setIsSubmitting(true);

    let secondaryApp: firebaseApp.FirebaseApp | undefined;

    try {
        // 1. Create a secondary Firebase App instance.
        // We do this to create a user WITHOUT logging out the current Admin.
        // If we used the main 'auth', creating a user would automatically sign the Admin out.
        secondaryApp = firebaseApp.initializeApp(firebaseConfig, "SecondaryApp");
        const secondaryAuth = getAuth(secondaryApp);

        // 2. Create the Authentication Record
        const userCredential = await createUserWithEmailAndPassword(
            secondaryAuth, 
            formData.email, 
            formData.password
        );

        // 3. Create the Firestore User Document using the *same UID* from Auth
        const newUid = userCredential.user.uid;

        const newTeacher: User = {
            id: newUid,
            name: formData.name,
            email: formData.email,
            role: UserRole.TEACHER,
            assignedClassIds: formData.assignedClassIds || []
        };

        await db.addUser(newTeacher);

        // 4. Cleanup
        await signOut(secondaryAuth);
        
        // Success
        setShowModal(false);
        setFormData({ role: UserRole.TEACHER, assignedClassIds: [], password: '' });
        fetchData();
        showToast(`Teacher created successfully! Email: ${newTeacher.email}`, { type: 'success', duration: 6000 });

    } catch (error: any) {
        console.error("Error creating teacher:", error);
        if (error.code === 'auth/email-already-in-use') {
            showToast("This email is already registered.", { type: 'error' });
        } else {
            showToast("Failed to create teacher. " + error.message, { type: 'error' });
        }
    } finally {
        // Always delete the secondary app to clean up resources
        if (secondaryApp) {
            await firebaseApp.deleteApp(secondaryApp);
        }
        setIsSubmitting(false);
    }
  };

  const promptDelete = (id: string) => {
    setDeleteId(id);
  };

  const executeDelete = async () => {
    if (!deleteId) return;
    const idToDelete = deleteId;
    setDeleteId(null); // Close modal

    // Optimistic Update
    const previousTeachers = [...teachers];
    setTeachers(prev => prev.filter(t => t.id !== idToDelete));

    try {
      // Delete the user document from Firestore
      await db.deleteUser(idToDelete);

      // Also delete all teacher attendance records for this teacher
      const teacherAttendanceRecords = await db.getAllTeacherAttendanceRecords();
      const recordsToDelete = teacherAttendanceRecords.filter(r => r.teacherId === idToDelete);
      const deletePromises = recordsToDelete.map(r => deleteDoc(doc(firestore, 'teacher_attendance', r.id)));
      await Promise.all(deletePromises);


    } catch (error) {
      console.error("Failed to delete teacher", error);
            // Revert if failed
            setTeachers(previousTeachers);
            showToast("Failed to delete teacher profile. Please try again.", { type: 'error' });
    }
  };

  const toggleClass = (classId: string) => {
      setFormData(prev => {
          const current = prev.assignedClassIds || [];
          if (current.includes(classId)) {
              return { ...prev, assignedClassIds: current.filter(id => id !== classId) };
          } else {
              return { ...prev, assignedClassIds: [...current, classId] };
          }
      });
  };

  return (
    <Layout title="Manage Teachers">
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <h2 className="font-semibold text-slate-800">Staff List</h2>
            <button 
                onClick={() => setShowModal(true)}
                className="flex items-center bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 transition-colors text-sm font-medium"
            >
                <Plus size={16} className="mr-2" />
                Add Teacher
            </button>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-800 font-semibold border-b border-slate-200">
                    <tr>
                        <th className="px-6 py-3">Name</th>
                        <th className="px-6 py-3">Email</th>
                        <th className="px-6 py-3">Assigned Classes</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {teachers.length === 0 ? (
                        <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                                No teachers found.
                            </td>
                        </tr>
                    ) : (
                        teachers.map(teacher => {
                            const assignedIds = teacher.assignedClassIds || [];
                            const classNames = assignedIds.map(id => CLASSES_LIST.find(c => c.id === id)?.name).filter(Boolean);
                            
                            return (
                                <tr key={teacher.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-3 font-medium text-slate-800">{teacher.name}</td>
                                    <td className="px-6 py-3 flex items-center">
                                        <Mail size={14} className="mr-2 text-slate-400"/>
                                        {teacher.email}
                                    </td>
                                    <td className="px-6 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {classNames.length > 0 ? (
                                                classNames.map(name => (
                                                    <span key={name} className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                                        {name}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-slate-400 italic text-xs">No classes</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        <button 
                                            onClick={() => promptDelete(teacher.id)} 
                                            className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-full transition-colors"
                                            title="Remove Teacher"
                                        >
                                            <Trash2 size={16} className="pointer-events-none" />
                                        </button>
                                    </td>
                                </tr>
                            )
                        })
                    )}
                </tbody>
            </table>
        </div>
      </div>

       {/* Delete Confirmation Modal */}
       {deleteId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-sm w-full p-6 shadow-xl transform transition-all">
            <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle className="text-red-600 w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Remove Teacher?</h3>
                <p className="text-sm text-slate-500 mb-6">
                    This removes their profile and disables their login account from the system.
                </p>
                <div className="flex gap-3 w-full">
                    <button 
                        onClick={() => setDeleteId(null)}
                        className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={executeDelete}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors shadow-sm"
                    >
                        Remove
                    </button>
                </div>
            </div>
          </div>
        </div>
      )}

       {/* Add Modal */}
       {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4 flex items-center text-slate-900 border-b pb-2">
                <UserPlus className="mr-2 text-emerald-600" size={20}/> Add New Teacher
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Full Name</label>
                <input 
                  type="text" 
                  required
                  className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none placeholder-slate-400 text-white bg-slate-800"
                  value={formData.name || ''}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Mr. John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Email Address</label>
                <input 
                  type="email" 
                  required
                  className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none placeholder-slate-400 text-white bg-slate-800"
                  value={formData.email || ''}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  placeholder="teacher@school.com"
                />
              </div>
              
              {/* Password Field */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Set Password</label>
                <div className="relative">
                    <Lock className="absolute left-3 top-3 text-slate-400 w-4 h-4"/>
                    <input 
                        type="text" 
                        required
                        className="w-full border border-slate-300 pl-9 p-2.5 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none placeholder-slate-400 text-white bg-slate-800"
                        value={formData.password || ''}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                        placeholder="Min 6 chars"
                        minLength={6}
                    />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Teacher will use this email & password to log in.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Assign Classes</label>
                <div className="border border-slate-300 rounded-lg p-3 max-h-56 overflow-y-auto bg-slate-50">
                    <div className="grid grid-cols-2 gap-3">
                        {CLASSES_LIST.map(c => {
                            const isSelected = formData.assignedClassIds?.includes(c.id);
                            return (
                                <button 
                                    type="button"
                                    key={c.id} 
                                    onClick={() => toggleClass(c.id)}
                                    className={`
                                        flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium border transition-all duration-200
                                        ${isSelected 
                                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-md transform scale-[1.02]' 
                                            : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:shadow-sm'
                                        }
                                    `}
                                >
                                    <span>{c.name}</span>
                                    {isSelected ? (
                                        <CheckSquare size={16} className="text-white ml-2" />
                                    ) : (
                                        <Square size={16} className="text-slate-300 ml-2" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Click classes to select/deselect them.</p>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium shadow-sm transition-colors disabled:opacity-70"
                >
                  {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="mr-2 animate-spin"/> Creating...
                      </>
                  ) : (
                      'Create Teacher'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default ManageTeachers;