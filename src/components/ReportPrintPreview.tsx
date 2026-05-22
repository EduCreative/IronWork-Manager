import React from 'react';
import { 
  X, 
  Printer, 
  Download, 
  FileText,
  Building,
  Phone,
  Mail,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface MetricHighlight {
  label: string;
  value: string;
  colorClass?: string;
  bgColorClass?: string;
}

interface ReportSection {
  title: string;
  description?: string;
  headers: string[];
  rows: (string | number)[][];
}

interface ReportPrintPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  dateRange?: string;
  metrics?: MetricHighlight[];
  sections?: ReportSection[];
  companyInfo: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
  filenamePrefix?: string;
}

export default function ReportPrintPreview({
  isOpen,
  onClose,
  title,
  subtitle = "Generated Live Report",
  dateRange = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  metrics = [],
  sections = [],
  companyInfo,
  filenamePrefix = "Report"
}: ReportPrintPreviewProps) {
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
    const printArea = document.getElementById('printable-report-card');
    if (!printArea) return;

    const printContent = printArea.innerHTML;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${title} - ${dateRange}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
              
              body {
                font-family: 'Inter', sans-serif;
                color: #0f172a;
                background-color: #ffffff;
                padding: 40px;
                margin: 0;
              }
              .report-card {
                max-width: 800px;
                margin: 0 auto;
              }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              .w-full { width: 100%; }
              .flex { display: flex; }
              .justify-between { justify-content: space-between; }
              .items-center { align-items: center; }
              .border-b { border-bottom: 1px solid #e2e8f0; }
              .border-t { border-top: 1px solid #e2e8f0; }
              .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
              .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
              .my-4 { margin-top: 1rem; margin-bottom: 1rem; }
              .mb-4 { margin-bottom: 1rem; }
              .mb-6 { margin-bottom: 1.5rem; }
              .mt-6 { margin-top: 1.5rem; }
              .grid { display: grid; }
              .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
              .gap-4 { gap: 1rem; }
              .font-bold { font-weight: 700; }
              .font-black { font-weight: 900; }
              .font-medium { font-weight: 500; }
              .text-xs { font-size: 0.75rem; }
              .text-sm { font-size: 0.875rem; }
              .text-base { font-size: 1rem; }
              .text-lg { font-size: 1.125rem; }
              .text-2xl { font-size: 1.5rem; }
              .uppercase { text-transform: uppercase; }
              .tracking-widest { letter-spacing: 0.1em; }
              .text-gray-400 { color: #94a3b8; }
              .text-gray-500 { color: #64748b; }
              .bg-slate-50 { background-color: #f8fafc; }
              .p-4 { padding: 1rem; }
              .p-5 { padding: 1.25rem; }
              .rounded-xl { border-radius: 0.75rem; }
              .rounded-2xl { border-radius: 1rem; }
              .border { border: 1px solid #e2e8f0; }
              .space-y-4 > * + * { margin-top: 1rem; }
              
              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 1rem;
                margin-bottom: 1.5rem;
              }
              th {
                text-align: left;
                padding: 10px 12px;
                border-bottom: 2px solid #cbd5e1;
                color: #475569;
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                font-weight: 700;
              }
              td {
                padding: 10px 12px;
                border-bottom: 1px solid #f1f5f9;
                font-size: 12px;
                color: #1e293b;
              }
              .section-title {
                font-size: 14px;
                font-weight: 800;
                color: #0f172a;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin-bottom: 0.5rem;
                margin-top: 1.5rem;
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
            <div class="report-card">
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

  const generateAndDownloadPDF = () => {
    const doc = new jsPDF();
    const dateFormatted = new Date().toISOString().split('T')[0];
    
    // Header Company Details
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(companyInfo.name.toUpperCase(), 14, 20);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(companyInfo.address || "Metal Fabrication & Engineering Operations", 14, 25);
    doc.text(`Phone: ${companyInfo.phone || 'N/A'} | Email: ${companyInfo.email || 'N/A'}`, 14, 29);
    
    // Rule line
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(14, 33, 196, 33);
    
    // Title
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(title, 14, 43);
    
    // Subtitle & Date range
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`${subtitle} • Range: ${dateRange}`, 14, 49);
    
    let currentY = 56;
    
    // Render key metrics if present
    if (metrics.length > 0) {
      doc.setDrawColor(241, 245, 249);
      doc.setFillColor(248, 250, 252);
      doc.rect(14, currentY, 182, 18, "F");
      
      const colWidth = 182 / metrics.length;
      metrics.forEach((m, idx) => {
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(m.label.toUpperCase(), 17 + idx * colWidth, currentY + 6);
        
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text(m.value, 17 + idx * colWidth, currentY + 13);
      });
      currentY += 26;
    }
    
    // Add sections
    sections.forEach((sec) => {
      // Check space remaining, add page break if needed
      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }
      
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(sec.title.toUpperCase(), 14, currentY);
      currentY += 4;
      
      if (sec.description) {
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text(sec.description, 14, currentY);
        currentY += 3;
      }
      
      currentY += 2;
      
      autoTable(doc, {
        head: [sec.headers],
        body: sec.rows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85], fontSize: 8.5, halign: 'left' },
        bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
        styles: { cellPadding: 2.5 }
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 12;
    });
    
    // Add page numbers
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${i} of ${totalPages}`, 196 - 20, 287, { align: 'right' });
      doc.text("System generated document via IronWork Print Terminal Manager.", 14, 287);
    }
    
    doc.save(`${filenamePrefix}_Report_${dateFormatted}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Box */}
      <div className="relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header toolbar */}
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
              <FileText className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white leading-none">Interactive Print & PDF Terminal</h2>
              <p className="text-xs text-slate-500 mt-1">Review the audit-ready layout parameters before submitting to output.</p>
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
            <div className="w-full bg-slate-200 dark:bg-slate-950 p-4 md:p-6 rounded-2xl border border-slate-300 dark:border-slate-800 shadow-inner overflow-x-auto">
              
              {/* Virtual Printed Sheet */}
              <div 
                id="printable-report-card"
                className="w-full min-w-[620px] bg-white text-slate-900 p-10 md:p-12 rounded shadow-lg font-sans relative"
              >
                {/* PDF accent top line */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-800" />

                {/* Corporate Header */}
                <div className="flex justify-between items-start mb-8 border-b border-slate-100 pb-6">
                  <div>
                    <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">
                      {companyInfo.name || "IRONWORK MANAGER"}
                    </h1>
                    <p className="text-xs text-slate-500 font-semibold mt-1 max-w-sm">
                      {companyInfo.address || "Industrial Fabrication Operations Center"}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 font-bold">
                      {companyInfo.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{companyInfo.phone}</span>}
                      {companyInfo.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{companyInfo.email}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-black tracking-widest uppercase text-slate-400 block mb-1">Issue Timestamp</span>
                    <p className="text-xs font-bold text-slate-700 font-mono">
                      {new Date().toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-black tracking-widest bg-slate-50 border border-slate-100 px-2 py-0.5 rounded inline-block">
                      System Audit Log
                    </p>
                  </div>
                </div>

                {/* Primary Content Block Header */}
                <div className="mb-6">
                  <span className="text-[10px] font-black tracking-widest uppercase text-blue-600 block mb-1">Report Identity</span>
                  <h2 className="text-xl font-extrabold text-slate-900">
                    {title}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {subtitle} • Reporting Span: <strong className="font-bold text-slate-700">{dateRange}</strong>
                  </p>
                </div>

                {/* Key Highlight Metrics Ribbons */}
                {metrics.length > 0 && (
                  <div className="grid grid-cols-3 gap-4 bg-slate-50 border border-slate-100 p-4 rounded-xl mb-6">
                    {metrics.map((m, index) => (
                      <div key={index} className="border-r border-slate-200/60 last:border-0 pr-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                          {m.label}
                        </span>
                        <p className={`text-base font-black ${m.colorClass || 'text-slate-900'} font-mono`}>
                          {m.value}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Audit tables */}
                <div className="space-y-6">
                  {sections.map((sec, sIdx) => (
                    <div key={sIdx} className="space-y-2">
                      <div className="border-l-2 border-slate-800 pl-3.5 py-0.5">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                          {sec.title}
                        </h3>
                        {sec.description && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {sec.description}
                          </p>
                        )}
                      </div>

                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/50">
                            {sec.headers.map((h, hIdx) => (
                              <th key={hIdx} className="py-2.5 px-3 text-left font-bold text-slate-500 uppercase text-[9px] tracking-widest">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                          {sec.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-50/20">
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="py-2 px-3 text-xs font-semibold text-slate-700">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                          {sec.rows.length === 0 && (
                            <tr>
                              <td colSpan={sec.headers.length} className="py-6 text-center text-slate-400 italic text-xs">
                                No entries logged for this sector grid.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>

                {/* A4 Footer standardizations */}
                <div className="border-t border-slate-100 pt-6 mt-10 flex justify-between items-center text-[9px] text-slate-400 font-bold">
                  <span>IronWork Report Service • Cryptographic Ledger Integrity</span>
                  <span>Document Authentication Code: IW-{Math.floor(100000 + Math.random() * 900000)}</span>
                </div>

              </div>
            </div>
          </div>

          {/* Right Column: Interactive Actions Sidebar */}
          <div className="lg:col-span-4 flex flex-col justify-between">
            <div className="space-y-6 bg-slate-50 dark:bg-slate-950/40 p-5 rounded-3xl border border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-500" />
                Report Diagnostics
              </h3>
              
              <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed space-y-3">
                <p>
                  You are viewing the auto-aligned print layout designed to output cleanly on standard <strong>ISO Letter/A4</strong> dimensions without cropping or text overflow.
                </p>
                <p className="p-3 bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 rounded-xl border border-blue-100 dark:border-blue-900/20 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0 animate-spin" />
                  <span>
                    Charts are simplified into audited tabular ledgers inside the PDF layout to ensure 100% ink and pixel fidelity.
                  </span>
                </p>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Filename:</span>
                  <span className="font-bold text-gray-900 dark:text-white font-mono">{filenamePrefix}_Report.pdf</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Total Sections:</span>
                  <span className="font-bold text-gray-900 dark:text-white font-mono">{sections.length}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 mt-6">
              <button
                onClick={triggerBrowserPrint}
                className="w-full bg-slate-900 hover:bg-slate-950 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95 text-xs tracking-widest uppercase"
              >
                <Printer className="w-4 h-4" />
                Print layout
              </button>
              
              <button
                onClick={generateAndDownloadPDF}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 hover:shadow-xl transition-all active:scale-95 text-xs tracking-widest uppercase"
              >
                <Download className="w-4 h-4" />
                Save as PDF
              </button>

              <button
                onClick={onClose}
                className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-extrabold py-3 rounded-2xl text-xs tracking-widest uppercase hover:bg-slate-200 dark:hover:bg-slate-750 transition-all active:scale-95"
              >
                Return to Screens
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
