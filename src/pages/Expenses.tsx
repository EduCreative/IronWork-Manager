import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  CreditCard, 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  X,
  TrendingDown,
  Edit,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Clock
} from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { formatCurrency as baseFormatCurrency, cn, OperationType, handleFirestoreError, formatDate, logActivity, safeToDate } from '../lib/utils';
import { useCurrency } from '../hooks/useCurrency';

export default function Expenses() {
  const { userRole } = useOutletContext<{ userRole: string | null }>();
  const isAdmin = userRole === 'admin';
  const { formatCurrency } = useCurrency();
  
  const [expenses, setExpenses] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [sortField, setSortField] = React.useState<string>('createdAt');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');
  
  const [formData, setFormData] = React.useState({
    category: 'Fuel',
    description: '',
    amount: 0,
    paymentMethod: 'Cash',
    date: new Date().toISOString().split('T')[0]
  });

  const [editingExpense, setEditingExpense] = React.useState<any>(null);

  const expenseCategories = [
    'Fuel', 'Electricity', 'Labor', 'Transport', 'Internet', 'Refreshment', 'Office Supplies', 'Maintenance', 'Miscellaneous/Others'
  ];

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      setExpenses(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'expenses');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchExpenses();
  }, []);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filteredExpenses = expenses.filter(e => 
    e.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedExpenses = React.useMemo(() => {
    return [...filteredExpenses].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'createdAt') {
        valA = safeToDate(a.createdAt).getTime();
        valB = safeToDate(b.createdAt).getTime();
      }

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredExpenses, sortField, sortOrder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (editingExpense) {
        await updateDoc(doc(db, 'expenses', editingExpense.id), {
          category: formData.category,
          description: formData.description,
          amount: formData.amount,
          paymentMethod: formData.paymentMethod,
          createdAt: new Date(formData.date)
        });
        await logActivity('EXPENSE_UPDATE', `Updated ${formData.category} expense: ${formData.amount}`, {
          expenseId: editingExpense.id
        });
      } else {
        await addDoc(collection(db, 'expenses'), {
          ...formData,
          createdAt: new Date(formData.date)
        });
        await logActivity('EXPENSE_CREATE', `Logged ${formData.category} expense: ${formData.amount}`, {
          category: formData.category,
          amount: formData.amount
        });
      }
      setIsModalOpen(false);
      setEditingExpense(null);
      setFormData({ category: 'Fuel', description: '', amount: 0, paymentMethod: 'Cash', date: new Date().toISOString().split('T')[0] });
      fetchExpenses();
    } catch (error) {
      handleFirestoreError(error, editingExpense ? OperationType.UPDATE : OperationType.CREATE, 'expenses');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (expense: any) => {
    setEditingExpense(expense);
    setFormData({
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      paymentMethod: expense.paymentMethod,
      date: safeToDate(expense.createdAt).toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const expenseToDelete = expenses.find(e => e.id === id);
    if (window.confirm('Delete this expense entry?')) {
      try {
        await deleteDoc(doc(db, 'expenses', id));
        if (expenseToDelete) {
          await logActivity('EXPENSE_DELETE', `Deleted ${expenseToDelete.category} expense of ${expenseToDelete.amount}`, {
            categoryId: id
          });
        }
        fetchExpenses();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'expenses');
      }
    }
  };

  const totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Expense Tracking</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Monitor operational overhead and miscellaneous spending.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search expenses..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-theme-card border-theme-border text-xs py-2 px-4 rounded-xl focus:ring-2 focus:ring-blue-500 w-64"
            />
          </div>
          <button 
            onClick={() => {
              setEditingExpense(null);
              setFormData({ category: 'Fuel', description: '', amount: 0, paymentMethod: 'Cash', date: new Date().toISOString().split('T')[0] });
              setIsModalOpen(true);
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-red-500/10 active:scale-95 transition-all"
            title="Log a new business expense"
          >
            <Plus className="w-4 h-4" />
            Log Expense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-theme-card p-6 rounded-3xl border border-theme-border flex items-center gap-6 shadow-sm">
          <div className="h-16 w-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
             <TrendingDown className="w-8 h-8" />
          </div>
          <div>
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Expenses</p>
             <p className="text-3xl font-black text-red-600 dark:text-red-500 leading-tight">{formatCurrency(totalExpenses)}</p>
             <p className="text-[10px] font-bold text-gray-400">Sum of {expenses.length} records</p>
          </div>
        </div>
        
        <div className="md:col-span-2 bg-theme-card p-4 rounded-3xl border border-theme-border flex items-center gap-4 shadow-sm overflow-x-auto no-scrollbar">
           {expenseCategories.slice(0, 5).map(cat => (
             <div key={cat} className="flex-shrink-0 px-4 py-3 bg-theme-bg/50 rounded-2xl border border-theme-border">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{cat}</p>
                <p className="text-sm font-black dark:text-white">
                  {formatCurrency(expenses.filter(e => e.category === cat).reduce((a, b) => a + b.amount, 0))}
                </p>
             </div>
           ))}
        </div>
      </div>

      <div className="bg-theme-card rounded-3xl border border-theme-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-theme-bg/50 border-b border-theme-border">
                {[
                  { label: 'Date', field: 'createdAt' },
                  { label: 'Category', field: 'category' },
                  { label: 'Description', field: 'description' },
                  { label: 'Amount', field: 'amount' },
                  { label: 'Method', field: 'paymentMethod' }
                ].map(col => (
                  <th 
                    key={col.field}
                    onClick={() => handleSort(col.field)}
                    className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer group hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      <span className="transition-opacity">
                        {sortField === col.field ? (
                          sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-500" /> : <ChevronDown className="w-3 h-3 text-blue-500" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                        )}
                      </span>
                    </div>
                  </th>
                ))}
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border">
              {sortedExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-theme-bg/40 transition-colors group">
                  <td className="px-6 py-4 text-sm font-black dark:text-white opacity-60">
                     {formatDate(safeToDate(expense.createdAt))}
                  </td>
                  <td className="px-6 py-4">
                     <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                       {expense.category}
                     </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-600 dark:text-gray-300 max-w-xs truncate">{expense.description}</td>
                  <td className="px-6 py-4 text-sm font-black text-red-600 dark:text-red-500">{formatCurrency(expense.amount)}</td>
                  <td className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">{expense.paymentMethod}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isAdmin && (
                        <button 
                          onClick={() => handleEdit(expense)} 
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors"
                          title="Edit expense entry"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => handleDelete(expense.id)} 
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                        title="Delete expense entry"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedExpenses.length === 0 && (
                <tr>
                   <td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-bold italic uppercase tracking-widest">No expense records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-theme-card w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl border border-theme-border animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-theme-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-3 rounded-2xl",
                  editingExpense ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600" : "bg-red-100 dark:bg-red-900/30 text-red-600"
                )}>
                  {editingExpense ? <Edit className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                </div>
                <div>
                   <h3 className="text-lg font-black dark:text-white leading-none">
                     {editingExpense ? 'Modify Expense' : 'Record Expense'}
                   </h3>
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Operation Details</span>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-theme-bg rounded-xl transition-colors text-gray-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Category</label>
                    <select 
                      className="w-full bg-theme-bg border border-theme-border text-theme-text font-black rounded-xl p-3 focus:ring-2 focus:ring-red-500"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Date</label>
                    <input 
                      type="date" 
                      className="w-full bg-theme-bg border border-theme-border text-theme-text font-black rounded-xl p-3 focus:ring-2 focus:ring-red-500"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                 </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Details / Description</label>
                <textarea 
                  required
                  rows={2}
                  placeholder="e.g. Weekly fuel for transport truck"
                  className="w-full bg-theme-bg border border-theme-border text-theme-text font-medium rounded-2xl p-4 focus:ring-2 focus:ring-red-500"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Amount</label>
                  <input 
                    type="number" 
                    required 
                    className="w-full bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 font-black text-red-600 dark:text-red-500 rounded-xl p-3 text-lg"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Payment Method</label>
                  <select 
                    className="w-full bg-theme-bg border border-theme-border text-theme-text font-black rounded-xl p-3 focus:ring-2 focus:ring-red-500"
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>
              
              <button 
                type="submit" 
                disabled={submitting}
                className={cn(
                  "w-full py-5 rounded-[2rem] font-black uppercase tracking-widest shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-2",
                  editingExpense 
                    ? "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 text-white" 
                    : "bg-red-600 hover:bg-red-700 shadow-red-500/20 text-white"
                )}
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  editingExpense ? 'Update Entry' : 'Post Expense'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
