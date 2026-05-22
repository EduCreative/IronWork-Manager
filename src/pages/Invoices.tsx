import React from 'react';
import { 
  Receipt, 
  Search, 
  Plus, 
  Download, 
  Eye, 
  Printer, 
  X, 
  Trash2, 
  UserPlus, 
  Package,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Banknote,
  Clock
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
  getDoc,
  runTransaction
} from 'firebase/firestore';
import { formatCurrency as baseFormatCurrency, cn, OperationType, handleFirestoreError, formatDate, logActivity, safeToDate } from '../lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useCurrency } from '../hooks/useCurrency';
import { useConfig } from '../context/ConfigContext';
import { useLocation, useNavigate } from 'react-router-dom';
import InvoicePrintPreview from '../components/InvoicePrintPreview';

export default function Invoices() {
  const { formatCurrency, currencySymbol } = useCurrency();
  const { companyName, companyAddress, companyPhone, companyEmail } = useConfig();
  const location = useLocation();
  const navigate = useNavigate();
  const [invoices, setInvoices] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isCreating, setIsCreating] = React.useState(false);
  const [viewingInvoice, setViewingInvoice] = React.useState<any>(null);
  const [recordingPayment, setRecordingPayment] = React.useState<any>(null);
  const [paymentAmount, setPaymentAmount] = React.useState<number>(0);
  const [paymentMode, setPaymentMode] = React.useState<string>('Cash');
  const [isProcessingPayment, setIsProcessingPayment] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [sortField, setSortField] = React.useState<string>('createdAt');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');
  const [invoiceDate, setInvoiceDate] = React.useState(new Date().toISOString().split('T')[0]);

  // Invoice Creation State
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [products, setProducts] = React.useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = React.useState<any>(null);
  const [invoiceItems, setInvoiceItems] = React.useState<any[]>([]);
  const [discount, setDiscount] = React.useState(0);
  const [taxRate, setTaxRate] = React.useState(0);
  const [paidAmount, setPaidAmount] = React.useState(0);
  const [paymentMethod, setPaymentMethod] = React.useState('Cash');
  const [submitting, setSubmitting] = React.useState(false);
  const [nextInvoiceNumber, setNextInvoiceNumber] = React.useState<string>('Loading...');
  const [showPreview, setShowPreview] = React.useState(false);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInvoices(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'invoices');
    } finally {
      setLoading(false);
    }
  };

  const fetchNextInvoiceNumber = async () => {
    try {
      const counterRef = doc(db, 'counters', 'invoices');
      const counterSnap = await getDoc(counterRef);
      const currentYear = new Date().getFullYear();
      
      if (counterSnap.exists()) {
        const data = counterSnap.data();
        if (data.year === currentYear) {
          setNextInvoiceNumber(`INV-${currentYear}-${(data.lastNumber + 1).toString().padStart(4, '0')}`);
        } else {
          setNextInvoiceNumber(`INV-${currentYear}-0001`);
        }
      } else {
        setNextInvoiceNumber(`INV-${currentYear}-0001`);
      }
    } catch (error) {
      console.error('Error fetching next invoice number:', error);
      setNextInvoiceNumber('AUTO-GEN');
    }
  };

  const fetchDataForInvoice = async () => {
    try {
      const [custSnap, prodSnap] = await Promise.all([
        getDocs(collection(db, 'customers')),
        getDocs(collection(db, 'products')),
        fetchNextInvoiceNumber()
      ]);
      setCustomers(custSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setProducts(prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error(error);
    }
  };

  React.useEffect(() => {
    fetchInvoices();
    if (location.state?.openCreator) {
      setIsCreating(true);
    }
  }, [location.state]);

  React.useEffect(() => {
    if (isCreating) {
      fetchDataForInvoice();
    }
  }, [isCreating]);

  const addProductToInvoice = (product: any) => {
    const existing = invoiceItems.find(item => item.id === product.id);
    if (existing) {
      setInvoiceItems(invoiceItems.map(item => 
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setInvoiceItems([...invoiceItems, { 
        id: product.id, 
        name: product.name, 
        price: product.salePrice, 
        unitType: product.unitType,
        quantity: 1 
      }]);
    }
  };

  const removeItem = (id: string) => {
    setInvoiceItems(invoiceItems.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, qty: number) => {
    if (qty <= 0) return;
    setInvoiceItems(invoiceItems.map(item => 
      item.id === id ? { ...item, quantity: qty } : item
    ));
  };

  const subtotal = invoiceItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const netAfterDiscount = subtotal - discount;
  const taxAmount = (netAfterDiscount * taxRate) / 100;
  const total = netAfterDiscount + taxAmount;
  const balance = total - paidAmount;

  const saveInvoice = async () => {
    if (submitting) return;
    if (!selectedCustomer) {
      alert('Please select a customer');
      return;
    }
    if (invoiceItems.length === 0) {
      alert('Please add at least one item');
      return;
    }

    setSubmitting(true);
    try {
      // Use a transaction to update stock, counter, and save invoice
      await runTransaction(db, async (transaction) => {
        // --- 1. ALL READS FIRST ---
        
        // Read Counter
        const counterRef = doc(db, 'counters', 'invoices');
        const counterDoc = await transaction.get(counterRef);
        
        // Read Customer
        const custRef = doc(db, 'customers', selectedCustomer.id);
        const custDoc = await transaction.get(custRef);
        
        // Read Products
        const prodRefs = invoiceItems.map(item => doc(db, 'products', item.id));
        const prodDocs = await Promise.all(prodRefs.map(ref => transaction.get(ref)));
        
        // --- 2. CALCULATIONS ---
        
        // Calculate Invoice Number Sequence
        const currentYear = new Date().getFullYear();
        let sequence = 1;
        if (counterDoc.exists()) {
          const counterData = counterDoc.data();
          if (counterData.year === currentYear) {
            sequence = counterData.lastNumber + 1;
          }
        }
        const invoiceNumber = `INV-${currentYear}-${sequence.toString().padStart(4, '0')}`;

        // --- 3. ALL WRITES AFTER ---
        
        const invoiceData = {
          invoiceNumber,
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.name,
          items: invoiceItems,
          subtotal,
          discount,
          taxRate,
          taxAmount,
          total,
          paidAmount,
          balance,
          paymentMethod,
          status: balance <= 0 ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid'),
          createdAt: new Date(invoiceDate)
        };

        // Create Invoice
        const invRef = doc(collection(db, 'invoices'));
        transaction.set(invRef, invoiceData);

        // Update Product Stocks
        prodDocs.forEach((prodDoc, index) => {
          if (prodDoc.exists()) {
            const currentStock = prodDoc.data().currentStock;
            transaction.update(prodRefs[index], { currentStock: currentStock - invoiceItems[index].quantity });
          }
        });

        // Update Customer Balance
        if (custDoc.exists()) {
          const currentBalance = custDoc.data().balance || 0;
          transaction.update(custRef, { balance: currentBalance + balance });
        }

        // Update Global Counter
        transaction.set(counterRef, {
          year: currentYear,
          lastNumber: sequence
        }, { merge: true });

        // Log the final number for activity log
        logActivity('INVOICE_CREATE', `Created invoice ${invoiceNumber} for ${selectedCustomer.name}`, {
          invoiceNumber,
          total,
          customerName: selectedCustomer.name
        });
      });

      alert('Invoice generated successfully!');
      setIsCreating(false);
      fetchInvoices();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'invoices');
    } finally {
      setSubmitting(false);
    }
  };

  const generatePDF = (invoice: any) => {
    const doc = new jsPDF() as any;
    const companyLogo = localStorage.getItem('global_company_logo');
    
    let textXShift = 105;
    let textOptions: any = { align: 'center' };
    
    if (companyLogo) {
      try {
        const format = companyLogo.includes("png") ? "PNG" : "JPEG";
        doc.addImage(companyLogo, format, 20, 10, 18, 18);
        textXShift = 42;
        textOptions = { align: 'left' };
      } catch (e) {
        console.warn("Could not insert company logo in Invoice PDF:", e);
      }
    }
    
    // Add Company Info
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.text(companyName.toUpperCase(), textXShift, 18, textOptions);
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    
    let headerY = 24;
    if (companyAddress) {
      doc.text(companyAddress, textXShift, headerY, textOptions);
      headerY += 5;
    }
    
    const contactInfo = [
      companyPhone ? `Phone: ${companyPhone}` : null,
      companyEmail ? `Email: ${companyEmail}` : null
    ].filter(Boolean).join('  |  ');
    
    if (contactInfo) {
      doc.text(contactInfo, textXShift, headerY, textOptions);
    }
    
    doc.setTextColor(0); // Reset to black
    
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 40, 190, 40);

    // Invoice Header
    doc.setFontSize(12);
    doc.text(`INVOICE: ${invoice.invoiceNumber}`, 20, 50);
    doc.text(`Date: ${formatDate(safeToDate(invoice.createdAt))}`, 190, 50, { align: 'right' });

    // Customer Info
    doc.setFontSize(10);
    doc.text('BILL TO:', 20, 65);
    doc.setFont(undefined, 'bold');
    doc.text(invoice.customerName, 20, 70);
    doc.setFont(undefined, 'normal');

    // Items Table
    const tableData = invoice.items.map((item: any) => [
      item.name,
      `${item.quantity} ${item.unitType}`,
      formatCurrency(item.price),
      formatCurrency(item.price * item.quantity)
    ]);

    autoTable(doc, {
      startY: 80,
      head: [['Description', 'Quantity', 'Unit Price', 'Total']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] }
    });

    // Summary
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.text(`Subtotal: ${formatCurrency(invoice.subtotal)}`, 190, finalY, { align: 'right' });
    doc.text(`Discount: ${formatCurrency(invoice.discount)}`, 190, finalY + 5, { align: 'right' });
    if (invoice.taxAmount > 0) {
      doc.text(`Sales Tax (${invoice.taxRate}%): ${formatCurrency(invoice.taxAmount)}`, 190, finalY + 10, { align: 'right' });
      doc.setFont(undefined, 'bold');
      doc.text(`Total Due: ${formatCurrency(invoice.total)}`, 190, finalY + 17, { align: 'right' });
      doc.setFont(undefined, 'normal');
      doc.text(`Paid Amount: ${formatCurrency(invoice.paidAmount)}`, 190, finalY + 22, { align: 'right' });
      doc.text(`Balance: ${formatCurrency(invoice.balance)}`, 190, finalY + 27, { align: 'right' });
    } else {
      doc.setFont(undefined, 'bold');
      doc.text(`Total Due: ${formatCurrency(invoice.total)}`, 190, finalY + 12, { align: 'right' });
      doc.setFont(undefined, 'normal');
      doc.text(`Paid Amount: ${formatCurrency(invoice.paidAmount)}`, 190, finalY + 17, { align: 'right' });
      doc.text(`Balance: ${formatCurrency(invoice.balance)}`, 190, finalY + 22, { align: 'right' });
    }

    // Footer
    doc.setFontSize(8);
    doc.text('Terms: All payments strictly within 30 days. Fabricated items cannot be returned.', 20, 280);
    doc.text('Authorised Signature: _______________________', 190, 280, { align: 'right' });

    doc.save(`${invoice.invoiceNumber}.pdf`);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filteredInvoices = invoices.filter(i => 
    i.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedInvoices = React.useMemo(() => {
    return [...filteredInvoices].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      // Handle special cases
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
  }, [filteredInvoices, sortField, sortOrder]);

  const handleProcessPayment = async () => {
    if (!recordingPayment || paymentAmount <= 0) return;
    if (paymentAmount > recordingPayment.balance) {
      alert(`Payment amount cannot exceed the pending balance (${formatCurrency(recordingPayment.balance)})`);
      return;
    }

    setIsProcessingPayment(true);
    try {
      await runTransaction(db, async (transaction) => {
        const invRef = doc(db, 'invoices', recordingPayment.id);
        const custRef = doc(db, 'customers', recordingPayment.customerId);

        const invDoc = await transaction.get(invRef);
        const custDoc = await transaction.get(custRef);

        if (!invDoc.exists()) throw new Error("Invoice does not exist!");

        const currentPaid = invDoc.data().paidAmount || 0;
        const currentTotal = invDoc.data().total || 0;
        const newPaid = currentPaid + paymentAmount;
        const newBalance = currentTotal - newPaid;
        const newStatus = newBalance <= 0 ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');

        // Update Invoice
        transaction.update(invRef, {
          paidAmount: newPaid,
          balance: newBalance,
          status: newStatus,
          lastPaymentDate: serverTimestamp(),
          paymentMethod: paymentMode // Update to last used method
        });

        // Update Customer Balance (Debt)
        if (custDoc.exists()) {
          const currentCustBalance = custDoc.data().balance || 0;
          transaction.update(custRef, {
            balance: Math.max(0, currentCustBalance - paymentAmount)
          });
        }
      });

      await logActivity('PAYMENT_RECORD', `Recorded payment of ${formatCurrency(paymentAmount)} for invoice ${recordingPayment.invoiceNumber}`, {
        invoiceId: recordingPayment.id,
        amount: paymentAmount,
        customerName: recordingPayment.customerName
      });

      alert('Payment recorded successfully!');
      setRecordingPayment(null);
      setPaymentAmount(0);
      fetchInvoices();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'invoices');
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
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 transition-colors"
            title="Return to invoice list"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Invoices
          </button>
          <div className="flex flex-col items-end">
            <h1 className="text-2xl font-bold dark:text-white leading-none">Create New Invoice</h1>
            <div className="mt-3 bg-blue-50 dark:bg-blue-900/10 px-4 py-2 rounded-2xl border border-blue-200/50 dark:border-blue-900/50 flex items-center gap-3 shadow-sm border-dashed">
              <span className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-[0.2em]">Next Sequence</span>
              <span className="text-lg font-black text-blue-700 dark:text-white font-mono tracking-tighter">{nextInvoiceNumber}</span>
            </div>
          </div>
        </div>

        {/* 1. Date and Customer Details (Universal Top Section) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {/* Date Section */}
           <div className="bg-theme-card rounded-2xl border border-theme-border p-6 shadow-sm">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                Invoice Date
              </h3>
              <input 
                type="date" 
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full bg-theme-bg border border-theme-border text-theme-text font-bold p-3 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
           </div>

           {/* Customer Details */}
           <div className="bg-theme-card rounded-2xl border border-theme-border p-6 shadow-sm">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-500" />
                Customer Selection
              </h3>
              <select 
                className="w-full bg-theme-bg border border-theme-border text-theme-text font-bold p-3 rounded-xl focus:ring-2 focus:ring-blue-500"
                onChange={(e) => setSelectedCustomer(customers.find(c => c.id === e.target.value))}
                value={selectedCustomer?.id || ''}
              >
                <option value="">Choose a Customer...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
              </select>
              {selectedCustomer && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/20 flex items-center justify-between">
                   <div>
                     <p className="text-sm font-black text-blue-600 dark:text-blue-400">{selectedCustomer.name}</p>
                     <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">{selectedCustomer.phone}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Prev. Balance</p>
                      <p className="text-sm font-black text-red-500">{formatCurrency(selectedCustomer.balance || 0)}</p>
                   </div>
                </div>
              )}
           </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Side: Product Selection and Items */}
          <div className="xl:col-span-2 space-y-6">
            {/* 3. Select Products */}
            <div className="bg-theme-card rounded-2xl border border-theme-border p-6 shadow-sm">
               <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                 <Package className="w-4 h-4 text-blue-500" />
                 Select Products
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar border-t border-theme-border/10 pt-4">
                  {products.map(p => (
                    <button 
                      key={p.id}
                      onClick={() => addProductToInvoice(p)}
                      className="p-3 bg-theme-bg border border-theme-border hover:border-blue-500 rounded-xl text-left transition-all active:scale-[0.98] group"
                    >
                      <div className="flex justify-between items-start mb-1">
                         <span className="font-bold dark:text-white group-hover:text-blue-600 transition-colors">{p.name}</span>
                         <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded font-black uppercase">{p.unitType}</span>
                      </div>
                      <div className="flex justify-between items-end">
                         <span className="text-[10px] text-gray-400 font-bold">In Stock: {p.currentStock}</span>
                         <span className="font-black text-blue-500">{formatCurrency(p.salePrice)}</span>
                      </div>
                    </button>
                  ))}
               </div>
            </div>

            {/* 4. Invoice Items */}
            <div className="bg-theme-card rounded-2xl border border-theme-border shadow-sm overflow-hidden">
               <div className="p-6 border-b border-theme-border font-black text-xs uppercase tracking-widest text-gray-400">
                 Invoice Items List
               </div>
               <div className="overflow-x-auto text-sm">
                 <table className="w-full text-left">
                    <thead>
                      <tr className="bg-theme-bg/50 border-b border-theme-border">
                        <th className="px-6 py-4 font-black text-gray-500 uppercase text-[10px] tracking-widest">Item Description</th>
                        <th className="px-6 py-4 font-black text-gray-500 uppercase text-[10px] tracking-widest">Qty</th>
                        <th className="px-6 py-4 font-black text-gray-500 uppercase text-[10px] tracking-widest text-right">Price</th>
                        <th className="px-6 py-4 font-black text-gray-500 uppercase text-[10px] tracking-widest text-right">Total</th>
                        <th className="px-3 py-4 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-border">
                      {invoiceItems.map(item => (
                        <tr key={item.id} className="group">
                          <td className="px-6 py-4 dark:text-white font-bold">{item.name}</td>
                          <td className="px-6 py-4">
                             <input 
                               type="number" 
                               value={item.quantity} 
                               onChange={(e) => updateQuantity(item.id, parseInt(e.target.value))}
                               className="w-20 bg-theme-bg border border-theme-border text-theme-text font-black px-2 py-1 rounded-lg text-center focus:ring-1 focus:ring-blue-500"
                             />
                          </td>
                          <td className="px-6 py-4 text-right dark:text-white font-medium">{formatCurrency(item.price)}</td>
                          <td className="px-6 py-4 text-right font-black text-blue-600 dark:text-blue-400">{formatCurrency(item.price * item.quantity)}</td>
                          <td className="px-3 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                             <button 
                               onClick={() => removeItem(item.id)} 
                               className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                          </td>
                        </tr>
                      ))}
                      {invoiceItems.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-bold italic uppercase tracking-widest">Your invoice is empty. Start by choosing products above.</td>
                        </tr>
                      )}
                    </tbody>
                 </table>
               </div>
            </div>
          </div>

          {/* Right Side: Summary (Point 5) */}
          <div className="space-y-6">
            <div className="bg-theme-card rounded-3xl border border-theme-border p-8 shadow-xl shadow-blue-500/5 space-y-6">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Billing Summary</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-gray-400 uppercase tracking-widest">Subtotal</span>
                  <span className="font-black dark:text-white">{formatCurrency(subtotal)}</span>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-gray-400 uppercase tracking-widest">Discount</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 font-bold">{currencySymbol}</span>
                    <input 
                      type="number" 
                      value={discount} 
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      className="w-24 text-right font-black text-red-500 bg-theme-bg border border-theme-border rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-gray-400 uppercase tracking-widest">Sales Tax (%)</span>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={taxRate} 
                      onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                      placeholder="Tax %"
                      className="w-24 text-right font-black text-blue-500 bg-theme-bg border border-theme-border rounded-lg"
                    />
                  </div>
                </div>
                
                {taxRate > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-gray-400 uppercase tracking-widest text-[10px]">Tax Amount</span>
                    <span className="font-black text-blue-500">{formatCurrency(taxAmount)}</span>
                  </div>
                )}

                <div className="pt-4 border-t border-theme-border flex justify-between items-center">
                  <span className="font-black text-gray-900 dark:text-white uppercase tracking-widest">Current Total</span>
                  <span className="font-black text-2xl text-blue-600 dark:text-blue-400">{formatCurrency(total)}</span>
                </div>

                <div className="space-y-3 pt-4 border-t border-theme-border">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-green-600 uppercase tracking-widest">Paid Now</span>
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 font-bold">{currencySymbol}</span>
                      <input 
                        type="number" 
                        value={paidAmount} 
                        onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                        className="w-24 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 text-right font-black text-green-600 dark:text-green-500 rounded-lg p-2"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/20 space-y-2">
                     <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Current Balance</span>
                        <span className="font-black text-red-600">{formatCurrency(balance)}</span>
                     </div>
                     {selectedCustomer && (
                       <>
                         <div className="flex justify-between items-center border-t border-red-100 dark:border-red-900/20 pt-2">
                            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Previous Debt</span>
                            <span className="font-black text-red-600">{formatCurrency(selectedCustomer.balance || 0)}</span>
                         </div>
                         <div className="flex justify-between items-center border-t-2 border-red-200 dark:border-red-900/40 pt-2">
                            <span className="text-xs font-black text-red-600 uppercase tracking-widest">Total Outstanding</span>
                            <span className="text-lg font-black text-red-600">{formatCurrency(balance + (selectedCustomer.balance || 0))}</span>
                         </div>
                       </>
                     )}
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Select Payment Mode</label>
                 <div className="grid grid-cols-2 gap-2">
                    {['Cash', 'Bank Transfer', 'Cheque', 'Credit'].map(m => (
                      <button 
                        key={m}
                        onClick={() => setPaymentMethod(m)}
                        className={cn(
                          "px-3 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all active:scale-95",
                          paymentMethod === m 
                            ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20" 
                            : "bg-theme-bg border-theme-border text-gray-500 hover:border-gray-400"
                        )}
                      >
                        {m}
                      </button>
                    ))}
                 </div>
              </div>

              <div className="grid grid-cols-1 gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedCustomer) {
                      alert('Please select a customer first');
                      return;
                    }
                    if (invoiceItems.length === 0) {
                      alert('Please add at least one item first');
                      return;
                    }
                    setShowPreview(true);
                  }}
                  className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold py-4 rounded-3xl transition-all flex items-center justify-center gap-2 active:scale-95 border border-slate-200 dark:border-slate-700 uppercase text-xs tracking-wider"
                >
                  <Eye className="w-5 h-5 text-blue-500" />
                  Print Preview
                </button>

                <button 
                  onClick={saveInvoice}
                  disabled={submitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black py-4 rounded-3xl shadow-2xl shadow-blue-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 text-xs tracking-wider uppercase"
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      PROCESSING...
                    </>
                  ) : 'GENERATE INVOICE'}
                </button>
              </div>
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invoices & Billing</h1>
          <p className="text-gray-500 dark:text-gray-400">View history and generate new billing records.</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
          title="Create a new invoice and update inventory"
        >
          <Plus className="w-4 h-4" />
          Create Invoice
        </button>
      </div>

      <div className="bg-theme-card rounded-3xl border border-theme-border shadow-sm overflow-hidden transition-all">
        <div className="p-6 border-b border-theme-border flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by invoice # or customer..."
              className="w-full pl-10 pr-4 py-2 bg-theme-bg border-theme-border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-100/50 dark:bg-slate-800/50 divide-x divide-slate-200/50 dark:divide-slate-700/50">
                {[
                  { label: 'Invoice #', field: 'invoiceNumber' },
                  { label: 'Date Issued', field: 'createdAt' },
                  { label: 'Party Name', field: 'customerName' },
                  { label: 'Total Value', field: 'total' },
                  { label: 'Workflow Status', field: 'status' },
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
              {sortedInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-sm font-black text-gray-900 dark:text-white">{inv.invoiceNumber}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{formatDate(safeToDate(inv.createdAt))}</td>
                  <td className="px-6 py-4 text-sm">
                    <button 
                      onClick={() => navigate('/customers', { state: { openLedgerId: inv.customerId } })}
                      className="font-bold text-blue-600 hover:underline text-left"
                    >
                      {inv.customerName}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm font-black text-gray-900 dark:text-white">{formatCurrency(inv.total)}</td>
                  <td className="px-6 py-4">
                    <span className={cn("px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm",
                      inv.status === 'paid' ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-500" :
                      inv.status === 'partial' ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-500" :
                      "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-500"
                    )}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                       {inv.status !== 'paid' && (
                         <button 
                           onClick={() => {
                             setRecordingPayment(inv);
                             setPaymentAmount(inv.balance);
                             setPaymentMode('Cash');
                           }}
                           className="p-2 text-green-600 hover:bg-green-600 hover:text-white dark:hover:bg-green-900 rounded-xl transition-all shadow-sm"
                           title="Record Payment"
                         >
                            <Banknote className="w-4 h-4" />
                         </button>
                       )}
                       <button onClick={() => generatePDF(inv)} className="p-2 text-blue-600 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-900 rounded-xl transition-all shadow-sm" title="Download PDF">
                          <Download className="w-4 h-4" />
                       </button>
                       <button 
                         onClick={() => setViewingInvoice(inv)}
                         className="p-2 text-gray-600 hover:bg-gray-900 hover:text-white dark:hover:bg-gray-800 rounded-xl transition-all shadow-sm"
                         title="View Invoice Details"
                       >
                          <Eye className="w-4 h-4" />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Detail Modal */}
      {viewingInvoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-theme-card w-full max-w-2xl rounded-[2rem] overflow-hidden shadow-2xl border border-theme-border animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-theme-border flex items-center justify-between bg-theme-bg/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                   <h3 className="text-lg font-black text-gray-900 dark:text-white leading-none">{viewingInvoice.invoiceNumber}</h3>
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{formatDate(safeToDate(viewingInvoice.createdAt))}</span>
                </div>
              </div>
              <button 
                onClick={() => setViewingInvoice(null)}
                className="p-2 hover:bg-theme-bg rounded-xl transition-colors text-gray-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8 max-h-[70vh] overflow-y-auto space-y-8">
              <div className="flex justify-between items-start">
                 <div>
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Billed To</h4>
                    <p className="text-lg font-black text-gray-900 dark:text-white leading-tight">{viewingInvoice.customerName}</p>
                    <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">Customer ID: {viewingInvoice.customerId}</p>
                 </div>
                 <div className="text-right">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Payment Status</h4>
                    <span className={cn("px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm inline-block",
                      viewingInvoice.status === 'paid' ? "bg-green-100 text-green-700" :
                      viewingInvoice.status === 'partial' ? "bg-blue-100 text-blue-700" :
                      "bg-amber-100 text-amber-700"
                    )}>
                      {viewingInvoice.status}
                    </span>
                    <p className="text-xs text-gray-400 mt-2 font-medium">via {viewingInvoice.paymentMethod}</p>
                 </div>
              </div>

              <div className="rounded-2xl border border-theme-border overflow-hidden bg-theme-bg/30">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-theme-bg/50 border-b border-theme-border">
                      <th className="px-6 py-3 font-black text-gray-500 uppercase text-[10px] tracking-widest">Description</th>
                      <th className="px-6 py-3 font-black text-gray-500 uppercase text-[10px] tracking-widest">Qty</th>
                      <th className="px-6 py-3 font-black text-gray-500 uppercase text-[10px] tracking-widest text-right">Price</th>
                      <th className="px-6 py-3 font-black text-gray-500 uppercase text-[10px] tracking-widest text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-border font-medium">
                    {viewingInvoice.items.map((item: any, i: number) => (
                      <tr key={i}>
                        <td className="px-6 py-4 text-gray-900 dark:text-white capitalize">{item.name}</td>
                        <td className="px-6 py-4 text-gray-700 dark:text-white">{item.quantity} {item.unitType}</td>
                        <td className="px-6 py-4 text-gray-700 dark:text-white text-right">{formatCurrency(item.price)}</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white text-right font-black">{formatCurrency(item.price * item.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3">
                 <div className="flex justify-between items-center px-4 py-2 bg-theme-bg/30 rounded-xl">
                    <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Subtotal</span>
                    <span className="text-base font-black text-gray-900 dark:text-white">{formatCurrency(viewingInvoice.subtotal)}</span>
                 </div>
                 <div className="flex justify-between items-center px-4 py-2 bg-theme-bg/30 rounded-xl">
                    <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Discount</span>
                    <span className="text-base font-bold text-red-500">-{formatCurrency(viewingInvoice.discount)}</span>
                 </div>
                 {viewingInvoice.taxRate > 0 && (
                   <div className="flex justify-between items-center px-4 py-2 bg-theme-bg/30 rounded-xl">
                      <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Sales Tax ({viewingInvoice.taxRate}%)</span>
                      <span className="text-base font-bold text-blue-500">+{formatCurrency(viewingInvoice.taxAmount)}</span>
                   </div>
                 )}
                 <div className="flex justify-between items-center px-6 py-4 bg-blue-600 rounded-2xl shadow-xl shadow-blue-600/20">
                    <span className="text-lg font-black text-white uppercase tracking-widest">Total Amount</span>
                    <span className="text-2xl font-black text-white">{formatCurrency(viewingInvoice.total)}</span>
                 </div>
                 <div className="flex items-center justify-between pt-4 gap-4">
                    <div className="flex-1 p-4 rounded-2xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30">
                       <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Actually Paid</p>
                       <p className="text-xl font-black text-green-700 dark:text-green-500">{formatCurrency(viewingInvoice.paidAmount)}</p>
                    </div>
                    <div className={cn(
                      "flex-1 p-4 rounded-2xl border",
                      viewingInvoice.balance > 0 
                        ? "bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30" 
                        : "bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-800"
                    )}>
                       <p className={cn("text-[10px] font-black uppercase tracking-widest", 
                         viewingInvoice.balance > 0 ? "text-red-600" : "text-gray-400"
                       )}>Balance Due</p>
                       <p className={cn("text-xl font-black", 
                         viewingInvoice.balance > 0 ? "text-red-700 dark:text-red-500" : "text-gray-600 dark:text-gray-400"
                       )}>{formatCurrency(viewingInvoice.balance)}</p>
                    </div>
                 </div>
              </div>
            </div>

            <div className="p-6 bg-theme-bg border-t border-theme-border flex gap-4">
              <button
                onClick={() => setViewingInvoice(null)}
                className="flex-1 py-4 text-sm font-black text-gray-500 bg-theme-card border border-theme-border rounded-2xl hover:bg-theme-bg active:scale-95 transition-all"
                title="Close invoice detail view"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-black rounded-2xl border border-theme-border flex items-center justify-center gap-2 active:scale-95 transition-all"
                title="Print this invoice directly"
              >
                <Printer className="w-5 h-5" />
                Print
              </button>
              <button
                onClick={() => {
                  generatePDF(viewingInvoice);
                  setViewingInvoice(null);
                }}
                className="flex-[1.5] py-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-black rounded-2xl shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
                title="Download this invoice as a PDF file"
              >
                <Download className="w-5 h-5" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {recordingPayment && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-theme-card w-full max-w-md rounded-[2rem] overflow-hidden shadow-2xl border border-theme-border animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-theme-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                   <h3 className="text-lg font-black text-gray-900 dark:text-white leading-none">Record Payment</h3>
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{recordingPayment.invoiceNumber}</span>
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
                     <p className="text-xl font-black text-gray-900 dark:text-white">{formatCurrency(recordingPayment.total)}</p>
                  </div>
                  <div className="p-4 bg-theme-bg/50 rounded-2xl border border-theme-border">
                     <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Pending</p>
                     <p className="text-xl font-black text-red-500">{formatCurrency(recordingPayment.balance)}</p>
                  </div>
               </div>

               <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Payment Amount ({currencySymbol})</label>
                  <input 
                    type="number" 
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                    max={recordingPayment.balance}
                    className="w-full text-2xl font-black text-green-600 bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30 py-4"
                    autoFocus
                  />
               </div>

               <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Payment Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Cash', 'Bank Transfer', 'Cheque', 'Credit'].map(mode => (
                      <button 
                        key={mode}
                        onClick={() => setPaymentMode(mode)}
                        className={cn(
                          "py-3 text-xs font-bold rounded-xl border transition-all",
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
                 className="flex-1 py-4 text-xs font-black text-gray-500 bg-theme-card border border-theme-border rounded-2xl active:scale-95 transition-all"
               >
                 Cancel
               </button>
               <button 
                 onClick={handleProcessPayment}
                 disabled={isProcessingPayment || paymentAmount <= 0}
                 className="flex-[2] py-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-black rounded-2xl shadow-xl shadow-green-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
               >
                 {isProcessingPayment ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Banknote className="w-4 h-4" />}
                 Confirm Payment
               </button>
            </div>
          </div>
        </div>
      )}

      <InvoicePrintPreview
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        onConfirm={() => {
          setShowPreview(false);
          saveInvoice();
        }}
        onDownloadPDF={() => {
          const draftInvoice = {
            invoiceNumber: nextInvoiceNumber,
            customerName: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
            createdAt: invoiceDate,
            items: invoiceItems,
            subtotal,
            discount,
            taxAmount,
            taxRate,
            total,
            paidAmount,
            balance,
            paymentMethod
          };
          generatePDF(draftInvoice);
        }}
        submitting={submitting}
        invoiceNumber={nextInvoiceNumber}
        invoiceDate={invoiceDate}
        selectedCustomer={selectedCustomer}
        invoiceItems={invoiceItems}
        subtotal={subtotal}
        discount={discount}
        taxRate={taxRate}
        taxAmount={taxAmount}
        total={total}
        paidAmount={paidAmount}
        balance={balance}
        paymentMethod={paymentMethod}
        companyInfo={{
          name: companyName,
          address: companyAddress,
          phone: companyPhone,
          email: companyEmail
        }}
        currencySymbol={currencySymbol}
        formatCurrency={formatCurrency}
      />
    </div>
  );
}
