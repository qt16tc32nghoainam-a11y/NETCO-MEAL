import { useState, useEffect, useCallback, type FormEvent } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  TrendingUp,
  DollarSign,
  Building,
  Users,
  Utensils,
  Calendar,
  AlertCircle,
  Check,
  Search,
  Send,
  Bell,
  Phone,
  Mail,
  BookOpen,
  ShieldCheck,
  CheckSquare,
  Square,
  Clock,
  ChevronRight
} from 'lucide-react';
import {
  User,
  Menu,
  MenuItem,
  AttendanceComparison,
  AttendanceSyncRun,
  Booking
} from '../../types';
import { fetchApi, formatVND } from '../../utils/api';

interface HrPortalProps {
  currentUser: User;
  onRefreshGlobal?: () => void;
}

export function HrPortal({ currentUser, onRefreshGlobal }: HrPortalProps) {
  const [hrTab, setHrTab] = useState<'approvals' | 'dish-approvals' | 'attendance' | 'finance'>('approvals');
  const [pendingMenus, setPendingMenus] = useState<Menu[]>([]);
  const [allDishes, setAllDishes] = useState<MenuItem[]>([]);
  const [dishFilterStatus, setDishFilterStatus] = useState<'ALL' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'>('PENDING_APPROVAL');
  const [comparison, setComparison] = useState<AttendanceComparison | null>(null);
  const [syncRuns, setSyncRuns] = useState<AttendanceSyncRun[]>([]);
  const [reportData, setReportData] = useState<{
    totalBookings: number;
    totalCheckedIn: number;
    totalNoShow: number;
    totalAttendance: number;
    totalCostToday: number;
    costByDept: { departmentName: string; count: number; totalCost: number }[];
  } | null>(null);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);

  // Menu Rejection Modal State
  const [rejectingMenuId, setRejectingMenuId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  // Dish Rejection Modal State
  const [rejectingDishId, setRejectingDishId] = useState<string | null>(null);
  const [rejectDishReason, setRejectDishReason] = useState<string>('');

  // Attendance Sub-tab & Multi-Select
  const [attSubTab, setAttSubTab] = useState<'unbooked' | 'departments' | 'unattended' | 'sync-history'>('unbooked');
  const [selectedUnbookedEmpCodes, setSelectedUnbookedEmpCodes] = useState<string[]>([]);
  const [unbookedSearch, setUnbookedSearch] = useState('');
  const [unbookedDeptFilter, setUnbookedDeptFilter] = useState('ALL');

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [menusData, attData, repData, bksData, dishesData] = await Promise.all([
        fetchApi<Menu[]>('/menus', {}, currentUser.id),
        fetchApi<{ comparison: AttendanceComparison; syncRuns: AttendanceSyncRun[] }>('/attendance/comparison', {}, currentUser.id),
        fetchApi<{ hr: { totalBookings: number; totalCheckedIn: number; totalNoShow: number; totalAttendance: number; totalCostToday: number; costByDept: { departmentName: string; count: number; totalCost: number }[] } }>('/reports/dashboard', {}, currentUser.id),
        fetchApi<Booking[]>('/bookings', {}, currentUser.id),
        fetchApi<MenuItem[]>('/dishes', {}, currentUser.id),
      ]);

      setPendingMenus(menusData.filter((m) => m.status === 'PENDING_APPROVAL'));
      setComparison(attData.comparison);
      setSyncRuns(attData.syncRuns);
      setReportData(repData.hr);
      setAllBookings(bksData);
      setAllDishes(dishesData);
    } catch (err: unknown) {
      console.error('Error loading HR/GA data:', err);
    }
  }, [currentUser.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Menu Approval
  const handleApproveMenu = async (menuId: string) => {
    try {
      await fetchApi(`/menus/${menuId}/approve`, { method: 'POST' }, currentUser.id);
      setMessage({ type: 'success', text: 'Đã phê duyệt thực đơn thành công! Bếp Trưởng có thể bấm công bố (Publish).' });
      await loadData();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi khi phê duyệt thực đơn';
      setMessage({ type: 'error', text: errorMsg });
    }
  };

  // Handle Menu Rejection
  const handleRejectMenu = async (e: FormEvent) => {
    e.preventDefault();
    if (!rejectingMenuId || !rejectReason.trim()) {
      setMessage({ type: 'error', text: 'Bắt buộc phải nhập lý do từ chối thực đơn.' });
      return;
    }

    try {
      await fetchApi(
        `/menus/${rejectingMenuId}/reject`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: rejectReason }),
        },
        currentUser.id
      );

      setMessage({ type: 'success', text: 'Đã từ chối thực đơn và gửi phản hồi lại cho Bếp Trưởng điều chỉnh.' });
      setRejectingMenuId(null);
      setRejectReason('');
      await loadData();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi khi từ chối thực đơn';
      setMessage({ type: 'error', text: errorMsg });
    }
  };

  // Handle Dish Approval
  const handleApproveDish = async (dishId: string) => {
    try {
      await fetchApi(`/dishes/${dishId}/approve`, { method: 'POST' }, currentUser.id);
      setMessage({
        type: 'success',
        text: 'Đã phê duyệt món ăn vào Ngân Hàng Món Chuẩn! Bếp Trưởng có thể chọn món này khi lên thực đơn tuần/ngày.',
      });
      await loadData();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi khi phê duyệt món ăn';
      setMessage({ type: 'error', text: errorMsg });
    }
  };

  // Handle Dish Rejection
  const handleRejectDish = async (e: FormEvent) => {
    e.preventDefault();
    if (!rejectingDishId || !rejectDishReason.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập lý do từ chối món ăn.' });
      return;
    }

    try {
      await fetchApi(
        `/dishes/${rejectingDishId}/reject`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: rejectDishReason }),
        },
        currentUser.id
      );

      setMessage({ type: 'success', text: 'Đã từ chối món ăn và thông báo lại cho Bếp Trưởng.' });
      setRejectingDishId(null);
      setRejectDishReason('');
      await loadData();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi khi từ chối món ăn';
      setMessage({ type: 'error', text: errorMsg });
    }
  };

  // Lấy số lượng & danh sách nhân viên chấm công hôm nay từ hệ thống chấm công độc lập bên ngoài (chỉ đọc)
  const handleSyncAttendance = async () => {
    try {
      setIsSyncing(true);
      await fetchApi('/attendance/sync', { method: 'POST' }, currentUser.id);
      setMessage({ type: 'success', text: 'Đã lấy số lượng & danh sách nhân viên chấm công hôm nay từ hệ thống chấm công độc lập và cập nhật đối soát suất ăn!' });
      await loadData();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi khi lấy dữ liệu từ hệ thống chấm công độc lập';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsSyncing(false);
    }
  };

  // Bulk Emergency Booking
  const handleEmergencyBookBulk = async (empCodes: string[]) => {
    if (empCodes.length === 0) {
      setMessage({ type: 'error', text: 'Vui lòng chọn ít nhất 1 nhân viên để đặt cơm bổ sung!' });
      return;
    }

    try {
      setIsActionLoading(true);
      const res = await fetchApi<{ message: string; bookedCount: number }>(
        '/attendance/emergency-book-bulk',
        {
          method: 'POST',
          body: JSON.stringify({
            employeeCodes: empCodes,
            reason: 'Hành chính GA đặt bổ sung khẩn cấp theo dữ liệu từ hệ thống chấm công độc lập bên ngoài',
          }),
        },
        currentUser.id
      );

      setMessage({
        type: 'success',
        text: `Đã hoàn tất đặt cơm bổ sung khẩn cấp cho ${res.bookedCount} nhân viên! Bếp đã nhận được số lượng suất ăn cập nhật.`,
      });
      setSelectedUnbookedEmpCodes([]);
      await loadData();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi đặt cơm bổ sung';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Bulk Send Reminders
  const handleSendReminders = async (empCodes: string[]) => {
    if (empCodes.length === 0) {
      setMessage({ type: 'error', text: 'Vui lòng chọn ít nhất 1 nhân viên để gửi nhắc nhở!' });
      return;
    }

    try {
      setIsActionLoading(true);
      const res = await fetchApi<{ message: string; sentCount: number }>(
        '/attendance/send-reminders',
        {
          method: 'POST',
          body: JSON.stringify({ employeeCodes: empCodes }),
        },
        currentUser.id
      );

      setMessage({
        type: 'success',
        text: `Đã gửi thông báo nhắc nhở đặt cơm (Zalo / Email NETCO) tới ${res.sentCount} nhân viên thành công!`,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi gửi nhắc nhở';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Export CSV (Excel Compatible with UTF-8 BOM)
  const handleExportCSV = () => {
    const headers = [
      'Mã Booking',
      'Mã Nhân Viên',
      'Họ Và Tên',
      'Phòng Ban',
      'Ngày Ăn',
      'Ca Ăn',
      'Món Đã Chọn',
      'Giá Suất (VND)',
      'Trạng Thái',
      'Loại'
    ];
    const rows = allBookings.map((b) => [
      b.bookingCode,
      b.userEmployeeCode,
      `"${b.userName}"`,
      `"${b.departmentName}"`,
      b.mealDate,
      `"${b.shiftName}"`,
      `"${b.selectedItemNames.join('; ')}"`,
      b.priceSnapshot,
      b.status,
      b.isGuest ? 'Suất Khách' : 'Cá Nhân',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `NETCO_Meal_Bao_Cao_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print PDF
  const handlePrint = () => {
    window.print();
  };

  // Filtered Unbooked Employees
  const filteredUnbookedEmployees = (comparison?.unbookedEmployees || []).filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(unbookedSearch.toLowerCase()) ||
      emp.employeeCode.toLowerCase().includes(unbookedSearch.toLowerCase()) ||
      emp.phone.includes(unbookedSearch);
    const matchesDept = unbookedDeptFilter === 'ALL' || emp.departmentName === unbookedDeptFilter;
    return matchesSearch && matchesDept;
  });

  // Filtered Dishes
  const pendingDishes = allDishes.filter((d) => (d.status || 'APPROVED') === 'PENDING_APPROVAL');
  const filteredDishes = allDishes.filter((d) => {
    if (dishFilterStatus === 'ALL') return true;
    return (d.status || 'APPROVED') === dishFilterStatus;
  });

  // Unique departments from unbooked list
  const departmentsList = Array.from(
    new Set((comparison?.unbookedEmployees || []).map((e) => e.departmentName))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Sub Navigation */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setHrTab('approvals')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
              hrTab === 'approvals'
                ? 'bg-[#002D72] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Duyệt Thực Đơn ({pendingMenus.length})</span>
          </button>
          <button
            onClick={() => setHrTab('dish-approvals')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
              hrTab === 'dish-approvals'
                ? 'bg-[#002D72] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Utensils className="w-4 h-4" />
            <span>Duyệt Món Ăn Mới ({pendingDishes.length})</span>
          </button>
          <button
            onClick={() => setHrTab('attendance')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
              hrTab === 'attendance'
                ? 'bg-[#002D72] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Đối Soát Chấm Công & Đặt Cơm</span>
          </button>
          <button
            onClick={() => setHrTab('finance')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
              hrTab === 'finance'
                ? 'bg-[#002D72] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Báo Cáo Chi Phí & Xuất Dữ Liệu</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Xuất Excel/CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>In Báo Cáo / PDF</span>
          </button>
        </div>
      </div>

      {/* Message alert */}
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

      {/* TAB 1: MENU APPROVALS */}
      {hrTab === 'approvals' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="text-base font-bold text-slate-900">Danh Sách Thực Đơn Chờ Ban Hành Chính (GA) Phê Duyệt</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Đảm bảo tiêu chuẩn dinh dưỡng, chi phí theo định mức và tính đa dạng của thực đơn doanh nghiệp NETCO Meal.
            </p>
          </div>

          {pendingMenus.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">Không có thực đơn nào đang chờ duyệt</h4>
              <p className="text-xs text-slate-500">Tất cả các thực đơn do Bếp Trưởng gửi lên đều đã được xử lý xong.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingMenus.map((menu) => (
                <div key={menu.id} className="bg-white p-6 rounded-2xl border border-blue-200 shadow-md space-y-4">
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-amber-100 text-amber-800 uppercase">
                        Chờ Phê Duyệt
                      </span>
                      <h4 className="font-extrabold text-base text-slate-900 mt-1">{menu.title}</h4>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Ngày phục vụ: <strong>{menu.date}</strong> | Người tạo: <strong>{menu.createdByName}</strong>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Đơn giá đề xuất:</div>
                      <div className="font-mono font-extrabold text-[#002D72] text-base">{formatVND(menu.price)}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-700 block">Các món trong thực đơn:</span>
                    <div className="grid grid-cols-1 gap-2">
                      {menu.items.map((item) => (
                        <div key={item.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-slate-800">{item.name}</div>
                            <div className="text-[11px] text-slate-500">{item.description}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {item.isVegetarian && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-sm">
                                Chay
                              </span>
                            )}
                            <span className="text-slate-400 font-mono text-[11px]">{item.calories} kcal</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setRejectingMenuId(menu.id);
                        setRejectReason('');
                      }}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition cursor-pointer border border-rose-200"
                    >
                      Từ Chối (Reject)
                    </button>
                    <button
                      onClick={() => handleApproveMenu(menu.id)}
                      className="px-5 py-2 bg-[#002D72] hover:bg-[#001D4A] text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
                    >
                      Phê Duyệt (Approve)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reject Reason Modal */}
          {rejectingMenuId && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <form onSubmit={handleRejectMenu} className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
                <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Từ Chối Phê Duyệt Thực Đơn</span>
                </div>
                <p className="text-xs text-slate-500">
                  Theo quy định nghiệp vụ, bắt buộc phải cung cấp lý do từ chối để Bếp Trưởng có cơ sở chỉnh sửa lại thực đơn.
                </p>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Lý do từ chối chi tiết:</label>
                  <textarea
                    rows={4}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Ví dụ: Thiếu món tráng miệng theo định mức quy định, calo vượt quá giới hạn khuyến nghị..."
                    className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setRejectingMenuId(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Hủy Bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer"
                  >
                    Xác Nhận Từ Chối
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DISH APPROVALS (NGÂN HÀNG MÓN ĂN CHUẨN) */}
      {hrTab === 'dish-approvals' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-xs gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Phê Duyệt Món Ăn Mới Vào Ngân Hàng Món Chuẩn (Master Dish Catalog)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Khi Bếp tạo món mới, Ban Hành Chính (GA) sẽ kiểm duyệt nguyên liệu, calo, an toàn thực phẩm trước khi cho phép đưa vào thực đơn ca ăn.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Lọc theo trạng thái:</span>
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setDishFilterStatus('PENDING_APPROVAL')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    dishFilterStatus === 'PENDING_APPROVAL' ? 'bg-[#002D72] text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Chờ Duyệt ({pendingDishes.length})
                </button>
                <button
                  onClick={() => setDishFilterStatus('APPROVED')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    dishFilterStatus === 'APPROVED' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Đã Duyệt
                </button>
                <button
                  onClick={() => setDishFilterStatus('REJECTED')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    dishFilterStatus === 'REJECTED' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Từ Chối
                </button>
                <button
                  onClick={() => setDishFilterStatus('ALL')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    dishFilterStatus === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tất Cả ({allDishes.length})
                </button>
              </div>
            </div>
          </div>

          {filteredDishes.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">Không có món ăn nào trong mục này</h4>
              <p className="text-xs text-slate-500">Không có món ăn nào khớp với bộ lọc hiện tại.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDishes.map((dish) => {
                const status = dish.status || 'APPROVED';
                return (
                  <div key={dish.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between">
                    <div>
                      <div className="relative h-40 bg-slate-100 overflow-hidden">
                        <img
                          src={dish.imageUrl}
                          alt={dish.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 left-3 flex gap-1.5">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-white/90 text-slate-800 backdrop-blur-xs shadow-xs">
                            {dish.category}
                          </span>
                          {dish.isVegetarian && (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-600 text-white shadow-xs">
                              Món Chay
                            </span>
                          )}
                        </div>
                        <div className="absolute top-3 right-3">
                          {status === 'APPROVED' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-xs">
                              Đã Duyệt
                            </span>
                          )}
                          {status === 'PENDING_APPROVAL' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-xs animate-pulse">
                              Chờ GA Duyệt
                            </span>
                          )}
                          {status === 'REJECTED' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 shadow-xs">
                              Đã Từ Chối
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-4 space-y-2">
                        <h4 className="font-bold text-sm text-slate-900">{dish.name}</h4>
                        <p className="text-xs text-slate-500 line-clamp-2">{dish.description}</p>

                        <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-100">
                          <span>Năng lượng:</span>
                          <span className="font-bold font-mono text-slate-800">{dish.calories} kcal</span>
                        </div>

                        {dish.allergens && dish.allergens.length > 0 && (
                          <div className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg">
                            <strong>Dị ứng:</strong> {dish.allergens.join(', ')}
                          </div>
                        )}

                        {dish.submittedByName && (
                          <div className="text-[11px] text-slate-400">
                            Đề xuất bởi: <strong>{dish.submittedByName}</strong> ({dish.submittedAt ? new Date(dish.submittedAt).toLocaleDateString('vi-VN') : ''})
                          </div>
                        )}

                        {status === 'REJECTED' && dish.rejectionReason && (
                          <div className="text-[11px] text-rose-800 bg-rose-50 p-2 rounded-lg border border-rose-100">
                            <strong>Lý do từ chối:</strong> {dish.rejectionReason}
                          </div>
                        )}
                      </div>
                    </div>

                    {status === 'PENDING_APPROVAL' && (
                      <div className="p-4 pt-0 border-t border-slate-100 flex items-center justify-end gap-2 mt-2">
                        <button
                          onClick={() => {
                            setRejectingDishId(dish.id);
                            setRejectDishReason('');
                          }}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg transition cursor-pointer border border-rose-200"
                        >
                          Từ Chối
                        </button>
                        <button
                          onClick={() => handleApproveDish(dish.id)}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition cursor-pointer shadow-xs flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Duyệt Món Vào Thư Viện</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Dish Rejection Modal */}
          {rejectingDishId && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <form onSubmit={handleRejectDish} className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
                <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Từ Chối Món Ăn Mới</span>
                </div>
                <p className="text-xs text-slate-500">
                  Nhập lý do từ chối để Bếp Trưởng nắm được thông tin (ví dụ: nguyên liệu không phù hợp, dị ứng cao, calo quá lớn...).
                </p>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Lý do từ chối:</label>
                  <textarea
                    rows={4}
                    value={rejectDishReason}
                    onChange={(e) => setRejectDishReason(e.target.value)}
                    placeholder="Ví dụ: Món này có thành phần nguyên liệu chi phí vượt quá định mức bữa ăn NETCO Meal..."
                    className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setRejectingDishId(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Hủy Bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer"
                  >
                    Xác Nhận Từ Chối
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ATTENDANCE RECONCILIATION & COMPARISON */}
      {hrTab === 'attendance' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-xs gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Đối Soát Dữ Liệu Chấm Công (Hệ Thống Độc Lập) & Suất Ăn Doanh Nghiệp NETCO Meal
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Lấy số lượng & danh sách nhân viên chấm công hôm nay từ hệ thống chấm công độc lập bên ngoài, rồi so sánh với số suất cơm đã đặt và thực tế đã quét QR Check-in tại nhà ăn.
              </p>
            </div>
            <button
              onClick={handleSyncAttendance}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 bg-[#002D72] hover:bg-[#001D4A] text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs disabled:bg-slate-300"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Đang lấy dữ liệu...' : 'Lấy Dữ Liệu Chấm Công Hôm Nay (Hệ Thống Độc Lập)'}</span>
            </button>
          </div>

          {/* Metric Comparison Cards */}
          {comparison && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng Chấm Công Hôm Nay</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">
                  {comparison.totalAttendance} <span className="text-xs font-semibold text-slate-500">nhân sự</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Nguồn: hệ thống chấm công độc lập</div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng Suất Đã Đặt</div>
                <div className="text-2xl font-extrabold text-[#002D72] mt-1">
                  {comparison.totalBookings} <span className="text-xs font-semibold text-slate-500">suất</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Cá nhân, phòng ban & khách</div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Đã Quét Check-in</div>
                <div className="text-2xl font-extrabold text-emerald-600 mt-1">
                  {comparison.totalCheckedIn} <span className="text-xs font-semibold text-slate-500">suất</span>
                </div>
                <div className="text-[11px] text-emerald-700 mt-0.5 font-medium">Đã dùng bữa thực tế</div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-xs">
                <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Có Mặt Chưa Đặt Cơm</div>
                <div className="text-2xl font-extrabold text-amber-600 mt-1">
                  {comparison.unbookedAttendanceCount} <span className="text-xs font-semibold text-slate-500">người</span>
                </div>
                <div className="text-[11px] text-amber-800 mt-0.5 font-medium">Cần xử lý bổ sung</div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/30 shadow-xs">
                <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Đặt Nhưng Chưa Chấm Công</div>
                <div className="text-2xl font-extrabold text-rose-600 mt-1">
                  {comparison.unattendedBookingCount} <span className="text-xs font-semibold text-slate-500">suất</span>
                </div>
                <div className="text-[11px] text-rose-800 mt-0.5 font-medium">Nguy cơ dư thừa suất</div>
              </div>
            </div>
          )}

          {/* Sub Navigation Tabs inside Attendance */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => setAttSubTab('unbooked')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                attSubTab === 'unbooked'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Nhân Viên Đi Làm Chưa Đặt Cơm ({comparison?.unbookedEmployees?.length || 0})</span>
            </button>
            <button
              onClick={() => setAttSubTab('departments')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                attSubTab === 'departments'
                  ? 'bg-[#002D72] text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Đối Soát Theo Phòng Ban ({comparison?.departmentBreakdown?.length || 0})</span>
            </button>
            <button
              onClick={() => setAttSubTab('unattended')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                attSubTab === 'unattended'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Đã Đặt Cơm Nhưng Vắng Mặt ({comparison?.unattendedBookings?.length || 0})</span>
            </button>
            <button
              onClick={() => setAttSubTab('sync-history')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                attSubTab === 'sync-history'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Lịch Sử Lấy Dữ Liệu Chấm Công ({syncRuns.length})</span>
            </button>
          </div>

          {/* ATTENDANCE SUB-TAB 1: UNBOOKED EMPLOYEES */}
          {attSubTab === 'unbooked' && (
            <div className="space-y-4">
              {/* Filter and Bulk Action Bar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                    <div className="relative flex-1 min-w-[180px]">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={unbookedSearch}
                        onChange={(e) => setUnbookedSearch(e.target.value)}
                        placeholder="Tìm theo tên, mã NV, SĐT..."
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <select
                      value={unbookedDeptFilter}
                      onChange={(e) => setUnbookedDeptFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                    >
                      <option value="ALL">Tất cả phòng ban</option>
                      {departmentsList.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Bulk Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (selectedUnbookedEmpCodes.length === filteredUnbookedEmployees.length) {
                          setSelectedUnbookedEmpCodes([]);
                        } else {
                          setSelectedUnbookedEmpCodes(filteredUnbookedEmployees.map((e) => e.employeeCode));
                        }
                      }}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      {selectedUnbookedEmpCodes.length === filteredUnbookedEmployees.length && filteredUnbookedEmployees.length > 0
                        ? 'Bỏ Chọn Tất Cả'
                        : `Chọn Tất Cả (${filteredUnbookedEmployees.length})`}
                    </button>

                    <button
                      onClick={() => handleSendReminders(selectedUnbookedEmpCodes)}
                      disabled={selectedUnbookedEmpCodes.length === 0 || isActionLoading}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-[#002D72] hover:bg-[#001D4A] text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Gửi Nhắc Nhở ({selectedUnbookedEmpCodes.length})</span>
                    </button>

                    <button
                      onClick={() => handleEmergencyBookBulk(selectedUnbookedEmpCodes)}
                      disabled={selectedUnbookedEmpCodes.length === 0 || isActionLoading}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#D12630] hover:bg-[#B01F28] text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>GA Đặt Bổ Sung Khẩn Cấp ({selectedUnbookedEmpCodes.length})</span>
                    </button>
                  </div>
                </div>

                {selectedUnbookedEmpCodes.length > 0 && (
                  <div className="text-xs bg-amber-50 text-amber-900 px-3 py-2 rounded-xl border border-amber-200 flex items-center justify-between">
                    <span>
                      Đang chọn <strong>{selectedUnbookedEmpCodes.length}</strong> nhân sự chưa đặt cơm. Bạn có thể gửi tin nhắn nhắc nhở hoặc đặt bổ sung ngay lập tức để kịp chuyển số lượng sang bếp.
                    </span>
                    <button
                      onClick={() => setSelectedUnbookedEmpCodes([])}
                      className="text-amber-800 font-bold underline cursor-pointer ml-2"
                    >
                      Hủy chọn
                    </button>
                  </div>
                )}
              </div>

              {/* Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="p-3.5 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              filteredUnbookedEmployees.length > 0 &&
                              selectedUnbookedEmpCodes.length === filteredUnbookedEmployees.length
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUnbookedEmpCodes(filteredUnbookedEmployees.map((emp) => emp.employeeCode));
                              } else {
                                setSelectedUnbookedEmpCodes([]);
                              }
                            }}
                            className="rounded text-[#002D72] focus:ring-[#002D72]"
                          />
                        </th>
                        <th className="p-3.5">Mã NV & Họ Tên</th>
                        <th className="p-3.5">Phòng Ban</th>
                        <th className="p-3.5">Chấm Công Lúc</th>
                        <th className="p-3.5">Cổng / Máy Quẹt</th>
                        <th className="p-3.5">Thông Tin Liên Hệ</th>
                        <th className="p-3.5 text-right">Thao Tác Nhanh</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUnbookedEmployees.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400">
                            Tuyệt vời! Không có nhân viên nào có mặt mà chưa đặt cơm.
                          </td>
                        </tr>
                      ) : (
                        filteredUnbookedEmployees.map((emp) => {
                          const isSelected = selectedUnbookedEmpCodes.includes(emp.employeeCode);
                          return (
                            <tr
                              key={emp.employeeCode}
                              className={`hover:bg-slate-50/80 transition ${
                                isSelected ? 'bg-amber-50/40' : ''
                              }`}
                            >
                              <td className="p-3.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    if (isSelected) {
                                      setSelectedUnbookedEmpCodes((prev) =>
                                        prev.filter((c) => c !== emp.employeeCode)
                                      );
                                    } else {
                                      setSelectedUnbookedEmpCodes((prev) => [...prev, emp.employeeCode]);
                                    }
                                  }}
                                  className="rounded text-[#002D72] focus:ring-[#002D72]"
                                />
                              </td>
                              <td className="p-3.5">
                                <div className="font-bold text-slate-900">{emp.name}</div>
                                <div className="text-[11px] font-mono text-slate-400">{emp.employeeCode}</div>
                              </td>
                              <td className="p-3.5">
                                <span className="px-2 py-0.5 bg-slate-100 rounded-md text-slate-700 font-semibold text-[11px]">
                                  {emp.departmentName}
                                </span>
                              </td>
                              <td className="p-3.5 font-mono text-slate-700 font-bold">
                                {emp.checkInTime}
                              </td>
                              <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                                {emp.machineId}
                              </td>
                              <td className="p-3.5">
                                <div className="flex flex-col text-[11px]">
                                  <span className="flex items-center gap-1 text-slate-700">
                                    <Phone className="w-3 h-3 text-slate-400" />
                                    {emp.phone}
                                  </span>
                                  <span className="flex items-center gap-1 text-slate-400">
                                    <Mail className="w-3 h-3 text-slate-400" />
                                    {emp.email}
                                  </span>
                                </div>
                              </td>
                              <td className="p-3.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleSendReminders([emp.employeeCode])}
                                    title="Gửi tin nhắn nhắc nhở cá nhân"
                                    className="px-2.5 py-1 text-[11px] font-bold text-[#002D72] bg-blue-50 hover:bg-blue-100 rounded-lg transition cursor-pointer"
                                  >
                                    Nhắc Nhở
                                  </button>
                                  <button
                                    onClick={() => handleEmergencyBookBulk([emp.employeeCode])}
                                    title="Hành chính GA đặt bổ sung ngay cho nhân viên này"
                                    className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#D12630] hover:bg-[#B01F28] rounded-lg transition cursor-pointer shadow-2xs"
                                  >
                                    Đặt Bổ Sung
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ATTENDANCE SUB-TAB 2: DEPARTMENT BREAKDOWN */}
          {attSubTab === 'departments' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">
                    Báo Cáo Tỷ Lệ Đặt Cơm & Tuân Thủ Theo Phòng Ban
                  </h4>
                  <p className="text-xs text-slate-500">
                    So sánh số nhân sự có mặt chấm công vs số suất cơm đã đăng ký theo từng khối phòng ban.
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Phòng Ban</th>
                      <th className="p-3.5 text-center">Tổng Nhân Sự</th>
                      <th className="p-3.5 text-center">Có Mặt Hôm Nay</th>
                      <th className="p-3.5 text-center">Đã Đặt Cơm</th>
                      <th className="p-3.5 text-center">Chưa Đặt Cơm</th>
                      <th className="p-3.5 text-center">Đặt Nhưng Vắng</th>
                      <th className="p-3.5">Tỷ Lệ Tuân Thủ (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(comparison?.departmentBreakdown || []).map((dept) => (
                      <tr key={dept.departmentId} className="hover:bg-slate-50/80 transition">
                        <td className="p-3.5 font-bold text-slate-900">{dept.departmentName}</td>
                        <td className="p-3.5 text-center font-semibold text-slate-600">{dept.totalEmployees}</td>
                        <td className="p-3.5 text-center font-bold text-[#002D72]">{dept.clockedInCount}</td>
                        <td className="p-3.5 text-center font-bold text-emerald-600">{dept.bookedCount}</td>
                        <td className="p-3.5 text-center">
                          {dept.unbookedCount > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px]">
                              {dept.unbookedCount} người
                            </span>
                          ) : (
                            <span className="text-slate-400 font-semibold">0</span>
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          {dept.unattendedCount > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[11px]">
                              {dept.unattendedCount} suất
                            </span>
                          ) : (
                            <span className="text-slate-400 font-semibold">0</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  dept.complianceRate >= 90
                                    ? 'bg-emerald-500'
                                    : dept.complianceRate >= 70
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${dept.complianceRate}%` }}
                              />
                            </div>
                            <span className="font-mono font-bold text-slate-800">{dept.complianceRate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ATTENDANCE SUB-TAB 3: UNATTENDED BOOKINGS (ORDERED BUT DID NOT CLOCK IN) */}
          {attSubTab === 'unattended' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>Danh Sách Đặt Cơm Nhưng Không Quẹt Chấm Công Hôm Nay</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Những suất ăn này đã được bếp chuẩn bị nhưng người đặt chưa có ghi nhận chấm công (nghỉ ốm, công tác đột xuất...). Hành chính GA có thể liên hệ kiểm tra để hủy suất hoặc phân phối lại.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Mã Booking</th>
                      <th className="p-3.5">Mã NV & Họ Tên</th>
                      <th className="p-3.5">Phòng Ban</th>
                      <th className="p-3.5">Ca Ăn</th>
                      <th className="p-3.5">Trạng Thái Suất</th>
                      <th className="p-3.5 text-right">Cảnh Báo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(comparison?.unattendedBookings || []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          Không có trường hợp nào đặt cơm mà không đi làm hôm nay.
                        </td>
                      </tr>
                    ) : (
                      (comparison?.unattendedBookings || []).map((item) => (
                        <tr key={item.bookingCode} className="hover:bg-slate-50/80 transition">
                          <td className="p-3.5 font-mono font-bold text-slate-900">{item.bookingCode}</td>
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900">{item.name}</div>
                            <div className="text-[11px] font-mono text-slate-400">{item.employeeCode}</div>
                          </td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-semibold">
                              {item.departmentName}
                            </span>
                          </td>
                          <td className="p-3.5 font-semibold text-slate-800">{item.shiftName}</td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              {item.status}
                            </span>
                          </td>
                          <td className="p-3.5 text-right font-medium text-rose-600">
                            Chưa có dữ liệu chấm công
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ATTENDANCE SUB-TAB 4: SYNC HISTORY */}
          {attSubTab === 'sync-history' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <h4 className="font-bold text-sm text-slate-900">
                Nhật Ký Các Lần Lấy Dữ Liệu Từ Hệ Thống Chấm Công Độc Lập
              </h4>
              <div className="space-y-2">
                {syncRuns.map((run) => (
                  <div
                    key={run.id}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">
                        Lấy dữ liệu lúc: {new Date(run.syncedAt).toLocaleString('vi-VN')}
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        Thực hiện bởi: <strong>{run.triggeredBy}</strong>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-700">
                        Đã lấy về: <strong>{run.recordsProcessed}</strong> nhân viên chấm công
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {run.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: FINANCIAL REPORTS & EXPORTS */}
      {hrTab === 'finance' && reportData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng Ngân Sách Suất Ăn Hôm Nay</div>
              <div className="text-3xl font-extrabold text-[#002D72] mt-2">
                {formatVND(reportData.totalCostToday)}
              </div>
              <div className="text-xs text-slate-500 mt-1">Định mức tiêu chuẩn 45.000 đ/suất</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tỷ Lệ Check-in Dùng Bữa</div>
              <div className="text-3xl font-extrabold text-emerald-600 mt-2">
                {reportData.totalBookings > 0
                  ? ((reportData.totalCheckedIn / reportData.totalBookings) * 100).toFixed(1)
                  : 0}
                %
              </div>
              <div className="text-xs text-emerald-700 mt-1 font-medium">
                {reportData.totalCheckedIn} / {reportData.totalBookings} suất ăn
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Suất Bỏ Lỡ / Không Nhận (No-show)</div>
              <div className="text-3xl font-extrabold text-rose-600 mt-2">
                {reportData.totalNoShow} <span className="text-sm font-semibold text-slate-500">suất</span>
              </div>
              <div className="text-xs text-rose-700 mt-1 font-medium">Lãng phí ngân sách doanh nghiệp</div>
            </div>
          </div>

          {/* Department Breakdown Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-slate-900">Chi Phí Suất Ăn Phân Bổ Theo Phòng Ban</h4>
                <p className="text-xs text-slate-500">Đối chiếu hạch toán kế toán và chi phí nội bộ hàng tháng.</p>
              </div>
            </div>

            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-4">Phòng Ban</th>
                  <th className="p-4">Số Lượng Suất</th>
                  <th className="p-4">Tổng Chi Phí (VND)</th>
                  <th className="p-4">Tỷ Trọng Ngân Sách</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.costByDept.map((dept, idx) => {
                  const ratio = reportData.totalCostToday > 0 ? (dept.totalCost / reportData.totalCostToday) * 100 : 0;
                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 transition">
                      <td className="p-4 font-bold text-slate-900">{dept.departmentName}</td>
                      <td className="p-4 font-semibold">{dept.count} suất</td>
                      <td className="p-4 font-mono font-extrabold text-slate-900">{formatVND(dept.totalCost)}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div className="bg-[#002D72] h-full rounded-full" style={{ width: `${ratio}%` }} />
                          </div>
                          <span className="font-mono font-semibold">{ratio.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
