
const { db } = require('./services/mockDb'); // Adjust path as needed
const admin = require('firebase-admin');

// You would typically get your Firebase Admin SDK credentials here
// For this environment, we'll assume `db` already has initialized firestore from the client SDK.
// If running from Node environment that requires Admin SDK, this would need a service account.

async function resetTeacherAttendance() {
  try {
    console.log("Attempting to reset all teacher attendance records...");
    await db.resetAllTeacherAttendance();
    console.log("Successfully reset all teacher attendance records.");
  } catch (error) {
    console.error("Error resetting teacher attendance:", error);
  } finally {
    // Exit the process
    process.exit();
  }
}

resetTeacherAttendance();
