import React from 'react';
import { 
  Hammer, 
  Trash2, 
  Plus, 
  Save, 
  Package, 
  ChevronRight,
  TrendingUp,
  Clock,
  Briefcase
} from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  runTransaction,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { formatCurrency as baseFormatCurrency, cn, OperationType, handleFirestoreError, formatDate, logActivity } from '../lib/utils';
import { useCurrency } from '../hooks/useCurrency';

interface BOMItem {
  productId: string;
  name: string;
  quantity: number;
  unitType: string;
  unitCost: number;
}

export default function Fabrication() {
  const { formatCurrency } = useCurrency();
  const [products, setProducts] = React.useState<any[]>([]);
  const [productions, setProductions] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Form State
  const [selectedProduct, setSelectedProduct] = React.useState<any>(null);
  const [quantityToProduce, setQuantityToProduce] = React.useState(1);
  const [consumedMaterials, setConsumedMaterials] = React.useState<BOMItem[]>([]);
  const [labourCost, setLabourCost] = React.useState(0);
  const [otherCosts, setOtherCosts] = React.useState(0);
  const [notes, setNotes] = React.useState('');

  const fetchProducts = async () => {
    try {
      const q = collection(db, 'products');
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'products');
    }
  };

  const fetchProductions = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'productions'), orderBy('createdAt', 'desc'), limit(50));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProductions(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'productions');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchProducts();
    fetchProductions();
  }, []);

  const handleProductSelect = (productId: string) => {
    const product = products.find(p => p.id === productId);
    setSelectedProduct(product);
    if (product?.bom) {
      const initialBOM = product.bom.map((item: any) => {
        const raw = products.find(p => p.id === item.productId);
        return {
          productId: item.productId,
          name: raw?.name || 'Unknown Item',
          quantity: item.quantity,
          unitType: raw?.unitType || 'kg',
          unitCost: raw?.purchasePrice || 0
        };
      });
      setConsumedMaterials(initialBOM);
    } else {
      setConsumedMaterials([]);
    }
    setLabourCost(product?.labourCharges || 0);
  };

  const addMaterial = () => {
    setConsumedMaterials([...consumedMaterials, {
      productId: '',
      name: '',
      quantity: 1,
      unitType: 'kg',
      unitCost: 0
    }]);
  };

  const removeMaterial = (index: number) => {
    setConsumedMaterials(consumedMaterials.filter((_, i) => i !== index));
  };

  const updateMaterial = (index: number, field: keyof BOMItem, value: any) => {
    const newItems = [...consumedMaterials];
    if (field === 'productId') {
      const p = products.find(prod => prod.id === value);
      newItems[index] = {
        ...newItems[index],
        productId: value,
        name: p?.name || '',
        unitType: p?.unitType || 'kg',
        unitCost: p?.purchasePrice || 0
      };
    } else {
      (newItems[index] as any)[field] = value;
    }
    setConsumedMaterials(newItems);
  };

  const totalMaterialCost = consumedMaterials.reduce((sum, item) => sum + (item.quantity * item.unitCost * quantityToProduce), 0);
  const totalProductionCost = totalMaterialCost + labourCost + otherCosts;
  const costPerUnit = quantityToProduce > 0 ? totalProductionCost / quantityToProduce : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || quantityToProduce <= 0 || submitting) return;

    setSubmitting(true);
    try {
      await runTransaction(db, async (tx) => {
        // Reads
        const prodRefs = consumedMaterials.map(m => doc(db, 'products', m.productId));
        const prodDocs = await Promise.all(prodRefs.map(ref => tx.get(ref)));
        const finishedProdRef = doc(db, 'products', selectedProduct.id);
        const finishedProdDoc = await tx.get(finishedProdRef);

        // Writes
        // 1. Record Production Log
        const productionRef = doc(collection(db, 'productions'));
        tx.set(productionRef, {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          quantityProduced: quantityToProduce,
          consumedMaterials,
          labourCost,
          otherCosts,
          totalCost: totalProductionCost,
          unitCost: costPerUnit,
          notes,
          createdAt: serverTimestamp()
        });

        // 2. Reduce Raw Materials
        prodDocs.forEach((doc, idx) => {
          if (doc.exists()) {
            const currentStock = doc.data().currentStock || 0;
            const consumed = consumedMaterials[idx].quantity * quantityToProduce;
            tx.update(prodRefs[idx], { currentStock: currentStock - consumed });
          }
        });

        // 3. Increase Finished Goods
        if (finishedProdDoc.exists()) {
          const currentStock = finishedProdDoc.data().currentStock || 0;
          tx.update(finishedProdRef, { 
            currentStock: currentStock + quantityToProduce,
            // Update purchase price to reflect production cost for profit analysis
            purchasePrice: costPerUnit 
          });
        }

        // 4. Stock Movements
        // For Finished Product (IN)
        const finishedMovementRef = doc(collection(db, 'stockMovements'));
        tx.set(finishedMovementRef, {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          type: 'in',
          quantity: quantityToProduce,
          reason: 'Fabrication Output',
          referenceId: productionRef.id,
          createdAt: serverTimestamp()
        });

        // For Raw Materials (OUT)
        consumedMaterials.forEach((m) => {
          const movementRef = doc(collection(db, 'stockMovements'));
          tx.set(movementRef, {
            productId: m.productId,
            productName: m.name,
            type: 'out',
            quantity: m.quantity * quantityToProduce,
            reason: 'Fabrication Input',
            referenceId: productionRef.id,
            createdAt: serverTimestamp()
          });
        });

        // 5. Activity Log
        const logRef = doc(collection(db, 'activityLogs'));
        tx.set(logRef, {
          action: 'FABRICATION_COMPLETE',
          details: `Produced ${quantityToProduce} units of ${selectedProduct.name}`,
          metadata: { productId: selectedProduct.id, quantity: quantityToProduce },
          createdAt: serverTimestamp()
        });
      });

      setIsModalOpen(false);
      resetForm();
      fetchProductions();
      fetchProducts();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'productions');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedProduct(null);
    setQuantityToProduce(1);
    setConsumedMaterials([]);
    setLabourCost(0);
    setOtherCosts(0);
    setNotes('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Fabrication & Production</h1>
          <p className="text-gray-500 dark:text-gray-400">Convert raw materials into finished industrial products.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
        >
          <Hammer className="w-4 h-4" />
          Start Production
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-theme-card p-6 rounded-2xl border border-theme-border flex items-center gap-4">
          <div className="bg-blue-600 p-3 rounded-xl text-white shadow-lg">
            <Hammer className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Total Logs</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">{productions.length}</p>
          </div>
        </div>
        <div className="bg-theme-card p-6 rounded-2xl border border-theme-border flex items-center gap-4">
          <div className="bg-green-600 p-3 rounded-xl text-white shadow-lg">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Efficiency</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">94%</p>
          </div>
        </div>
        <div className="bg-theme-card p-6 rounded-2xl border border-theme-border flex items-center gap-4">
          <div className="bg-amber-600 p-3 rounded-xl text-white shadow-lg">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Avg. Cycle</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">4.5h</p>
          </div>
        </div>
        <div className="bg-theme-card p-6 rounded-2xl border border-theme-border flex items-center gap-4">
          <div className="bg-purple-600 p-3 rounded-xl text-white shadow-lg">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Labour Used</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">{formatCurrency(productions.reduce((s, p) => s + (p.labourCost || 0), 0))}</p>
          </div>
        </div>
      </div>

      <div className="bg-theme-card rounded-3xl border border-theme-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
           <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">Recent Production History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Finished Product</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Qty Produced</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Cost</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Unit Cost</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {productions.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                          <Package className="w-4 h-4" />
                       </div>
                       <span className="text-sm font-bold dark:text-white">{p.productName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium dark:text-gray-300">{p.quantityProduced} Units</span>
                  </td>
                  <td className="px-6 py-4 font-bold text-red-500">
                    {formatCurrency(p.totalCost)}
                  </td>
                  <td className="px-6 py-4 text-xs dark:text-gray-400">
                    {formatCurrency(p.unitCost)} / unit
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500 uppercase font-medium">
                    {formatDate(p.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {productions.length === 0 && !loading && (
             <div className="p-20 text-center text-gray-400">
                <Hammer className="w-12 h-12 mx-auto mb-4 opacity-10" />
                <p className="font-bold uppercase tracking-widest text-xs">No production records yet</p>
             </div>
          )}
        </div>
      </div>

      {/* Fabrication Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-theme-card w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl relative my-8">
            <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-theme-card z-10">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-600 rounded-2xl text-white">
                   <Hammer className="w-6 h-6" />
                </div>
                <div>
                   <h3 className="text-xl font-black dark:text-white uppercase tracking-tight">Production Order</h3>
                   <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Convert raw materials into finished units</p>
                </div>
              </div>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <ChevronRight className="w-3 h-3 text-blue-600" />
                    Output Item
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Select Finished Goods</label>
                      <select 
                        required
                        className="w-full bg-theme-bg border border-theme-border p-4 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                        value={selectedProduct?.id || ''}
                        onChange={(e) => handleProductSelect(e.target.value)}
                      >
                        <option value="">Select Item to Produce...</option>
                        {products.filter(p => !p.type || p.type === 'finished').map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Quantity to Produce</label>
                      <input 
                        type="number" 
                        required 
                        min="1"
                        className="w-full bg-theme-bg border border-theme-border p-4 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                        value={quantityToProduce}
                        onChange={(e) => setQuantityToProduce(parseInt(e.target.value) || 1)}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <ChevronRight className="w-3 h-3 text-blue-600" />
                    Labour & Overhead
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 text-blue-600">Labour Charges (Per Unit)</label>
                      <input 
                        type="number" 
                        className="w-full bg-theme-bg border border-theme-border p-4 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-gray-500"
                        value={labourCost}
                        onChange={(e) => setLabourCost(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Other Costs (Total)</label>
                      <input 
                        type="number" 
                        placeholder="Electricity, consumables, etc."
                        className="w-full bg-theme-bg border border-theme-border p-4 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                        value={otherCosts}
                        onChange={(e) => setOtherCosts(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <ChevronRight className="w-3 h-3 text-blue-600" />
                    Bill of Materials (Consumption Per Unit)
                  </h4>
                  <button 
                    type="button" 
                    onClick={addMaterial}
                    className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1 hover:underline"
                  >
                    <Plus className="w-3 h-3" /> Add Raw Material
                  </button>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {consumedMaterials.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-2xl items-end border border-transparent hover:border-gray-200 dark:hover:border-gray-800 transition-all">
                      <div className="col-span-12 md:col-span-5 space-y-1">
                        <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Material</label>
                        <select 
                          className="w-full bg-theme-bg border-none p-3 rounded-xl text-xs font-bold"
                          value={item.productId}
                          onChange={(e) => updateMaterial(index, 'productId', e.target.value)}
                        >
                          <option value="">Select Material...</option>
                          {products.filter(pr => pr.type === 'raw' || !pr.type).map(pr => (
                            <option key={pr.id} value={pr.id}>{pr.name} ({pr.unitType})</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-6 md:col-span-3 space-y-1">
                        <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Qty (Per Unit)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          className="w-full bg-theme-bg border-none p-3 rounded-xl text-xs font-bold text-center"
                          value={item.quantity}
                          onChange={(e) => updateMaterial(index, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-4 md:col-span-3 text-right pr-4">
                         <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Cost</p>
                         <p className="text-xs font-bold dark:text-white">{formatCurrency(item.quantity * item.unitCost * quantityToProduce)}</p>
                      </div>
                      <div className="col-span-2 md:col-span-1 text-center">
                        <button 
                          type="button" 
                          onClick={() => removeMaterial(index)}
                          className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {consumedMaterials.length === 0 && (
                    <div className="p-8 text-center border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-3xl text-gray-400">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-10" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Link some raw materials from BOM</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-900 text-white p-8 rounded-[32px] shadow-xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform duration-500">
                    <TrendingUp className="w-32 h-32" />
                 </div>
                 <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Unit Cost</p>
                      <p className="text-4xl font-black tracking-tight">{formatCurrency(costPerUnit)}</p>
                      {selectedProduct && (
                        <p className={cn("text-xs font-bold mt-2 flex items-center gap-1", selectedProduct.salePrice > costPerUnit ? "text-green-400" : "text-red-400")}>
                           Sale Price: {formatCurrency(selectedProduct.salePrice)}
                           <span className="opacity-50">({Math.round(((selectedProduct.salePrice - costPerUnit) / selectedProduct.salePrice) * 100)}% Margin)</span>
                        </p>
                      )}
                    </div>
                    <div className="md:border-l md:border-white/10 md:pl-8">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Material Cost</p>
                       <p className="text-2xl font-black">{formatCurrency(totalMaterialCost)}</p>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4 mb-2">Operational Cost</p>
                       <p className="text-2xl font-black">{formatCurrency((labourCost * quantityToProduce) + otherCosts)}</p>
                    </div>
                    <div className="flex flex-col justify-end gap-3">
                       <button 
                         type="submit" 
                         disabled={submitting || !selectedProduct}
                         className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-600/30 active:scale-95 flex items-center justify-center gap-2"
                       >
                          <Save className="w-5 h-5" />
                          {submitting ? 'Recording Entry...' : 'Complete Fabrication'}
                       </button>
                       <button 
                         type="button"
                         onClick={() => setIsModalOpen(false)}
                         className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-2xl font-bold uppercase tracking-widest transition-all text-xs"
                       >
                          Cancel Production
                       </button>
                    </div>
                 </div>
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
