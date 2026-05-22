import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  Receipt, 
  Users, 
  Truck, 
  ShoppingBag, 
  CreditCard, 
  BarChart3,
  LogOut,
  Menu,
  X,
  Bell,
  Sun,
  Moon,
  Hammer,
  ClipboardList,
  Database,
  Settings,
  Info,
  Heart,
  Monitor
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { doc, updateDoc, collection, onSnapshot } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { useConfig } from '../context/ConfigContext';
import { useProgress } from '../context/ProgressContext';

interface Props {
  userRole: string | null;
}

export default function Layout({ userRole }: Props) {
  const { themeMode, lightBg, lightText, darkBg, darkText, companyName } = useConfig();
  const { progress, message } = useProgress();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(window.innerWidth >= 1024);
  const [lowStockCount, setLowStockCount] = React.useState(0);
  const navigate = useNavigate();

  const handleNavClick = () => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  React.useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      const count = snapshot.docs.filter(doc => {
        const data = doc.data();
        return (data.currentStock || 0) <= (data.minStock || 0);
      }).length;
      setLowStockCount(count);
    }, (error) => {
      console.error("Error listening to products collection:", error);
    });

    return () => unsubscribe();
  }, []);

  // Handle Theme Mode & Custom Colors
  React.useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const applyTheme = () => {
      const isDark = themeMode === 'dark' || (themeMode === 'system' && mediaQuery.matches);
      
      if (isDark) {
        root.classList.add('dark');
        root.style.setProperty('--theme-bg', darkBg || '#020617');
        root.style.setProperty('--theme-text', darkText || '#f8fafc');
        root.style.setProperty('--theme-card-bg', '#0f172a'); 
        root.style.setProperty('--theme-card-border', '#1e293b');
      } else {
        root.classList.remove('dark');
        root.style.setProperty('--theme-bg', lightBg || '#f8fafc');
        root.style.setProperty('--theme-text', lightText || '#0f172a');
        root.style.setProperty('--theme-card-bg', '#ffffff');
        root.style.setProperty('--theme-card-border', '#e2e8f0');
      }
    };

    applyTheme();

    if (themeMode === 'system') {
      const handler = () => applyTheme();
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [themeMode, lightBg, lightText, darkBg, darkText]);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/', roles: ['admin', 'manager', 'staff', 'storekeeper'] },
    { name: 'Inventory', icon: Package, path: '/inventory', roles: ['admin', 'storekeeper', 'manager'] },
    { name: 'Fabrication', icon: Hammer, path: '/fabrication', roles: ['admin', 'storekeeper', 'manager'] },
    { name: 'Invoices', icon: Receipt, path: '/invoices', roles: ['admin', 'manager', 'staff'] },
    { name: 'Customers', icon: Users, path: '/customers', roles: ['admin', 'manager', 'staff'] },
    { name: 'Suppliers', icon: Truck, path: '/suppliers', roles: ['admin', 'manager'] },
    { name: 'Purchases', icon: ShoppingBag, path: '/purchases', roles: ['admin', 'manager'] },
    { name: 'Expenses', icon: CreditCard, path: '/expenses', roles: ['admin', 'manager'] },
    { name: 'Reports', icon: BarChart3, path: '/reports', roles: ['admin', 'manager'] },
    { name: 'About', icon: Info, path: '/about', roles: ['admin', 'manager', 'staff', 'storekeeper'] },
    { name: 'Users', icon: Users, path: '/users', roles: ['admin'] },
    { name: 'Settings', icon: Settings, path: '/settings', roles: ['admin'] },
  ];

  const filteredNavItems = navItems.filter(item => !userRole || item.roles.includes(userRole));

  const toggleTheme = async () => {
    const modes: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system'];
    const currentIndex = modes.indexOf(themeMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    
    try {
      await updateDoc(doc(db, 'settings', 'global'), {
        themeMode: nextMode,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error toggling theme:", error);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden animate-in fade-in transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-theme-card border-r border-theme-border transition-transform duration-300 ease-in-out lg:translate-x-0 shadow-2xl lg:shadow-none",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-500/20">
                <Hammer className="text-white w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-black text-gray-900 dark:text-white leading-none">{companyName.split(' ')[0]}</h1>
                <span className="text-[10px] font-black text-blue-600 dark:text-blue-500 tracking-[0.2em] mt-1" title="App Version">v1.6.0</span>
              </div>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
              title="Close Sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 px-4 py-4 space-y-1">
            {filteredNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                )}
                title={`Go to ${item.name}`}
                onClick={handleNavClick}
              >
                {({ isActive }) => (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-slate-400")} />
                      <span>{item.name}</span>
                    </div>
                    {item.name === 'Inventory' && lowStockCount > 0 && (
                      <span className={cn(
                        "text-[10px] font-black px-2 py-0.5 rounded-full leading-none transition-colors",
                        isActive 
                          ? "bg-white text-blue-600 shadow-sm" 
                          : "bg-amber-500 text-white dark:bg-amber-500/20 dark:text-amber-400"
                      )}>
                        {lowStockCount}
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-200 dark:border-gray-800">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/10 rounded-lg transition-colors"
              title="Sign out of your account"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={cn("transition-all duration-300", isSidebarOpen ? "lg:ml-64" : "ml-0")}>
        {/* Topbar */}
        <header className="sticky top-0 z-40 bg-theme-card/80 backdrop-blur-md border-b border-theme-border h-16 flex items-center justify-between px-6">
          {/* Global Progress Bar Overlay */}
          {progress !== null && (
            <div className="absolute top-0 left-0 w-full h-[3px] bg-theme-border/20 z-[60]">
              <div 
                className="bg-blue-600 h-full transition-all duration-300 ease-out shadow-[0_0_12px_rgba(37,99,235,0.6)]" 
                style={{ width: `${progress}%` }} 
              />
            </div>
          )}

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              {isSidebarOpen ? <X /> : <Menu />}
            </button>
            <div className="hidden sm:flex flex-col gap-0.5">
              <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none">
                {userRole || 'Authenticated User'}
              </div>
              {progress !== null && (
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 animate-pulse truncate max-w-[200px]">
                    {message}
                  </span>
                  <span className="text-[9px] font-black text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 px-1 rounded-sm">
                    {Math.round(progress)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={toggleTheme}
              className="p-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-90"
              title={`Switch Theme (Current: ${themeMode})`}
            >
              {themeMode === 'light' ? <Sun className="w-5 h-5" /> : themeMode === 'dark' ? <Moon className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
            </button>
            <button 
              className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg relative"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"></span>
            </button>
            <div 
              className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm"
              title={`Logged in as ${auth.currentUser?.email}`}
            >
              {auth.currentUser?.email?.[0].toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          <Outlet context={{ userRole }} />
        </main>
      </div>
    </div>
  );
}
