import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  serverTimestamp,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';

// Invite codes
export async function validateInviteCode(code) {
  const q = query(
    collection(db, 'inviteCodes'),
    where('code', '==', code.toUpperCase()),
    where('used', '==', false)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
}

export async function markCodeUsed(codeId, userId) {
  await updateDoc(doc(db, 'inviteCodes', codeId), {
    used: true,
    usedBy: userId,
    usedAt: serverTimestamp(),
  });
}

export async function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  await addDoc(collection(db, 'inviteCodes'), {
    code,
    used: false,
    createdAt: serverTimestamp(),
  });
  return code;
}

// Users
export async function createUserDoc(uid, data) {
  await setDoc(doc(db, 'users', uid), {
    ...data,
    isAdmin: false,
    active: true,
    createdAt: serverTimestamp(),
    lastActive: serverTimestamp(),
  });
}

export async function getUserDoc(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateUserLastActive(uid) {
  await updateDoc(doc(db, 'users', uid), { lastActive: serverTimestamp() });
}

export async function getAllUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function setUserActive(uid, active) {
  await updateDoc(doc(db, 'users', uid), { active });
}

// Profiles
export async function getProfiles(uid) {
  const snap = await getDocs(collection(db, 'users', uid, 'profiles'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createProfile(uid, profileData) {
  const ref = await addDoc(collection(db, 'users', uid, 'profiles'), {
    ...profileData,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProfile(uid, profileId, data) {
  await updateDoc(doc(db, 'users', uid, 'profiles', profileId), data);
}

export async function deleteProfile(uid, profileId) {
  await deleteDoc(doc(db, 'users', uid, 'profiles', profileId));
}

// Conversations
export async function saveMessage(uid, profileId, language, message) {
  await addDoc(
    collection(db, 'users', uid, 'profiles', profileId, 'conversations', language, 'messages'),
    { ...message, timestamp: serverTimestamp() }
  );
}

export async function getMessages(uid, profileId, language, msgLimit = 50) {
  const q = query(
    collection(db, 'users', uid, 'profiles', profileId, 'conversations', language, 'messages'),
    orderBy('timestamp', 'asc'),
    limit(msgLimit)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveConversationSummary(uid, profileId, language, summary) {
  await setDoc(
    doc(db, 'users', uid, 'profiles', profileId, 'conversations', language),
    { summary, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function getConversationMeta(uid, profileId, language) {
  const snap = await getDoc(
    doc(db, 'users', uid, 'profiles', profileId, 'conversations', language)
  );
  return snap.exists() ? snap.data() : null;
}

// Progress / scores
export async function saveActivityScore(uid, profileId, language, activityType, score) {
  await addDoc(
    collection(db, 'users', uid, 'profiles', profileId, 'scores'),
    { language, activityType, score, timestamp: serverTimestamp() }
  );
}

export async function getScores(uid, profileId, language) {
  const q = query(
    collection(db, 'users', uid, 'profiles', profileId, 'scores'),
    where('language', '==', language),
    orderBy('timestamp', 'desc'),
    limit(100)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
