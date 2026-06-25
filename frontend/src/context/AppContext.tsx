import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface AppContextType {
  user: User | null;
  token: string | null;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  login: (token: string, refreshToken: string, user: User) => void;
  logout: () => void;
  hasPermission: (permissionName: string) => boolean;
  userPermissions: string[];
  setUserPermissions: (perms: string[]) => void;
  loading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Load state from localStorage on init
  useEffect(() => {
    const savedToken = localStorage.getItem('lms_token');
    const savedUser = localStorage.getItem('lms_user');
    const savedTheme = localStorage.getItem('lms_theme') as 'light' | 'dark';

    if (savedToken && savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setToken(savedToken);
      setUser(parsedUser);
      axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
      
      // Fetch permissions based on role
      fetchUserPermissions(savedToken);
    }

    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
      document.documentElement.classList.toggle('light', savedTheme === 'light');
    } else {
      document.documentElement.classList.add('dark');
    }
    setLoading(false);
  }, []);

  const fetchUserPermissions = async (authToken: string) => {
    try {
      const res = await axios.get('/api/settings/masters', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const currentRole = res.data.roles.find((r: any) => r.name === JSON.parse(localStorage.getItem('lms_user') || '{}').role);
      if (currentRole) {
        const permsList = currentRole.permissions.map((p: any) => p.permission.name);
        setUserPermissions(permsList);
      }
    } catch (err) {
      console.error('Failed to load user permissions:', err);
    }
  };

  const login = (accessToken: string, refreshToken: string, userData: User) => {
    setToken(accessToken);
    setUser(userData);
    localStorage.setItem('lms_token', accessToken);
    localStorage.setItem('lms_refresh_token', refreshToken);
    localStorage.setItem('lms_user', JSON.stringify(userData));
    axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    
    fetchUserPermissions(accessToken);
    navigate('/');
  };

  const logout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (err) {
      console.error('Logout request failed:', err);
    }
    setToken(null);
    setUser(null);
    setUserPermissions([]);
    localStorage.removeItem('lms_token');
    localStorage.removeItem('lms_refresh_token');
    localStorage.removeItem('lms_user');
    delete axios.defaults.headers.common['Authorization'];
    navigate('/login');
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('lms_theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    document.documentElement.classList.toggle('light', nextTheme === 'light');
  };

  const hasPermission = (permissionName: string) => {
    if (user?.role === 'Admin') return true;
    return userPermissions.includes(permissionName);
  };

  return (
    <AppContext.Provider
      value={{
        user,
        token,
        theme,
        toggleTheme,
        login,
        logout,
        hasPermission,
        userPermissions,
        setUserPermissions,
        loading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
