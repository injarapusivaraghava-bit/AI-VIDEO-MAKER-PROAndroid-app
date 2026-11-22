import React, { createContext, useContext, useEffect, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  auth,
  getDriveAccessToken,
  googleProvider,
  setDriveAccessToken,
} from '../firebase';
import { ADMIN_EMAIL, ensureUserProfile } from '../utils/firestoreService';

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  profileReady: boolean;
  isAdminUser: boolean;
  signingIn: boolean;
  authError: string;
  driveToken: string | null;
  needsDriveAuth: boolean;
  signInWithGoogle: () => Promise<string | null>;
  connectGoogleDrive: () => Promise<string | null>;
  clearDriveToken: () => void;
  signOutUser: () => Promise<void>;
  clearAuthError: () => void;
}

const FirebaseContext = createContext<FirebaseContextValue>({
  user: null,
  authReady: false,
  profileReady: false,
  isAdminUser: false,
  signingIn: false,
  authError: '',
  driveToken: null,
  needsDriveAuth: true,
  signInWithGoogle: async () => null,
  connectGoogleDrive: async () => null,
  clearDriveToken: () => {},
  signOutUser: async () => {},
  clearAuthError: () => {},
});

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState('');
  const [driveToken, setDriveToken] = useState<string | null>(() => getDriveAccessToken());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setProfileReady(false);
      setAuthReady(true);

      if (nextUser) {
        try {
          await ensureUserProfile(nextUser);
          setProfileReady(true);
        } catch (err: any) {
          console.error('Failed to ensure Firestore user profile:', err);
          setAuthError(err?.message || 'Unable to initialize cloud profile.');
        }
      } else {
        setDriveAccessToken(null);
        setDriveToken(null);
      }
    });

    return () => unsub();
  }, []);

  const signInWithGoogle = async (): Promise<string | null> => {
    setSigningIn(true);
    setAuthError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken ?? null;
      if (token) {
        setDriveAccessToken(token);
        setDriveToken(token);
      }
      return token;
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setAuthError(err?.message || 'Google Sign-In failed');
      }
      return null;
    } finally {
      setSigningIn(false);
    }
  };

  const clearDriveToken = () => {
    setDriveAccessToken(null);
    setDriveToken(null);
  };

  const signOutUser = async () => {
    setAuthError('');
    clearDriveToken();
    await signOut(auth);
  };

  const isAdminUser = Boolean(
    user && user.emailVerified && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authReady,
        profileReady,
        isAdminUser,
        signingIn,
        authError,
        driveToken,
        needsDriveAuth: !driveToken,
        signInWithGoogle,
        connectGoogleDrive: signInWithGoogle,
        clearDriveToken,
        signOutUser,
        clearAuthError: () => setAuthError(''),
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebase() {
  return useContext(FirebaseContext);
}
