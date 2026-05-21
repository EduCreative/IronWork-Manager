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
  PieChart
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { formatCurrency as baseFormatCurrency, formatDate, cn } from '../lib/utils';
import { Bar, Pie } from 'react-chartjs-2';
import { useCurrency } from '../hooks/useCurrency';

export default function Reports() {
  const { formatCurrency } = useCurrency();
  const [loading, setLoading] = React.useState(true);
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

  React.useEffect(() => {
     // Mock async data load
     setTimeout(() => setLoading(false), 800);
  }, []);

  const barData = {
    labels: ['Sales', 'Expenses', 'Purchases', 'Profit'],
    datasets: [{
      label: 'Financial Performance',
      data: [45000, 12000, 25000, 33000],
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
