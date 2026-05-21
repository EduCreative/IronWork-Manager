import React from 'react';
import { 
  ShoppingBag, 
  Plus, 
  ArrowLeft, 
  Trash2, 
  Truck,
  Package,
  Clock,
  Banknote,
  X,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Download,
  Printer
} from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { formatCurrency as baseFormatCurrency, cn, OperationType, handleFirestoreError, formatDate, logActivity, safeToDate } from '../lib/utils';
import { useCurrency } from '../hooks/useCurrency';
import { useConfig } from '../context/ConfigContext';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Purchases() {
  const { formatCurrency, currencySymbol } = useCurrency();
  const { companyName, companyAddress, companyPhone, companyEmail } = useConfig();
  const navigate = useNavigate();
  const [purchases, setPurchases] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isCreating, setIsCreating] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [sortField, setSortField] = React.useState<string>('createdAt');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');
  const [purchaseDate, setPurchaseDate] = React.useState(new Date().toISOString().split('T')[0]);

  // Record Payment State
  const [recordingPayment, setRecordingPayment] = React.useState<any>(null);
  const [paymentAmount, setPaymentAmount] = React.useState<number>(0);
  const [paymentMode, setPaymentMode] = React.useState<string>('Cash');
  const [isProcessingPayment, setIsProcessingPayment] = React.useState(false);

  // New Purchase State
  const [suppliers, setSuppliers] = React.useState<any[]>([]);
  const [products, setProducts] = React.useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = React.useState<any>(null);
  const [purchaseItems, setPurchaseItems] = React.useState<any[]>([]);
  const [paidAmount, setPaidAmount] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'purchases'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      setPurchases(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'purchases');
    } finally {
      setLoading(false);
    }
  };

  const fetchDataForPurchase = async () => {
    try {
      const [suppSnap, prodSnap] = await Promise.all([
        getDocs(collection(db, 'suppliers')),
        getDocs(collection(db, 'products'))
      ]);
      setSuppliers(suppSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setProducts(prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error(error);
    }
  };

  React.useEffect(() => {
    fetchPurchases();
  }, []);

  React.useEffect(() => {
    if (isCreating) {
      fetchDataForPurchase();
    }
  }, [isCreating]);

  const addProductToPurchase = (product: any) => {
    const existing = purchaseItems.find(item => item.id === product.id);
    if (existing) {
      setPurchaseItems(purchaseItems.map(item => 
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setPurchaseItems([...purchaseItems, { 
        id: product.id, 
        name: product.name, 
        cost: product.purchasePrice, 
        unitType: product.unitType,
        quantity: 1 
      }]);
    }
  };

  const totalCost = purchaseItems.reduce((acc, item) => acc + (item.cost * item.quantity), 0);
  const balance = totalCost - paidAmount;

  const savePurchase = async () => {
    if (submitting) return;
    if (!selectedSupplier) return alert('Select a supplier');
    if (purchaseItems.length === 0) return alert('Add items');

    setSubmitting(true);
    try {
      await runTransaction(db, async (tx) => {
        // --- 1. ALL READS FIRST ---
        
        // Read Products
        const prodRefs = purchaseItems.map(item => doc(db, 'products', item.id));
        const prodDocs = await Promise.all(prodRefs.map(ref => tx.get(ref)));
        
        // Read Supplier
        const suppRef = doc(db, 'suppliers', selectedSupplier.id);
        const suppDoc = await tx.get(suppRef);

        // --- 2. ALL WRITES AFTER ---
        
        // Save Purchase
        const purchaseRef = doc(collection(db, 'purchases'));
        tx.set(purchaseRef, {
          supplierId: selectedSupplier.id,
          supplierName: selectedSupplier.name,
          items: purchaseItems,
          total: totalCost,
          paidAmount,
          balance,
          status: balance <= 0 ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid'),
          createdAt: new Date(purchaseDate)
        });

        // Increase stock
        prodDocs.forEach((prodDoc, index) => {
          if (prodDoc.exists()) {
            tx.update(prodRefs[index], { currentStock: prodDoc.data().currentStock + purchaseItems[index].quantity });
          }
        });

        // Increase supplier balance due
        if (suppDoc.exists()) {
          tx.update(suppRef, { balance: (suppDoc.data().balance || 0) + balance });
        }
      });

      await logActivity('PURCHASE_CREATE', `Recorded purchase from ${selectedSupplier.name}`, {
        supplierName: selectedSupplier.name,
        total: totalCost
      });

      setIsCreating(false);
      fetchPurchases();
      alert('Purchase recorded successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'purchases');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filteredPurchases = purchases.filter(p => 
    p.supplierName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedPurchases = React.useMemo(() => {
    return [...filteredPurchases].sort((a, b) => {
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
  }, [filteredPurchases, sortField, sortOrder]);

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

    doc.save(`PUR-${purchase.id.slice(0, 8).toUpperCase()}.pdf`);
  };

  const handleProcessPayment = async () => {
    if (!recordingPayment || paymentAmount <= 0) return;
    if (paymentAmount > recordingPayment.balance) {
      alert(`Payment amount cannot exceed the pending balance (${formatCurrency(recordingPayment.balance)})`);
      return;
    }

    setIsProcessingPayment(true);
    try {
      await runTransaction(db, async (transaction) => {
        const purRef = doc(db, 'purchases', recordingPayment.id);
        const suppRef = doc(db, 'suppliers', recordingPayment.supplierId);

        const purDoc = await transaction.get(purRef);
        const suppDoc = await transaction.get(suppRef);

        if (!purDoc.exists()) throw new Error("Purchase record does not exist!");

        const currentPaid = purDoc.data().paidAmount || 0;
        const currentTotal = purDoc.data().total || 0;
        const newPaid = currentPaid + paymentAmount;
        const newBalance = currentTotal - newPaid;
        const newStatus = newBalance <= 0 ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');

        // Update Purchase
        transaction.update(purRef, {
          paidAmount: newPaid,
          balance: newBalance,
          status: newStatus,
          lastPaymentDate: serverTimestamp()
        });

        // Update Supplier Balance (Debt reduction)
        if (suppDoc.exists()) {
          const currentSuppBalance = suppDoc.data().balance || 0;
          transaction.update(suppRef, {
            balance: Math.max(0, currentSuppBalance - paymentAmount)
          });
        }
      });

      await logActivity('PAYMENT_RECORD', `Recorded payment of ${formatCurrency(paymentAmount)} for purchase from ${recordingPayment.supplierName}`, {
        purchaseId: recordingPayment.id,
        amount: paymentAmount,
        supplierName: recordingPayment.supplierName
      });

      alert('Payment recorded successfully!');
      setRecordingPayment(null);
      setPaymentAmount(0);
      fetchPurchases();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'purchases');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  if (isCreating) {
    return (
      <div className="space-y-6 pb-20">
        <div className="flex items-center justify-between">
           <button 
             onClick={() => setIsCreating(false)} 
             className="flex items-center gap-2 text-gray-500 hover:text-blue-500 transition-colors"
             title="Return to purchase history"
           >
             <ArrowLeft className="w-5 h-5" /> Back
           </button>
           <h1 className="text-2xl font-bold dark:text-white">Record New Purchase</h1>
        </div>

        {/* 1. Date and Supplier Details (Reordered for Mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="bg-theme-card rounded-2xl border border-theme-border p-6 shadow-sm">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                Purchase Entry Date
              </h3>
              <input 
                type="date" 
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full bg-theme-bg border border-theme-border text-theme-text font-bold p-3 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
           </div>

           <div className="bg-theme-card rounded-2xl border border-theme-border p-6 shadow-sm">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-500" />
                Select Supplier
              </h3>
              <select 
                className="w-full bg-theme-bg border border-theme-border text-theme-text font-bold p-3 rounded-xl focus:ring-2 focus:ring-blue-500"
                value={selectedSupplier?.id || ''}
                onChange={(e) => setSelectedSupplier(suppliers.find(s => s.id === e.target.value))}
              >
                <option value="">Choose Supplier...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {selectedSupplier && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/20 flex items-center justify-between">
                   <div>
                     <p className="text-sm font-black text-blue-600 dark:text-blue-400">{selectedSupplier.name}</p>
                     <p className="text-[10px] text-blue-400 font-bold uppercase">Balance Due to Supplier</p>
                   </div>
                   <div className="text-right">
                      <p className="font-black text-red-500">{formatCurrency(selectedSupplier.balance || 0)}</p>
                   </div>
                </div>
              )}
           </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
           <div className="xl:col-span-2 space-y-6">
              {/* 3. Material Selection */}
              <div className="bg-theme-card rounded-2xl border border-theme-border p-6 shadow-sm">
                 <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                   <Package className="w-4 h-4 text-blue-500" />
                   Select Products
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {products.map(p => (
                      <button 
                        key={p.id}
                        onClick={() => addProductToPurchase(p)}
                        className="p-3 bg-theme-bg border border-theme-border hover:border-blue-500 rounded-xl text-left transition-all active:scale-[0.98] group"
                      >
                         <div className="flex justify-between items-start mb-1">
                            <span className="font-bold dark:text-white group-hover:text-blue-600 transition-colors">{p.name}</span>
                            <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded font-black uppercase">{p.unitType}</span>
                         </div>
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] text-gray-400 font-bold italic">Stock: {p.currentStock}</span>
                            <span className="font-black text-blue-500">{formatCurrency(p.purchasePrice)}</span>
                         </div>
                      </button>
                    ))}
                 </div>
              </div>

              {/* 4. Purchase Items */}
              <div className="bg-theme-card rounded-2xl border border-theme-border shadow-sm overflow-hidden">
                 <div className="p-6 border-b border-theme-border font-black text-[10px] uppercase tracking-widest text-gray-400">
                    Purchase Items List
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                       <thead className="bg-theme-bg/50 border-b border-theme-border">
                          <tr>
                             <th className="px-6 py-4 font-black text-gray-500 uppercase text-[10px] tracking-widest">Item</th>
                             <th className="px-6 py-4 font-black text-gray-500 uppercase text-[10px] tracking-widest">Quantity</th>
                             <th className="px-6 py-4 font-black text-gray-500 uppercase text-[10px] tracking-widest text-right">Unit Cost</th>
                             <th className="px-6 py-4 font-black text-gray-500 uppercase text-[10px] tracking-widest text-right">Total</th>
                             <th className="px-3 py-4"></th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-theme-border">
                          {purchaseItems.map(item => (
                            <tr key={item.id} className="group">
                               <td className="px-6 py-4 dark:text-white font-bold">{item.name}</td>
                               <td className="px-6 py-4">
                                  <input 
                                    type="number" 
                                    className="w-20 bg-theme-bg border border-theme-border text-theme-text font-black px-2 py-1 rounded-lg text-center"
                                    value={item.quantity}
                                    onChange={(e) => setPurchaseItems(purchaseItems.map(i => i.id === item.id ? { ...i, quantity: parseInt(e.target.value) || 0 } : i))}
                                  />
                               </td>
                               <td className="px-6 py-4 text-right dark:text-white font-medium">{formatCurrency(item.cost)}</td>
                               <td className="px-6 py-4 text-right font-black text-blue-600 dark:text-blue-400">{formatCurrency(item.cost * item.quantity)}</td>
                               <td className="px-3 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={() => setPurchaseItems(purchaseItems.filter(i => i.id !== item.id))} 
                                    className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                                  >
                                     <Trash2 className="w-4 h-4" />
                                  </button>
                               </td>
                            </tr>
                          ))}
                          {purchaseItems.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-bold italic uppercase tracking-widest">Your purchase list is empty.</td>
                            </tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>

           {/* 5. Summary Section */}
           <div className="space-y-6">
              <div className="bg-theme-card rounded-3xl border border-theme-border p-8 shadow-xl shadow-blue-500/5 space-y-6">
                 <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pricing Summary</h3>
                 <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                       <span className="font-bold text-gray-400 uppercase tracking-widest">Purchase Total</span>
                       <span className="font-black dark:text-white">{formatCurrency(totalCost)}</span>
                    </div>
                    <div className="flex justify-between items-center gap-4 text-sm">
                       <span className="font-bold text-green-600 uppercase tracking-widest">Paid Now</span>
                       <div className="flex items-center gap-2">
                          <span className="text-green-600 font-bold">{currencySymbol}</span>
                          <input 
                             type="number" 
                             className="w-32 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 text-green-600 dark:text-green-500 font-black text-right p-2 rounded-lg"
                             value={paidAmount}
                             onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                          />
                       </div>
                    </div>
                    <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/20 space-y-2">
                       <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Current Balance</span>
                          <span className="font-black text-red-600">{formatCurrency(balance)}</span>
                       </div>
                       {selectedSupplier && (
                         <>
                           <div className="flex justify-between items-center border-t border-red-100 dark:border-red-900/20 pt-2">
                              <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Supplier Previous Debt</span>
                              <span className="font-black text-red-600">{formatCurrency(selectedSupplier.balance || 0)}</span>
                           </div>
                           <div className="flex justify-between items-center border-t-2 border-red-200 dark:border-red-900/40 pt-2">
                              <span className="text-xs font-black text-red-600 uppercase tracking-widest">Total Outstanding to Supplier</span>
                              <span className="text-lg font-black text-red-600">{formatCurrency(balance + (selectedSupplier.balance || 0))}</span>
                           </div>
                         </>
                       )}
                    </div>
                 </div>
                 
                 <button 
                   onClick={savePurchase}
                   disabled={submitting}
                   className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black py-5 rounded-3xl shadow-2xl shadow-blue-500/20 active:scale-95 transition-all text-xs flex items-center justify-center gap-2"
                 >
                   {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'RECORD PURCHASE'}
                 </button>
              </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Purchase History</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Track raw material intake and supplier liabilities.</p>
        </div>
        <div className="flex items-center gap-2">
           <input 
             type="text" 
             placeholder="Search supplier..." 
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             className="hidden md:block bg-theme-card border-theme-border text-xs py-2 px-4 rounded-xl"
           />
           <button 
             onClick={() => {
               setPurchaseDate(new Date().toISOString().split('T')[0]);
               setIsCreating(true);
             }}
             className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-blue-500/10 active:scale-95"
             title="Log a new stock purchase from a supplier"
           >
             <Plus className="w-4 h-4" />
             Log Purchase
           </button>
        </div>
      </div>

      <div className="bg-theme-card rounded-3xl border border-theme-border shadow-sm overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                   <tr className="bg-slate-100/50 dark:bg-slate-800/50 divide-x divide-slate-200/50 dark:divide-slate-700/50">
                      {[
                         { label: 'Purchased On', field: 'createdAt' },
                         { label: 'Vendor Entitiy', field: 'supplierName' },
                         { label: 'Volume', field: 'itemsCount' },
                         { label: 'Gross Value', field: 'total' },
                         { label: 'Total Paid', field: 'paidAmount' },
                         { label: 'Net Liability', field: 'balance' },
                      ].map((col) => (
                         <th 
                           key={col.field}
                           onClick={() => handleSort(col.field)}
                           className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest cursor-pointer group hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
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
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">Actions</th>
                   </tr>
                </thead>
               <tbody className="divide-y divide-theme-border">
                  {sortedPurchases.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/10 transition-colors">
                       <td className="px-6 py-4 text-sm font-black dark:text-white opacity-60">
                          {formatDate(safeToDate(p.createdAt))}
                       </td>
                       <td className="px-6 py-4 text-sm font-black dark:text-white">
                         <button 
                           onClick={() => navigate('/suppliers', { state: { openLedgerId: p.supplierId } })}
                           className="text-blue-600 hover:underline"
                         >
                           {p.supplierName}
                         </button>
                       </td>
                       <td className="px-6 py-4 text-sm dark:text-gray-300 font-bold italic">{p.items.length} materials</td>
                       <td className="px-6 py-4 text-sm font-black dark:text-white">{formatCurrency(p.total)}</td>
                       <td className="px-6 py-4 text-sm text-green-500 font-black">{formatCurrency(p.paidAmount)}</td>
                       <td className="px-6 py-4 text-sm text-red-500 font-black">{formatCurrency(p.balance)}</td>
                       <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                             <button 
                               onClick={() => generatePDF(p)}
                               className="p-2 text-blue-600 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-900 rounded-xl transition-all shadow-sm"
                               title="Download/Print Purchase Voucher"
                             >
                                <Download className="w-4 h-4" />
                             </button>
                             {p.balance > 0 && (
                                <button 
                                  onClick={() => {
                                    setRecordingPayment(p);
                                    setPaymentAmount(p.balance);
                                    setPaymentMode('Cash');
                                  }}
                                  className="p-2 text-green-600 hover:bg-green-600 hover:text-white dark:hover:bg-green-900 rounded-xl transition-all shadow-sm"
                                  title="Record Payment against Purchase"
                                >
                                   <Banknote className="w-4 h-4" />
                                </button>
                             )}
                          </div>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {/* Record Payment Modal */}
      {recordingPayment && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-theme-card w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl border border-theme-border animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-theme-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-2xl text-green-600">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                   <h3 className="text-lg font-black dark:text-white leading-none">Settle Purchase</h3>
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{recordingPayment.supplierName}</span>
                </div>
              </div>
              <button 
                onClick={() => setRecordingPayment(null)}
                className="p-2 hover:bg-theme-bg rounded-xl transition-colors text-gray-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 space-y-6">
               <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-theme-bg/50 rounded-2xl border border-theme-border">
                     <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Due</p>
                     <p className="text-xl font-black dark:text-white">{formatCurrency(recordingPayment.total)}</p>
                  </div>
                  <div className="p-4 bg-theme-bg/50 rounded-2xl border border-theme-border">
                     <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Pending</p>
                     <p className="text-xl font-black text-red-500">{formatCurrency(recordingPayment.balance)}</p>
                  </div>
               </div>

               <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Payment Amount ({currencySymbol})</label>
                  <input 
                    type="number" 
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                    max={recordingPayment.balance}
                    className="w-full text-2xl font-black text-green-600 bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30 py-6 text-center rounded-3xl"
                    autoFocus
                  />
               </div>

               <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Account</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Cash', 'Bank Transfer', 'Cheque'].map(mode => (
                      <button 
                        key={mode}
                        onClick={() => setPaymentMode(mode)}
                        className={cn(
                          "py-3 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all",
                          paymentMode === mode 
                            ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20" 
                            : "bg-theme-bg border-theme-border text-gray-500 hover:border-gray-400"
                        )}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
               </div>
            </div>

            <div className="p-6 bg-theme-bg border-t border-theme-border flex gap-3">
               <button 
                 onClick={() => setRecordingPayment(null)}
                 className="flex-1 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest bg-theme-card border border-theme-border rounded-2xl active:scale-95 transition-all"
               >
                 Cancel
               </button>
               <button 
                 onClick={handleProcessPayment}
                 disabled={isProcessingPayment || paymentAmount <= 0}
                 className="flex-[2] py-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-green-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
               >
                 {isProcessingPayment ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Banknote className="w-4 h-4" />}
                 Post Payment
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
