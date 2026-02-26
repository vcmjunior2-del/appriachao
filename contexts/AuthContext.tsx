
import React, { createContext, useContext, useEffect, useState } from 'react';
import firebase from 'firebase/compat/app';
import { auth, db } from '../firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserItem } from '../types';

interface AuthContextType {
  currentUser: firebase.User | null;
  userData: UserItem | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userData: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<firebase.User | null>(null);
  const [userData, setUserData] = useState<UserItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      if (!user) {
        setUserData(null);
        setLoading(false);
      }
    });

    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    if (currentUser) {
      const unsubscribeDoc = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
          setUserData(docSnap.data() as UserItem);
        } else {
          setUserData(null);
        }
        setLoading(false);
      }, (error) => {
        console.error("Error fetching user data:", error);
        setLoading(false);
      });
      return unsubscribeDoc;
    }
  }, [currentUser]);

  const value = {
    currentUser,
    userData,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
