import React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Users, 
  Calendar,
  Download,
  Filter,
  PieChart,
  Printer,
  CreditCard
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { formatCurrency as baseFormatCurrency, formatDate, cn, safeToDate } from '../lib/utils';
import { Bar, Pie } from 'react-chartjs-2';
import { useCurrency } from '../hooks/useCurrency';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function Reports() {
  const { formatCurrency } = useCurrency();
  const [loading, setLoading] = React.useState(true);
  const [expenses, setExpenses] = React.useState<any[]>([]);
  const [data, setData] = React.useState<any>({
    totalSales: 45000,
    totalExpenses: 12000,
    netProfit: 33000,
    customerDebts: 28000,
    stockValue: 154000,
    topProducts: [
      { name: 'MS Pipe 1x1', sales: 1200 },
      { name: 'Iron Sheet 2mm', sales: 950 },
      { name: 'Steel Rod 12mm', sales: 800 },
    ]
  });

  // Calculate the last 6 months (chronological)
  const trendMonths = React.useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ label, value });
    }
    return months;
  }, []);

  const getExpenseMonth = (expense: any) => {
    if (!expense.createdAt) return '';
    const dateObj = safeToDate(expense.createdAt);
    if (!dateObj) return '';
    return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
  };

  React.useEffect(() => {
     const fetchReportsData = async () => {
       setLoading(true);
       try {
         // 1. Fetch real expenses
         const expensesSnap = await getDocs(collection(db, 'expenses'));
         const expensesList = expensesSnap.docs.map(doc => {
           const d = doc.data();
           return {
             id: doc.id,
             ...d
           };
         });
         setExpenses(expensesList);

         const calculatedExpenses = (expensesList as any[]).reduce((acc, curr: any) => acc + (curr.amount || 0), 0);

         // 2. Fetch real invoices
         const invoicesSnap = await getDocs(collection(db, 'invoices'));
         const invoicesList = invoicesSnap.docs.map(doc => doc.data());
         const calculatedSales = invoicesList.reduce((acc, curr) => acc + (curr.total || 0), 0);
         const calculatedDebts = invoicesList.reduce((acc, curr) => acc + (curr.balance || 0), 0);

         // 3. Fetch products for stock value
         const productsSnap = await getDocs(collection(db, 'products'));
         const productsList = productsSnap.docs.map(doc => doc.data());
         const calculatedStockVal = productsList.reduce((acc, curr) => {
           const stock = curr.currentStock || 0;
           const cost = curr.unitPrice || curr.price || 0;
           return acc + (stock * cost);
         }, 0);

         setData((prev: any) => ({
           ...prev,
           totalSales: calculatedSales > 0 ? calculatedSales : prev.totalSales,
           totalExpenses: calculatedExpenses > 0 ? calculatedExpenses : prev.totalExpenses,
           netProfit: (calculatedSales > 0 ? calculatedSales : prev.totalSales) - (calculatedExpenses > 0 ? calculatedExpenses : prev.totalExpenses),
           customerDebts: calculatedDebts > 0 ? calculatedDebts : prev.customerDebts,
           stockValue: calculatedStockVal > 0 ? calculatedStockVal : prev.stockValue
         }));

       } catch (error) {
         console.error("Error fetching data for Reports page:", error);
       } finally {
         setLoading(false);
       }
     };

     fetchReportsData();
  }, []);

  const hasRealExpenses = expenses.length > 0;

  const expenseCategories = [
    'Fuel', 'Electricity', 'Labor', 'Transport', 'Internet', 'Refreshment', 'Office Supplies', 'Maintenance', 'Miscellaneous/Others'
  ];

  const categoryColors: { [key: string]: string } = {
    'Fuel': 'rgba(239, 68, 68, 0.75)',
    'Electricity': 'rgba(245, 158, 11, 0.75)',
    'Labor': 'rgba(16, 185, 129, 0.75)',
    'Transport': 'rgba(59, 130, 246, 0.75)',
    'Internet': 'rgba(99, 102, 241, 0.75)',
    'Refreshment': 'rgba(168, 85, 247, 0.75)',
    'Office Supplies': 'rgba(236, 72, 153, 0.75)',
    'Maintenance': 'rgba(20, 184, 166, 0.75)',
    'Miscellaneous/Others': 'rgba(107, 114, 128, 0.75)'
  };

  const categoryHoverColors: { [key: string]: string } = {
    'Fuel': 'rgba(239, 68, 68, 0.95)',
    'Electricity': 'rgba(245, 158, 11, 0.95)',
    'Labor': 'rgba(16, 185, 129, 0.95)',
    'Transport': 'rgba(59, 130, 246, 0.95)',
    'Internet': 'rgba(99, 102, 241, 0.95)',
    'Refreshment': 'rgba(168, 85, 247, 0.95)',
    'Office Supplies': 'rgba(236, 72, 153, 0.95)',
    'Maintenance': 'rgba(20, 184, 166, 0.95)',
    'Miscellaneous/Others': 'rgba(107, 114, 128, 0.95)'
  };

  const datasets = expenseCategories.map(cat => {
    const dataForMonths = trendMonths.map(monthObj => {
      if (hasRealExpenses) {
        return expenses
          .filter(e => e.category === cat && getExpenseMonth(e) === monthObj.value)
          .reduce((sum, e) => sum + (e.amount || 0), 0);
      } else {
        const mockMap: { [key: string]: number[] } = {
          'Fuel': [300, 310, 290, 410, 380, 420],
          'Electricity': [1200, 1400, 1100, 1500, 1600, 1800],
          'Labor': [5000, 5200, 5000, 5400, 5800, 6000],
          'Transport': [800, 750, 900, 1050, 950, 1100],
          'Internet': [150, 150, 150, 150, 155, 155],
          'Refreshment': [250, 300, 280, 320, 350, 400],
          'Office Supplies': [100, 50, 120, 80, 140, 90],
          'Maintenance': [450, 200, 150, 600, 300, 450],
          'Miscellaneous/Others': [200, 150, 300, 250, 200, 150]
        };
        const idx = trendMonths.findIndex(m => m.value === monthObj.value);
        return mockMap[cat] ? mockMap[cat][idx] || 0 : 0;
      }
    });

    return {
      label: cat,
      data: dataForMonths,
      backgroundColor: categoryColors[cat] || 'rgba(107, 114, 128, 0.7)',
      hoverBackgroundColor: categoryHoverColors[cat] || 'rgba(107, 114, 128, 0.9)',
      borderRadius: 4
    };
  });

  const stackedBarData = {
    labels: trendMonths.map(m => m.label),
    datasets: datasets
  };

  const stackedBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 15,
          color: 'rgba(156, 163, 175, 1)',
          font: {
            family: 'Inter',
            size: 11,
            weight: 'bold' as const
          }
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#fff',
        bodyColor: '#cbd5e1',
        titleFont: { family: 'Inter', size: 12, weight: 'bold' as const },
        bodyFont: { family: 'Inter', size: 12 },
        padding: 12,
        borderRadius: 12,
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += formatCurrency(context.parsed.y);
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: {
          display: false
        },
        ticks: {
          color: 'rgba(156, 163, 175, 1)',
          font: {
            family: 'Inter',
            size: 11
          }
        }
      },
      y: {
        stacked: true,
        border: {
          dash: [4, 4]
        },
        grid: {
          color: 'rgba(156, 163, 175, 0.1)'
        },
        ticks: {
          color: 'rgba(156, 163, 175, 1)',
          font: {
            family: 'Inter',
            size: 11
          },
          callback: function(value: any) {
            return formatCurrency(value);
          }
        }
      }
    }
  };

  const barData = {
    labels: ['Sales', 'Expenses', 'Purchases', 'Profit'],
    datasets: [{
      label: 'Financial Performance',
      data: [data.totalSales, data.totalExpenses, data.totalExpenses * 1.5, data.netProfit],
      backgroundColor: [
        'rgba(59, 130, 246, 0.6)',
        'rgba(239, 68, 68, 0.6)',
        'rgba(245, 158, 11, 0.6)',
        'rgba(16, 185, 129, 0.6)',
      ],
      borderRadius: 8
    }]
  };

  const pieData = {
    labels: ['Paid', 'Pending', 'Partial'],
    datasets: [{
      data: [65, 20, 15],
      backgroundColor: [
        'rgba(16, 185, 129, 0.6)',
        'rgba(245, 158, 11, 0.6)',
        'rgba(239, 68, 68, 0.6)',
      ]
    }]
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold dark:text-white">Financial & Analytics Reports</h1>
          <p className="text-gray-500 dark:text-gray-400">Deep dive into your fabrication business metrics.</p>
        </div>
        <div className="flex gap-2">
           <button 
             className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
             title="Change report time range"
           >
             <Calendar className="w-4 h-4" />
             This Month
           </button>
           <button 
             onClick={() => window.print()}
             className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold shadow-sm transition-all hover:scale-[1.02]"
             title="Print report"
           >
             <Printer className="w-4 h-4" />
             Print Report
           </button>
           <button 
             className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02]"
             title="Export all financial data to CSV"
           >
             <Download className="w-4 h-4" />
             Export All
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-6 rounded-2xl shadow-sm">
           <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-blue-500 uppercase tracking-widest">Total Sales</span>
              <TrendingUp className="w-5 h-5 text-green-500" />
           </div>
           <p className="text-3xl font-bold dark:text-white">{formatCurrency(data.totalSales)}</p>
           <p className="text-xs text-gray-400 mt-2">Gross revenue across all channels</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-6 rounded-2xl shadow-sm">
           <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-red-500 uppercase tracking-widest">Net Profit</span>
              <TrendingDown className="w-5 h-5 text-red-500" />
           </div>
           <p className="text-3xl font-bold dark:text-white">{formatCurrency(data.netProfit)}</p>
           <p className="text-xs text-gray-400 mt-2">After deducting costs and expenses</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-6 rounded-2xl shadow-sm">
           <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">Stock Value</span>
              <PieChart className="w-5 h-5 text-amber-500" />
           </div>
           <p className="text-3xl font-bold dark:text-white">{formatCurrency(data.stockValue)}</p>
           <p className="text-xs text-gray-400 mt-2">Invested capital in inventory</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-8 rounded-3xl shadow-sm">
            <h3 className="text-xl font-bold dark:text-white mb-10 flex items-center gap-3">
              <BarChart3 className="text-blue-500" />
              Financial Breakdown
            </h3>
            <div className="h-80">
               <Bar data={barData} options={{ maintainAspectRatio: false }} />
            </div>
         </div>

         <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-8 rounded-3xl shadow-sm">
            <h3 className="text-xl font-bold dark:text-white mb-10">Sales Payment Status</h3>
            <div className="h-60 flex justify-center">
               <Pie data={pieData} />
            </div>
            <div className="mt-10 grid grid-cols-2 gap-4">
               <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-500 uppercase font-bold mb-1">Outstanding Debt</p>
                  <p className="text-xl font-bold text-red-500">{formatCurrency(data.customerDebts)}</p>
               </div>
               <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-500 uppercase font-bold mb-1">Top Selling</p>
                  <p className="text-xl font-bold dark:text-white">MS Pipes</p>
               </div>
            </div>
         </div>
      </div>

      {/* Expenses Analysis Component */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-8 rounded-3xl shadow-sm">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
               <h3 className="text-xl font-bold dark:text-white flex items-center gap-3">
                 <CreditCard className="text-red-500 w-6 h-6" />
                 Expenses Analysis
               </h3>
               <p className="text-xs text-gray-400 mt-1">Monthly cost allocation and category trend breakdown over the last 6 months.</p>
            </div>
            
            <div className="flex items-center gap-2">
               <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                  <span className={cn("w-1.5 h-1.5 rounded-full", hasRealExpenses ? "bg-green-500 animate-pulse" : "bg-amber-500")} />
                  {hasRealExpenses ? 'Live Firestore Analytics' : 'Projections & Sample History'}
               </span>
            </div>
         </div>

         <div className="h-96 w-full print:h-80">
            <Bar data={stackedBarData} options={stackedBarOptions} />
         </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm">
         <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h3 className="text-xl font-bold dark:text-white">Recent Stock Movements</h3>
            <button 
              className="text-blue-500 text-sm font-bold hover:underline"
              title="View full history of stock changes"
            >
              View History
            </button>
         </div>
         <div className="p-4 overflow-x-auto text-sm">
            <table className="w-full text-left">
               <thead>
                  <tr className="text-gray-400 font-bold border-b border-gray-100 dark:border-gray-800">
                     <th className="p-4">Item</th>
                     <th className="p-4">Action</th>
                     <th className="p-4">Qty</th>
                     <th className="p-4">Reference</th>
                     <th className="p-4">Timestamp</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {[
                    { item: 'MS Pipe 1x1', action: 'Inbound', qty: '+50', ref: 'PUR-8822', date: '2026-04-30 10:20' },
                    { item: 'Steel Rod 12mm', action: 'Outbound', qty: '-12', ref: 'INV-3321', date: '2026-04-30 08:45' },
                    { item: 'Iron Sheet 2mm', action: 'Outbound', qty: '-4', ref: 'INV-3320', date: '2026-04-29 16:12' },
                  ].map((m, i) => (
                    <tr key={i} className="dark:text-gray-300">
                       <td className="p-4 font-bold dark:text-white">{m.item}</td>
                       <td className="p-4">
                          <span className={cn("px-2 py-1 rounded text-[10px] font-bold uppercase", m.action === 'Inbound' ? 'bg-green-100 text-green-700 dark:bg-green-900/20' : 'bg-red-100 text-red-700 dark:bg-red-900/20')}>
                             {m.action}
                          </span>
                       </td>
                       <td className={cn("p-4 font-mono", m.qty.startsWith('+') ? 'text-green-500' : 'text-red-500')}>{m.qty}</td>
                       <td className="p-4 opacity-50">{m.ref}</td>
                       <td className="p-4 opacity-50">{m.date}</td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}
