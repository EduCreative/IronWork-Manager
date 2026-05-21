import React from 'react';
import { 
  Mail,
  Copy,
  Check,
  MessageSquare,
  Users, 
  Plus, 
  Search, 
  Phone, 
  MapPin, 
  DollarSign, 
  History,
  Edit,
  Trash2,
  X,
  Eye,
  Printer,
  Receipt,
  Download,
  Calendar,
  Banknote,
  ArrowRight
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
import { formatCurrency as baseFormatCurrency, cn, OperationType, handleFirestoreError, formatDate, safeToDate, logActivity } from '../lib/utils';
import { useCurrency } from '../hooks/useCurrency';
import { useConfig } from '../context/ConfigContext';
import { useLocation } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Customers() {
  const { formatCurrency } = useCurrency();
  const { companyName, companyAddress, companyPhone, companyEmail } = useConfig();
  const location = useLocation();
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingCustomer, setEditingCustomer] = React.useState<any>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Ledger State
  const [ledgerCustomer, setLedgerCustomer] = React.useState<any>(null);
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

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'customers'), orderBy('name', 'asc'));
      const querySnapshot = await getDocs(q);
      setCustomers(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'customers');
    } finally {
      setLoading(false);
    }
  };

  const generateLedgerPDF = (customer: any, transactions: any[]) => {
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
    doc.text('STATEMENT OF ACCOUNT', pageWidth / 2, headerY + 3, { align: 'center' });
    
    doc.setDrawColor(200, 200, 200);
    doc.line(20, headerY + 10, pageWidth - 20, headerY + 10);
    
    const summaryStartY = headerY + 20;

    // Customer Details
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text('CUSTOMER INFORMATION:', 20, headerY + 25);
    doc.setFont(undefined, 'bold');
    doc.text(customer.name, 20, headerY + 30);
    doc.setFont(undefined, 'normal');
    doc.text(`Phone: ${customer.phone}`, 20, headerY + 35);
    doc.text(`Address: ${customer.address || 'N/A'}`, 20, headerY + 40);

    doc.text(`Statement Date: ${formatDate(new Date())}`, pageWidth - 20, headerY + 30, { align: 'right' });

    // Summary Box
    const totalSales = transactions.reduce((a, b) => a + b.total, 0);
    const totalPaid = transactions.reduce((a, b) => a + (b.paidAmount || 0), 0);
    const initialBal = customer.balance - (totalSales - totalPaid);

    autoTable(doc, {
      startY: headerY + 50,
      head: [['Opening Balance', 'Total Invoiced', 'Total Payments', 'Net Outstanding']],
      body: [[
        formatCurrency(initialBal),
        formatCurrency(totalSales),
        formatCurrency(totalPaid),
        formatCurrency(customer.balance)
      ]],
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { halign: 'center', fontSize: 10, fontStyle: 'bold' }
    });

    // Transaction Table
    const tableData = transactions.map(tx => [
      formatDate(safeToDate(tx.createdAt)),
      tx.invoiceNumber,
      formatCurrency(tx.total),
      formatCurrency(tx.paidAmount),
      formatCurrency(tx.balance)
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['Date', 'Reference', 'Invoice Total', 'Amount Paid', 'Balance']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [71, 85, 105] }
    });

    doc.save(`${customer.name}_Ledger_${new Date().getTime()}.pdf`);
  };

  const fetchLedger = async (customer: any) => {
    setLedgerCustomer(customer);
    setLoadingLedger(true);
    try {
      const q = query(
        collection(db, 'invoices'), 
        where('customerId', '==', customer.id),
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

  const generatePDF = (invoice: any) => {
    const doc = new jsPDF() as any;
    
    // Add Company Info
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.text(companyName.toUpperCase(), 105, 18, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    
    let invHeaderY = 24;
    if (companyAddress) {
      doc.text(companyAddress, 105, invHeaderY, { align: 'center' });
      invHeaderY += 5;
    }
    
    const invContactInfo = [
      companyPhone ? `Phone: ${companyPhone}` : null,
      companyEmail ? `Email: ${companyEmail}` : null
    ].filter(Boolean).join('  |  ');
    
    if (invContactInfo) {
      doc.text(invContactInfo, 105, invHeaderY, { align: 'center' });
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

  React.useEffect(() => {
    fetchCustomers();
  }, []);

  React.useEffect(() => {
    if (location.state?.openLedgerId && customers.length > 0) {
      const customer = customers.find(c => c.id === location.state.openLedgerId);
      if (customer) {
        fetchLedger(customer);
      }
    }
  }, [location.state, customers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (editingCustomer) {
        await updateDoc(doc(db, 'customers', editingCustomer.id), {
          ...formData,
          createdAt: editingCustomer.createdAt || serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'customers'), {
          ...formData,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      setEditingCustomer(null);
      setFormData({ name: '', phone: '', email: '', whatsapp: '', address: '', balance: 0 });
      fetchCustomers();
    } catch (error) {
      handleFirestoreError(error, editingCustomer ? OperationType.UPDATE : OperationType.CREATE, 'customers');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (customer: any) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      whatsapp: customer.whatsapp || '',
      address: customer.address || '',
      balance: customer.balance
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      try {
        await deleteDoc(doc(db, 'customers', id));
        fetchCustomers();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'customers');
      }
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customer Directory</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage client profiles and outstanding balances.</p>
        </div>
        <button 
          onClick={() => { setEditingCustomer(null); setFormData({ name: '', phone: '', address: '', balance: 0 }); setIsModalOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
          title="Add a new customer profile"
        >
          <Plus className="w-4 h-4" />
          Add Customer
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by name or phone..."
              className="w-full pl-10 pr-4 py-2 border-none rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6 bg-gray-50/50 dark:bg-gray-950/20">
          {filteredCustomers.map((customer) => (
            <div key={customer.id} className="group bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900/40 transition-all">
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xl shadow-inner cursor-pointer hover:scale-105 transition-transform"
                     onClick={() => fetchLedger(customer)}
                >
                   {customer.name[0].toUpperCase()}
                </div>
                <div className="flex gap-2">
                   <button 
                     onClick={() => handleEdit(customer)} 
                     className="p-2.5 bg-gray-50 dark:bg-gray-800 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                     title="Edit customer details"
                   >
                      <Edit className="w-4 h-4" />
                   </button>
                   <button 
                     onClick={() => handleDelete(customer.id)} 
                     className="p-2.5 bg-gray-50 dark:bg-gray-800 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm"
                     title="Delete customer profile"
                   >
                      <Trash2 className="w-4 h-4" />
                   </button>
                </div>
              </div>

              <h3 
                className="text-xl font-black text-gray-900 dark:text-white mb-2 tracking-tight cursor-pointer hover:text-blue-600 transition-colors"
                onClick={() => fetchLedger(customer)}
              >
                {customer.name}
              </h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between group/contact">
                  <div className="flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                     <div className="bg-gray-100 dark:bg-gray-800 p-1.5 rounded-lg"><Phone className="w-3.5 h-3.5" /></div>
                     <a href={`tel:${customer.phone}`} className="hover:text-blue-600 transition-colors font-bold">{customer.phone}</a>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover/contact:opacity-100 transition-opacity">
                    <a 
                      href={`https://wa.me/${customer.whatsapp || customer.phone.replace(/[^0-9]/g, '')}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-1.5 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all shadow-sm"
                      title="Send WhatsApp Message"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </a>
                    <button 
                      onClick={() => copyToClipboard(customer.phone, `${customer.id}-phone`)}
                      className="p-1.5 bg-gray-50 dark:bg-gray-800 text-gray-400 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                      title="Copy Phone Number"
                    >
                      {copiedId === `${customer.id}-phone` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {customer.email && (
                  <div className="flex items-center justify-between group/contact">
                    <div className="flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                      <div className="bg-gray-100 dark:bg-gray-800 p-1.5 rounded-lg"><Mail className="w-3.5 h-3.5" /></div>
                      <a href={`mailto:${customer.email}`} className="hover:text-blue-600 transition-colors truncate max-w-[140px]">{customer.email}</a>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover/contact:opacity-100 transition-opacity">
                      <button 
                        onClick={() => copyToClipboard(customer.email, `${customer.id}-email`)}
                        className="p-1.5 bg-gray-50 dark:bg-gray-800 text-gray-400 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                      >
                        {copiedId === `${customer.id}-email` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between group/contact">
                  <div className="flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                     <div className="bg-gray-100 dark:bg-gray-800 p-1.5 rounded-lg"><MapPin className="w-3.5 h-3.5" /></div>
                     <a 
                       href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address || "No address provided")}`}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="hover:text-blue-600 transition-colors truncate max-w-[140px] block"
                       title="View on Google Maps"
                     >
                       {customer.address || "No address provided"}
                     </a>
                  </div>
                  {customer.address && (
                    <div className="flex items-center gap-2 opacity-0 group-hover/contact:opacity-100 transition-opacity">
                      <button 
                        onClick={() => copyToClipboard(customer.address, `${customer.id}-addr`)}
                        className="p-1.5 bg-gray-50 dark:bg-gray-800 text-gray-400 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                        title="Copy Address"
                      >
                        {copiedId === `${customer.id}-addr` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
                 <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-black text-gray-400 tracking-widest mb-1">Current Balance</span>
                    <span className={cn("font-black text-2xl tracking-tighter", customer.balance > 0 ? "text-red-600 dark:text-red-500" : "text-green-600 dark:text-green-500")}>
                      {formatCurrency(customer.balance)}
                    </span>
                 </div>
                 <button 
                   onClick={() => fetchLedger(customer)}
                   className="p-3 bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-2xl transition-colors"
                   title="View customer payment history"
                 >
                    <History className="w-5 h-5" />
                 </button>
              </div>
            </div>
          ))}
          {filteredCustomers.length === 0 && !loading && (
            <div className="col-span-full py-20 text-center text-gray-500 italic">
               No customers found. Start by adding one.
            </div>
          )}
        </div>
      </div>

      {/* Customer Ledger Modal */}
      {ledgerCustomer && (
        <div className="fixed inset-0 z-[70] flex items-center justify-end bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-950 w-full max-w-4xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl font-black">
                  {ledgerCustomer.name[0].toUpperCase()}
                </div>
                <div>
                   <h2 className="text-2xl font-black dark:text-white uppercase tracking-tight">{ledgerCustomer.name}'s Ledger</h2>
                   <div className="flex flex-wrap items-center gap-3 mt-1">
                      <a href={`tel:${ledgerCustomer.phone}`} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1 hover:text-blue-600 transition-colors">
                        <Phone className="w-3 h-3" /> {ledgerCustomer.phone}
                      </a>
                      {ledgerCustomer.email && (
                        <a href={`mailto:${ledgerCustomer.email}`} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1 hover:text-blue-600 transition-colors">
                          <Mail className="w-3 h-3" /> {ledgerCustomer.email}
                        </a>
                      )}
                      <a 
                        href={`https://wa.me/${ledgerCustomer.whatsapp || ledgerCustomer.phone.replace(/[^0-9]/g, '')}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold text-green-500 uppercase tracking-widest flex items-center gap-1 hover:underline"
                      >
                        <MessageSquare className="w-3 h-3" /> WhatsApp
                      </a>
                      <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">
                        Outstanding: {formatCurrency(ledgerCustomer.balance)}
                      </span>
                   </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 <button 
                   onClick={() => generateLedgerPDF(ledgerCustomer, ledgerTransactions)}
                   className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest"
                 >
                    <Download className="w-4 h-4" />
                    Export Statement
                 </button>
                 <button 
                   onClick={() => setLedgerCustomer(null)}
                   className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-colors text-gray-400"
                 >
                    <X className="w-8 h-8" />
                 </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              {loadingLedger ? (
                <div className="flex items-center justify-center py-20">
                   <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-3xl border border-blue-100 dark:border-blue-900/20">
                     <h3 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-4">Account Summary</h3>
                     <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                        <div>
                           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Opening Balance</p>
                           <p className="text-lg font-black dark:text-white">
                             {formatCurrency(ledgerCustomer.balance - (ledgerTransactions.reduce((a, b) => a + b.total, 0) - ledgerTransactions.reduce((a, b) => a + (b.paidAmount || 0), 0)))}
                           </p>
                        </div>
                        <div>
                           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Invoiced</p>
                           <p className="text-lg font-black dark:text-white">{formatCurrency(ledgerTransactions.reduce((a, b) => a + b.total, 0))}</p>
                        </div>
                        <div>
                           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Payments</p>
                           <p className="text-lg font-black text-green-600">{formatCurrency(ledgerTransactions.reduce((a, b) => a + (b.paidAmount || 0), 0))}</p>
                        </div>
                        <div>
                           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Net Outstanding</p>
                           <p className="text-xl font-black text-red-600">{formatCurrency(ledgerCustomer.balance)}</p>
                        </div>
                     </div>
                     <p className="mt-4 text-[10px] text-gray-400 italic">
                       * Net Outstanding = Opening Balance + Total Invoiced - Total Payments
                     </p>
                  </div>

                  <div className="rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800/50">
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Ref No</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Total</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Paid</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Balance</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {ledgerTransactions.map((tx) => (
                           <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                              <td className="px-6 py-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                                 {formatDate(safeToDate(tx.createdAt))}
                              </td>
                              <td className="px-6 py-4">
                                 <button 
                                   onClick={() => setViewingTransaction(tx)}
                                   className="text-sm font-black text-blue-600 hover:underline"
                                 >
                                    {tx.invoiceNumber}
                                 </button>
                              </td>
                              <td className="px-6 py-4 text-sm font-black dark:text-white uppercase">
                                 {formatCurrency(tx.total)}
                              </td>
                              <td className="px-6 py-4 text-sm font-black text-green-600">
                                 {formatCurrency(tx.paidAmount)}
                              </td>
                              <td className="px-6 py-4 text-sm font-black text-red-600">
                                 {formatCurrency(tx.balance)}
                              </td>
                              <td className="px-6 py-4 text-right">
                                 <button 
                                   onClick={() => setViewingTransaction(tx)}
                                   className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                 >
                                    <Eye className="w-4 h-4" />
                                 </button>
                              </td>
                           </tr>
                        ))}
                        {ledgerTransactions.length === 0 && (
                          <tr>
                             <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">No transactions recorded for this customer.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-8 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex justify-end">
               <button 
                 onClick={() => setLedgerCustomer(null)}
                 className="px-8 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-black uppercase tracking-widest rounded-2xl active:scale-95 transition-all"
               >
                 Close Ledger
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Detail Viewer Modal (Nested-like overlay) */}
      {viewingTransaction && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-950 w-full max-w-2xl rounded-[3rem] overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-800 animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                    <Receipt className="w-6 h-6" />
                 </div>
                 <div>
                    <h3 className="text-xl font-black dark:text-white leading-tight uppercase tracking-tight">{viewingTransaction.invoiceNumber}</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Transaction Detail</p>
                 </div>
              </div>
              <div className="flex items-center gap-2">
                 <button 
                   onClick={() => generatePDF(viewingTransaction)}
                   className="p-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                   title="Print / Save as PDF"
                 >
                    <Printer className="w-5 h-5" />
                 </button>
                 <button 
                   onClick={() => setViewingTransaction(null)}
                   className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 rounded-2xl transition-colors"
                 >
                   <X className="w-6 h-6" />
                 </button>
              </div>
            </div>

            <div className="p-8 max-h-[70vh] overflow-y-auto">
               <div className="grid grid-cols-2 gap-8 mb-10">
                  <div className="space-y-1">
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Issue Date</span>
                     <p className="text-sm font-black dark:text-white tracking-widest">{formatDate(safeToDate(viewingTransaction.createdAt))}</p>
                  </div>
                  <div className="space-y-1 text-right">
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Status</span>
                     <span className={cn(
                       "inline-block px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm",
                       viewingTransaction.status === 'paid' ? "bg-green-100 text-green-700" :
                       viewingTransaction.status === 'partial' ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                     )}>
                        {viewingTransaction.status}
                     </span>
                  </div>
               </div>

               <div className="rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden mb-8">
                  <table className="w-full text-left text-sm">
                     <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
                        <tr>
                           <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Item</th>
                           <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Qty</th>
                           <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Price</th>
                           <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Total</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {viewingTransaction.items.map((item: any, i: number) => (
                           <tr key={i}>
                              <td className="px-6 py-4 font-bold dark:text-white capitalize">{item.name}</td>
                              <td className="px-6 py-4 font-medium dark:text-white opacity-60">{item.quantity} {item.unitType}</td>
                              <td className="px-6 py-4 text-right dark:text-white">{formatCurrency(item.price)}</td>
                              <td className="px-6 py-4 text-right font-black text-blue-600 dark:text-blue-400">{formatCurrency(item.price * item.quantity)}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>

               <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                     <span className="font-bold text-gray-400 uppercase tracking-widest">Subtotal</span>
                     <span className="font-black dark:text-white">{formatCurrency(viewingTransaction.subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm pb-4 border-b border-gray-100 dark:border-gray-800">
                     <span className="font-bold text-gray-400 uppercase tracking-widest">Discount</span>
                     <span className="font-black text-red-500">-{formatCurrency(viewingTransaction.discount || 0)}</span>
                  </div>
                  {viewingTransaction.taxAmount > 0 && (
                    <div className="flex justify-between items-center text-sm pb-4 border-b border-gray-100 dark:border-gray-800">
                       <span className="font-bold text-gray-400 uppercase tracking-widest">Sales Tax ({viewingTransaction.taxRate}%)</span>
                       <span className="font-black text-blue-500">+{formatCurrency(viewingTransaction.taxAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2">
                     <span className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">Total Amount</span>
                     <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{formatCurrency(viewingTransaction.total)}</span>
                  </div>
                  <div className="p-6 bg-theme-bg/50 rounded-3xl border border-theme-border mt-6 grid grid-cols-2 gap-8">
                     <div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Paid Amount</span>
                        <p className="text-xl font-black text-green-600">{formatCurrency(viewingTransaction.paidAmount)}</p>
                        <p className="text-[10px] font-bold text-gray-400 mt-1">via {viewingTransaction.paymentMethod}</p>
                     </div>
                     <div className="text-right">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Pending Balance</span>
                        <p className="text-xl font-black text-red-600">{formatCurrency(viewingTransaction.balance)}</p>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Existing Modal for Add/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-xl font-bold dark:text-white">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                <input 
                  type="text" 
                  required 
                  className="w-full bg-theme-bg border border-gray-200 dark:border-gray-800 p-4 rounded-2xl font-bold"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Phone Number</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full bg-theme-bg border border-gray-200 dark:border-gray-800 p-4 rounded-2xl font-bold"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">WhatsApp (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="Leave blank for same as phone"
                    className="w-full bg-theme-bg border border-gray-200 dark:border-gray-800 p-4 rounded-2xl font-bold"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                <input 
                  type="email" 
                  className="w-full bg-theme-bg border border-gray-200 dark:border-gray-800 p-4 rounded-2xl font-bold"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Street Address</label>
                <textarea 
                  rows={3}
                  className="w-full bg-theme-bg border border-gray-200 dark:border-gray-800 p-4 rounded-2xl font-medium"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                ></textarea>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Initial Balance</label>
                <input 
                  type="number" 
                  className="w-full bg-theme-bg border border-gray-200 dark:border-gray-800 p-4 rounded-2xl font-bold"
                  value={formData.balance}
                  onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
                />
              </div>
              
              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-theme-bg/50 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-1 bg-blue-600 disabled:bg-blue-400 text-white py-3 rounded-xl font-medium shadow-lg shadow-blue-500/20"
                >
                  {submitting ? 'Processing...' : (editingCustomer ? 'Update Customer' : 'Save Customer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
