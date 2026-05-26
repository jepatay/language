import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../firebase/config';
import {
  createUserDoc,
  getUserDoc,
  validateInviteCode,
  markCodeUsed,
  updateUserLastActive,
} from '../firebase/firestore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const doc = await getUserDoc(firebaseUser.uid);
        if (doc && doc.active === false) {
          await signOut(auth);
          setUser(null);
          setUserDoc(null);
        } else {
          setUser(firebaseUser);
          setUserDoc(doc);
          updateUserLastActive(firebaseUser.uid);
        }
      } else {
        setUser(null);
        setUserDoc(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function registerWithCode(email, password, inviteCode) {
    const codeDoc = await validateInviteCode(inviteCode);
    if (!codeDoc) throw new Error('Invalid or already-used invite code.');

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await createUserDoc(cred.user.uid, { email });
    await markCodeUsed(codeDoc.id, cred.user.uid);

    const doc = await getUserDoc(cred.user.uid);
    setUserDoc(doc);
    return cred.user;
  }

  async function login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const doc = await getUserDoc(cred.user.uid);
    if (doc?.active === false) {
      await signOut(auth);
      throw new Error('Account deactivated. Contact the admin.');
    }
    setUserDoc(doc);
    return cred.user;
  }

  async function logout() {
    await signOut(auth);
  }

  async function refreshUserDoc() {
    if (user) {
      const doc = await getUserDoc(user.uid);
      setUserDoc(doc);
    }
  }

  return (
    <AuthContext.Provider value={{ user, userDoc, loading, registerWithCode, login, logout, refreshUserDoc }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
