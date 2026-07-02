// frontend/src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const STORAGE_KEY = 'auth_session'; // sessionStorage, pas localStorage (voir note plus bas)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Au chargement de l'app, on restaure la session si elle existe déjà
  // (évite de devoir se reconnecter à chaque rafraîchissement de page)
  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { user, accessToken } = JSON.parse(saved);
        setUser(user);
        setAccessToken(accessToken);
      } catch {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  function login(user, accessToken) {
    setUser(user);
    setAccessToken(accessToken);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ user, accessToken }));
  }

  function logout() {
    setUser(null);
    setAccessToken(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }

  const value = {
    user,
    accessToken,
    isAuthenticated: !!accessToken,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé à l\'intérieur de <AuthProvider>');
  }
  return context;
}