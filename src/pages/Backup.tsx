import React from 'react';
import { 
  Cloud, 
  Download, 
  Upload, 
  Clock, 
  User, 
  Database,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileJson,
  Smartphone,
  Globe,
  ArrowLeft
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { db, auth } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { cn, formatDate, logActivity } from '../lib/utils';
import { getBackupData, restoreBackup, saveBackupMetadata } from '../lib/backupService';
import { uploadToDrive, listBackupsFromDrive } from '../lib/driveService';
import { useProgress } from '../context/ProgressContext';

export default function Backup() {
  const { showProgress, updateProgress, hideProgress } = useProgress();
  const [loading, setLoading] = React.useState(false);
  const [metadata, setMetadata] = React.useState<any>(null);
  const [status, setStatus] = React.useState<{ type: 'success' | 'error' | 'info', msg: string } | null>(null);
  const [progress, setProgress] = React.useState('');
  const [previewData, setPreviewData] = React.useState<any>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [validationErrors, setValidationErrors] = React.useState<string[]>([]);

  const fetchMetadata = async () => {
    const docRef = await getDoc(doc(db, 'backupMetadata', 'last_backup'));
    if (docRef.exists()) {
      setMetadata(docRef.data());
    }
  };

  React.useEffect(() => {
    fetchMetadata();
  }, []);

  const validateBackupData = (data: any) => {
    const errors: string[] = [];
    
    // Normalize data: check if it's the wrapped format or raw format
    const actualData = data.data && typeof data.data === 'object' && !Array.isArray(data.data) 
      ? data.data 
      : data;

    if (typeof actualData !== 'object' || Array.isArray(actualData)) {
      errors.push('Invalid backup structure: file must contain a JSON object');
      return errors;
    }
    
    const requiredCollections = ['products', 'customers', 'invoices'];
    
    requiredCollections.forEach(col => {
      if (!actualData[col]) {
        errors.push(`Missing important collection: ${col}`);
      } else if (!Array.isArray(actualData[col])) {
        errors.push(`Collection ${col} must be an array`);
      }
    });

    return errors;
  };

  const handleLocalBackup = async () => {
    setLoading(true);
    setStatus({ type: 'info', msg: 'Preparing data...' });
    showProgress('Starting local backup...', 0);
    try {
      const data = await getBackupData((p, msg) => {
        updateProgress(p, msg);
        setProgress(msg);
      });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `FORGE_STEEL_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await saveBackupMetadata('local', blob.size);
      await fetchMetadata();
      await logActivity('BACKUP_CREATE', 'Manual local backup created and downloaded');
      setStatus({ type: 'success', msg: 'Local backup downloaded successfully!' });
      hideProgress();
    } catch (error: any) {
      setStatus({ type: 'error', msg: `Backup failed: ${error.message}` });
      hideProgress();
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    showProgress('Reading file...', 50);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const errors = validateBackupData(data);
      
      setValidationErrors(errors);
      setPreviewData(data);
      setIsModalOpen(true);
    } catch (error: any) {
      setStatus({ type: 'error', msg: `Failed to read file: ${error.message}` });
    } finally {
      setLoading(false);
      hideProgress();
      e.target.value = '';
    }
  };

  const handleConfirmRestore = async () => {
    if (!previewData) return;
    
    setIsModalOpen(false);
    setLoading(true);
    setStatus({ type: 'info', msg: 'Restoring data...' });
    showProgress('Initializing Restore...', 0);
    
    try {
      await restoreBackup(previewData, (p, msg) => {
        updateProgress(p, msg);
        setProgress(msg);
      });
      await logActivity('BACKUP_RESTORE', 'System data restored from local backup file');
      setStatus({ type: 'success', msg: 'Data restored successfully!' });
      setProgress('');
      setPreviewData(null);
      hideProgress();
    } catch (error: any) {
      setStatus({ type: 'error', msg: `Restore failed: ${error.message}` });
      hideProgress();
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleDriveBackup = async () => {
    setLoading(true);
    setStatus({ type: 'info', msg: 'Preparing Google Drive upload...' });
    showProgress('Preparing Google Drive backup...', 0);
    try {
      const data = await getBackupData((p, msg) => {
        updateProgress(p * 0.5, msg); // Use first half for data prep
        setProgress(msg);
      });
      const content = JSON.stringify(data, null, 2);
      const filename = `FORGE_STEEL_BACKUP_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      
      updateProgress(50, 'Uploading to Google Drive...');
      const result = await uploadToDrive(filename, content);
      
      if (result.success) {
        updateProgress(100, 'Upload complete!');
        await saveBackupMetadata('drive', content.length);
        await fetchMetadata();
        await logActivity('BACKUP_CREATE', 'Manual Google Drive backup created');
        setStatus({ type: 'success', msg: result.message });
      } else {
        setStatus({ type: 'error', msg: result.message });
      }
      hideProgress();
    } catch (error: any) {
      setStatus({ type: 'error', msg: `Drive backup failed: ${error.message}` });
      hideProgress();
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <NavLink 
          to="/settings"
          className="p-3 bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-blue-500 rounded-2xl transition-colors border border-gray-200 dark:border-gray-700 shadow-sm"
          title="Back to Settings"
        >
          <ArrowLeft className="w-6 h-6" />
        </NavLink>
        <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20">
          <Database className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Backup & Restore</h1>
          <p className="text-gray-500 dark:text-gray-400">Keep your data safe and synchronized across devices.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Card (WhatsApp Style) */}
        <div className="md:col-span-2 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-6 mb-8">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center text-green-600">
                <Cloud className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Last backup</h2>
                <div className="flex flex-wrap gap-x-6 gap-y-2 mt-1">
                  <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>{metadata ? formatDate(metadata.lastBackupAt) : 'Never'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                    <Database className="w-4 h-4" />
                    <span>Size: {metadata ? formatSize(metadata.size) : '0 KB'}</span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-6">
              Backup your data and history to prevent loss. You can restore your data when you Switch database or reinstall the app.
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Account</p>
                    <p className="text-sm font-medium dark:text-white">{metadata?.lastBackupEmail || auth.currentUser?.email}</p>
                  </div>
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                  metadata?.type === 'drive' ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                )}>
                  {metadata?.type || 'No backup'}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-gray-50/50 dark:bg-gray-800/30 flex flex-wrap gap-4 items-center justify-between">
            <button 
              onClick={handleGoogleDriveBackup}
              disabled={loading}
              className="px-8 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold rounded-2xl shadow-lg shadow-green-500/20 transition-all flex items-center gap-2"
              title="Securely upload a copy of your database to Google Drive"
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Cloud className="w-5 h-5" />}
              BACK UP TO DRIVE
            </button>
            <div className="text-xs text-gray-400 italic">
              Auto-backup is currently disabled
            </div>
          </div>
        </div>

        {/* Local Backup Card */}
        <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 mb-6">
            <FileJson className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Local Backup</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            Download your data as a JSON file. Perfect for manual archiving or moving between systems.
          </p>
          <button 
            onClick={handleLocalBackup}
            disabled={loading}
            className="w-full py-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
            title="Download a database backup file to your computer"
          >
            <Download className="w-4 h-4" />
            Export Data
          </button>
        </div>

        {/* Restore Card */}
        <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 mb-6">
            <Smartphone className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Restore Data</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            Upload a previously exported backup file to restore your entire database.
          </p>
          <label 
            className="w-full py-3 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-600 dark:text-purple-400 font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            title="Upload and restore data from a backup JSON file"
          >
            <Upload className="w-4 h-4" />
            Import File
            <input 
              type="file" 
              accept=".json" 
              onChange={handleFileSelect}
              className="hidden" 
              disabled={loading}
            />
          </label>
        </div>
      </div>

      {status && (
        <div className={cn(
          "p-4 rounded-2xl border flex items-start gap-3",
          status.type === 'success' ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-900/30 dark:text-green-400" :
          status.type === 'error' ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400" :
          "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-900/30 dark:text-blue-400"
        )}>
          {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          <div className="flex-1">
            <p className="text-sm font-medium">{status.msg}</p>
            {progress && <p className="text-xs mt-1 opacity-70">{progress}</p>}
          </div>
          <button onClick={() => setStatus(null)} className="text-sm font-bold opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Restore Preview Modal */}
      {isModalOpen && previewData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-theme-card w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-theme-border">
            <div className="p-6 border-b border-theme-border flex items-center justify-between">
              <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                <FileJson className="w-6 h-6 text-purple-500" />
                Restore Data Preview
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-theme-bg rounded-xl transition-colors"
                disabled={loading}
              >
                ✕
              </button>
            </div>
            
            <div className="p-8 max-h-[70vh] overflow-y-auto">
              {(() => {
                const actualData = previewData.data && typeof previewData.data === 'object' && !Array.isArray(previewData.data) 
                  ? previewData.data 
                  : previewData;
                
                return (
                  <>
                    {validationErrors.length > 0 ? (
                      <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-2xl">
                        <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold mb-3">
                          <AlertCircle className="w-5 h-5" />
                          Data Integrity Issues Found
                        </div>
                        <ul className="space-y-2">
                          {validationErrors.map((err, i) => (
                            <li key={i} className="text-sm text-red-600 dark:text-red-300 flex items-center gap-2">
                               <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                               {err}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-4 text-xs text-red-500 font-medium">
                          Restoring this file may cause application instability or data loss.
                        </p>
                      </div>
                    ) : (
                      <div className="mb-8 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/30 rounded-2xl">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-bold">
                          <CheckCircle2 className="w-5 h-5" />
                          Data Integrity Verified
                        </div>
                      </div>
                    )}

                    <div className="space-y-8">
                      <div>
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Backup Information</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-theme-bg/50 rounded-2xl border border-theme-border">
                            <p className="text-[10px] font-bold text-gray-500 uppercase">Version</p>
                            <p className="text-sm font-bold dark:text-white">{previewData.version || 'N/A (Raw Data)'}</p>
                          </div>
                          <div className="p-4 bg-theme-bg/50 rounded-2xl border border-theme-border">
                            <p className="text-[10px] font-bold text-gray-500 uppercase">Created At</p>
                            <p className="text-sm font-bold dark:text-white">{previewData.timestamp ? formatDate(previewData.timestamp) : 'Unknown'}</p>
                          </div>
                        </div>
                      </div>

                      <div>
                         <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Content Summary</h4>
                         <div className="grid grid-cols-3 gap-4">
                            {Object.entries(actualData).map(([key, value]: [string, any]) => {
                              if (!Array.isArray(value)) return null;
                              return (
                                <div key={key} className="p-4 bg-theme-bg rounded-2xl border border-theme-border flex flex-col items-center">
                                  <span className="text-lg font-black dark:text-white">
                                    {value.length}
                                  </span>
                                  <span className="text-[10px] font-bold text-gray-500 uppercase mt-1">{key}</span>
                                </div>
                              );
                            })}
                         </div>
                      </div>

                      <div className="p-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-2xl">
                         <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                            <div>
                               <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Warning</p>
                               <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                                 This action will completely replace your current database records with the contents of this file. This cannot be undone.
                               </p>
                            </div>
                         </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="p-6 bg-theme-bg border-t border-theme-border flex gap-4">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-4 text-sm font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 bg-theme-card border border-theme-border rounded-2xl transition-all"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRestore}
                disabled={loading || (validationErrors.length > 0 && !window.confirm('Errors were found in the backup. Are you sure you still want to import?'))}
                className="flex-[2] py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white text-sm font-bold rounded-2xl shadow-xl shadow-purple-500/20 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                Confirm & Restore Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
