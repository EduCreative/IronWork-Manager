import React from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { 
  auth, 
  db, 
  firestoreStatus, 
  firestoreErrorDetails, 
  testConnection,
  firebaseConfig,
  setLocalStorageOverride,
  clearLocalStorageOverrides
} from '../lib/firebase';
import { Hammer, Chrome, AlertTriangle, Database, RefreshCw, Settings, Check, HelpCircle, Eye, EyeOff } from 'lucide-react';
import { logActivity } from '../lib/utils';
import { useConfig } from '../context/ConfigContext';

export default function Login() {
  const { companyName } = useConfig();
  const [isLogin, setIsLogin] = React.useState(true);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [connStatus, setConnStatus] = React.useState(firestoreStatus);
  const [connChecking, setConnChecking] = React.useState(false);

  // Connection configurations state
  const [showTroubleshooter, setShowTroubleshooter] = React.useState(firestoreStatus !== 'connected' && firestoreStatus !== 'permission-denied');
  const [customDbId, setCustomDbId] = React.useState(firebaseConfig.firestoreDatabaseId || '(default)');
  const [customApiKey, setCustomApiKey] = React.useState(firebaseConfig.apiKey || '');
  const [customProjectId, setCustomProjectId] = React.useState(firebaseConfig.projectId || '');
  const [showKey, setShowKey] = React.useState(false);

  const handleSaveOverrides = () => {
    setLocalStorageOverride('FIREBASE_DATABASE_ID', customDbId.trim());
    setLocalStorageOverride('FIREBASE_API_KEY', customApiKey.trim());
    if (customProjectId.trim()) {
      setLocalStorageOverride('FIREBASE_PROJECT_ID', customProjectId.trim());
    }
    window.location.reload();
  };

  const handleResetDefaults = () => {
    clearLocalStorageOverrides();
    window.location.reload();
  };

  const handleRetryConnection = async () => {
    setConnChecking(true);
    await testConnection();
    setConnStatus(firestoreStatus);
    setConnChecking(false);
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Store access token for Google Drive integration
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      if (token) {
        localStorage.setItem('googleAccessToken', token);
      }
      
      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          role: user.email === 'kmasroor50@gmail.com' ? 'admin' : 'staff',
          createdAt: new Date().toISOString()
        });
        await logActivity('USER_REGISTER', `Google registered: ${user.email}`);
      } else {
        await logActivity('USER_LOGIN', `Google login: ${user.email}`);
      }
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError('Google Sign-In is not enabled in Firebase Console. Please enable it under Authentication > Providers.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        await logActivity('USER_LOGIN', `Email login: ${email}`);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: email,
          role: email === 'kmasroor50@gmail.com' ? 'admin' : 'staff',
          createdAt: new Date().toISOString()
        });
        await logActivity('USER_REGISTER', `Email registered: ${email}`);
      }
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password sign-in is not enabled in Firebase Console. Please enable it under Authentication > Sign-in method.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
        setIsLogin(true);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4 transition-colors duration-300">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-500/20">
            <Hammer className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{companyName}</h1>
          <p className="text-gray-500 dark:text-gray-400 italic">Advanced Industrial Solutions</p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-8 rounded-3xl shadow-xl">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>

          {/* Connection Diagnostician / Troubleshooter Box */}
          {connStatus !== 'connected' && connStatus !== 'permission-denied' && (
            <div className="mb-6 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 p-4 rounded-2xl">
              <div className="flex gap-2.5 items-start">
                <AlertTriangle className="text-amber-600 dark:text-amber-500 w-5 h-5 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-amber-900 dark:text-amber-300 text-sm">Firestore Connection Issue</h3>
                  <p className="text-xs text-amber-700 dark:text-amber-400/95 mt-1 leading-relaxed">
                    We could not reach Firestore on project <strong className="font-mono">{firebaseConfig.projectId}</strong>. 
                  </p>
                  
                  <div className="mt-3 overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={() => setShowTroubleshooter(!showTroubleshooter)}
                      className="text-amber-800 dark:text-amber-400 underline font-semibold hover:text-amber-950 dark:hover:text-amber-200 flex items-center gap-1"
                    >
                      <Settings className="w-3.5 h-3.5 animate-pulse" />
                      {showTroubleshooter ? 'Hide Controls' : 'Open Settings & Troubleshooter'}
                    </button>

                    {showTroubleshooter && (
                      <div className="mt-4 bg-white/85 dark:bg-gray-950/50 border border-amber-200/60 dark:border-amber-850/40 p-3 rounded-xl space-y-3 shadow-inner text-gray-800 dark:text-gray-100">
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                          Active Parameters
                        </div>
                        
                        <div>
                          <label className="block text-[11px] text-gray-400 dark:text-gray-500 mb-0.5">Database Instance ID</label>
                          <select
                            value={customDbId}
                            onChange={(e) => setCustomDbId(e.target.value)}
                            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-[11px] font-mono p-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="(default)">(default) - Standard default database</option>
                            <option value="ai-studio-fc06b0dc-4427-49a5-87eb-c1b22fe462f9">ai-studio-fc06b0dc-4427-49a5-87eb-c1b22fe462f9 (custom AI Studio DB)</option>
                            <option value="other">Enter Custom Database ID...</option>
                          </select>
                          
                          {customDbId !== '(default)' && customDbId !== 'ai-studio-fc06b0dc-4427-49a5-87eb-c1b22fe462f9' && (
                            <input
                              type="text"
                              placeholder="Enter Custom Database ID"
                              value={customDbId === 'other' ? '' : customDbId}
                              onChange={(e) => setCustomDbId(e.target.value)}
                              className="w-full mt-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-[11px] font-mono p-1.5 rounded-lg text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
                            />
                          )}
                          <p className="text-[10px] text-amber-800 dark:text-amber-500 mt-1 leading-normal italic">
                            If you created Firestore database manually in Firebase console, select <strong>(default)</strong>.
                          </p>
                        </div>

                        <div>
                          <label className="block text-[11px] text-gray-400 dark:text-gray-500 mb-0.5">Browser API Key</label>
                          <div className="relative">
                            <input
                              type={showKey ? "text" : "password"}
                              value={customApiKey}
                              onChange={(e) => setCustomApiKey(e.target.value)}
                              className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-[11px] font-mono p-1.5 pr-8 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="AIzaSy..."
                            />
                            <button
                              type="button"
                              onClick={() => setShowKey(!showKey)}
                              className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] text-gray-400 dark:text-gray-500 mb-0.5">Project ID</label>
                          <input
                            type="text"
                            value={customProjectId}
                            onChange={(e) => setCustomProjectId(e.target.value)}
                            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-[11px] font-mono p-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="ironwork-manager"
                          />
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleSaveOverrides}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] py-1.5 px-2 rounded-lg transition-all text-center"
                          >
                            Apply & Reload
                          </button>
                          <button
                            type="button"
                            onClick={handleResetDefaults}
                            className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-[11px] py-1.5 px-2 rounded-lg transition-all text-center"
                          >
                            Reset Defaults
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 font-mono break-all bg-amber-100/40 dark:bg-amber-950/40 p-1.5 rounded-lg leading-snug">
                    Message: {firestoreErrorDetails || 'Endpoint unreachable / Firestore API disabled / Database instance has not been initialized'}
                  </p>

                  <button
                    type="button"
                    onClick={handleRetryConnection}
                    disabled={connChecking}
                    className="mt-3 inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold text-[11px] px-3 py-1.5 rounded-xl transition-all shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${connChecking ? 'animate-spin' : ''}`} />
                    {connChecking ? 'Testing Connection...' : 'Recheck Connection'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-gray-400"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-gray-400"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              title={isLogin ? "Sign in to your account" : "Create a new staff account"}
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Register')}
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-900 text-gray-400 dark:text-gray-500 uppercase tracking-widest text-[10px]">Or continue with</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-white border border-gray-200 dark:border-transparent dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-semibold py-3 rounded-xl shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              title="Sign in using your Google account"
            >
              <Chrome className="w-5 h-5" />
              Google Portal
            </button>
          </form>

          <p className="mt-6 text-center text-gray-500 text-sm">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-blue-500 hover:underline font-medium"
              title={isLogin ? "Switch to registration form" : "Switch to login form"}
            >
              {isLogin ? 'Register now' : 'Sign in instead'}
            </button>
          </p>
        </div>
        
        <div className="mt-8 text-center text-gray-400 dark:text-gray-600 text-xs uppercase tracking-[0.2em]">
          Secure Industrial Portal v1.6.0
        </div>
      </div>
    </div>
  );
}
