import React from 'react';
import { 
  Package, 
  Search, 
  Filter, 
  Plus, 
  MoreVertical, 
  History, 
  ArrowUpCircle, 
  ArrowDownCircle,
  AlertCircle,
  Edit,
  Trash2,
  FileDown
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../lib/firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where,
  serverTimestamp 
} from 'firebase/firestore';
import { formatCurrency as baseFormatCurrency, cn, OperationType, handleFirestoreError, logActivity } from '../lib/utils';
import { useCurrency } from '../hooks/useCurrency';
import { useConfig } from '../context/ConfigContext';

export default function Inventory() {
  const { formatCurrency } = useCurrency();
  const { companyName, companyAddress, companyPhone, companyEmail } = useConfig();
  const [products, setProducts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState('All');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<any>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Form State
  const [formData, setFormData] = React.useState({
    name: '',
    code: '',
    category: '',
    type: 'raw' as 'raw' | 'finished' | 'service',
    unitType: 'kg',
    purchasePrice: 0,
    salePrice: 0,
    labourCharges: 0,
    currentStock: 0,
    minStock: 0,
    bom: [] as { productId: string, quantity: number }[]
  });

  const categories = ['All', 'MS Pipes', 'Iron Sheets', 'Steel Rods', 'Angles', 'Channels', 'Flats'];

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const q = collection(db, 'products');
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'products');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchProducts();
  }, []);

  const totalBOMCost = React.useMemo(() => {
    return formData.bom.reduce((sum, item) => {
      const rawProd = products.find(p => p.id === item.productId);
      return sum + (item.quantity * (rawProd?.purchasePrice || 0));
    }, 0);
  }, [formData.bom, products]);

  const totalManufacturingCost = totalBOMCost + formData.labourCharges;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        await logActivity('INVENTORY_UPDATE', `Updated product: ${formData.name}`, { productId: editingProduct.id });
      } else {
        const docRef = await addDoc(collection(db, 'products'), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        await logActivity('INVENTORY_CREATE', `Added new product: ${formData.name}`, { productId: docRef.id });
      }
      setIsModalOpen(false);
      setEditingProduct(null);
      setFormData({ 
        name: '', 
        code: '', 
        category: '', 
        type: 'raw',
        unitType: 'kg', 
        purchasePrice: 0, 
        salePrice: 0, 
        labourCharges: 0,
        currentStock: 0, 
        minStock: 0,
        bom: []
      });
      fetchProducts();
    } catch (error) {
      handleFirestoreError(error, editingProduct ? OperationType.UPDATE : OperationType.CREATE, 'products');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      code: product.code,
      category: product.category,
      type: product.type || 'raw',
      unitType: product.unitType,
      purchasePrice: product.purchasePrice,
      salePrice: product.salePrice,
      labourCharges: product.labourCharges || 0,
      currentStock: product.currentStock,
      minStock: product.minStock,
      bom: product.bom || []
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const productToDelete = products.find(p => p.id === id);
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteDoc(doc(db, 'products', id));
        await logActivity('INVENTORY_DELETE', `Deleted product: ${productToDelete?.name}`, { productId: id });
        fetchProducts();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'products');
      }
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const generatePDF = () => {
    const doc = new jsPDF();
    const reportTitle = "CURRENT INVENTORY STATUS REPORT";
    const dateStr = new Date().toLocaleString();

    // Company Header
    doc.setFontSize(22);
    doc.setTextColor(37, 99, 235); // Blue-600
    doc.setFont(undefined, 'bold');
    doc.text(companyName.toUpperCase(), 105, 18, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    
    let headerY = 24;
    if (companyAddress) {
      doc.text(companyAddress, 105, headerY, { align: 'center' });
      headerY += 5;
    }
    
    const contactInfo = [
      companyPhone ? `Phone: ${companyPhone}` : null,
      companyEmail ? `Email: ${companyEmail}` : null
    ].filter(Boolean).join('  |  ');
    
    if (contactInfo) {
      doc.text(contactInfo, 105, headerY, { align: 'center' });
      headerY += 5;
    }

    doc.setFontSize(10);
    doc.text(reportTitle, 105, headerY + 2, { align: 'center' });
    doc.text(`Generated on: ${dateStr}`, 105, headerY + 8, { align: 'center' });
    
    doc.setDrawColor(200);
    doc.line(20, headerY + 12, 190, headerY + 12);
    
    // Adjusted Table startY
    const tableStartY = headerY + 18;

    // Table Data
    const tableColumn = ["Code", "Product Name", "Category", "Current Stock", "Min Stock", "Sale Price"];
    const tableRows = filteredProducts.map(p => [
      p.code,
      p.name,
      p.category,
      `${p.currentStock} ${p.unitType}`,
      `${p.minStock} ${p.unitType}`,
      formatCurrency(p.salePrice)
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: tableStartY,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], fontSize: 10, halign: 'center' },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 60 },
        2: { cellWidth: 30 },
        3: { cellWidth: 25, halign: 'center' },
        4: { cellWidth: 25, halign: 'center' },
        5: { cellWidth: 30, halign: 'right' }
      }
    });

    // Summary Footer
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`Total Unique Items: ${filteredProducts.length}`, 14, finalY);
    doc.text(`Low Stock Items: ${filteredProducts.filter(p => p.currentStock <= p.minStock).length}`, 14, finalY + 6);

    doc.save(`Inventory_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory Management</h1>
          <p className="text-gray-500 dark:text-gray-400">Track and manage your raw materials and products.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={generatePDF}
            className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border border-gray-200 dark:border-gray-700 transition-all shadow-sm active:scale-95"
            title="Download/Print current inventory list as PDF"
          >
            <FileDown className="w-4 h-4" />
            Export Report
          </button>
          <button 
            onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-500/10 active:scale-95 transition-all"
            title="Register a new item in the inventory"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-theme-card p-6 rounded-2xl border border-theme-border flex items-center gap-4 transition-all hover:shadow-lg hover:shadow-blue-500/5 group">
            <div className="bg-blue-600 p-3 rounded-xl text-white shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1.5">Total Inventory</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{products.length}</p>
            </div>
          </div>
          <div className="bg-theme-card p-6 rounded-2xl border border-theme-border flex items-center gap-4 transition-all hover:shadow-lg hover:shadow-amber-500/5 group">
            <div className="bg-amber-500 p-3 rounded-xl text-white shadow-lg shadow-amber-500/20 group-hover:scale-110 transition-transform">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1.5">Critical Units</p>
              <p className="text-2xl font-black text-amber-600 leading-none">
                {products.filter(p => p.currentStock <= p.minStock).length} Items
              </p>
            </div>
          </div>
          <div className="bg-theme-card p-6 rounded-2xl border border-theme-border flex items-center gap-4 transition-all hover:shadow-lg hover:shadow-green-500/5 group">
            <div className="bg-green-500 p-3 rounded-xl text-white shadow-lg shadow-green-500/20 group-hover:scale-110 transition-transform">
              <History className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1.5">Monthly Intake</p>
              <p className="text-2xl font-black text-green-600 leading-none">1.2k Tons</p>
            </div>
          </div>
      </div>

      <div className="bg-theme-card rounded-3xl border border-theme-border shadow-sm overflow-hidden transition-all">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by name or code..."
              className="w-full pl-10 pr-4 py-2 ring-1 ring-gray-200 dark:ring-gray-800 bg-white dark:bg-gray-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-gray-400" />
            <select 
              className="bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-gray-800 border-none rounded-xl text-sm px-3 py-2 focus:ring-2 focus:ring-blue-500 dark:text-white cursor-pointer"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-100/50 dark:bg-slate-800/50 divide-x divide-slate-200/50 dark:divide-slate-700/50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Product Details</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Category</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Available Stock</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Valuation</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold dark:text-white">{product.name}</span>
                      <span className="text-xs text-gray-400 uppercase">{product.code}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight w-fit">
                         {product.category}
                      </span>
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-[0.2em] ml-1",
                        product.type === 'finished' ? "text-blue-600" : product.type === 'service' ? "text-purple-600" : "text-gray-400"
                      )}>
                        {product.type || 'raw'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={cn("text-sm font-medium", product.currentStock <= product.minStock ? "text-amber-500" : "text-green-500")}>
                        {product.currentStock} {product.unitType}
                      </span>
                      {product.currentStock <= product.minStock && (
                        <div className="w-full bg-gray-200 dark:bg-gray-700 h-1 rounded-full overflow-hidden">
                          <div 
                            className="bg-amber-500 h-full" 
                            style={{ width: `${(product.currentStock / product.minStock) * 100}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                       <span className="text-sm font-bold dark:text-white">{formatCurrency(product.salePrice)}</span>
                       <span className="text-[10px] text-gray-400 italic">Cost: {formatCurrency(product.purchasePrice)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <button 
                         onClick={() => handleEdit(product)} 
                         className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                         title="Edit product details"
                       >
                          <Edit className="w-4 h-4" />
                       </button>
                       <button 
                         onClick={() => handleDelete(product.id)} 
                         className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                         title="Delete product from inventory"
                       >
                          <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-theme-card w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-xl font-bold dark:text-white">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label>Product Name</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full"
                    placeholder="e.g. Iron Pipe 2 inch"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label>Product Code</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full"
                    placeholder="e.g. pipe-001"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>
                <div>
                   <label>Category</label>
                  <select 
                    className="w-full"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="">Select Category</option>
                    {categories.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                   <label>Item Type</label>
                  <select 
                    className="w-full"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  >
                    <option value="raw">Raw Material</option>
                    <option value="finished">Finished Good</option>
                    <option value="service">Service/Job Work</option>
                  </select>
                </div>
                <div>
                   <label>Unit Type</label>
                  <select 
                    className="w-full"
                    value={formData.unitType}
                    onChange={(e) => setFormData({ ...formData, unitType: e.target.value })}
                  >
                    <option value="kg">Kilogram (kg)</option>
                    <option value="ton">Metric Ton (ton)</option>
                    <option value="piece">Piece (unit)</option>
                    <option value="meter">Meter (m)</option>
                    <option value="sq m">Sq. Meter (sqm)</option>
                    <option value="sq ft">Sq. Feet (sqft)</option>
                  </select>
                </div>
                <div>
                  <label>Purchase Price (or Base Cost)</label>
                  <input 
                    type="number" 
                    required 
                    className="w-full"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label>Sale Price</label>
                  <input 
                    type="number" 
                    required 
                    className="w-full"
                    value={formData.salePrice}
                    onChange={(e) => setFormData({ ...formData, salePrice: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                {formData.type === 'finished' && (
                  <div>
                    <label>Labour Cost (Est.)</label>
                    <input 
                      type="number" 
                      className="w-full"
                      value={formData.labourCharges}
                      onChange={(e) => setFormData({ ...formData, labourCharges: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                )}
                <div>
                  <label>Current Stock</label>
                  <input 
                    type="number" 
                    required 
                    className="w-full"
                    value={formData.currentStock}
                    onChange={(e) => setFormData({ ...formData, currentStock: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label>Min Stock Alert</label>
                  <input 
                    type="number" 
                    required 
                    className="w-full"
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              {formData.type === 'finished' && (
                <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <label className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Bill of Materials (BOM)</label>
                      <p className="text-[9px] text-gray-400 uppercase font-bold">Materials required for 1 unit</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setFormData({ ...formData, bom: [...formData.bom, { productId: '', quantity: 0 }] })}
                      className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 p-2 rounded-lg hover:bg-blue-100 transition-colors"
                      title="Add raw material"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                    {formData.bom.map((bomItem, idx) => {
                      const rawProd = products.find(p => p.id === bomItem.productId);
                      return (
                        <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-transparent hover:border-gray-200 dark:hover:border-gray-800 transition-all">
                          <div className="flex-1">
                            <select 
                              className="w-full bg-transparent border-none text-xs font-bold focus:ring-0 p-0"
                              value={bomItem.productId}
                              onChange={(e) => {
                                const newBom = [...formData.bom];
                                newBom[idx].productId = e.target.value;
                                setFormData({ ...formData, bom: newBom });
                              }}
                            >
                              <option value="">Select Material</option>
                              {products.filter(p => p.type === 'raw').map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.unitType})</option>
                              ))}
                            </select>
                            {rawProd && (
                              <p className="text-[9px] text-gray-400 mt-1">Cost: {formatCurrency(rawProd.purchasePrice)} / {rawProd.unitType}</p>
                            )}
                          </div>
                          <div className="w-24 px-2 border-l border-gray-200 dark:border-gray-800">
                            <input 
                              type="number" 
                              step="0.01"
                              placeholder="Qty"
                              className="w-full bg-transparent border-none text-xs font-bold text-center focus:ring-0 p-0"
                              value={bomItem.quantity}
                              onChange={(e) => {
                                const newBom = [...formData.bom];
                                newBom[idx].quantity = parseFloat(e.target.value) || 0;
                                setFormData({ ...formData, bom: newBom });
                              }}
                            />
                             <p className="text-[9px] text-gray-400 mt-1 text-center">Quantity</p>
                          </div>
                          <button 
                            type="button"
                            onClick={() => setFormData({ ...formData, bom: formData.bom.filter((_, i) => i !== idx) })}
                            className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                    {formData.bom.length === 0 && (
                      <div className="p-8 text-center border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-3xl text-gray-400">
                        <Package className="w-8 h-8 mx-auto mb-2 opacity-10" />
                        <p className="text-[10px] font-black uppercase tracking-widest leading-tight">No materials linked.<br/>Add raw materials to track costs.</p>
                      </div>
                    )}
                  </div>

                  {/* BOM Cost Summary */}
                  <div className="bg-slate-900 rounded-2xl p-4 text-white">
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Production Cost</p>
                        <p className="text-xl font-black">{formatCurrency(totalManufacturingCost)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Profit/Margin</p>
                        <p className={cn(
                          "text-lg font-black",
                          formData.salePrice > totalManufacturingCost ? "text-green-400" : "text-red-400"
                        )}>
                          {formatCurrency(formData.salePrice - totalManufacturingCost)}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                      <div>
                         <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Material</p>
                         <p className="text-xs font-bold">{formatCurrency(totalBOMCost)}</p>
                      </div>
                      <div>
                         <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Labour</p>
                         <p className="text-xs font-bold">{formatCurrency(formData.labourCharges)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-1 bg-blue-600 disabled:bg-blue-400 text-white py-3 rounded-xl font-medium shadow-lg shadow-blue-500/20"
                >
                  {submitting ? 'Processing...' : (editingProduct ? 'Update Product' : 'Add Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function X({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
  )
}
