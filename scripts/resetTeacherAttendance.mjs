import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCHlCLhumJn50nw2JBgJTGeIH_6GKzjFbA",
  authDomain: "noble-care-management-system.firebaseapp.com",
  projectId: "noble-care-management-system",
  storageBucket: "noble-care-management-system.firebasestorage.app",
  messagingSenderId: "573085015524",
  appId: "1:573085015524:web:29ae8a509813ec1199fbf1"
};

initializeApp(firebaseConfig);
const firestore = getFirestore();

async function resetTeacherAttendance() {
  console.log("Attempting to reset all teacher attendance records...");
  const collectionName = 'teacher_attendance';
  const snap = await getDocs(collection(firestore, collectionName));

  if (snap.docs.length === 0) {
    console.log(`  No documents found in ${collectionName}`);
    return;
  }

  const ops = snap.docs.map(d => deleteDoc(doc(firestore, collectionName, d.id)));
  await Promise.all(ops);
  console.log(`  Deleted ${snap.docs.length} documents from ${collectionName}`);
}

(async () => {
  try {
    await resetTeacherAttendance();
    console.log('\n✅ Teacher attendance reset complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during teacher attendance reset:', err);
    process.exit(1);
  }
})();
