import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  AlertTriangle, 
  DollarSign, 
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  FileDown,
  Printer
} from 'lucide-react';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend, 
  ArcElement,
  BarElement
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { db } from '../lib/firebase';
import { collection, query, getDocs, limit, orderBy, where } from 'firebase/firestore';
import { formatCurrency as baseFormatCurrency, cn, safeToDate } from '../lib/utils';
import { useCurrency } from '../hooks/useCurrency';
import { useNavigate } from 'react-router-dom';
import { useConfig } from '../context/ConfigContext';
import ReportPrintPreview from '../components/ReportPrintPreview';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function Dashboard() {
  const { formatCurrency } = useCurrency();
  const { companyName, companyAddress, companyPhone, companyEmail } = useConfig();
  const [showPreview, setShowPreview] = React.useState(false);
  const navigate = useNavigate();
  const [stats, setStats] = React.useState<any>({
    todaySales: 0,
    monthlySales: 0,
    pendingPayments: 0,
    totalExpenses: 0,
    stockValue: 0,
    lowStockItems: 0,
    amountReceivables: 0,
    amountPayables: 0,
    recentInvoices: [],
    salesHistory: [],
    expenseDistribution: {}
  });
  const [loading, setLoading] = React.useState(true);
  const [timeRange, setTimeRange] = React.useState('3'); // Default 3 months
  const [isDarkMode, setIsDarkMode] = React.useState(() => document.documentElement.classList.contains('dark'));

  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const [
          invoicesSnap, 
          customersSnap, 
          suppliersSnap, 
          productsSnap,
          expensesSnap
        ] = await Promise.all([
          getDocs(query(collection(db, 'invoices'), orderBy('createdAt', 'desc'))),
          getDocs(collection(db, 'customers')),
          getDocs(collection(db, 'suppliers')),
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'expenses'))
        ]);

        const allInvoices = invoicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const allExpenses = expensesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Aggregate Sales for Charts
        const monthsCount = parseInt(timeRange);
        const salesByMonth: { [key: string]: number } = {};
        const labels: string[] = [];

        for (let i = monthsCount - 1; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthLabel = d.toLocaleString('default', { month: 'short' });
          labels.push(monthLabel);
          salesByMonth[monthLabel] = 0;
        }

        allInvoices.forEach((inv: any) => {
          const date = safeToDate(inv.createdAt);
          const monthLabel = date.toLocaleString('default', { month: 'short' });
          if (salesByMonth[monthLabel] !== undefined) {
            salesByMonth[monthLabel] += (inv.total || 0);
          }
        });

        // Expenses Distribution
        const expenseDist: { [key: string]: number } = {};
        allExpenses.forEach((exp: any) => {
          const cat = exp.category || 'Other';
          expenseDist[cat] = (expenseDist[cat] || 0) + (exp.amount || 0);
        });

        const recentInvoices = allInvoices.slice(0, 5).map((inv: any) => ({
          ...inv,
          customer: inv.customerName,
          number: inv.invoiceNumber,
          amount: inv.total,
          date: safeToDate(inv.createdAt).toLocaleDateString()
        }));

        const todaySales = allInvoices
          .filter((inv: any) => safeToDate(inv.createdAt) >= startOfToday)
          .reduce((acc: number, inv: any) => acc + (inv.total || 0), 0);

        const monthlySales = allInvoices
          .filter((inv: any) => safeToDate(inv.createdAt) >= startOfMonth)
          .reduce((acc: number, inv: any) => acc + (inv.total || 0), 0);

        const totalReceivables = customersSnap.docs.reduce((acc, doc) => acc + (doc.data().balance || 0), 0);
        const totalPayables = suppliersSnap.docs.reduce((acc, doc) => acc + (doc.data().balance || 0), 0);
        const lowStockItems = productsSnap.docs.filter(doc => doc.data().currentStock <= doc.data().minStock).length;
        const stockValue = productsSnap.docs.reduce((acc, doc) => acc + (doc.data().currentStock * doc.data().purchasePrice), 0);

        setStats({
          todaySales,
          monthlySales,
          pendingPayments: totalReceivables,
          totalExpenses: allExpenses.reduce((acc: number, exp: any) => acc + (exp.amount || 0), 0),
          stockValue,
          lowStockItems,
          amountReceivables: totalReceivables,
          amountPayables: totalPayables,
          recentInvoices,
          salesHistory: labels.map(l => salesByMonth[l]),
          labels,
          expenseDistribution: expenseDist
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [timeRange]);

  const handleExportReport = () => {
    const csvContent = [
      ['Report Name', `${companyName} Business Overview`],
      ['Export Date', new Date().toLocaleString()],
      [''],
      ['Key Metrics'],
      ['Today Sales', stats.todaySales],
      ['Monthly Sales', stats.monthlySales],
      ['Total Receivables', stats.amountReceivables],
      ['Total Payables', stats.amountPayables],
      ['Stock Value', stats.stockValue],
      ['Low Stock Items', stats.lowStockItems],
      [''],
      ['Recent Sales'],
      ['Invoice #', 'Customer', 'Amount', 'Status', 'Date'],
      ...stats.recentInvoices.map((inv: any) => [
        inv.number,
        inv.customer,
        inv.total,
        inv.status,
        inv.date
      ])
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const sanitizedFileName = companyName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    link.setAttribute("download", `${sanitizedFileName}_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-500 font-medium animate-pulse">Analyzing business metrics...</p>
    </div>
  );

  const salesData = {
    labels: stats.labels,
    datasets: [
      {
        label: 'Sales Revenue',
        data: stats.salesHistory,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: '#fff',
        pointBorderColor: 'rgb(59, 130, 246)',
        pointBorderWidth: 2
      }
    ]
  };

  const expenseData = {
    labels: Object.keys(stats.expenseDistribution),
    datasets: [
      {
        label: 'Expense Distribution',
        data: Object.values(stats.expenseDistribution),
        backgroundColor: [
          'rgba(239, 68, 68, 0.7)',
          'rgba(59, 130, 246, 0.7)',
          'rgba(245, 158, 11, 0.7)',
          'rgba(16, 185, 129, 0.7)',
          'rgba(139, 92, 246, 0.7)',
          'rgba(236, 72, 153, 0.7)',
        ],
        borderWidth: 0
      }
    ]
  };

  const statCards = [
    { title: 'Today\'s Sales', value: formatCurrency(stats.todaySales), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/40', trend: '+12%' },
    { title: 'Monthly Sales', value: formatCurrency(stats.monthlySales), icon: ArrowUpRight, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/40', trend: '+8%' },
    { title: 'Pending Payments', value: formatCurrency(stats.pendingPayments), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/40', trend: '-2%' },
    { title: 'Amount Receivables', value: formatCurrency(stats.amountReceivables), icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/40', trend: '+5%' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Business Overview</h1>
          <p className="text-gray-500 dark:text-gray-400">Welcome back to {companyName} Control Center.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold shadow-sm transition-all hover:scale-[1.02]"
            title="Open report print preview"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
          <button 
            onClick={() => navigate('/invoices', { state: { openCreator: true } })}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
            title="Create a new sales invoice"
          >
            New Invoice
          </button>
        </div>
      </div>

      {/* Low Stock Alert Banner */}
      {stats.lowStockItems > 0 && (
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/30 rounded-3xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex gap-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-2xl flex-shrink-0 self-start md:self-center">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-amber-800 dark:text-amber-400">Low Stock Alert</h2>
              <p className="text-xs text-amber-700 dark:text-amber-500 mt-1 font-medium">
                There are <span className="font-extrabold">{stats.lowStockItems}</span> item{stats.lowStockItems > 1 ? 's' : ''} at or below their defined minimum stock level. Please review to prevent raw material and fabrication bottlenecks.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/inventory')}
            className="w-full md:w-auto px-4 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-lg shadow-amber-600/10 transition-all flex items-center justify-center gap-2 whitespace-nowrap self-stretch md:self-auto cursor-pointer"
            title="Go to Inventory page"
          >
            Review Inventory
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-theme-card p-6 rounded-3xl border border-theme-border shadow-sm transition-all hover:scale-[1.02] hover:shadow-md">
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-3 rounded-2xl", stat.bg)}>
                <stat.icon className={cn("w-6 h-6", stat.color)} />
              </div>
              <span className={cn("text-xs font-bold px-3 py-1 rounded-full", 
                stat.trend.startsWith('+') ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-500" : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-500"
              )}>
                {stat.trend}
              </span>
            </div>
            <h3 className="text-gray-400 dark:text-gray-500 text-[11px] font-bold uppercase tracking-wider mb-1">{stat.title}</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-theme-card p-8 rounded-3xl border border-theme-border shadow-sm transition-all">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Sales Performance</h3>
            <select 
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-sm px-4 py-2 outline-none text-gray-600 dark:text-gray-300 cursor-pointer font-black"
            >
              <option value="3">Last 3 Months</option>
              <option value="6">Last 6 Months</option>
              <option value="12">Last Year</option>
            </select>
          </div>
          <div className="h-[300px]">
            <Line data={salesData} options={{ 
              maintainAspectRatio: false, 
              plugins: { legend: { display: false } },
              scales: {
                y: { 
                  grid: { color: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }, 
                  ticks: { color: isDarkMode ? '#6B7280' : '#9CA3AF', font: { weight: 'bold', size: 10 } } 
                },
                x: { 
                  grid: { display: false }, 
                  ticks: { color: isDarkMode ? '#6B7280' : '#9CA3AF', font: { weight: 'bold', size: 10 } } 
                }
              }
            }} />
          </div>
        </div>

        <div className="bg-theme-card p-8 rounded-3xl border border-theme-border shadow-sm transition-all">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-8">Expense Distribution</h3>
          <div className="h-[250px] flex items-center justify-center">
            <Doughnut data={expenseData} options={{ 
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: { 
                    color: isDarkMode ? '#9CA3AF' : '#4B5563',
                    padding: 20,
                    font: { size: 11, weight: 'bold' },
                    usePointStyle: true
                  }
                }
              }
            }} />
          </div>
          <div className="mt-8 space-y-4">
             <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Stock Value</span>
                <span className="text-sm font-black text-gray-900 dark:text-white">{formatCurrency(stats.stockValue)}</span>
             </div>
             <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 rounded-xl">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Low Stock</span>
                <span className="text-sm font-black text-red-600 dark:text-red-500">{stats.lowStockItems} Items</span>
             </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-theme-card rounded-3xl border border-theme-border shadow-sm overflow-hidden transition-all">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Invoices</h3>
          <button 
            onClick={() => navigate('/invoices')}
            className="text-blue-600 text-sm font-bold hover:underline underline-offset-4"
          >
            View All Invoices
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Invoice #</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {stats.recentInvoices.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{inv.number}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{inv.customer}</td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(inv.amount)}</td>
                  <td className="px-6 py-4">
                    <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                      inv.status === 'paid' ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-500" :
                      inv.status === 'partial' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-500" :
                      "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-500"
                    )}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{inv.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ReportPrintPreview
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title="Business Overview Audit Report"
        subtitle={`${companyName} System Overview Executive Summary`}
        filenamePrefix="Business_Overview"
        metrics={[
          { label: "Month Sales", value: formatCurrency(stats.monthlySales), colorClass: "text-blue-600" },
          { label: "Unpaid Balance", value: formatCurrency(stats.pendingPayments), colorClass: "text-amber-600" },
          { label: "Assets Value", value: formatCurrency(stats.stockValue), colorClass: "text-green-600" }
        ]}
        sections={[
          {
            title: "Executive Key Operational KPIs",
            description: "Aggregated performance indices across current ranges",
            headers: ["Business Dimension Sector", "Audited Value Status"],
            rows: [
              ["Today's Emitted Sales Volume", formatCurrency(stats.todaySales)],
              ["Running Month Sales Ledger", formatCurrency(stats.monthlySales)],
              ["Outstanding Client Receivables", formatCurrency(stats.amountReceivables)],
              ["Outstanding Supplier Payables", formatCurrency(stats.amountPayables)],
              ["Total Raw Inventory Value Asset", formatCurrency(stats.stockValue)],
              ["Deficient Low Stock Warnings", `${stats.lowStockItems} Items flagged`]
            ]
          },
          {
            title: "Recent Sales Transactions Audit Trail",
            description: "Chronological ledger record of custom invoices processed",
            headers: ["Invoice #", "Customer Name", "Total Amount", "Fulfillment Status", "Emanated Date"],
            rows: stats.recentInvoices.map((inv: any) => [
              inv.number || "N/A",
              inv.customer || "Walk-in Customer",
              formatCurrency(inv.amount),
              (inv.status || "unpaid").toUpperCase(),
              inv.date || "N/A"
            ])
          }
        ]}
        companyInfo={{
          name: companyName,
          address: companyAddress,
          phone: companyPhone,
          email: companyEmail
        }}
      />
    </div>
  );
}
