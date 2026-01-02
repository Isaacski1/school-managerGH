import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '../types';
import { auth, firestore } from '../services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The UID provided by the user to be the Super Admin
  const ADMIN_UID = "JHaUOR3vlYQiaPKLTGlGtav1uYa2";

  useEffect(() => {
    // Listen for Firebase Auth changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      
      if (firebaseUser) {
        // Reset error on new attempt
        setError(null);
        try {
          // Fetch custom user profile (Role, Class Assignments) from Firestore
          const userDocRef = doc(firestore, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({
              id: firebaseUser.uid,
              name: userData.name || firebaseUser.displayName || 'User',
              email: firebaseUser.email || '',
              role: userData.role as UserRole,
              assignedClassIds: userData.assignedClassIds || []
            });
          } else {
            // New User Setup
            console.log("Setting up new user profile in Firestore...");
            
            // Check if this is the specific Admin UID OR the specific email
            const isTargetAdmin = firebaseUser.uid === ADMIN_UID;
            const isEmailAdmin = firebaseUser.email === 'admin@school.com' || firebaseUser.email === 'isaacskikrams@gmail.com';
            
            const role = (isTargetAdmin || isEmailAdmin) ? UserRole.ADMIN : UserRole.TEACHER;

            const newUser: User = {
                id: firebaseUser.uid,
                name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'New User',
                email: firebaseUser.email || '',
                role: role,
                assignedClassIds: []
            };
            
            // Create the doc so next time it exists
            await setDoc(userDocRef, {
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                assignedClassIds: []
            });

            setUser(newUser);
          }
        } catch (err: any) {
          console.error("Error fetching user profile:", err);
          setUser(null);
          
          // Improved Error Handling
          const errorMessage = err.message || err.toString();
          
          if (errorMessage.includes("Cloud Firestore API has not been used")) {
             setError("CRITICAL ERROR: The Firestore Database is not enabled. Go to Firebase Console > Build > Firestore Database > Create Database.");
          } else if (errorMessage.includes("permission-denied") || errorMessage.includes("Missing or insufficient permissions")) {
             setError("PERMISSION DENIED: Database access blocked. Go to Firebase Console > Firestore Database > Rules and change 'allow read, write: if false;' to 'allow read, write: if true;' (for testing).");
          } else if (errorMessage.includes("client is offline") || errorMessage.includes("offline")) {
             setError("Network Error: Could not connect to the database. Check your internet connection.");
          } else {
             setError("Failed to load user profile. Please try refreshing the page. Error: " + errorMessage);
          }
        }
      } else {
        setUser(null);
        setError(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setError(null);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};