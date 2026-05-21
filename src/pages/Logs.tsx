import React from 'react';
import { 
  ClipboardList, 
  Search, 
  Filter, 
  Calendar,
  User,
  Clock,
  Info,
  ArrowLeft
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  limit,
  where
} from 'firebase/firestore';
import { cn, formatDate, OperationType, handleFirestoreError, safeToDate } from '../lib/utils';

export default function Logs() {
  const [logs, setLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [actionFilter, setActionFilter] = React.useState('All');

  const actionTypes = [
    'All',
    'USER_LOGIN',
    'USER_REGISTER',
    'ROLE_CHANGE',
    'INVOICE_CREATE',
    'INVENTORY_CREATE',
    'INVENTORY_UPDATE',
    'INVENTORY_DELETE',
    'PURCHASE_CREATE',
    'EXPENSE_CREATE'
  ];

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'activityLogs'), 
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      const querySnapshot = await getDocs(q);
      setLogs(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'activityLogs');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         log.details.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = actionFilter === 'All' || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const getActionColor = (action: string) => {
    if (action.includes('CREATE')) return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-500';
    if (action.includes('DELETE')) return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-500';
    if (action.includes('UPDATE') || action.includes('CHANGE')) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-500';
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-500';
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <NavLink 
            to="/users"
            className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-blue-500 rounded-lg transition-colors border border-gray-200 dark:border-gray-700 shadow-sm"
            title="Back to Users"
          >
            <ArrowLeft className="w-5 h-5" />
          </NavLink>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Activity Logs</h1>
            <p className="text-gray-500 dark:text-gray-400">Audit trail of key system actions and user operations.</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by user or details..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
             <Filter className="w-4 h-4 text-gray-400" />
             <select 
               className="bg-gray-50 dark:bg-gray-800 border-none rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-blue-500 dark:text-white"
               value={actionFilter}
               onChange={(e) => setActionFilter(e.target.value)}
             >
               {actionTypes.map(t => <option key={t} value={t}>{t === 'All' ? 'All Actions' : t.replace('_', ' ')}</option>)}
             </select>
             <button 
               onClick={fetchLogs}
               className="p-2 text-gray-500 hover:text-blue-500 transition-colors"
               title="Refresh logs from database"
             >
               <Clock className="w-5 h-5" />
             </button>
          </div>
        </div>

        <div className="overflow-x-auto">
           <table className="w-full text-left">
              <thead>
                 <tr className="bg-gray-50 dark:bg-gray-800/50 text-xs font-bold text-gray-400 uppercase">
                    <th className="px-6 py-4">Timestamp</th>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Action</th>
                    <th className="px-6 py-4">Details</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                 {filteredLogs.map((log) => (
                   <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm dark:text-white font-medium">
                            {formatDate(safeToDate(log.createdAt))}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {safeToDate(log.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-400">
                               {log.userEmail[0].toUpperCase()}
                            </div>
                            <span className="text-sm dark:text-gray-300">{log.userEmail}</span>
                         </div>
                      </td>
                      <td className="px-6 py-4">
                         <span className={cn("px-2 py-1 rounded text-[10px] font-bold", getActionColor(log.action))}>
                            {log.action.replace('_', ' ')}
                         </span>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex items-start gap-2">
                           <Info className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                           <span className="text-sm text-gray-600 dark:text-gray-400">{log.details}</span>
                         </div>
                      </td>
                   </tr>
                 ))}
                 {filteredLogs.length === 0 && !loading && (
                   <tr>
                      <td colSpan={4} className="px-6 py-20 text-center text-gray-500 italic">
                         No logs found for the selected criteria.
                      </td>
                   </tr>
                 )}
              </tbody>
           </table>
        </div>
      </div>
    </div>
  );
}
