import { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  Utensils,
  QrCode,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  Flame,
  AlertTriangle,
  Leaf,
  Users,
  Building,
  UserCheck,
  Calendar,
  RefreshCw,
  Info,
  Check,
  ChevronRight,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { User, Menu, Shift, Booking, Department } from '../../types';
import { fetchApi, formatVND } from '../../utils/api';
import { UserIpcScanner } from './UserIpcScanner';
import { WeeklyMealBooking } from './WeeklyMealBooking';

interface EmployeePortalProps {
  currentUser: User;
  onRefreshGlobal?: () => void;
}

export function EmployeePortal({ currentUser, onRefreshGlobal }: EmployeePortalProps) {
  const [subTab, setSubTab] = useState<'order' | 'my-qr' | 'history'>('order');
  const [orderMode, setOrderMode] = useState<'personal' | 'weekly' | 'department' | 'guest'>('personal');

  const [menus, setMenus] = useState<Menu[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptEmployees, setDeptEmployees] = useState<User[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Selected state for ordering
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('shift_b');
  const [selectedDishIds, setSelectedDishIds] = useState<string[]>([]);
  const [orderNote, setOrderNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Department Bulk Booking state
  const [selectedDeptId, setSelectedDeptId] = useState<string>(currentUser.departmentId);
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [empSearch, setEmpSearch] = useState('');

  // Guest booking state
  const [guestName, setGuestName] = useState('');
  const [guestCount, setGuestCount] = useState(1);
  const [guestPurpose, setGuestPurpose] = useState('');

  // QR Code State
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrSecondsLeft, setQrSecondsLeft] = useState<number>(60);
  const [qrBooking, setQrBooking] = useState<Booking | null>(null);
  const [qrTokenString, setQrTokenString] = useState<string>('');
  const [isRefreshingQr, setIsRefreshingQr] = useState(false);

  // Fetch base data
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [menusData, shiftsData, deptsData, bookingsData] = await Promise.all([
        fetchApi<Menu[]>('/menus', {}, currentUser.id),
        fetchApi<Shift[]>('/shifts', {}, currentUser.id),
        fetchApi<Department[]>('/departments', {}, currentUser.id),
        fetchApi<Booking[]>('/bookings/me', {}, currentUser.id),
      ]);
      setMenus(menusData);
      setShifts(shiftsData);
      setDepartments(deptsData);
      setMyBookings(bookingsData);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi khi tải dữ liệu';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load department employees when selectedDeptId changes
  useEffect(() => {
    if (selectedDeptId) {
      fetchApi<User[]>(`/departments/${selectedDeptId}/employees`, {}, currentUser.id)
        .then((emps) => {
          setDeptEmployees(emps);
          // auto-select all active by default
          setSelectedEmpIds(emps.map((e) => e.id));
        })
        .catch(console.error);
    }
  }, [selectedDeptId, currentUser.id]);

  // Active Menu matching date & shift
  const currentMenu = menus.find(
    (m) => m.date === selectedDate && m.shiftId === selectedShiftId && m.status === 'PUBLISHED'
  );

  // Current active booking for selected date & shift
  const activeBookingForSlot = myBookings.find(
    (b) => b.mealDate === selectedDate && b.shiftId === selectedShiftId && b.status !== 'CANCELLED'
  );

  // Auto-select all dishes when current menu changes if not already set
  useEffect(() => {
    if (currentMenu && selectedDishIds.length === 0) {
      setSelectedDishIds(currentMenu.items.map((i) => i.id));
    }
  }, [currentMenu, selectedDishIds.length]);

  // Handlers for Personal Booking
  const handlePersonalOrder = async () => {
    if (!currentMenu) {
      setMessage({ type: 'error', text: 'Chưa có thực đơn công bố (PUBLISHED) cho ca và ngày này.' });
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    try {
      const result = await fetchApi<Booking>(
        '/bookings/personal',
        {
          method: 'POST',
          body: JSON.stringify({
            mealDate: selectedDate,
            shiftId: selectedShiftId,
            menuId: currentMenu.id,
            selectedItemIds: selectedDishIds,
            note: orderNote,
          }),
        },
        currentUser.id
      );

      setMessage({
        type: 'success',
        text: `Đăng ký suất ăn thành công! Mã booking: ${result.bookingCode}.`,
      });
      await loadData();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi khi đặt suất ăn';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handlers for Department Booking
  const handleDepartmentOrder = async () => {
    if (!currentMenu) {
      setMessage({ type: 'error', text: 'Chưa có thực đơn cho ca này.' });
      return;
    }
    if (selectedEmpIds.length === 0) {
      setMessage({ type: 'error', text: 'Vui lòng chọn ít nhất 1 nhân viên trong phòng ban.' });
      return;
    }
    if (selectedDishIds.length === 0) {
      setMessage({ type: 'error', text: 'Vui lòng chọn ít nhất 1 món ăn trong thực đơn cho phòng ban.' });
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    try {
      const result = await fetchApi<{ totalRequested: number; successCount: number }>(
        '/bookings/department',
        {
          method: 'POST',
          body: JSON.stringify({
            departmentId: selectedDeptId,
            employeeIds: selectedEmpIds,
            mealDate: selectedDate,
            shiftId: selectedShiftId,
            menuId: currentMenu.id,
            selectedItemIds: selectedDishIds,
          }),
        },
        currentUser.id
      );

      setMessage({
        type: 'success',
        text: `Đã hoàn tất đặt ăn cho phòng ban: Thành công ${result.successCount}/${result.totalRequested} nhân viên!`,
      });
      await loadData();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi khi đặt theo phòng ban';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handlers for Guest Booking
  const handleGuestOrder = async () => {
    if (!currentMenu) {
      setMessage({ type: 'error', text: 'Chưa có thực đơn cho ca này.' });
      return;
    }
    if (!guestName || !guestPurpose) {
      setMessage({ type: 'error', text: 'Vui lòng nhập tên đối tác và mục đích tiếp đón.' });
      return;
    }
    if (selectedDishIds.length === 0) {
      setMessage({ type: 'error', text: 'Vui lòng chọn ít nhất 1 món ăn trong thực đơn cho đoàn khách.' });
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    try {
      const result = await fetchApi<Booking>(
        '/bookings/guest',
        {
          method: 'POST',
          body: JSON.stringify({
            guestName,
            guestCount,
            purpose: guestPurpose,
            departmentId: currentUser.departmentId,
            mealDate: selectedDate,
            shiftId: selectedShiftId,
            menuId: currentMenu.id,
            selectedItemIds: selectedDishIds,
            note: orderNote,
          }),
        },
        currentUser.id
      );

      setMessage({
        type: 'success',
        text: `Đã đăng ký ${guestCount} suất ăn cho đoàn khách: ${guestName} (Mã: ${result.bookingCode}).`,
      });
      setGuestName('');
      setGuestPurpose('');
      await loadData();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi khi đặt suất khách';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel Booking
  const handleCancelBooking = async (bookingId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy suất ăn này không?')) return;
    try {
      await fetchApi(`/bookings/${bookingId}`, { method: 'DELETE' }, currentUser.id);
      setMessage({ type: 'success', text: 'Đã hủy suất ăn thành công.' });
      await loadData();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi khi hủy suất ăn';
      setMessage({ type: 'error', text: errorMsg });
    }
  };

  // Generate Rotating QR Code
  const refreshQrToken = useCallback(async () => {
    try {
      setIsRefreshingQr(true);
      const res = await fetchApi<{
        qrToken: string;
        expiresIn: number;
        booking: Booking;
      }>('/qr/token', { method: 'POST', body: JSON.stringify({}) }, currentUser.id);

      setQrBooking(res.booking);
      setQrTokenString(res.qrToken);
      setQrSecondsLeft(60);

      // Generate QR Canvas
      const url = await QRCode.toDataURL(res.qrToken, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      setQrDataUrl(url);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Chưa có suất ăn đã xác nhận hôm nay để tạo QR.';
      setMessage({ type: 'info', text: errorMsg });
      setQrDataUrl('');
      setQrBooking(null);
    } finally {
      setIsRefreshingQr(false);
    }
  }, [currentUser.id]);

  // QR Timer Countdown
  useEffect(() => {
    if (subTab !== 'my-qr') return;
    refreshQrToken();

    const interval = setInterval(() => {
      setQrSecondsLeft((prev) => {
        if (prev <= 1) {
          refreshQrToken();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [subTab, refreshQrToken]);

  const selectedShift = shifts.find((s) => s.id === selectedShiftId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Sub Tab Navigation */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubTab('order')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
              subTab === 'order'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Utensils className="w-4 h-4" />
            <span>Thực Đơn & Đặt Suất</span>
          </button>
          <button
            onClick={() => setSubTab('my-qr')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
              subTab === 'my-qr'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>📱 Quét QR Nhà Ăn (IPC)</span>
          </button>
          <button
            onClick={() => setSubTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
              subTab === 'history'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Lịch Sử Suất Ăn</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <Info className="w-4 h-4 text-slate-400" />
          <span>Thời gian chốt suất thực hiện tự động theo quy định ca làm việc.</span>
        </div>
      </div>

      {/* Global Alert Notification */}
      {message && (
        <div
          className={`p-4 rounded-xl text-sm flex items-start justify-between gap-3 shadow-xs animate-in fade-in ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : message.type === 'error'
              ? 'bg-rose-50 text-rose-900 border border-rose-200'
              : 'bg-blue-50 text-blue-900 border border-blue-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {message.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
            {message.type === 'error' && <XCircle className="w-5 h-5 text-rose-600 shrink-0" />}
            {message.type === 'info' && <Info className="w-5 h-5 text-blue-600 shrink-0" />}
            <span className="font-medium">{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-xs font-semibold underline opacity-70 hover:opacity-100 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* TAB 1: ORDER MEALS */}
      {subTab === 'order' && (
        <div className="space-y-6">
          {/* Filter Bar: Select Date & Shift */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Date Buttons */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  1. Chọn ngày dùng bữa:
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setSelectedDate(todayStr)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold border transition cursor-pointer ${
                      selectedDate === todayStr
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Hôm nay ({todayStr})
                  </button>
                  <button
                    onClick={() => setSelectedDate(tomorrowStr)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold border transition cursor-pointer ${
                      selectedDate === tomorrowStr
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Ngày mai ({tomorrowStr})
                  </button>
                </div>
              </div>

              {/* Shift Selector */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  2. Chọn ca phục vụ:
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {shifts.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedShiftId(s.id)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold border transition cursor-pointer ${
                        selectedShiftId === s.id
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>{s.name}</span>
                      <span className="text-[11px] opacity-75 ml-1.5 font-mono">({s.startTime})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Cut-off info card */}
            {selectedShift && (
              <div className="flex flex-wrap items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs text-slate-600 gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span>
                    Giờ chốt đặt suất ăn: <strong className="text-slate-800">{selectedShift.orderCutoffDisplay}</strong>
                  </span>
                  <span className="text-slate-300">|</span>
                  <span>
                    Giờ chốt hủy suất: <strong className="text-slate-800">{selectedShift.cancelCutoffDisplay}</strong>
                  </span>
                </div>
                <div className="text-emerald-700 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Hệ thống cho phép đăng ký suất ăn</span>
                </div>
              </div>
            )}
          </div>

          {/* Current Booking Status Banner for This Slot */}
          {activeBookingForSlot && (
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  ✓
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-950 text-sm">
                      Bạn đã đặt suất ăn cho ca này: {activeBookingForSlot.bookingCode}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-200 text-emerald-800">
                      {activeBookingForSlot.status === 'CHECKED_IN' ? 'Đã Quét Check-in' : 'Đã Xác Nhận'}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Món đã chọn: {activeBookingForSlot.selectedItemNames.join(', ')} - Giá suất:{' '}
                    {formatVND(activeBookingForSlot.priceSnapshot)}
                  </p>
                </div>
              </div>

              {activeBookingForSlot.status !== 'CHECKED_IN' && (
                <button
                  onClick={() => handleCancelBooking(activeBookingForSlot.id)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer shadow-xs"
                >
                  Hủy suất ăn trước cut-off
                </button>
              )}
            </div>
          )}

          {/* Booking Modes: Cá Nhân / Tuần / Phòng Ban / Khách */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="flex flex-wrap border-b border-slate-200 bg-slate-50/50">
              <button
                onClick={() => setOrderMode('personal')}
                className={`flex-1 min-w-[140px] py-3 px-3 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition cursor-pointer ${
                  orderMode === 'personal'
                    ? 'border-emerald-600 text-emerald-700 bg-white font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>Đặt Từng Ngày</span>
              </button>

              <button
                onClick={() => setOrderMode('weekly')}
                className={`flex-1 min-w-[160px] py-3 px-3 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition cursor-pointer ${
                  orderMode === 'weekly'
                    ? 'border-red-600 text-red-700 bg-white font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Calendar className="w-4 h-4 text-red-600" />
                <span>Đặt Cơm Cả Tuần</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800">
                  HOT
                </span>
              </button>

              {(currentUser.role === 'Department_Representative' ||
                currentUser.role === 'Administrator' ||
                currentUser.role === 'HR_GA') && (
                <button
                  onClick={() => setOrderMode('department')}
                  className={`flex-1 min-w-[150px] py-3 px-3 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition cursor-pointer ${
                    orderMode === 'department'
                      ? 'border-emerald-600 text-emerald-700 bg-white font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Building className="w-4 h-4" />
                  <span>Theo Phòng Ban</span>
                </button>
              )}

              <button
                onClick={() => setOrderMode('guest')}
                className={`flex-1 min-w-[140px] py-3 px-3 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition cursor-pointer ${
                  orderMode === 'guest'
                    ? 'border-emerald-600 text-emerald-700 bg-white font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Suất Khách Đối Tác</span>
              </button>
            </div>

            {orderMode === 'weekly' ? (
              <div className="p-6">
                <WeeklyMealBooking
                  currentUser={currentUser}
                  menus={menus}
                  shifts={shifts}
                  existingBookings={myBookings}
                  onBookingSuccess={() => {
                    loadData();
                    if (onRefreshGlobal) onRefreshGlobal();
                  }}
                />
              </div>
            ) : (
              <div className="p-6 space-y-6">
              {/* Menu Display */}
              {!currentMenu ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Utensils className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-700">Chưa có thực đơn cho thời điểm này</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Thực đơn cho ca này hiện đang được bếp soạn thảo hoặc đang chờ ban Nhân sự (HR/GA) phê duyệt trước khi công bố.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Menu Header Card */}
                  <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-100 gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">{currentMenu.title}</h3>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
                          {formatVND(currentMenu.price)}/suất
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{currentMenu.description}</p>
                    </div>
                    <div className="text-xs text-slate-500 text-right">
                      <div>Đầu bếp: <strong>{currentMenu.createdByName}</strong></div>
                      <div>Duyệt bởi: <strong>{currentMenu.approvedByName}</strong></div>
                    </div>
                  </div>

                  {/* Dishes Selection Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                    <div className="flex items-center gap-2">
                      <Utensils className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-slate-800">
                        {orderMode === 'personal' && 'Chọn món ăn cho suất của bạn:'}
                        {orderMode === 'department' && 'Chọn các món ăn cho suất của nhân viên phòng ban:'}
                        {orderMode === 'guest' && 'Chọn các món ăn tiếp đãi đoàn khách:'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 text-[11px]">
                        Đã chọn {selectedDishIds.length}/{currentMenu.items.length} món
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedDishIds(currentMenu.items.map((i) => i.id))}
                        className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-emerald-700 font-semibold hover:bg-emerald-50 transition cursor-pointer"
                      >
                        Chọn tất cả món
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedDishIds([])}
                        className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-600 font-semibold hover:bg-slate-100 transition cursor-pointer"
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>

                  {/* Dishes Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {currentMenu.items.map((dish) => {
                      const isSelected = selectedDishIds.includes(dish.id);
                      return (
                        <div
                          key={dish.id}
                          onClick={() => {
                            setSelectedDishIds((prev) =>
                              prev.includes(dish.id) ? prev.filter((id) => id !== dish.id) : [...prev, dish.id]
                            );
                          }}
                          className={`rounded-xl border overflow-hidden transition cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20 shadow-xs'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="relative h-36 w-full overflow-hidden bg-slate-100">
                            <img
                              src={dish.imageUrl}
                              alt={dish.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                            />
                            {dish.isVegetarian && (
                              <span className="absolute top-2 left-2 flex items-center gap-1 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                <Leaf className="w-3 h-3" /> Món Chay
                              </span>
                            )}
                            <span className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur text-white text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Flame className="w-3 h-3 text-amber-400" /> {dish.calories} kcal
                            </span>
                          </div>

                          <div className="p-3.5 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-bold text-sm text-slate-900 leading-snug">{dish.name}</h4>
                              <div
                                className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                                  isSelected
                                    ? 'bg-emerald-600 border-emerald-600 text-white'
                                    : 'border-slate-300 bg-white hover:border-slate-400'
                                }`}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5" />}
                              </div>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-2">{dish.description}</p>

                            {dish.allergens.length > 0 && (
                              <div className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 p-1.5 rounded-md border border-amber-200">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>Lưu ý dị ứng: {dish.allergens.join(', ')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Mode 1: Personal Submit Box */}
                  {orderMode === 'personal' && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 mt-6">
                      <div className="flex-1 min-w-[260px]">
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Ghi chú suất ăn (Tùy chọn):
                        </label>
                        <input
                          type="text"
                          value={orderNote}
                          onChange={(e) => setOrderNote(e.target.value)}
                          placeholder="Ví dụ: Ăn ít cơm, không hành mỡ, ăn suất chay..."
                          className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-xs text-slate-500">Đơn giá suất ăn:</div>
                          <div className="text-base font-extrabold text-slate-900">
                            {formatVND(currentMenu.price)}
                          </div>
                        </div>
                        <button
                          onClick={handlePersonalOrder}
                          disabled={isSubmitting || !!activeBookingForSlot}
                          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-xl transition cursor-pointer shadow-md shadow-emerald-600/20 flex items-center gap-2"
                        >
                          <Utensils className="w-4 h-4" />
                          <span>{isSubmitting ? 'Đang gửi...' : activeBookingForSlot ? 'Đã Đặt Suất Này' : 'Xác Nhận Đặt Ăn'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Mode 2: Department Bulk Booking Box */}
                  {orderMode === 'department' && (
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                        <div>
                          <h4 className="font-bold text-sm text-slate-800">
                            Đặt suất ăn hàng loạt cho nhân viên phòng ban
                          </h4>
                          <p className="text-xs text-slate-500">
                            Chọn nhân viên cần đăng ký suất ăn ngày {selectedDate} ({selectedShift?.name})
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedDeptId}
                            onChange={(e) => setSelectedDeptId(e.target.value)}
                            className="text-xs font-semibold px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                          >
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name} ({d.code})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Search & Select All Toolbar */}
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <input
                          type="text"
                          placeholder="Tìm theo tên hoặc mã nhân viên..."
                          value={empSearch}
                          onChange={(e) => setEmpSearch(e.target.value)}
                          className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs w-64"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedEmpIds(deptEmployees.map((e) => e.id))}
                            className="text-emerald-700 hover:underline font-semibold cursor-pointer"
                          >
                            Chọn tất cả ({deptEmployees.length})
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            onClick={() => setSelectedEmpIds([])}
                            className="text-rose-700 hover:underline font-semibold cursor-pointer"
                          >
                            Bỏ chọn
                          </button>
                        </div>
                      </div>

                      {/* Employee Checklist Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1">
                        {deptEmployees
                          .filter(
                            (e) =>
                              e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
                              e.employeeCode.toLowerCase().includes(empSearch.toLowerCase())
                          )
                          .map((emp) => {
                            const isChecked = selectedEmpIds.includes(emp.id);
                            return (
                              <label
                                key={emp.id}
                                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                                  isChecked
                                    ? 'bg-emerald-50/70 border-emerald-300 font-semibold text-emerald-950'
                                    : 'bg-white border-slate-200 text-slate-700'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedEmpIds([...selectedEmpIds, emp.id]);
                                    } else {
                                      setSelectedEmpIds(selectedEmpIds.filter((id) => id !== emp.id));
                                    }
                                  }}
                                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                                />
                                <div>
                                  <div>{emp.name}</div>
                                  <div className="text-[11px] text-slate-400 font-mono">{emp.employeeCode}</div>
                                </div>
                              </label>
                            );
                          })}
                      </div>

                      {/* Selected Dishes Summary for Department */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-700">Món ăn đã chọn cho suất ăn phòng ban:</span>
                          <span className="font-semibold text-emerald-700">{selectedDishIds.length} món</span>
                        </div>
                        {selectedDishIds.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {currentMenu.items
                              .filter((dish) => selectedDishIds.includes(dish.id))
                              .map((dish) => (
                                <span
                                  key={dish.id}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium text-[11px]"
                                >
                                  <span>{dish.name}</span>
                                </span>
                              ))}
                          </div>
                        ) : (
                          <p className="text-amber-700 text-[11px] font-medium">
                            ⚠️ Bạn chưa chọn món nào. Vui lòng bấm chọn món ở lưới thực đơn phía trên!
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                        <div className="text-xs text-slate-600">
                          Đã chọn: <strong className="text-slate-900">{selectedEmpIds.length}</strong> nhân viên | Tổng chi phí:{' '}
                          <strong className="text-emerald-700">{formatVND(selectedEmpIds.length * currentMenu.price)}</strong>
                        </div>
                        <button
                          onClick={handleDepartmentOrder}
                          disabled={isSubmitting || selectedEmpIds.length === 0 || selectedDishIds.length === 0}
                          className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm"
                        >
                          {isSubmitting ? 'Đang xử lý...' : `Xác nhận đặt cho ${selectedEmpIds.length} nhân viên`}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Mode 3: Guest Booking Box */}
                  {orderMode === 'guest' && (
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                      <div>
                        <h4 className="font-bold text-sm text-slate-800">Đặt Suất Ăn Tiếp Đón Khách Đối Tác</h4>
                        <p className="text-xs text-slate-500">
                          Chi phí suất ăn khách sẽ được hạch toán riêng vào ngân sách tiếp khách của phòng ban.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Tên khách / Đoàn khách:</label>
                          <input
                            type="text"
                            value={guestName}
                            onChange={(e) => setGuestName(e.target.value)}
                            placeholder="Ví dụ: Đoàn Chuyên Gia Viettel IDC"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Số lượng suất ăn:</label>
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={guestCount}
                            onChange={(e) => setGuestCount(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Mục đích tiếp đón:</label>
                          <input
                            type="text"
                            value={guestPurpose}
                            onChange={(e) => setGuestPurpose(e.target.value)}
                            placeholder="Ví dụ: Họp ký kết biên bản kỹ thuật"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                      </div>

                      {/* Selected Dishes Summary for Guest */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-700">Món ăn tiếp đãi đoàn khách:</span>
                          <span className="font-semibold text-emerald-700">{selectedDishIds.length} món</span>
                        </div>
                        {selectedDishIds.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {currentMenu.items
                              .filter((dish) => selectedDishIds.includes(dish.id))
                              .map((dish) => (
                                <span
                                  key={dish.id}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium text-[11px]"
                                >
                                  <span>{dish.name}</span>
                                </span>
                              ))}
                          </div>
                        ) : (
                          <p className="text-amber-700 text-[11px] font-medium">
                            ⚠️ Bạn chưa chọn món nào. Vui lòng bấm chọn món ở lưới thực đơn phía trên!
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                        <div className="text-xs text-slate-600">
                          Tổng chi phí dự kiến:{' '}
                          <strong className="text-emerald-700">{formatVND(guestCount * currentMenu.price)}</strong>
                        </div>
                        <button
                          onClick={handleGuestOrder}
                          disabled={isSubmitting || !guestName || !guestPurpose || selectedDishIds.length === 0}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm"
                        >
                          {isSubmitting ? 'Đang tạo...' : `Xác nhận đặt ${guestCount} suất khách`}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: USER SCANS CANTEEN IPC SCREEN */}
      {subTab === 'my-qr' && (
        <UserIpcScanner
          currentUser={currentUser}
          onRefreshData={loadData}
          onGoToOrderTab={() => setSubTab('order')}
        />
      )}

      {/* TAB 3: BOOKING HISTORY */}
      {subTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Lịch Sử Đăng Ký Suất Ăn</h3>
              <p className="text-xs text-slate-500">Danh sách các suất ăn bạn đã đặt cho bản thân hoặc được đặt hộ</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700">
              Tổng cộng: {myBookings.length} suất
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-4">Mã Booking</th>
                  <th className="p-4">Ngày Dùng Bữa</th>
                  <th className="p-4">Ca & Thực Đơn</th>
                  <th className="p-4">Món Đã Chọn</th>
                  <th className="p-4">Đơn Giá Snapshot</th>
                  <th className="p-4">Trạng Thái</th>
                  <th className="p-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myBookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      Chưa có lịch sử đăng ký suất ăn nào.
                    </td>
                  </tr>
                ) : (
                  myBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-4 font-mono font-bold text-slate-900">{b.bookingCode}</td>
                      <td className="p-4 font-medium">{b.mealDate}</td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-800">{b.shiftName}</div>
                        <div className="text-[11px] text-slate-400">Đặt lúc: {new Date(b.bookedAt).toLocaleTimeString('vi-VN')}</div>
                      </td>
                      <td className="p-4 max-w-xs">
                        <div className="truncate font-medium text-slate-800">{b.selectedItemNames.join(', ')}</div>
                        {b.isGuest && (
                          <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-sm font-semibold">
                            Suất Khách ({b.guestName})
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-mono font-semibold text-slate-900">{formatVND(b.priceSnapshot)}</td>
                      <td className="p-4">
                        {b.status === 'CHECKED_IN' && (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            Đã Check-in
                          </span>
                        )}
                        {b.status === 'CONFIRMED' && (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                            Đã Xác Nhận
                          </span>
                        )}
                        {b.status === 'CANCELLED' && (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                            Đã Hủy
                          </span>
                        )}
                        {b.status === 'NO_SHOW' && (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                            Vắng Mặt (No-show)
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {b.status === 'CONFIRMED' && (
                          <button
                            onClick={() => handleCancelBooking(b.id)}
                            className="text-xs font-semibold text-rose-600 hover:text-rose-800 underline cursor-pointer"
                          >
                            Hủy suất
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
