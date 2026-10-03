import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyChEIqqIPJPqlGoobvAXPRYCFoTpGssVR0",
    authDomain: "gelt-3cb09.firebaseapp.com",
    projectId: "gelt-3cb09",
    storageBucket: "gelt-3cb09.firebasestorage.app",
    messagingSenderId: "66252986689",
    appId: "1:66252986689:web:636a32eca15440845629c0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

window._fb = {
    async saveCloud(username, data) {
        try {
            const key = username.toLowerCase().replace(/[^a-z0-9_.]/g, '');
            await setDoc(doc(db, 'saves', key), { data: JSON.stringify(data), updatedAt: Date.now() });
            return true;
        } catch (e) { console.error('FB save:', e); return false; }
    },
    async loadCloud(username) {
        try {
            const key = username.toLowerCase().replace(/[^a-z0-9_.]/g, '');
            const snap = await getDoc(doc(db, 'saves', key));
            if (snap.exists()) return JSON.parse(snap.data().data);
            return null;
        } catch (e) { console.error('FB load:', e); return null; }
    },
    async savePwd(username, pwdHash) {
        try {
            const key = username.toLowerCase().replace(/[^a-z0-9_.]/g, '');
            await setDoc(doc(db, 'passwords', key), { pwdHash, updatedAt: Date.now() });
            return true;
        } catch (e) { console.error('FB pwd:', e); return false; }
    },
    async checkPwd(username, pwdHash) {
        try {
            const key = username.toLowerCase().replace(/[^a-z0-9_.]/g, '');
            const snap = await getDoc(doc(db, 'passwords', key));
            if (!snap.exists()) return 'not_found';
            return snap.data().pwdHash === pwdHash ? 'ok' : 'wrong';
        } catch (e) { return 'error'; }
    },
    async usernameExists(username) {
        try {
            const key = username.toLowerCase().replace(/[^a-z0-9_.]/g, '');
            const snap = await getDoc(doc(db, 'passwords', key));
            return snap.exists();
        } catch (e) { return false; }
    }
};
window._fbReady = true;
window.dispatchEvent(new Event('fbready'));