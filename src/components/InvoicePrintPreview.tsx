import React from 'react';
import { 
  X, 
  Printer, 
  Download, 
  CheckCircle, 
  Receipt,
  FileText,
  Building,
  Phone,
  Mail,
  User,
  Calendar,
  Layers
} from 'lucide-react';
import { cn } from '../lib/utils';

interface InvoiceItem {
  id: string;
  name: string;
  price: number;
  unitType: string;
  quantity: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  balance?: number;
}

interface InvoicePrintPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onDownloadPDF: () => void;
  submitting: boolean;
  invoiceNumber: string;
  invoiceDate: string;
  selectedCustomer: Customer | null;
  invoiceItems: InvoiceItem[];
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  balance: number;
  paymentMethod: string;
  companyInfo: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
  currencySymbol: string;
  formatCurrency: (amount: number) => string;
}

export default function InvoicePrintPreview({
  isOpen,
  onClose,
  onConfirm,
  onDownloadPDF,
  submitting,
  invoiceNumber,
  invoiceDate,
  selectedCustomer,
  invoiceItems,
  subtotal,
  discount,
  taxRate,
  taxAmount,
  total,
  paidAmount,
  balance,
  paymentMethod,
  companyInfo,
  currencySymbol,
  formatCurrency
}: InvoicePrintPreviewProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Render a clean print interface trigger
  const triggerBrowserPrint = () => {
    const printArea = document.getElementById('printable-preview-card');
    if (!printArea) return;

    const originalContent = document.body.innerHTML;
    const printContent = printArea.innerHTML;

    // Open a temporary frame or styled stylesheet or trigger browser print
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Invoice Print Preview - ${invoiceNumber}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
              @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');
              
              body {
                font-family: 'Inter', sans-serif;
                color: #0f172a;
                background-color: #ffffff;
                padding: 40px;
                margin: 0;
              }
              .invoice-card {
                max-width: 800px;
                margin: 0 auto;
              }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              .w-full { width: 100%; }
              .flex { display: flex; }
              .flex-col { flex-direction: column; }
              .justify-between { justify-content: space-between; }
              .items-center { align-items: center; }
              .border-b { border-bottom: 1px solid #e2e8f0; }
              .border-t { border-top: 1px solid #e2e8f0; }
              .border-t-2 { border-top: 2px solid #0f172a; }
              .border-dashed { border-style: dashed !important; }
              .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
              .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
              .my-4 { margin-top: 1rem; margin-bottom: 1rem; }
              .mb-4 { margin-bottom: 1rem; }
              .mb-2 { margin-bottom: 0.5rem; }
              .mb-6 { margin-bottom: 1.5rem; }
              .mt-6 { margin-top: 1.5rem; }
              .grid { display: grid; }
              .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
              .font-bold { font-weight: 700; }
              .font-black { font-weight: 900; }
              .font-medium { font-weight: 500; }
              .font-mono { font-family: 'JetBrains Mono', monospace; }
              .text-xs { font-size: 0.75rem; }
              .text-sm { font-size: 0.875rem; }
              .text-base { font-size: 1rem; }
              .text-lg { font-size: 1.125rem; }
              .text-xl { font-size: 1.25rem; }
              .text-2xl { font-size: 1.5rem; }
              .text-3xl { font-size: 1.875rem; }
              .uppercase { text-transform: uppercase; }
              .tracking-widest { letter-spacing: 0.1em; }
              .tracking-tighter { letter-spacing: -0.05em; }
              .text-gray-400 { color: #94a3b8; }
              .text-gray-500 { color: #64748b; }
              .text-slate-500 { color: #64748b; }
              .text-blue-600 { color: #2563eb; }
              .text-green-600 { color: #16a34a; }
              .text-red-500 { color: #ef4444; }
              .text-red-600 { color: #dc2626; }
              
              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 1.5rem;
                margin-bottom: 1.5rem;
              }
              th {
                text-align: left;
                padding: 12px 16px;
                border-bottom: 2px solid #e2e8f0;
                color: #475569;
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                font-weight: 700;
              }
              td {
                padding: 12px 16px;
                border-bottom: 1px solid #f1f5f9;
                font-size: 13px;
                color: #1e293b;
              }
              .bg-slate-50 {
                background-color: #f8fafc;
              }
              .p-4 {
                padding: 1rem;
              }
              .rounded-xl {
                border-radius: 0.75rem;
              }
              .space-y-2 > * + * {
                margin-top: 0.5rem;
              }
              .space-y-3 > * + * {
                margin-top: 0.75rem;
              }
              
              @media print {
                body {
                  padding: 0;
                  background-color: transparent;
                }
              }
            </style>
          </head>
          <body>
            <div class="invoice-card">
              ${printContent}
            </div>
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleDownloadPDF = () => {
    onDownloadPDF();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Box */}
      <div className="relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header toolbar */}
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
              <Receipt className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white leading-none">Pre-flight Link & PDF Preview</h2>
              <p className="text-xs text-slate-500 mt-1">Review the ledger outputs and tax structures accurately before submitting.</p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
            title="Close Preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body Split Layout */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 min-h-0">
          
          {/* Left Column: Virtual A4 Document Preview */}
          <div className="lg:col-span-8 flex flex-col items-center">
            <div className="w-full max-w-[800px] bg-slate-200 dark:bg-slate-950 p-4 md:p-6 rounded-2xl border border-slate-300 dark:border-slate-800 shadow-inner overflow-x-auto">
              
              {/* Virtual Printed Page Sheet */}
              <div 
                id="printable-preview-card"
                className="w-full min-w-[650px] bg-white text-slate-900 p-10 md:p-14 rounded-md shadow-lg font-sans relative aspect-[1/1.414]"
              >
                {/* PDF Watermark / Design elements */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-600" />

                {/* Corporate Info Header */}
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-black uppercase text-slate-900 tracking-tight font-sans">
                    {companyInfo.name || "IRONWORK MANAGER"}
                  </h1>
                  {companyInfo.address && (
                    <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed max-w-sm mx-auto">
                      {companyInfo.address}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-center gap-4 mt-2.5 text-xs text-slate-400 font-medium border-t border-slate-100 pt-2.5 max-w-md mx-auto">
                    {companyInfo.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {companyInfo.phone}
                      </span>
                    )}
                    {companyInfo.phone && companyInfo.email && <span className="text-slate-300">|</span>}
                    {companyInfo.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {companyInfo.email}
                      </span>
                    )}
                  </div>
                </div>

                <div className="border-b border-slate-200 my-6" />

                {/* Primary Identifiers */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-[10px] font-black tracking-widest uppercase text-slate-400 block mb-1">Invoice Reference</span>
                    <h2 className="text-lg font-black text-slate-900 font-mono">
                      {invoiceNumber}
                    </h2>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black tracking-widest uppercase text-slate-400 block mb-1">Issue Date</span>
                    <div className="flex items-center justify-end gap-1.5 font-bold text-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-blue-500" />
                      {new Date(invoiceDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                  </div>
                </div>

                {/* Customer Details Segment */}
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl mb-6">
                  <span className="text-[10px] font-black tracking-widest uppercase text-slate-400 block mb-2">Billed To Customer</span>
                  {selectedCustomer ? (
                    <div>
                      <p className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-500" />
                        {selectedCustomer.name}
                      </p>
                      <p className="text-xs text-slate-500 font-semibold mt-1">
                        Phone: {selectedCustomer.phone}
                      </p>
                    </div>
                  ) : (
                    <div className="text-sm font-semibold text-slate-400 italic">
                      No Customer Selected
                    </div>
                  )}
                </div>

                {/* Invoice Line Items */}
                <table className="w-full mb-6">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-3 px-4 text-left font-black text-slate-500 uppercase text-[10px] tracking-widest w-1/2">Item Description</th>
                      <th className="py-3 px-4 text-center font-black text-slate-500 uppercase text-[10px] tracking-widest">Qty</th>
                      <th className="py-3 px-4 text-right font-black text-slate-500 uppercase text-[10px] tracking-widest">Unit Price</th>
                      <th className="py-3 px-4 text-right font-black text-slate-500 uppercase text-[10px] tracking-widest">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {invoiceItems.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 text-sm font-bold text-slate-900 capitalize">{item.name}</td>
                        <td className="py-3 px-4 text-sm text-center font-bold text-slate-700 font-mono">
                          {item.quantity} <span className="text-[10px] text-slate-400 uppercase font-bold">{item.unitType}</span>
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-slate-600 font-mono">{formatCurrency(item.price)}</td>
                        <td className="py-3 px-4 text-sm text-right font-black text-slate-900 font-mono">{formatCurrency(item.price * item.quantity)}</td>
                      </tr>
                    ))}
                    {invoiceItems.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 italic text-sm">
                          Line items are empty. Add products from the sidebar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Summary & Ledger Balance Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 pb-4">
                  {/* Left Notes Area */}
                  <div className="text-[10px] text-slate-400 leading-relaxed pr-6 space-y-2">
                    <p className="font-bold text-slate-500 uppercase tracking-wider">Payment Terms & Agreement</p>
                    <p>All payments are strictly within 30 days. Fabricated metals or dynamic layouts cannot be returned once approved.</p>
                    <p className="pt-2">Thank you for your business!</p>
                  </div>

                  {/* Right Summaries Calculations */}
                  <div className="space-y-2 border-t md:border-t-0 md:border-l border-slate-100 md:pl-6">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-400 uppercase tracking-widest">Subtotal</span>
                      <span className="font-bold text-slate-800 font-mono">{formatCurrency(subtotal)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-400 uppercase tracking-widest">Discount</span>
                        <span className="font-bold text-red-500 font-mono">-{formatCurrency(discount)}</span>
                      </div>
                    )}
                    {taxRate > 0 && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-400 uppercase tracking-widest">Tax ({taxRate}%)</span>
                        <span className="font-bold text-blue-600 font-mono">{formatCurrency(taxAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center border-t border-dashed border-slate-200 pt-2 text-sm">
                      <span className="font-black text-slate-900 uppercase tracking-widest">Total Bill</span>
                      <span className="font-black text-blue-600 text-base font-mono">{formatCurrency(total)}</span>
                    </div>
                    
                    {/* Paid details */}
                    <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-2">
                      <span className="font-bold text-green-600 uppercase tracking-widest">Paid amount</span>
                      <span className="font-bold text-green-600 font-mono">{formatCurrency(paidAmount)}</span>
                    </div>
                    
                    {/* Remaining debt */}
                    <div className="flex justify-between items-center p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                      <span className="font-black text-red-500 uppercase tracking-widest">Pending Balance</span>
                      <span className="font-black text-red-600 font-mono">{formatCurrency(balance)}</span>
                    </div>
                  </div>
                </div>

                <div className="border-b border-dashed border-slate-200 my-8" />

                {/* Bottom Authorizations Marker */}
                <div className="flex justify-between items-end text-[10px] text-slate-400 font-bold mt-10">
                  <span>Powering Metal Fabrications & Ledger Integrity</span>
                  <div className="text-right">
                    <p className="border-b border-slate-300 w-44 pb-1 inline-block"></p>
                    <p className="mt-1">Authorised Signature</p>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Right Column: Interactive Actions Sidebar */}
          <div className="lg:col-span-4 space-y-6 flex flex-col justify-between">
            
            {/* Context Details Box */}
            <div className="space-y-6">
              <div className="bg-slate-50 dark:bg-slate-950/40 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 space-y-4">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-500" />
                  Pre-flight Diagnostics
                </h3>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-gray-500 dark:text-gray-400 font-semibold">Sequence Number:</span>
                    <span className="font-bold text-gray-900 dark:text-white font-mono">{invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-gray-500 dark:text-gray-400 font-semibold">Payment Method:</span>
                    <span className="font-bold text-gray-900 dark:text-white capitalize">{paymentMethod}</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-gray-500 dark:text-gray-400 font-semibold">Current Total:</span>
                    <span className="font-black text-blue-600 dark:text-blue-400 font-mono">{formatCurrency(total)}</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-gray-500 dark:text-gray-400 font-semibold">Paid Amount:</span>
                    <span className="font-bold text-green-600 dark:text-green-500 font-mono">{formatCurrency(paidAmount)}</span>
                  </div>
                </div>

                {balance > 0 && selectedCustomer && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/20 text-xs">
                    <p className="font-black text-red-500 uppercase tracking-widest mb-1">Ledger Notice</p>
                    <p className="text-slate-600 dark:text-slate-300 leading-normal font-medium">
                      An amount of <strong className="font-bold text-red-600">{formatCurrency(balance)}</strong> will be credited permanently to <strong>{selectedCustomer.name}</strong>'s profile debt ledger, bringing their accumulated outstanding to <strong className="font-bold text-red-600">{formatCurrency(balance + (selectedCustomer.balance || 0))}</strong>.
                    </p>
                  </div>
                )}
              </div>

              {/* Printing Controls Actions Group */}
              <div className="space-y-3">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Utility Outputs</span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={triggerBrowserPrint}
                    className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl text-[10px] uppercase tracking-widest font-black gap-2 text-slate-700 dark:text-slate-300 transition-all active:scale-95 group shadow-xs"
                    title="Send standard format to connected physical printer"
                  >
                    <Printer className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform" />
                    Print Layout
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl text-[10px] uppercase tracking-widest font-black gap-2 text-slate-700 dark:text-slate-300 transition-all active:scale-95 group shadow-xs"
                    title="Render High Quality PDF as saved on cloud servers"
                  >
                    <Download className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform" />
                    Download PDF
                  </button>
                </div>
              </div>
            </div>

            {/* Final Action Submission Pathway */}
            <div className="space-y-3 pt-6 border-t border-slate-100 dark:border-slate-800 mt-6 lg:mt-0">
              <button
                onClick={onConfirm}
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 transition-all active:scale-95 text-xs tracking-widest uppercase"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Finalizing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    CONFIRM & GENERATE INVOICE
                  </>
                )}
              </button>
              
              <button
                onClick={onClose}
                className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-extrabold py-3 rounded-2xl text-xs tracking-widest uppercase hover:bg-slate-200 dark:hover:bg-slate-750 transition-all active:scale-95"
              >
                EDIT LAYOUT & DETAILS
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
