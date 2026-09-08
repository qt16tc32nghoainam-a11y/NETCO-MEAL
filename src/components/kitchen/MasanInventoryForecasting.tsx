import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Package,
  TrendingDown,
  TrendingUp,
  ShoppingCart,
  Calendar,
  Filter,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Building,
  FileText,
  DollarSign,
  Search,
  ExternalLink,
  ChevronRight,
  Send,
  Boxes,
  Check,
  Clock,
  Truck,
} from 'lucide-react';
import {
  User,
  InventoryRequirementAnalysis,
  MasanPurchaseOrder,
  MasanSupplier,
} from '../../types';
import { fetchApi, formatVND } from '../../utils/api';

interface MasanInventoryForecastingProps {
  currentUser: User;
  onRefreshGlobal?: () => void;
}

export function MasanInventoryForecasting({
  currentUser,
  onRefreshGlobal,
}: MasanInventoryForecastingProps) {
  const [scope, setScope] = useState<'today' | 'week'>('today');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [activeSupplierFilter, setActiveSupplierFilter] = useState<
    'ALL' | MasanSupplier | 'SHORTAGE_ONLY'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [safetyBuffer, setSafetyBuffer] = useState<number>(20); // 20% safety stock

  const [analysisData, setAnalysisData] = useState<{
    targetDate: string;
    scope: string;
    totalMealsBooked: number;
    summary: {
      totalItems: number;
      shortageCount: number;
      lowStockCount: number;
      sufficientCount: number;
      totalEstimatedCost: number;
    };
    items: InventoryRequirementAnalysis[];
    bySupplier: Record<string, InventoryRequirementAnalysis[]>;
  } | null>(null);

  const [purchaseOrders, setPurchaseOrders] = useState<MasanPurchaseOrder[]>([]);
  const [activeTab, setActiveTab] = useState<'forecasting' | 'purchase_orders'>('forecasting');
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPO, setIsGeneratingPO] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const loadAnalysis = useCallback(async () => {
    try {
      setIsLoading(true);
      const [analysisRes, poRes] = await Promise.all([
        fetchApi<any>(
          `/inventory/analysis?scope=${scope}&date=${selectedDate}`,
          {},
          currentUser.id
        ),
        fetchApi<MasanPurchaseOrder[]>('/inventory/purchase-orders', {}, currentUser.id),
      ]);
      setAnalysisData(analysisRes);
      setPurchaseOrders(poRes);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi tải dữ liệu kho & dự toán';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsLoading(false);
    }
  }, [scope, selectedDate, currentUser.id]);

  useEffect(() => {
    loadAnalysis();
  }, [loadAnalysis]);

  // Handle 1-click Auto PO generation
  const handleAutoGeneratePO = async () => {
    try {
      setIsGeneratingPO(true);
      setMessage(null);
      const res = await fetchApi<{
        createdCount: number;
        purchaseOrders: MasanPurchaseOrder[];
        message: string;
      }>(
        '/inventory/purchase-orders/auto-generate',
        {
          method: 'POST',
          body: JSON.stringify({
            mealDate: selectedDate,
            scope,
            safetyBufferPercent: safetyBuffer,
          }),
        },
        currentUser.id
      );

      setMessage({ type: 'success', text: res.message });
      await loadAnalysis();
      if (res.createdCount > 0) {
        setActiveTab('purchase_orders');
      }
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi khi tạo đề xuất mua hàng';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsGeneratingPO(false);
    }
  };

  // Handle PO status update (GA approve or delivery receipt)
  const handleUpdatePOStatus = async (poId: string, newStatus: MasanPurchaseOrder['status']) => {
    try {
      await fetchApi(
        `/inventory/purchase-orders/${poId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: newStatus }),
        },
        currentUser.id
      );
      setMessage({
        type: 'success',
        text: `Đã cập nhật trạng thái đơn hàng sang: ${newStatus}`,
      });
      await loadAnalysis();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi cập nhật đơn hàng';
      setMessage({ type: 'error', text: errorMsg });
    }
  };

  const getSupplierInfo = (sup: MasanSupplier) => {
    switch (sup) {
      case 'MML':
        return {
          name: 'MML (Masan MEATLife)',
          badgeColor: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-300',
          scopeDesc: '100% Thịt & Trứng (MEATDeli, gà sạch MML)',
        };
      case 'CHIN_SU':
        return {
          name: 'CHIN-SU / Masan Consumer',
          badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300',
          scopeDesc: '100% Gia vị, Tương ớt, Nước tương, Nam Ngư',
        };
      case 'WINECO':
        return {
          name: 'WinEco Nông Trường Masan',
          badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300',
          scopeDesc: '100% Rau, Củ, Quả tươi VietGAP',
        };
      case 'WINCOMMERCE':
      default:
        return {
          name: 'WinCommerce / WinMart',
          badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300',
          scopeDesc: '100% Gạo ST25 Ngọc Nương, Hàng khô',
        };
    }
  };

  // Filtered items
  const filteredItems = (analysisData?.items || []).filter((item) => {
    // Supplier filter
    if (activeSupplierFilter === 'SHORTAGE_ONLY' && !item.isShortage) {
      return false;
    }
    if (
      activeSupplierFilter !== 'ALL' &&
      activeSupplierFilter !== 'SHORTAGE_ONLY' &&
      item.masanSupplier !== activeSupplierFilter
    ) {
      return false;
    }
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 1. Masan Group 100% Commitment Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-red-900 via-slate-900 to-slate-950 text-white border border-red-800/60 shadow-md">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-red-600 text-white tracking-wide uppercase">
                Chính Sách Cung Ứng Chuẩn
              </span>
              <span className="text-xs text-red-200 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                100% Sản Phẩm Thuộc Hệ Sinh Thái Tập Đoàn Masan
              </span>
            </div>
            <h2 className="text-xl font-bold mt-1 text-white flex items-center gap-2">
              Dự Báo Thiếu/Đủ Tồn Kho & Lập Kế Hoạch Mua Nguyên Liệu
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
              Hệ thống tự động liên kết số lượng suất ăn đã đặt từ nhân viên với định mức món ăn (BOM)
              để tính toán chính xác lượng nguyên liệu thiếu hụt. Tự động chia theo 4 nhà cung ứng Masan
              để xuất đơn đề xuất mua hàng cho phòng Hành chính (GA).
            </p>
          </div>

          {/* Quick ecosystem badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full lg:w-auto">
            <div className="p-2 rounded-xl bg-white/10 border border-white/10 text-center">
              <div className="text-[11px] font-bold text-red-300">🥩 MML MEATLife</div>
              <div className="text-[10px] text-slate-300">100% Thịt & Trứng</div>
            </div>
            <div className="p-2 rounded-xl bg-white/10 border border-white/10 text-center">
              <div className="text-[11px] font-bold text-emerald-300">🥗 WinEco</div>
              <div className="text-[10px] text-slate-300">100% Rau Củ Quả</div>
            </div>
            <div className="p-2 rounded-xl bg-white/10 border border-white/10 text-center">
              <div className="text-[11px] font-bold text-amber-300">🌶️ CHIN-SU</div>
              <div className="text-[10px] text-slate-300">100% Nước Tương & Gia Vị</div>
            </div>
            <div className="p-2 rounded-xl bg-white/10 border border-white/10 text-center">
              <div className="text-[11px] font-bold text-blue-300">🌾 WinCommerce</div>
              <div className="text-[10px] text-slate-300">100% Gạo & Đồ Khô</div>
            </div>
          </div>
        </div>
      </div>

      {/* Notification */}
      {message && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 shadow-sm ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-slate-400 hover:text-slate-600 font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Scope Controls & Navigation Tab Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('forecasting')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'forecasting'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Đối Soát Nhu Cầu & Tồn Kho (BOM)</span>
          </button>

          <button
            onClick={() => setActiveTab('purchase_orders')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'purchase_orders'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Đơn Đề Xuất Mua Masan ({purchaseOrders.length})</span>
          </button>
        </div>

        {/* Scope selector */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 hidden md:inline">
            Thời Gian Đối Soát:
          </span>
          <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
            <button
              onClick={() => setScope('today')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                scope === 'today'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Hôm Nay
            </button>
            <button
              onClick={() => setScope('week')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                scope === 'week'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Cả Tuần Này
            </button>
          </div>

          <button
            onClick={loadAnalysis}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition"
            title="Tải lại phân tích"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {activeTab === 'forecasting' ? (
        <>
          {/* 2. Key Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Suất Ăn Đã Đặt
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {analysisData?.totalMealsBooked || 0}
              </div>
              <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
                {scope === 'today' ? 'Trong ngày đã chọn' : 'Toàn bộ tuần'}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Nguyên Liệu Cần (BOM)
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {analysisData?.summary.totalItems || 0}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">100% Masan Group</div>
            </div>

            <div className="bg-red-50 dark:bg-red-950/30 p-4 rounded-2xl border border-red-200 dark:border-red-900/60">
              <div className="text-[11px] font-bold text-red-700 dark:text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Thiếu Hụt (Cần Mua)
              </div>
              <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
                {analysisData?.summary.shortageCount || 0}
              </div>
              <div className="text-[10px] text-red-700/80 dark:text-red-400/80 mt-0.5">
                Mặt hàng âm kho
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/60">
              <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                Cận Mức Tối Thiểu
              </div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                {analysisData?.summary.lowStockCount || 0}
              </div>
              <div className="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                Cần bổ sung thêm
              </div>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60">
              <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Đủ Tồn Kho
              </div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {analysisData?.summary.sufficientCount || 0}
              </div>
              <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
                Sẵn sàng nấu
              </div>
            </div>

            <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800">
              <div className="text-[11px] font-bold text-slate-300">Dự Toán Mua Bổ Sung</div>
              <div className="text-base font-black text-amber-400 mt-1 truncate">
                {formatVND(analysisData?.summary.totalEstimatedCost || 0)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Masan ecosystem</div>
            </div>
          </div>

          {/* 3. Action Bar: Auto-PO button & Safety buffer */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center font-bold">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Lập Đề Xuất Mua Hàng Masan Tự Động
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tự động gom các mặt hàng thiếu hụt theo 4 đơn vị MML, WinEco, CHIN-SU, WinCommerce.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span>Dự phòng an toàn:</span>
                <select
                  value={safetyBuffer}
                  onChange={(e) => setSafetyBuffer(Number(e.target.value))}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                >
                  <option value={10}>+10% (Tối thiểu)</option>
                  <option value={20}>+20% (Khuyến nghị)</option>
                  <option value={30}>+30% (An toàn cao)</option>
                </select>
              </div>

              <button
                onClick={handleAutoGeneratePO}
                disabled={isGeneratingPO || (analysisData?.summary.shortageCount === 0 && analysisData?.summary.lowStockCount === 0)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white text-xs font-bold transition shadow-sm cursor-pointer shrink-0"
              >
                <Sparkles className={`w-4 h-4 ${isGeneratingPO ? 'animate-spin' : ''}`} />
                <span>
                  {isGeneratingPO ? 'Đang Lập Đơn...' : '⚡ Lập Đơn Mua Masan Ngay'}
                </span>
              </button>
            </div>
          </div>

          {/* 4. Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setActiveSupplierFilter('ALL')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                  activeSupplierFilter === 'ALL'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                }`}
              >
                Tất Cả Hàng Masan ({analysisData?.items.length || 0})
              </button>

              <button
                onClick={() => setActiveSupplierFilter('SHORTAGE_ONLY')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                  activeSupplierFilter === 'SHORTAGE_ONLY'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900/60 hover:bg-red-100'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Chỉ Mặt Hàng Thiếu ({analysisData?.summary.shortageCount || 0})</span>
              </button>

              <button
                onClick={() => setActiveSupplierFilter('MML')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                  activeSupplierFilter === 'MML'
                    ? 'bg-red-900 text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                }`}
              >
                🥩 MML (Thịt & Trứng)
              </button>

              <button
                onClick={() => setActiveSupplierFilter('WINECO')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                  activeSupplierFilter === 'WINECO'
                    ? 'bg-emerald-800 text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                }`}
              >
                🥗 WinEco (Rau Củ Quả)
              </button>

              <button
                onClick={() => setActiveSupplierFilter('CHIN_SU')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                  activeSupplierFilter === 'CHIN_SU'
                    ? 'bg-amber-800 text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                }`}
              >
                🌶️ CHIN-SU (Gia Vị)
              </button>

              <button
                onClick={() => setActiveSupplierFilter('WINCOMMERCE')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                  activeSupplierFilter === 'WINCOMMERCE'
                    ? 'bg-blue-800 text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                }`}
              >
                🌾 WinCommerce (Gạo & Hàng Khô)
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên nguyên liệu, SKU..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* 5. Inventory Analysis Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Nguyên Liệu & Thương Hiệu Masan</th>
                    <th className="py-3 px-3">Nhà Cung Ứng</th>
                    <th className="py-3 px-3">Tồn Kho Hiện Có</th>
                    <th className="py-3 px-3">Nhu Cầu Đã Đặt (BOM)</th>
                    <th className="py-3 px-3">Cân Đối Tồn Kho</th>
                    <th className="py-3 px-3">Tình Trạng</th>
                    <th className="py-3 px-4 text-right">Chi Phí Mua Thêm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        Không tìm thấy mặt hàng nguyên liệu nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const supp = getSupplierInfo(item.masanSupplier);

                      return (
                        <tr
                          key={item.itemId}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition ${
                            item.isShortage ? 'bg-red-50/30 dark:bg-red-950/10' : ''
                          }`}
                        >
                          {/* Name & SKU */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 dark:text-white text-xs">
                              {item.name}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                              <span className="font-mono">{item.sku}</span>
                              <span>•</span>
                              <span className="text-slate-700 dark:text-slate-300 font-semibold">
                                {item.brand}
                              </span>
                            </div>
                            {item.affectedDishes.length > 0 && (
                              <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 flex flex-wrap gap-1">
                                <span>Phục vụ món:</span>
                                {item.affectedDishes.map((d, i) => (
                                  <span key={i} className="font-semibold underline">
                                    {d.dishName} ({d.portionCount}s)
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Supplier */}
                          <td className="py-3.5 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-md border ${supp.badgeColor}`}
                            >
                              {supp.name}
                            </span>
                            <div className="text-[9px] text-slate-400 mt-0.5">{supp.scopeDesc}</div>
                          </td>

                          {/* Current stock */}
                          <td className="py-3.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            {item.currentStock} {item.unit}
                          </td>

                          {/* Required by bookings */}
                          <td className="py-3.5 px-3 font-bold text-slate-900 dark:text-white">
                            {item.requiredForBookings} {item.unit}
                          </td>

                          {/* Balance after cooking */}
                          <td className="py-3.5 px-3">
                            <span
                              className={`font-black text-xs ${
                                item.balanceStock < 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : item.balanceStock <= 15
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {item.balanceStock > 0 ? `+${item.balanceStock}` : item.balanceStock}{' '}
                              {item.unit}
                            </span>
                            <div className="text-[9px] text-slate-400">
                              {item.balanceStock < 0
                                ? `Thiếu hụt ${item.shortageQuantity} ${item.unit}`
                                : 'Dư thừa tồn'}
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-3">
                            {item.status === 'CRITICAL_SHORTAGE' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 animate-pulse">
                                <AlertTriangle className="w-3 h-3" />
                                THIẾU HỤT CẦN MUA
                              </span>
                            ) : item.status === 'LOW' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                CẬN TỒN TỐI THIỂU
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                <CheckCircle2 className="w-3 h-3" />
                                ĐỦ TỒN KHO
                              </span>
                            )}
                          </td>

                          {/* Estimated purchase cost */}
                          <td className="py-3.5 px-4 text-right">
                            {item.isShortage ? (
                              <div>
                                <span className="font-extrabold text-red-600 dark:text-red-400 text-xs">
                                  {formatVND(item.estimatedPurchaseCost)}
                                </span>
                                <div className="text-[10px] text-slate-400">
                                  {formatVND(item.unitCost)}/{item.unit}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* 6. Masan Purchase Orders Management Tab */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-red-600" />
              Danh Sách Đơn Đề Xuất Mua Hàng Masan
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Tổng số: {purchaseOrders.length} phiếu đặt hàng
            </span>
          </div>

          {purchaseOrders.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <ShoppingCart className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-300">
                Chưa có đơn đề xuất mua hàng nào được tạo
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Khi có suất ăn đặt trước bị thiếu nguyên liệu, hãy bấm nút "Lập Đơn Mua Masan Ngay"
                để hệ thống tự động bóc tách và phân loại đơn hàng.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {purchaseOrders.map((po) => {
                const supp = getSupplierInfo(po.supplier);

                return (
                  <div
                    key={po.id}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono font-black text-sm text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                          {po.poCode}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${supp.badgeColor}`}
                        >
                          {supp.name}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            po.status === 'DELIVERED'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : po.status === 'APPROVED'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {po.status === 'DELIVERED'
                            ? 'Đã Nhập Kho (Cộng Tồn Xong)'
                            : po.status === 'APPROVED'
                            ? 'GA Đã Duyệt (Đang Giao Hàng)'
                            : 'Chờ GA Phê Duyệt'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {po.notes}
                      </p>

                      {/* Items list preview */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {po.items.map((it, idx) => (
                          <span
                            key={idx}
                            className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          >
                            {it.name}: <strong>{it.purchaseQty} {it.unit}</strong> ({formatVND(it.subtotal)})
                          </span>
                        ))}
                      </div>

                      <div className="text-[11px] text-slate-400">
                        Ngày tạo: {new Date(po.createdAt).toLocaleString('vi-VN')} • Áp dụng ca ăn:{' '}
                        <strong>{po.forMealDate}</strong>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 w-full md:w-auto shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
                      <div className="text-right">
                        <div className="text-xs text-slate-500">Tổng Giá Trị Đơn Hàng:</div>
                        <div className="text-lg font-black text-red-600 dark:text-red-400">
                          {formatVND(po.totalAmount)}
                        </div>
                      </div>

                      {/* Action buttons based on status & role */}
                      <div className="flex items-center gap-2">
                        {po.status === 'PENDING_GA_APPROVAL' && (
                          <button
                            onClick={() => handleUpdatePOStatus(po.id, 'APPROVED')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>GA Phê Duyệt</span>
                          </button>
                        )}

                        {po.status === 'APPROVED' && (
                          <button
                            onClick={() => handleUpdatePOStatus(po.id, 'DELIVERED')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
                            title="Xác nhận xe giao hàng Masan đã đến và cộng tồn kho tự động"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Xác Nhận Nhập Kho</span>
                          </button>
                        )}

                        {po.status === 'DELIVERED' && (
                          <div className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Đã cộng vào kho</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
