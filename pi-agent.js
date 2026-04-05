/**
 * AI Commander - Raspberry Pi Agent
 * 
 * Instructions:
 * 1. Install Node.js on your Raspberry Pi.
 * 2. Create a folder and run: npm init -y
 * 3. Install dependencies: npm install firebase-admin
 * 4. Download your Firebase Service Account Key (JSON) from the Firebase Console.
 * 5. Save the key as 'service-account.json' in the same folder.
 * 6. Update the 'databaseURL' and 'uid' below.
 * 7. Run the agent: node pi-agent.js
 */

const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const serviceAccount = require('./service-account.json');
const UID = "3ZraaFt0XHXKLfwz1woT6QDFQ2F2"; // <--- YOUR_FIREBASE_UID
const DATABASE_ID = "ai-studio-8795b7cd-639f-4622-b8ac-5d6253b4fb6b";

if (UID === "YOUR_FIREBASE_UID_HERE") {
  console.error("\n[!] ERROR: You must replace 'YOUR_FIREBASE_UID_HERE' with your actual UID.");
  console.error("[!] You can find your UID in the AI Commander app top bar after logging in.\n");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Correctly initialize the named database
const db = getFirestore(DATABASE_ID);

console.log(`[PI_AGENT] Starting for UID: ${UID}...`);
console.log(`[PI_AGENT] Connected to Database: ${DATABASE_ID}`);

// --- PI STATUS ---
const updateStatus = (online) => {
  db.collection('pi_status').doc(UID).set({
    online,
    lastSeen: admin.firestore.FieldValue.serverTimestamp(),
    hostname: require('os').hostname(),
    os: require('os').type(),
    uid: UID
  }, { merge: true });
};

updateStatus(true);
setInterval(() => updateStatus(true), 60000); // Keep-alive every minute

// --- COMMAND LISTENER ---
db.collection('commands')
  .where('uid', '==', UID)
  .where('status', '==', 'pending')
  .onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        const cmdDoc = change.doc;
        const { command } = cmdDoc.data();
        
        console.log(`[PI_AGENT] Executing: ${command}`);
        cmdDoc.ref.update({ status: 'executing' });

        exec(command, (error, stdout, stderr) => {
          const output = stdout || stderr || (error ? error.message : 'No output');
          
          db.collection('responses').add({
            commandId: cmdDoc.id,
            output: output,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            uid: UID
          });

          cmdDoc.ref.update({ status: error ? 'failed' : 'completed' });
          
          // Refresh filesystem after command
          syncFilesystem();
        });
      }
    });
  });

// --- FILESYSTEM SYNC ---
const syncFilesystem = async () => {
  console.log('[PI_AGENT] Syncing filesystem...');
  const rootDir = process.cwd(); // Or any directory you want to mirror
  
  try {
    const files = fs.readdirSync(rootDir);
    
    // Simple one-level sync for demo
    for (const fileName of files) {
      const filePath = path.join(rootDir, fileName);
      const stats = fs.statSync(filePath);
      const isDir = stats.isDirectory();
      
      const fileData = {
        name: fileName,
        type: isDir ? 'dir' : 'file',
        size: stats.size,
        date: stats.mtime.toISOString().split('T')[0],
        parentId: null,
        uid: UID
      };

      if (!isDir && stats.size < 10000) {
        fileData.content = fs.readFileSync(filePath, 'utf8');
      }

      // Use a stable ID based on path
      const fileId = Buffer.from(filePath).toString('base64').replace(/=/g, '');
      await db.collection('filesystem').doc(fileId).set(fileData);
    }
  } catch (err) {
    console.error('[PI_AGENT] Sync failed:', err);
  }
};

syncFilesystem();

// Cleanup on exit
process.on('SIGINT', async () => {
  console.log('[PI_AGENT] Shutting down...');
  await updateStatus(false);
  process.exit();
});
