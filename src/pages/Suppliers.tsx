import React from 'react';
import { 
  Mail,
  Copy,
  Check,
  MessageSquare,
  Truck, 
  Plus, 
  Search, 
  Phone, 
  MapPin, 
  DollarSign, 
  Clock,
  Edit,
  Trash2,
  X,
  History,
  Eye,
  Printer,
  Receipt,
  Download,
  Package,
  Calendar,
  Banknote
} from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp,
  where
} from 'firebase/firestore';
import { formatCurrency as baseFormatCurrency, cn, OperationType, handleFirestoreError, formatDate, safeToDate } from '../lib/utils';
import { useCurrency } from '../hooks/useCurrency';
import { useConfig } from '../context/ConfigContext';
import { useLocation } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Suppliers() {
  const { formatCurrency } = useCurrency();
  const { companyName, companyAddress, companyPhone, companyEmail } = useConfig();
  const location = useLocation();
  const [suppliers, setSuppliers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingSupplier, setEditingSupplier] = React.useState<any>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Ledger State
  const [ledgerSupplier, setLedgerSupplier] = React.useState<any>(null);
  const [ledgerTransactions, setLedgerTransactions] = React.useState<any[]>([]);
  const [loadingLedger, setLoadingLedger] = React.useState(false);
  const [viewingTransaction, setViewingTransaction] = React.useState<any>(null);

  const [formData, setFormData] = React.useState({
    name: '',
    phone: '',
    email: '',
    whatsapp: '',
    address: '',
    balance: 0
  });

  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'suppliers'), orderBy('name', 'asc'));
      const querySnapshot = await getDocs(q);
      setSuppliers(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'suppliers');
    } finally {
      setLoading(false);
    }
  };

  const generateLedgerPDF = (supplier: any, transactions: any[]) => {
    const doc = new jsPDF() as any;
    const pageWidth = doc.internal.pageSize.width;

    // Company Header
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.text(companyName.toUpperCase(), pageWidth / 2, 18, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    
    let headerY = 24;
    if (companyAddress) {
      doc.text(companyAddress, pageWidth / 2, headerY, { align: 'center' });
      headerY += 5;
    }
    
    const contactInfo = [
      companyPhone ? `Phone: ${companyPhone}` : null,
      companyEmail ? `Email: ${companyEmail}` : null
    ].filter(Boolean).join('  |  ');
    
    if (contactInfo) {
      doc.text(contactInfo, pageWidth / 2, headerY, { align: 'center' });
      headerY += 5;
    }

    doc.setFontSize(10);
    doc.text('SUPPLIER ACCOUNT STATEMENT', pageWidth / 2, headerY + 3, { align: 'center' });
    
    doc.setDrawColor(200, 200, 200);
    doc.line(20, headerY + 10, pageWidth - 20, headerY + 10);
    
    const infoStartY = headerY + 20;

    // Supplier Details
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text('SUPPLIER INFORMATION:', 20, headerY + 25);
    doc.setFont(undefined, 'bold');
    doc.text(supplier.name, 20, headerY + 30);
    doc.setFont(undefined, 'normal');
    doc.text(`Phone: ${supplier.phone}`, 20, headerY + 35);
    doc.text(`Address: ${supplier.address || 'N/A'}`, 20, headerY + 40);

    doc.text(`Statement Date: ${formatDate(new Date())}`, pageWidth - 20, headerY + 30, { align: 'right' });

    // Summary Box
    const totalPurchases = transactions.reduce((a, b) => a + b.total, 0);
    const totalSettled = transactions.reduce((a, b) => a + (b.paidAmount || 0), 0);
    const initialLiability = supplier.balance - (totalPurchases - totalSettled);

    autoTable(doc, {
      startY: headerY + 50,
      head: [['Opening Liability', 'Total Purchases', 'Total Settled', 'Current Balance']],
      body: [[
        formatCurrency(initialLiability),
        formatCurrency(totalPurchases),
        formatCurrency(totalSettled),
        formatCurrency(supplier.balance)
      ]],
      theme: 'grid',
      headStyles: { fillColor: [71, 85, 105] },
      styles: { halign: 'center', fontSize: 10, fontStyle: 'bold' }
    });

    // Transaction Table
    const tableData = transactions.map(tx => [
      formatDate(safeToDate(tx.createdAt)),
      `PUR-${tx.id.slice(0, 8).toUpperCase()}`,
      formatCurrency(tx.total),
      formatCurrency(tx.paidAmount),
      formatCurrency(tx.balance)
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['Date', 'Voucher Ref', 'Purchase Amount', 'Amount Paid', 'Balance Due']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [51, 65, 85] }
    });

    doc.save(`${supplier.name}_Statement_${new Date().getTime()}.pdf`);
  };

  const fetchLedger = async (supplier: any) => {
    setLedgerSupplier(supplier);
    setLoadingLedger(true);
    try {
      const q = query(
        collection(db, 'purchases'), 
        where('supplierId', '==', supplier.id),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setLedgerTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'ledger');
    } finally {
      setLoadingLedger(false);
    }
  };

  const generatePDF = (purchase: any) => {
    const doc = new jsPDF() as any;
    
    // Add Company Info
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.text(companyName.toUpperCase(), 105, 18, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    
    let purHeaderY = 24;
    if (companyAddress) {
      doc.text(companyAddress, 105, purHeaderY, { align: 'center' });
      purHeaderY += 5;
    }
    
    const purContactInfo = [
      companyPhone ? `Phone: ${companyPhone}` : null,
      companyEmail ? `Email: ${companyEmail}` : null
    ].filter(Boolean).join('  |  ');
    
    if (purContactInfo) {
      doc.text(purContactInfo, 105, purHeaderY, { align: 'center' });
    }
    
    doc.setTextColor(0); // Reset to black
    
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 40, 190, 40);

    // Purchase Header
    doc.setFontSize(12);
    doc.text(`STOCK PURCHASE VOUCHER`, 20, 50);
    doc.text(`Date: ${formatDate(safeToDate(purchase.createdAt))}`, 190, 50, { align: 'right' });

    // Supplier Info
    doc.setFontSize(10);
    doc.text('SUPPLIER:', 20, 65);
    doc.setFont(undefined, 'bold');
    doc.text(purchase.supplierName, 20, 70);
    doc.setFont(undefined, 'normal');

    // Items Table
    const tableData = purchase.items.map((item: any) => [
      item.name,
      `${item.quantity} ${item.unitType}`,
      formatCurrency(item.cost),
      formatCurrency(item.cost * item.quantity)
    ]);

    autoTable(doc, {
      startY: 80,
      head: [['Product Description', 'Quantity', 'Unit Cost', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [71, 85, 105] } // Slate-600
    });

    // Summary
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont(undefined, 'bold');
    doc.text(`Total Purchase Amount: ${formatCurrency(purchase.total)}`, 190, finalY, { align: 'right' });
    doc.setFont(undefined, 'normal');
    doc.text(`Paid Amount: ${formatCurrency(purchase.paidAmount)}`, 190, finalY + 7, { align: 'right' });
    doc.text(`Outstanding Balance: ${formatCurrency(purchase.balance)}`, 190, finalY + 12, { align: 'right' });

    // Footer
    doc.setFontSize(8);
    doc.text('This is a computer generated purchase voucher for inventory tracking.', 20, 280);
    doc.text('Store Keeper Signature: _______________________', 190, 280, { align: 'right' });

    doc.save(`PUR-${purchase.id.slice(0, 8)}.pdf`);
  };

  React.useEffect(() => {
    fetchSuppliers();
  }, []);

  React.useEffect(() => {
    if (location.state?.openLedgerId && suppliers.length > 0) {
      const supplier = suppliers.find(s => s.id === location.state.openLedgerId);
      if (supplier) {
        fetchLedger(supplier);
      }
    }
  }, [location.state, suppliers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (editingSupplier) {
        await updateDoc(doc(db, 'suppliers', editingSupplier.id), {
          ...formData,
          createdAt: editingSupplier.createdAt || serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'suppliers'), {
          ...formData,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      setEditingSupplier(null);
      setFormData({ name: '', phone: '', email: '', whatsapp: '', address: '', balance: 0 });
      fetchSuppliers();
    } catch (error) {
      handleFirestoreError(error, editingSupplier ? OperationType.UPDATE : OperationType.CREATE, 'suppliers');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (supplier: any) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      phone: supplier.phone,
      email: supplier.email || '',
      whatsapp: supplier.whatsapp || '',
      address: supplier.address || '',
      balance: supplier.balance
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this supplier?')) {
      try {
        await deleteDoc(doc(db, 'suppliers', id));
        fetchSuppliers();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'suppliers');
      }
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Supplier Network</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your raw material vendors and accounts.</p>
        </div>
        <button 
          onClick={() => { setEditingSupplier(null); setFormData({ name: '', phone: '', address: '', balance: 0 }); setIsModalOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-500/10"
        >
          <Plus className="w-4 h-4" />
          Add Supplier
        </button>
      </div>

      <div className="bg-theme-card rounded-[2rem] border border-theme-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-theme-border flex items-center justify-between bg-white dark:bg-gray-950">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search suppliers..."
              className="w-full pl-10 pr-4 py-2 bg-theme-bg border border-theme-border rounded-xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/10 border-b border-theme-border">
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Vendor Profile</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Contact Info</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Outstanding</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border">
              {filteredSuppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/10 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-lg cursor-pointer hover:scale-105 transition-transform shadow-inner"
                        onClick={() => fetchLedger(supplier)}
                      >
                        {supplier.name[0].toUpperCase()}
                      </div>
                      <div>
                        <button 
                          onClick={() => fetchLedger(supplier)}
                          className="text-base font-black dark:text-white block hover:text-blue-600 transition-colors truncate max-w-[200px]"
                        >
                          {supplier.name}
                        </button>
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(supplier.address || "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-gray-400 font-bold flex items-center gap-1 uppercase tracking-tight truncate max-w-[200px] hover:text-blue-600 transition-colors"
                        >
                          <MapPin className="w-3 h-3 text-blue-500" /> {supplier.address}
                        </a>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between group/contact max-w-[200px]">
                        <div className="flex items-center gap-2 text-sm font-bold dark:text-gray-300">
                           <Phone className="w-3.5 h-3.5 text-gray-400" />
                           <a href={`tel:${supplier.phone}`} className="hover:text-blue-600 transition-colors uppercase tabular-nums">{supplier.phone}</a>
                        </div>
                        <div className="flex items-center gap-1.5 opacity-0 group-hover/contact:opacity-100 transition-opacity">
                          <a 
                            href={`https://wa.me/${supplier.whatsapp || supplier.phone.replace(/[^0-9]/g, '')}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-1 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-md hover:bg-green-600 hover:text-white transition-all shadow-sm"
                          >
                            <MessageSquare className="w-3 h-3" />
                          </a>
                          <button 
                            onClick={() => copyToClipboard(supplier.phone, `${supplier.id}-phone`)}
                            className="p-1 bg-gray-50 dark:bg-gray-800 text-gray-400 rounded-md hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                          >
                            {copiedId === `${supplier.id}-phone` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>

                      {supplier.email && (
                        <div className="flex items-center justify-between group/contact max-w-[200px]">
                           <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                             <Mail className="w-3.5 h-3.5 text-gray-400" />
                             <a href={`mailto:${supplier.email}`} className="hover:text-blue-600 transition-all truncate lowercase">{supplier.email}</a>
                           </div>
                           <div className="opacity-0 group-hover/contact:opacity-100 transition-opacity whitespace-nowrap ml-2">
                              <button 
                                onClick={() => copyToClipboard(supplier.email, `${supplier.id}-email`)}
                                className="p-1 bg-gray-50 dark:bg-gray-800 text-gray-400 rounded-md hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                              >
                                {copiedId === `${supplier.id}-email` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              </button>
                           </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                     <span className={cn("font-black text-xl tracking-tighter", supplier.balance > 0 ? "text-red-500" : "text-green-500")}>
                        {formatCurrency(supplier.balance)}
                     </span>
                     <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Payable</p>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => fetchLedger(supplier)}
                        className="p-3 bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-2xl transition-all shadow-sm"
                        title="View Purchase History & Ledger"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleEdit(supplier)} 
                        className="p-3 bg-gray-50 dark:bg-gray-800 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white rounded-2xl transition-all shadow-sm"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(supplier.id)} 
                        className="p-3 bg-gray-50 dark:bg-gray-800 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white rounded-2xl transition-all shadow-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSuppliers.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center text-gray-400 italic font-medium uppercase tracking-widest">No suppliers found in network.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supplier Ledger Modal */}
      {ledgerSupplier && (
        <div className="fixed inset-0 z-[70] flex items-center justify-end bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-950 w-full max-w-4xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-8 border-b border-theme-border flex items-center justify-between bg-white dark:bg-gray-900 sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-600 text-white flex items-center justify-center shadow-lg shadow-slate-600/20">
                  <Truck className="w-8 h-8" />
                </div>
                <div>
                   <h2 className="text-2xl font-black dark:text-white uppercase tracking-tight">{ledgerSupplier.name}'s Account</h2>
                   <div className="flex flex-wrap items-center gap-4 mt-2">
                      <a href={`tel:${ledgerSupplier.phone}`} className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 hover:text-blue-600 transition-colors">
                        <Phone className="w-3.5 h-3.5 text-blue-500" /> {ledgerSupplier.phone}
                      </a>
                      {ledgerSupplier.email && (
                        <a href={`mailto:${ledgerSupplier.email}`} className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 hover:text-blue-600 transition-colors">
                          <Mail className="w-3.5 h-3.5 text-blue-500" /> {ledgerSupplier.email}
                        </a>
                      )}
                      <a 
                         href={`https://wa.me/${ledgerSupplier.whatsapp || ledgerSupplier.phone.replace(/[^0-9]/g, '')}`} 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="text-[10px] font-black text-green-500 uppercase tracking-widest flex items-center gap-1 hover:underline"
                       >
                         <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                       </a>
                      <div className="h-4 w-px bg-gray-200 dark:bg-gray-800" />
                      <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">
                        Payable: {formatCurrency(ledgerSupplier.balance)}
                      </span>
                   </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 <button 
                   onClick={() => generateLedgerPDF(ledgerSupplier, ledgerTransactions)}
                   className="p-3 bg-slate-50 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400 rounded-2xl hover:bg-slate-600 hover:text-white transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest"
                 >
                    <Download className="w-4 h-4" />
                    Export Statement
                 </button>
                 <button 
                   onClick={() => setLedgerSupplier(null)}
                   className="p-3 hover:bg-theme-bg rounded-[1.5rem] transition-colors text-gray-400"
                 >
                    <X className="w-10 h-10" />
                 </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {loadingLedger ? (
                <div className="flex items-center justify-center py-20">
                   <div className="w-12 h-12 border-4 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-8">
                        <div className="space-y-1">
                           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Opening Liability</p>
                           <p className="text-xl font-black dark:text-white">
                             {formatCurrency(ledgerSupplier.balance - (ledgerTransactions.reduce((a, b) => a + b.total, 0) - ledgerTransactions.reduce((a, b) => a + (b.paidAmount || 0), 0)))}
                           </p>
                        </div>
                        <div className="space-y-1">
                           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Purchases</p>
                           <p className="text-xl font-black dark:text-white">{formatCurrency(ledgerTransactions.reduce((a, b) => a + b.total, 0))}</p>
                        </div>
                        <div className="space-y-1">
                           <p className="text-[10px] font-black text-green-500 uppercase tracking-widest">Total Settled</p>
                           <p className="text-xl font-black text-green-600">{formatCurrency(ledgerTransactions.reduce((a, b) => a + (b.paidAmount || 0), 0))}</p>
                        </div>
                        <div className="space-y-1">
                           <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Current Liability</p>
                           <p className="text-2xl font-black text-red-600 tracking-tighter">{formatCurrency(ledgerSupplier.balance)}</p>
                        </div>
                  </div>
                  <p className="text-[10px] text-gray-400 italic px-4">
                    * Current Liability = Opening Liability + Total Purchases - Total Settled
                  </p>

                  <div className="rounded-[2rem] border border-theme-border overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800/20">
                          <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                          <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Voucher Ref</th>
                          <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Amount</th>
                          <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Settled</th>
                          <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Due</th>
                          <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Ops</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-theme-border">
                        {ledgerTransactions.map((tx) => (
                           <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/10 transition-colors group">
                              <td className="px-8 py-5 text-xs font-black text-gray-400">
                                 {formatDate(safeToDate(tx.createdAt))}
                              </td>
                              <td className="px-8 py-5">
                                 <button 
                                   onClick={() => setViewingTransaction(tx)}
                                   className="text-sm font-black text-slate-600 hover:text-blue-600 dark:text-slate-400 transition-colors uppercase tracking-widest"
                                 >
                                    PUR-{tx.id.slice(0, 8).toUpperCase()}
                                 </button>
                              </td>
                              <td className="px-8 py-5 text-sm font-black dark:text-white text-right">
                                 {formatCurrency(tx.total)}
                              </td>
                              <td className="px-8 py-5 text-sm font-black text-green-600 text-right">
                                 {formatCurrency(tx.paidAmount)}
                              </td>
                              <td className="px-8 py-5 text-sm font-black text-red-600 text-right">
                                 {formatCurrency(tx.balance)}
                              </td>
                              <td className="px-8 py-5 text-right">
                                 <button 
                                   onClick={() => setViewingTransaction(tx)}
                                   className="p-3 bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-slate-600 rounded-xl transition-all"
                                 >
                                    <Eye className="w-4 h-4" />
                                 </button>
                              </td>
                           </tr>
                        ))}
                        {ledgerTransactions.length === 0 && (
                          <tr>
                             <td colSpan={6} className="px-8 py-20 text-center text-gray-400 italic font-bold uppercase tracking-widest">No procurement records found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-8 border-t border-theme-border bg-gray-50 dark:bg-gray-900 flex justify-end">
               <button 
                 onClick={() => setLedgerSupplier(null)}
                 className="px-8 py-4 bg-white dark:bg-gray-800 border border-theme-border text-xs font-black uppercase tracking-widest rounded-2xl active:scale-95 transition-all shadow-sm"
               >
                 Close Account View
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Detail Viewer Modal */}
      {viewingTransaction && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-950 w-full max-w-2xl rounded-[3rem] overflow-hidden shadow-2xl border border-theme-border animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-theme-border flex items-center justify-between bg-slate-50 dark:bg-gray-900">
              <div className="flex items-center gap-4">
                 <div className="w-14 h-14 rounded-2xl bg-slate-600 flex items-center justify-center text-white shadow-xl shadow-slate-600/30">
                    <Receipt className="w-6 h-6" />
                 </div>
                 <div>
                    <h3 className="text-xl font-black dark:text-white leading-tight uppercase tracking-tight">PUR-{viewingTransaction.id.slice(0, 8).toUpperCase()}</h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Procurement Voucher</p>
                 </div>
              </div>
              <div className="flex items-center gap-2">
                 <button 
                   onClick={() => generatePDF(viewingTransaction)}
                   className="p-4 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-2xl hover:bg-slate-600 hover:text-white transition-all shadow-sm"
                   title="Export Procurement Voucher"
                 >
                    <Printer className="w-5 h-5" />
                 </button>
                 <button 
                   onClick={() => setViewingTransaction(null)}
                   className="p-4 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 rounded-2xl transition-colors"
                 >
                   <X className="w-8 h-8" />
                 </button>
              </div>
            </div>

            <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
               <div className="grid grid-cols-2 gap-8 mb-10">
                  <div className="space-y-1.5 p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl">
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Purchase Date</span>
                     <p className="text-sm font-black dark:text-white tracking-widest uppercase">{formatDate(safeToDate(viewingTransaction.createdAt))}</p>
                  </div>
                  <div className="space-y-1.5 p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl text-right">
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Payment Status</span>
                     <span className={cn(
                       "inline-block px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm",
                       viewingTransaction.status === 'paid' ? "bg-green-100 text-green-700" :
                       viewingTransaction.status === 'partial' ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                     )}>
                        {viewingTransaction.status}
                     </span>
                  </div>
               </div>

               <div className="rounded-[2rem] border border-theme-border overflow-hidden mb-8 shadow-sm">
                  <table className="w-full text-left text-sm">
                     <thead className="bg-gray-50 dark:bg-gray-900 border-b border-theme-border">
                        <tr>
                           <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Material</th>
                           <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Quant</th>
                           <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Unit cost</th>
                           <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Subtotal</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-theme-border">
                        {viewingTransaction.items.map((item: any, i: number) => (
                           <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/10">
                              <td className="px-6 py-4 font-black dark:text-white text-xs uppercase">{item.name}</td>
                              <td className="px-6 py-4 text-center font-bold dark:text-white opacity-40 text-[10px]">{item.quantity} {item.unitType}</td>
                              <td className="px-6 py-4 text-right dark:text-white tabular-nums font-medium">{formatCurrency(item.cost)}</td>
                              <td className="px-6 py-4 text-right font-black text-slate-600 dark:text-slate-400 tabular-nums">{formatCurrency(item.cost * item.quantity)}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>

               <div className="space-y-4 pt-6">
                  <div className="flex justify-between items-center px-4">
                     <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Gross Total</span>
                     <span className="text-2xl font-black text-slate-600 dark:text-slate-400 tracking-tighter">{formatCurrency(viewingTransaction.total)}</span>
                  </div>
                  <div className="p-8 bg-slate-50 dark:bg-slate-900/40 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-10 mt-6 shadow-inner">
                     <div className="space-y-1">
                        <span className="text-[10px] font-black text-green-500 uppercase tracking-widest block">Amount Disbursed</span>
                        <p className="text-2xl font-black text-green-600 tabular-nums tracking-tighter">{formatCurrency(viewingTransaction.paidAmount)}</p>
                     </div>
                     <div className="text-right space-y-1 border-l border-slate-200 dark:border-slate-800 pl-10">
                        <span className="text-[10px] font-black text-red-400 uppercase tracking-widest block">Vendor Balance</span>
                        <p className="text-2xl font-black text-red-600 tabular-nums tracking-tighter">{formatCurrency(viewingTransaction.balance)}</p>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-theme-border animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-theme-border flex items-center justify-between">
              <h3 className="text-xl font-black dark:text-white uppercase tracking-tight">
                {editingSupplier ? 'Update Vendor' : 'New Vendor Profile'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X className="w-8 h-8" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Vendor Enterprise Name</label>
                <input 
                  type="text" 
                  required 
                  className="w-full bg-theme-bg border border-theme-border p-4 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Contact Phone</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="+92 300 0000000"
                    className="w-full bg-theme-bg border border-theme-border p-4 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">WhatsApp (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="Same as phone if blank"
                    className="w-full bg-theme-bg border border-theme-border p-4 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Official Email</label>
                <input 
                  type="email" 
                  placeholder="vendor@company.com"
                  className="w-full bg-theme-bg border border-theme-border p-4 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Enterprise Address</label>
                <textarea 
                  rows={3}
                  className="w-full bg-theme-bg border border-theme-border p-4 rounded-2xl font-medium focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                ></textarea>
              </div>
              <div className="space-y-1">
                  <label className="text-[10px] font-black text-red-400 uppercase tracking-widest ml-1">Pre-existing Debt (Liability)</label>
                <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="number" 
                      className="w-full bg-theme-bg border border-theme-border pl-12 pr-4 py-4 rounded-2xl font-black text-red-500 focus:ring-2 focus:ring-red-500 outline-none"
                      value={formData.balance}
                      onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
                    />
                </div>
              </div>
              
              <div className="pt-6 flex gap-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-theme-bg text-gray-500 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-theme-border hover:bg-gray-100 transition-colors"
                >
                  Discard
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-[2] bg-blue-600 disabled:bg-blue-400 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
                >
                  {submitting ? 'Committing...' : (editingSupplier ? 'Commit Changes' : 'Initialize Profile')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
