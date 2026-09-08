import { useState, useEffect, useCallback, type FormEvent } from 'react';
import {
  ChefHat,
  Package,
  Plus,
  Send,
  AlertTriangle,
  Leaf,
  CheckCircle2,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingDown,
  FileSpreadsheet,
  Layers,
  Utensils,
  Share2,
  BookOpen,
  Boxes,
  X
} from 'lucide-react';
import { User, Menu, MenuItem, Shift, InventoryItem, InventoryTransaction } from '../../types';
import { fetchApi, formatVND } from '../../utils/api';
import { MasterDishCatalog } from './MasterDishCatalog';
import { MasanInventoryForecasting } from './MasanInventoryForecasting';

interface KitchenPortalProps {
  currentUser: User;
  onRefreshGlobal?: () => void;
  initialSubTab?: 'production' | 'menus' | 'dishes' | 'inventory' | 'masan-forecasting';
}

export function KitchenPortal({ currentUser, onRefreshGlobal, initialSubTab = 'production' }: KitchenPortalProps) {
  const [kitchenTab, setKitchenTab] = useState<'production' | 'menus' | 'dishes' | 'inventory' | 'masan-forecasting'>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setKitchenTab(initialSubTab);
    }
  }, [initialSubTab]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [masterDishes, setMasterDishes] = useState<MenuItem[]>([]);
  const [dashboardData, setDashboardData] = useState<{
    totalMealsToCook: number;
    vegetarianMeals: number;
    guestMeals: number;
    mealsByShift: Record<string, number>;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Menu Form State
  const [isCreatingMenu, setIsCreatingMenu] = useState(false);
  const [isDishPickerOpen, setIsDishPickerOpen] = useState(false);
  const [newMenuDate, setNewMenuDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newMenuShiftId, setNewMenuShiftId] = useState<string>('shift_b');
  const [newMenuTitle, setNewMenuTitle] = useState('');
  const [newMenuPrice, setNewMenuPrice] = useState(45000);
  const [newMenuItems, setNewMenuItems] = useState<MenuItem[]>([]);

  // Inventory Transaction Modal State
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [selectedInvItem, setSelectedInvItem] = useState<InventoryItem | null>(null);
  const [txType, setTxType] = useState<'IN' | 'OUT' | 'ADJUSTMENT' | 'WASTE'>('IN');
  const [txQty, setTxQty] = useState<number>(10);
  const [txReason, setTxReason] = useState<string>('');

  const loadAll = useCallback(async () => {
    try {
      setIsLoading(true);
      const [menusData, shiftsData, invData, txData, reportData, dishesData] = await Promise.all([
        fetchApi<Menu[]>('/menus', {}, currentUser.id),
        fetchApi<Shift[]>('/shifts', {}, currentUser.id),
        fetchApi<InventoryItem[]>('/inventory', {}, currentUser.id),
        fetchApi<InventoryTransaction[]>('/inventory/transactions', {}, currentUser.id),
        fetchApi<{ kitchen: { totalMealsToCook: number; vegetarianMeals: number; guestMeals: number; mealsByShift: Record<string, number> } }>('/reports/dashboard', {}, currentUser.id),
        fetchApi<MenuItem[]>('/dishes', {}, currentUser.id),
      ]);
      setMenus(menusData);
      setShifts(shiftsData);
      setInventory(invData);
      setTransactions(txData);
      setDashboardData(reportData.kitchen);
      setMasterDishes(dishesData);

      // Prepopulate newMenuItems with first 3 approved dishes if currently empty
      if (dishesData && dishesData.length > 0) {
        const approved = dishesData.filter((d) => (d.status || 'APPROVED') === 'APPROVED');
        if (approved.length > 0) {
          setNewMenuItems((prev) => (prev.length === 0 ? approved.slice(0, 3) : prev));
        }
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Submit Menu to HR
  const handleSubmitMenu = async (menuId: string) => {
    try {
      await fetchApi(`/menus/${menuId}/submit`, { method: 'POST' }, currentUser.id);
      setMessage({ type: 'success', text: 'Đã gửi thực đơn cho ban HR/GA phê duyệt thành công!' });
      await loadAll();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi gửi thực đơn';
      setMessage({ type: 'error', text: errorMsg });
    }
  };

  // Publish Approved Menu
  const handlePublishMenu = async (menuId: string) => {
    try {
      await fetchApi(`/menus/${menuId}/publish`, { method: 'POST' }, currentUser.id);
      setMessage({ type: 'success', text: 'Thực đơn đã được công bố (PUBLISHED) cho toàn bộ nhân viên đăng ký!' });
      await loadAll();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi công bố thực đơn';
      setMessage({ type: 'error', text: errorMsg });
    }
  };

  // Create New Menu
  const handleCreateMenu = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMenuTitle) {
      setMessage({ type: 'error', text: 'Vui lòng nhập tên tiêu đề thực đơn.' });
      return;
    }
    if (newMenuItems.length < 2 || newMenuItems.length > 3) {
      setMessage({
        type: 'error',
        text: 'Mỗi thực đơn phải có 2 hoặc 3 món ăn đã được GA phê duyệt.',
      });
      return;
    }

    try {
      await fetchApi(
        '/menus',
        {
          method: 'POST',
          body: JSON.stringify({
            date: newMenuDate,
            shiftId: newMenuShiftId,
            title: newMenuTitle,
            description: 'Thực đơn đảm bảo tiêu chuẩn an toàn vệ sinh và định mức calo.',
            price: newMenuPrice,
            items: newMenuItems,
          }),
        },
        currentUser.id
      );

      setMessage({ type: 'success', text: 'Tạo bản thảo thực đơn mới thành công (Trạng thái: DRAFT).' });
      setIsCreatingMenu(false);
      setNewMenuTitle('');
      await loadAll();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi khi tạo thực đơn';
      setMessage({ type: 'error', text: errorMsg });
    }
  };

  // Submit Inventory Transaction
  const handleCreateInventoryTx = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedInvItem || !txReason) {
      setMessage({ type: 'error', text: 'Vui lòng nhập lý do giao dịch kho.' });
      return;
    }

    try {
      const actualQty = txType === 'OUT' || txType === 'WASTE' ? -Math.abs(txQty) : Math.abs(txQty);
      await fetchApi(
        '/inventory/transactions',
        {
          method: 'POST',
          body: JSON.stringify({
            inventoryItemId: selectedInvItem.id,
            type: txType,
            quantity: actualQty,
            reason: txReason,
          }),
        },
        currentUser.id
      );

      setMessage({ type: 'success', text: 'Đã lưu giao dịch kho và cập nhật số dư tồn thực tế thành công!' });
      setIsTxModalOpen(false);
      setTxReason('');
      await loadAll();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi giao dịch kho';
      setMessage({ type: 'error', text: errorMsg });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Sub Navigation */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setKitchenTab('production')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
              kitchenTab === 'production'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ChefHat className="w-4 h-4" />
            <span>Kế Hoạch Bếp & Nấu Nướng</span>
          </button>
          <button
            onClick={() => setKitchenTab('menus')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
              kitchenTab === 'menus'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Utensils className="w-4 h-4" />
            <span>Quản Lý Thực Đơn ({menus.length})</span>
          </button>
          <button
            onClick={() => setKitchenTab('dishes')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
              kitchenTab === 'dishes'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Ngân Hàng Món Ăn Chuẩn ({masterDishes.length})</span>
          </button>
          <button
            onClick={() => setKitchenTab('inventory')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
              kitchenTab === 'inventory'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Kho Nguyên Liệu ({inventory.length})</span>
          </button>
          <button
            onClick={() => setKitchenTab('masan-forecasting')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
              kitchenTab === 'masan-forecasting'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Cân Đối Kho & Đặt Hàng Masan (BOM)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
              100% MASAN
            </span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Khu Vực Quản Trị Nhà Bếp & An Toàn Thực Phẩm NETCO Meal
        </div>
      </div>

      {/* Alert */}
      {message && (
        <div
          className={`p-4 rounded-xl text-sm flex items-start justify-between gap-3 shadow-xs animate-in fade-in ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-rose-50 text-rose-900 border border-rose-200'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs font-bold underline cursor-pointer">
            Đóng
          </button>
        </div>
      )}

      {/* TAB 1: PRODUCTION & MEAL COUNTS */}
      {kitchenTab === 'production' && (
        <div className="space-y-6">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng Suất Cần Nấu Hôm Nay</div>
              <div className="text-3xl font-extrabold text-slate-900 mt-2">
                {dashboardData ? dashboardData.totalMealsToCook : '...'} <span className="text-sm font-semibold text-slate-500">suất</span>
              </div>
              <div className="text-xs text-emerald-600 mt-1 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Đã chốt cut-off đăng ký</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Suất Chay Dinh Dưỡng</div>
              <div className="text-3xl font-extrabold text-emerald-600 mt-2">
                {dashboardData ? dashboardData.vegetarianMeals : '...'} <span className="text-sm font-semibold text-slate-500">suất</span>
              </div>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <Leaf className="w-3.5 h-3.5 text-emerald-500" />
                <span>Nấu tại khu bếp chay riêng biệt</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Suất Khách Tiếp Đón</div>
              <div className="text-3xl font-extrabold text-blue-600 mt-2">
                {dashboardData ? dashboardData.guestMeals : '...'} <span className="text-sm font-semibold text-slate-500">suất</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">Phục vụ theo phòng tiếp khách VIP</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cảnh Báo Tồn Kho Thấp</div>
              <div className="text-3xl font-extrabold text-amber-600 mt-2">
                {inventory.filter((i) => i.status === 'LOW').length} <span className="text-sm font-semibold text-slate-500">mặt hàng</span>
              </div>
              <div className="text-xs text-amber-700 mt-1 font-medium">Cần bổ sung nhập kho gấp</div>
            </div>
          </div>

          {/* Breakdown by Shift */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900">Chi Tiết Định Mức Nấu Theo Ca Hôm Nay</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {shifts.map((s) => {
                const count = dashboardData?.mealsByShift[s.name] || 0;
                return (
                  <div key={s.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">{s.name}</span>
                      <span className="text-[11px] font-mono text-slate-500">{s.startTime}</span>
                    </div>
                    <div className="text-2xl font-extrabold text-slate-900">
                      {count} <span className="text-xs font-normal text-slate-500">phần ăn</span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>Giờ chốt đặt: {s.orderCutoffDisplay}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MENU MANAGEMENT & WORKFLOW */}
      {kitchenTab === 'menus' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Quản Lý Thực Đơn & Phê Duyệt</h3>
              <p className="text-xs text-slate-500">
                Quy trình: Bếp tạo (DRAFT) ➔ Gửi duyệt (PENDING_APPROVAL) ➔ Ban HR/GA phê duyệt ➔ Công bố (PUBLISHED)
              </p>
            </div>
            <button
              onClick={() => setIsCreatingMenu(!isCreatingMenu)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{isCreatingMenu ? 'Đóng Biểu Mẫu' : 'Tạo Thực Đơn Mới'}</span>
            </button>
          </div>

          {/* New Menu Creation Drawer/Form */}
          {isCreatingMenu && (
            <form onSubmit={handleCreateMenu} className="bg-white p-6 rounded-2xl border border-amber-200 shadow-md space-y-4">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-amber-600" />
                <span>Soạn Thảo Thực Đơn Mới (DRAFT)</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Ngày phục vụ:</label>
                  <input
                    type="date"
                    value={newMenuDate}
                    onChange={(e) => setNewMenuDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Ca áp dụng:</label>
                  <select
                    value={newMenuShiftId}
                    onChange={(e) => setNewMenuShiftId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                  >
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.startTime})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Đơn giá định mức (VND):</label>
                  <input
                    type="number"
                    step={1000}
                    value={newMenuPrice}
                    onChange={(e) => setNewMenuPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-xs text-slate-700 block mb-1">Tiêu đề thực đơn:</label>
                <input
                  type="text"
                  value={newMenuTitle}
                  onChange={(e) => setNewMenuTitle(e.target.value)}
                  placeholder="Ví dụ: Thực Đơn Bữa Trưa Dinh Dưỡng Năng Lượng Thứ Sáu"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold"
                  required
                />
              </div>

              {/* Items Selection in Form */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-bold text-xs text-slate-700 block">
                    Món ăn trong thực đơn ({newMenuItems.length}/3 món, yêu cầu 2–3):
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsDishPickerOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                    >
                      <Utensils className="w-3.5 h-3.5" />
                      <span>Chọn Từ Ngân Hàng Món Chuẩn</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingMenu(false);
                        setKitchenTab('dishes');
                      }}
                      className="text-xs text-amber-700 hover:text-amber-800 font-semibold underline cursor-pointer"
                    >
                      + Tạo món mới gửi GA duyệt
                    </button>
                  </div>
                </div>

                {newMenuItems.length === 0 ? (
                  <div className="p-4 bg-amber-50 rounded-xl border border-dashed border-amber-300 text-center text-xs text-amber-900">
                    <p className="font-bold">Chưa có món nào được chọn cho thực đơn này.</p>
                    <p className="text-amber-700 mt-0.5">
                      Bấm <strong>"Chọn Từ Ngân Hàng Món Chuẩn"</strong> và chọn 2 hoặc 3 món đã được GA phê duyệt.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {newMenuItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex gap-3 items-center justify-between shadow-2xs hover:border-slate-300 transition"
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-12 h-12 rounded-lg object-cover bg-slate-200 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-800 truncate">{item.name}</div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                            <span className="bg-slate-200 px-1.5 py-0.5 rounded font-semibold text-slate-700">
                              {item.category}
                            </span>
                            <span>{item.calories} kcal</span>
                            {item.isVegetarian && (
                              <span className="text-emerald-700 font-bold bg-emerald-50 px-1 rounded">Chay</span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewMenuItems((prev) => prev.filter((i) => i.id !== item.id))}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition cursor-pointer"
                          title="Bỏ món này khỏi thực đơn"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreatingMenu(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                >
                  Lưu Bản Thảo (DRAFT)
                </button>
              </div>
            </form>
          )}

          {/* Menus List with State Machine Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {menus.map((menu) => {
              const shift = shifts.find((s) => s.id === menu.shiftId);
              return (
                <div key={menu.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-900">{menu.title}</h4>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Ngày: <strong>{menu.date}</strong> | Ca: <strong>{shift?.name || menu.shiftId}</strong>
                      </div>
                    </div>

                    <div>
                      {menu.status === 'PUBLISHED' && (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          PUBLISHED (Đang Mở)
                        </span>
                      )}
                      {menu.status === 'APPROVED' && (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                          APPROVED (Đã Duyệt)
                        </span>
                      )}
                      {menu.status === 'PENDING_APPROVAL' && (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                          PENDING (Chờ HR Duyệt)
                        </span>
                      )}
                      {menu.status === 'DRAFT' && (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          DRAFT (Bản Thảo)
                        </span>
                      )}
                      {menu.status === 'REJECTED' && (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                          REJECTED (Bị Từ Chối)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Rejection Note Warning */}
                  {menu.status === 'REJECTED' && menu.rejectionReason && (
                    <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 text-xs text-rose-900">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <span>Lý do HR từ chối duyệt:</span>
                      </div>
                      <p className="mt-1 pl-5 text-rose-800 font-medium">{menu.rejectionReason}</p>
                    </div>
                  )}

                  {/* Dishes inside this menu */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Các món trong thực đơn:
                    </span>
                    <div className="grid grid-cols-1 gap-2 text-xs">
                      {menu.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="font-medium text-slate-800">{item.name}</span>
                          <div className="flex items-center gap-2">
                            {item.isVegetarian && (
                              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-sm">
                                Chay
                              </span>
                            )}
                            <span className="text-slate-400 font-mono text-[11px]">{item.calories} kcal</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Workflow Action Buttons */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-slate-900">{formatVND(menu.price)}/suất</span>

                    <div className="flex items-center gap-2">
                      {(menu.status === 'DRAFT' || menu.status === 'REJECTED') && (
                        <button
                          onClick={() => handleSubmitMenu(menu.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Gửi HR Duyệt</span>
                        </button>
                      )}

                      {menu.status === 'APPROVED' && (
                        <button
                          onClick={() => handlePublishMenu(menu.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition cursor-pointer shadow-xs"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Công Bố (Publish)</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: INVENTORY MANAGEMENT */}
      {kitchenTab === 'inventory' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Quản Lý Tồn Kho & Giao Dịch Kho</h3>
              <p className="text-xs text-slate-500">
                Mọi thay đổi tồn kho đều tạo Inventory_Transaction bất biến (IN, OUT, ADJUSTMENT, WASTE) kèm lý do.
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedInvItem(inventory[0] || null);
                setIsTxModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Thực Hiện Giao Dịch Kho</span>
            </button>
          </div>

          {/* Inventory Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-4">SKU / Mặt Hàng</th>
                    <th className="p-4">Nhóm</th>
                    <th className="p-4">Tồn Hiện Tại</th>
                    <th className="p-4">Tồn Tối Thiểu</th>
                    <th className="p-4">Hạn Sử Dụng</th>
                    <th className="p-4">Đơn Giá Vốn</th>
                    <th className="p-4">Trạng Thái</th>
                    <th className="p-4 text-right">Hành Động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inventory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{item.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {item.sku} - {item.supplier}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-sm bg-slate-100 text-slate-700 text-[11px]">
                          {item.category}
                        </span>
                      </td>
                      <td className="p-4 font-extrabold text-slate-900 text-sm">
                        {item.currentStock} <span className="text-xs font-normal text-slate-500">{item.unit}</span>
                      </td>
                      <td className="p-4 font-mono text-slate-500">
                        {item.minimumStock} {item.unit}
                      </td>
                      <td className="p-4 font-mono">{item.expiryDate}</td>
                      <td className="p-4 font-mono font-semibold">{formatVND(item.unitCost)}</td>
                      <td className="p-4">
                        {item.status === 'LOW' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Cảnh Báo Tồn Thấp
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Đủ Tồn Kho
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedInvItem(item);
                            setIsTxModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                          Nhập / Xuất
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Transactions Feed */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="font-bold text-sm text-slate-900">Nhật Ký Giao Dịch Kho Gần Nhất</h4>
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        tx.type === 'IN'
                          ? 'bg-emerald-100 text-emerald-700'
                          : tx.type === 'OUT'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {tx.type === 'IN' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">
                        {tx.type} {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}: {tx.inventoryItemName}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Lý do: <em>{tx.reason}</em> - Thực hiện bởi: {tx.performedByName}
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="font-bold text-slate-700">Tồn sau: {tx.balanceAfter}</div>
                    <div className="text-[10px] text-slate-400">{new Date(tx.createdAt).toLocaleTimeString('vi-VN')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Inventory Transaction Modal */}
      {isTxModalOpen && selectedInvItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreateInventoryTx} className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-bold text-base text-slate-900">Giao Dịch Kho: {selectedInvItem.name}</h3>
            <p className="text-xs text-slate-500">
              Hiện tồn: <strong>{selectedInvItem.currentStock} {selectedInvItem.unit}</strong> (Định mức tối thiểu: {selectedInvItem.minimumStock} {selectedInvItem.unit})
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Loại giao dịch:</label>
                <select
                  value={txType}
                  onChange={(e) => setTxType(e.target.value as 'IN' | 'OUT' | 'ADJUSTMENT' | 'WASTE')}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                >
                  <option value="IN">IN - Nhập hàng từ nhà cung cấp</option>
                  <option value="OUT">OUT - Xuất bếp chế biến món ăn</option>
                  <option value="ADJUSTMENT">ADJUSTMENT - Điều chỉnh kiểm kê thực tế</option>
                  <option value="WASTE">WASTE - Tiêu hao / Hủy hàng hỏng</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Số lượng ({selectedInvItem.unit}):</label>
                <input
                  type="number"
                  min={1}
                  value={txQty}
                  onChange={(e) => setTxQty(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Lý do giao dịch (Bắt buộc):</label>
                <input
                  type="text"
                  value={txReason}
                  onChange={(e) => setTxReason(e.target.value)}
                  placeholder="Ví dụ: Xuất nấu ca trưa 150 suất / Nhập kho định kỳ"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsTxModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer"
              >
                Lưu Giao Dịch
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: MASTER DISH CATALOG */}
      {kitchenTab === 'dishes' && (
        <MasterDishCatalog
          currentUser={currentUser}
          masterDishes={masterDishes}
          onRefresh={loadAll}
        />
      )}

      {/* TAB 5: MASAN 100% INVENTORY FORECASTING & PROCUREMENT */}
      {kitchenTab === 'masan-forecasting' && (
        <MasanInventoryForecasting
          currentUser={currentUser}
          onRefreshGlobal={loadAll}
        />
      )}

      {/* MODAL: DISH PICKER FOR MENU CREATION */}
      {isDishPickerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Utensils className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Chọn Món Ăn Từ Ngân Hàng Món Chuẩn (Đã Được GA Duyệt)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Chọn các món để đưa vào thực đơn ca ăn. Chỉ các món có trạng thái "Đã Duyệt" mới được đưa vào thực đơn.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDishPickerOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl font-bold cursor-pointer leading-none"
              >
                ×
              </button>
            </div>

            <MasterDishCatalog
              currentUser={currentUser}
              masterDishes={masterDishes}
              onRefresh={loadAll}
              isPickerMode={true}
              minSelection={2}
              maxSelection={3}
              initialSelectedIds={newMenuItems.map((d) => d.id)}
              onConfirmSelection={(selectedDishes) => {
                setNewMenuItems(selectedDishes);
                setIsDishPickerOpen(false);
              }}
              onClosePicker={() => setIsDishPickerOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
