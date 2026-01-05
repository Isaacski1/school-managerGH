const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.deleteAuthUser = functions.firestore
    .document('users/{userId}')
    .onDelete(async (snap, context) => {
        const userId = context.params.userId;
        try {
            await admin.auth().deleteUser(userId);
            console.log(`Successfully deleted auth user: ${userId}`);
        } catch (error) {
            console.error(`Error deleting auth user ${userId}:`, error);
        }
    });