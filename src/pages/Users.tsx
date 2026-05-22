import React from 'react';
import { 
  Users as UsersIcon, 
  Shield, 
  ShieldCheck, 
  UserCircle, 
  Warehouse,
  MoreVertical,
  Mail,
  Calendar,
  Check,
  ClipboardList
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { db } from '../lib/firebase';
import { 
  collection, 
  getDocs, 
  updateDoc, 
  doc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { cn, formatDate, OperationType, handleFirestoreError, logActivity } from '../lib/utils';

export default function Users() {
  const [users, setUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  const roles = [
    { value: 'admin', label: 'Admin', icon: ShieldCheck, desc: 'Full System Access' },
    { value: 'manager', label: 'Manager', icon: Shield, desc: 'Sales, Purchases & Reports' },
    { value: 'staff', label: 'Sales Staff', icon: UserCircle, desc: 'Invoices & Customers' },
    { value: 'storekeeper', label: 'Store Keeper', icon: Warehouse, desc: 'Stock & Inventory' },
  ];

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      setUsers(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingId(userId);
    const userToUpdate = users.find(u => u.id === userId);
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole
      });
      await logActivity('ROLE_CHANGE', `Changed ${userToUpdate?.email} role to ${newRole}`);
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading && users.length === 0) return <div className="flex items-center justify-center p-20 text-gray-500">Loading user database...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage staff roles and system access permissions.</p>
        </div>
        <NavLink 
          to="/logs"
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium border border-gray-200 dark:border-gray-700 shadow-sm"
          title="See detailed history of system activities"
        >
          <ClipboardList className="w-4 h-4" />
          View Activity Logs
        </NavLink>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {users.map((user) => (
          <div key={user.id} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <UserCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                  {user.email}
                  {user.role === 'admin' && <ShieldCheck className="w-4 h-4 text-blue-500" />}
                </h3>
                <div className="flex flex-wrap gap-4 mt-1">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Mail className="w-3.5 h-3.5" />
                    {user.email}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Calendar className="w-3.5 h-3.5" />
                    Joined {formatDate(user.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Current Role</p>
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase">{user.role}</p>
              </div>

              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                {roles.map((role) => (
                  <button
                    key={role.value}
                    onClick={() => handleRoleChange(user.id, role.value)}
                    disabled={updatingId === user.id}
                    className={cn(
                      "flex flex-col items-center justify-center px-4 py-2 rounded-xl border transition-all text-[10px] font-bold uppercase",
                      user.role === role.value
                        ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20"
                        : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-blue-300 dark:hover:border-blue-700"
                    )}
                    title={role.desc}
                  >
                    <role.icon className={cn("w-4 h-4 mb-1", user.role === role.value ? "text-white" : "text-gray-400")} />
                    {role.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}

        {users.length === 0 && (
          <div className="py-20 text-center text-gray-500 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
            <UsersIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No other users found in the system.</p>
          </div>
        )}
      </div>
    </div>
  );
}
