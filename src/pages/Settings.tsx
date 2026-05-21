import React from 'react';
import { 
  Settings as SettingsIcon, 
  Save, 
  Globe, 
  DollarSign, 
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowRight,
  Palette,
  Sun,
  Moon,
  Monitor,
  Trash2,
  X
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { logActivity, OperationType, handleFirestoreError, cn } from '../lib/utils';
import { useConfig } from '../context/ConfigContext';

export default function Settings() {
  const config = useConfig();
  
  const [currencySymbol, setCurrencySymbol] = React.useState(config.currencySymbol);
  const [companyName, setCompanyName] = React.useState(config.companyName);
  const [companyAddress, setCompanyAddress] = React.useState(config.companyAddress);
  const [companyPhone, setCompanyPhone] = React.useState(config.companyPhone);
  const [companyEmail, setCompanyEmail] = React.useState(config.companyEmail);
  const [themeMode, setThemeMode] = React.useState<'light' | 'dark' | 'system'>(config.themeMode);
  const [lightBg, setLightBg] = React.useState(config.lightBg);
  const [lightText, setLightText] = React.useState(config.lightText);
  const [darkBg, setDarkBg] = React.useState(config.darkBg);
  const [darkText, setDarkText] = React.useState(config.darkText);
  const [resetModalOpen, setResetModalOpen] = React.useState(false);
  const [resetPassword, setResetPassword] = React.useState('');
  const [resetting, setResetting] = React.useState(false);
  const [resetStatus, setResetStatus] = React.useState<string | null>(null);

  // Synchronize local state with global config when config updates
  React.useEffect(() => {
    setCurrencySymbol(config.currencySymbol);
    setCompanyName(config.companyName);
    setCompanyAddress(config.companyAddress);
    setCompanyPhone(config.companyPhone);
    setCompanyEmail(config.companyEmail);
    setThemeMode(config.themeMode);
    setLightBg(config.lightBg);
    setLightText(config.lightText);
    setDarkBg(config.darkBg);
    setDarkText(config.darkText);
  }, [config]);

  const THEME_PRESETS = [
    {
      name: 'Default Professional',
      lightBg: '#f9fafb', lightText: '#111827',
      darkBg: '#030712', darkText: '#f9fafb'
    },
    {
      name: 'Midnight Slate',
      lightBg: '#f1f5f9', lightText: '#0f172a',
      darkBg: '#020617', darkText: '#f8fafc'
    },
    {
      name: 'Forest Dark',
      lightBg: '#f0fdf4', lightText: '#064e3b',
      darkBg: '#022c22', darkText: '#ecfdf5'
    },
    {
      name: 'Pure Contrast',
      lightBg: '#ffffff', lightText: '#000000',
      darkBg: '#000000', darkText: '#ffffff'
    }
  ];

  const applyPreset = (preset: typeof THEME_PRESETS[0]) => {
    setLightBg(preset.lightBg);
    setLightText(preset.lightText);
    setDarkBg(preset.darkBg);
    setDarkText(preset.darkText);
  };
  
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<{ type: 'success' | 'error', msg: string } | null>(null);

  // Local Live Preview Effect
  React.useEffect(() => {
    const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const root = document.documentElement;
    
    if (isDark) {
      root.style.setProperty('--theme-bg', darkBg);
      root.style.setProperty('--theme-text', darkText);
      root.style.setProperty('--theme-card-bg', '#111827');
      root.style.setProperty('--theme-card-border', 'rgba(255,255,255,0.05)');
    } else {
      root.style.setProperty('--theme-bg', lightBg);
      root.style.setProperty('--theme-text', lightText);
      root.style.setProperty('--theme-card-bg', '#ffffff');
      root.style.setProperty('--theme-card-border', 'rgba(0,0,0,0.05)');
    }

    // Cleanup: Revert to global config values when leaving settings page
    return () => {
      const globalIsDark = config.themeMode === 'dark' || (config.themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (globalIsDark) {
        root.style.setProperty('--theme-bg', config.darkBg);
        root.style.setProperty('--theme-text', config.darkText);
        root.style.setProperty('--theme-card-bg', '#111827');
        root.style.setProperty('--theme-card-border', 'rgba(255,255,255,0.05)');
      } else {
        root.style.setProperty('--theme-bg', config.lightBg);
        root.style.setProperty('--theme-text', config.lightText);
        root.style.setProperty('--theme-card-bg', '#ffffff');
        root.style.setProperty('--theme-card-border', 'rgba(0,0,0,0.05)');
      }
    };
  }, [lightBg, lightText, darkBg, darkText, themeMode, config]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        currencySymbol,
        companyName,
        companyAddress,
        companyPhone,
        companyEmail,
        themeMode,
        lightBg,
        lightText,
        darkBg,
        darkText,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await logActivity('SETTINGS_UPDATE', `Updated global settings & theme`, { currencySymbol, themeMode });
      setStatus({ type: 'success', msg: 'Settings applied successfully! All connected users will see the update immediately.' });
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Auto-clear success message
      setTimeout(() => setStatus(null), 5000);
      
    } catch (error) {
      setStatus({ type: 'error', msg: 'Failed to update settings. Please check your permissions or network.' });
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDatabase = async () => {
    if (resetPassword !== "03331306603") {
      setResetStatus("Invalid security key. Database reset aborted.");
      return;
    }

    setResetting(true);
    setResetStatus("Initializing global reset...");

    try {
      const collections = [
        'products', 'productions', 'customers', 'suppliers', 
        'expenses', 'purchases', 'invoices', 'stockMovements', 
        'activityLogs', 'categories'
      ];

      for (const collName of collections) {
        setResetStatus(`Clearing ${collName}...`);
        const q = collection(db, collName);
        const snapshot = await getDocs(q);
        
        // Use batch to delete (limit 500 per batch)
        let batch = writeBatch(db);
        let count = 0;
        
        for (const doc of snapshot.docs) {
          batch.delete(doc.ref);
          count++;
          if (count === 450) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
        
        if (count > 0) {
          await batch.commit();
        }
      }

      await logActivity('DATABASE_RESET', 'User performed a complete database reset');
      setResetStatus("Database reset successfully! Reloading...");
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      setResetStatus("Reset failed: " + (error as Error).message);
      handleFirestoreError(error, OperationType.DELETE, 'MULTIPLE_COLLECTIONS');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-blue-600" />
          Global Settings
        </h1>
        <p className="text-gray-500 dark:text-gray-400">Configure application-wide parameters, regional preferences, and visual theme.</p>
      </div>

      <div className="bg-theme-card rounded-3xl border border-theme-border shadow-xl overflow-hidden">
        <div className="p-8">
          <form onSubmit={handleSave} className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Regional Settings */}
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-theme-text flex items-center gap-2 border-b border-theme-border pb-3">
                  <Globe className="w-5 h-5 text-blue-500" />
                  General & Regional
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label>Company Display Name</label>
                    <input 
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="ForgeSteel Fabrication"
                      className="w-full bg-theme-bg border-theme-border text-theme-text"
                      required
                    />
                  </div>
                  <div>
                    <label>Company Office Address</label>
                    <input 
                      type="text"
                      value={companyAddress}
                      onChange={(e) => setCompanyAddress(e.target.value)}
                      placeholder="Ind. Zone, Street 4, Karachi, PK"
                      className="w-full bg-theme-bg border-theme-border text-theme-text"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label>Contact Phone</label>
                      <input 
                        type="text"
                        value={companyPhone}
                        onChange={(e) => setCompanyPhone(e.target.value)}
                        placeholder="+92 21 0000000"
                        className="w-full bg-theme-bg border-theme-border text-theme-text"
                      />
                    </div>
                    <div>
                      <label>Email Address</label>
                      <input 
                        type="email"
                        value={companyEmail}
                        onChange={(e) => setCompanyEmail(e.target.value)}
                        placeholder="info@forgesteel.com"
                        className="w-full bg-theme-bg border-theme-border text-theme-text"
                      />
                    </div>
                  </div>
                  <div>
                    <label>Default Currency Symbol</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <DollarSign className="h-4 w-4 text-gray-400" />
                      </div>
                      <select 
                        value={currencySymbol}
                        onChange={(e) => setCurrencySymbol(e.target.value)}
                        className="pl-10 w-full bg-theme-bg border-theme-border text-theme-text"
                      >
                        <option value="Rs.">Rs. (Pakistani Rupee)</option>
                        <option value="$">$ (US Dollar)</option>
                        <option value="€">€ (Euro)</option>
                        <option value="£">£ (British Pound)</option>
                        <option value="AED">AED (UAE Dirham)</option>
                        <option value="SAR">SAR (Saudi Riyal)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                   <h3 className="text-sm font-bold text-theme-text mb-4 uppercase tracking-wider">Live Logic Preview</h3>
                   <div className="p-4 rounded-2xl bg-theme-bg border border-theme-border">
                      <div className="flex justify-between items-center">
                         <span className="text-xs text-gray-500">Sample Invoice</span>
                         <span className="text-sm font-bold text-theme-text">{currencySymbol} 12,500.00</span>
                      </div>
                      <div className="mt-2 text-[10px] text-gray-400 font-mono">
                         {companyName} System v1.1.2
                      </div>
                   </div>
                </div>
              </div>

              {/* Look & Feel */}
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-theme-text flex items-center gap-2 border-b border-theme-border pb-3">
                  <Palette className="w-5 h-5 text-purple-500" />
                  Look & Feel
                </h3>

                <div className="space-y-6">
                  <div>
                    <label>Theme Mode</label>
                    <div className="grid grid-cols-3 gap-2">
                       {[
                         { id: 'light', icon: Sun, label: 'Light' },
                         { id: 'dark', icon: Moon, label: 'Dark' },
                         { id: 'system', icon: Monitor, label: 'System' }
                       ].map((mode) => (
                         <button
                           key={mode.id}
                           type="button"
                           onClick={() => setThemeMode(mode.id as any)}
                           className={cn(
                             "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all",
                             themeMode === mode.id 
                               ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                               : "border-theme-border text-gray-500 hover:border-gray-300 dark:hover:border-gray-600"
                           )}
                         >
                           <mode.icon className="w-5 h-5" />
                           <span className="text-xs font-bold uppercase">{mode.label}</span>
                         </button>
                       ))}
                    </div>
                  </div>

                  <div>
                    <label>Theme Presets</label>
                    <div className="grid grid-cols-2 gap-2 mb-6">
                       {THEME_PRESETS.map((preset) => (
                         <button
                           key={preset.name}
                           type="button"
                           onClick={() => applyPreset(preset)}
                           className={cn(
                             "flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                             (lightBg === preset.lightBg && darkBg === preset.darkBg)
                               ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/20"
                               : "border-theme-border hover:border-gray-300 dark:hover:border-gray-600 bg-theme-bg"
                           )}
                         >
                           <div className="flex -space-x-2">
                             <div className="w-5 h-5 rounded-full border-2 border-theme-card" style={{ backgroundColor: preset.lightBg }}></div>
                             <div className="w-5 h-5 rounded-full border-2 border-theme-card" style={{ backgroundColor: preset.darkBg }}></div>
                           </div>
                           <span className="text-[10px] font-bold text-theme-text leading-tight">{preset.name}</span>
                         </button>
                       ))}
                    </div>

                    <label className="mb-4">Custom Color Tuning</label>
                    <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] uppercase text-gray-400 tracking-wider">Light Background</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="color" 
                            className="w-10 h-10 p-0 border-none rounded-lg cursor-pointer bg-transparent"
                            value={lightBg}
                            onChange={(e) => setLightBg(e.target.value)}
                          />
                          <input 
                            type="text" 
                            className="flex-1 text-[10px] px-2 py-1 h-10 font-mono bg-theme-bg border-theme-border text-theme-text"
                            value={lightBg}
                            onChange={(e) => setLightBg(e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase text-gray-400 tracking-wider">Light Text</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="color" 
                            className="w-10 h-10 p-0 border-none rounded-lg cursor-pointer bg-transparent"
                            value={lightText}
                            onChange={(e) => setLightText(e.target.value)}
                          />
                          <input 
                            type="text" 
                            className="flex-1 text-[10px] px-2 py-1 h-10 font-mono bg-theme-bg border-theme-border text-theme-text"
                            value={lightText}
                            onChange={(e) => setLightText(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] uppercase text-gray-400 tracking-wider">Dark Background</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="color" 
                            className="w-10 h-10 p-0 border-none rounded-lg cursor-pointer bg-transparent"
                            value={darkBg}
                            onChange={(e) => setDarkBg(e.target.value)}
                          />
                          <input 
                            type="text" 
                            className="flex-1 text-[10px] px-2 py-1 h-10 font-mono bg-theme-bg border-theme-border text-theme-text"
                            value={darkBg}
                            onChange={(e) => setDarkBg(e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase text-gray-400 tracking-wider">Dark Text</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="color" 
                            className="w-10 h-10 p-0 border-none rounded-lg cursor-pointer bg-transparent"
                            value={darkText}
                            onChange={(e) => setDarkText(e.target.value)}
                          />
                          <input 
                            type="text" 
                            className="flex-1 text-[10px] px-2 py-1 h-10 font-mono bg-theme-bg border-theme-border text-theme-text"
                            value={darkText}
                            onChange={(e) => setDarkText(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </div>

            {status && (
              <div className={`p-4 rounded-xl flex items-center gap-3 border ${
                status.type === 'success' 
                  ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-900/30 dark:text-green-400' 
                  : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400'
              }`}>
                {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                <span className="text-sm font-medium">{status.msg}</span>
              </div>
            )}

            <div className="pt-6 border-t border-theme-border flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-10 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-3 disabled:opacity-50 active:scale-95"
                title="Save all changes to global settings"
              >
                {saving ? (
                   <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                Save & Apply Settings
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-xl shadow-blue-500/20 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm">
            <Database className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-bold mb-1">System Backup & Recovery</h3>
            <p className="text-blue-100 text-sm max-w-md">
              Securely export your entire database for offline storage or migrate data across environments.
            </p>
          </div>
        </div>
        <NavLink 
          to="/backup"
          className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-blue-50 transition-colors shrink-0"
        >
          Go to Backup Center
          <ArrowRight className="w-4 h-4" />
        </NavLink>
      </div>

      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 p-8 rounded-[32px] space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
             <h3 className="text-xl font-black text-red-600 dark:text-red-500 uppercase tracking-tight flex items-center gap-2">
                <Trash2 className="w-6 h-6" />
                Danger Zone
             </h3>
             <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                Irreversible actions. Use with extreme caution.
             </p>
          </div>
          <button 
            onClick={() => {
              setResetPassword('');
              setResetStatus(null);
              setResetModalOpen(true);
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-red-500/20 active:scale-95 transition-all"
          >
            Reset All Database Data
          </button>
        </div>
        <p className="text-[10px] text-red-500/70 border-t border-red-200 dark:border-red-900/20 pt-4 uppercase font-black tracking-widest">
           Warning: This will delete all products, invoices, customers, and history logs forever.
        </p>
      </div>

      {resetModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-theme-card w-full max-w-md rounded-[40px] p-10 shadow-2xl border border-red-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
               <Trash2 className="w-32 h-32 text-red-600" />
            </div>
            
            <div className="relative z-10 space-y-8">
              <div className="text-center">
                 <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-[30px] flex items-center justify-center mx-auto mb-6 text-red-600">
                    <AlertCircle className="w-10 h-10" />
                 </div>
                 <h2 className="text-2xl font-black text-theme-text uppercase tracking-tight">Are you sure?</h2>
                 <p className="text-gray-500 text-sm mt-2">
                    This action is <span className="text-red-600 font-black">permanent</span> and cannot be undone. 
                    Your entire business history will be wiped.
                 </p>
              </div>

              <div className="space-y-4">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Enter Security Reset Key</label>
                    <input 
                      type="password"
                      placeholder="Enter the 11-digit master key"
                      className="w-full bg-theme-bg border-theme-border p-5 rounded-2xl font-black tracking-[0.5em] text-center text-xl focus:ring-4 focus:ring-red-500/20 outline-none transition-all"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      disabled={resetting}
                    />
                 </div>
              </div>

              {resetStatus && (
                <div className={cn(
                  "p-4 rounded-2xl text-xs font-bold text-center border animate-in fade-in slide-in-from-top-2",
                  resetStatus.includes('success') 
                    ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-900/30 dark:text-green-400"
                    : "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400"
                )}>
                  {resetStatus}
                </div>
              )}

              <div className="flex flex-col gap-3">
                 <button 
                   onClick={handleResetDatabase}
                   disabled={resetting || !resetPassword}
                   className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-200 dark:disabled:bg-gray-800 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                 >
                    {resetting ? (
                       <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    ) : (
                       <>
                         <Trash2 className="w-5 h-5" />
                         Confirm Wipe All Data
                       </>
                    )}
                 </button>
                 {!resetting && (
                   <button 
                     onClick={() => setResetModalOpen(false)}
                     className="w-full text-gray-500 hover:text-theme-text font-bold text-xs uppercase tracking-widest py-2 transition-colors"
                   >
                     I changed my mind. Cancel.
                   </button>
                 )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-6 rounded-2xl flex gap-4">
        <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-500 shrink-0" />
        <div>
          <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-1">Important Note</h4>
          <p className="text-xs text-amber-700 dark:text-amber-500/80 leading-relaxed">
            Changing regional settings affects how data is displayed to all users. 
            Currency conversions are not performed automatically; only the visual symbol is updated.
            The "Rs." symbol is optimized for the Pakistani regional market.
          </p>
        </div>
      </div>
    </div>
  );
}
