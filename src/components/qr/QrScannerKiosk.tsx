import { useState, useEffect, useCallback, type FormEvent } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCw,
  UserCheck,
  ShieldCheck,
  Search,
  Check,
  Volume2,
  Sparkles,
  Utensils,
  Clock,
  Smartphone,
  Users,
  Building2,
  CheckCircle,
  Radio,
  RefreshCw,
  Coffee,
} from 'lucide-react';
import { User, Booking, Shift, IPCTokenData, RecentCheckin } from '../../types';
import { fetchApi, formatVND } from '../../utils/api';
import { soundFX } from '../../utils/audio';

interface QrScannerKioskProps {
  currentUser: User;
  onRefreshGlobal?: () => void;
}

export function QrScannerKiosk({ currentUser, onRefreshGlobal }: QrScannerKioskProps) {
  const [ipcData, setIpcData] = useState<IPCTokenData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(30);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [recentCheckins, setRecentCheckins] = useState<RecentCheckin[]>([]);
  const [latestScanned, setLatestScanned] = useState<{
    userName: string;
    employeeCode: string;
    dishName: string;
    time: string;
  } | null>(null);

  // Manual Check-in Modal
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualEmpCode, setManualEmpCode] = useState('');
  const [manualShiftId, setManualShiftId] = useState('shift_lunch');
  const [manualReason, setManualReason] = useState('Nhân viên quên mang điện thoại cá nhân');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [allUsersList, setAllUsersList] = useState<User[]>([]);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [manualMessage, setManualMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Simulation state for phone scan demo
  const [simulatedUserId, setSimulatedUserId] = useState<string>('usr_emp_tuan');
  const [isSimulating, setIsSimulating] = useState(false);

  // 1. Fetch current IPC Screen Token & Data
  const fetchIpcToken = useCallback(async () => {
    try {
      const data = await fetchApi<IPCTokenData>('/qr/ipc-current-token', {}, currentUser.id);
      setIpcData(data);
      setCountdown(data.expiresIn || 30);
      setRecentCheckins(data.recentCheckins || []);

      // Generate QR Canvas
      if (data.ipcToken) {
        const url = await QRCode.toDataURL(data.ipcToken, {
          width: 380,
          margin: 2,
          color: {
            dark: '#0F172A',
            light: '#FFFFFF',
          },
          errorCorrectionLevel: 'M',
        });
        setQrDataUrl(url);
      }
    } catch (err) {
      console.error('Lỗi khi tải mã QR màn hình IPC:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser.id]);

  // Initial load
  useEffect(() => {
    fetchIpcToken();
    fetchApi<Shift[]>('/shifts', {}, currentUser.id).then(setShifts).catch(console.error);
    fetchApi<User[]>('/users', {}, currentUser.id).then(setAllUsersList).catch(console.error);
  }, [fetchIpcToken, currentUser.id]);

  // Countdown and periodic refresh timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchIpcToken();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchIpcToken]);

  // Poll for recent check-ins every 4 seconds so the canteen screen reflects mobile scans in real time
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const data = await fetchApi<IPCTokenData>('/qr/ipc-current-token', {}, currentUser.id);
        if (data.recentCheckins && data.recentCheckins.length > 0) {
          // Check if there's a new checkin not in our current list
          setRecentCheckins((prev) => {
            const latestId = data.recentCheckins[0]?.id;
            const currentLatestId = prev[0]?.id;
            if (latestId && latestId !== currentLatestId) {
              // Sound alert and show banner
              soundFX.playSuccess();
              const newest = data.recentCheckins[0];
              setLatestScanned({
                userName: newest.userName,
                employeeCode: newest.userEmployeeCode,
                dishName: newest.dishName,
                time: new Date().toLocaleTimeString('vi-VN'),
              });
              setTimeout(() => setLatestScanned(null), 5000);
            }
            return data.recentCheckins;
          });
        }
        if (data.stats) {
          setIpcData((prev) => (prev ? { ...prev, stats: data.stats } : prev));
        }
      } catch {
        // silent poll catch
      }
    }, 4000);

    return () => clearInterval(pollInterval);
  }, [currentUser.id]);

  // Simulate employee scanning this IPC screen with their phone
  const handleSimulatePhoneScan = async (empId: string) => {
    if (!ipcData?.ipcToken) return;
    setIsSimulating(true);

    try {
      const res = await fetchApi<{
        success: boolean;
        message: string;
        booking: Booking;
        user: User;
      }>(
        '/qr/user-scan-ipc',
        {
          method: 'POST',
          body: JSON.stringify({
            ipcToken: ipcData.ipcToken,
            targetUserId: empId,
          }),
        },
        empId
      );

      soundFX.playSuccess();
      setLatestScanned({
        userName: res.user.name,
        employeeCode: res.user.employeeCode,
        dishName: res.booking.selectedItemNames?.[0] || 'Suất ăn tiêu chuẩn',
        time: new Date().toLocaleTimeString('vi-VN'),
      });

      if (onRefreshGlobal) onRefreshGlobal();
      fetchIpcToken();

      setTimeout(() => setLatestScanned(null), 5000);
    } catch (err: unknown) {
      soundFX.playError();
      const errorMsg = err instanceof Error ? err.message : 'Lỗi quét QR';
      alert(`[Lỗi quét mã]: ${errorMsg}`);
    } finally {
      setIsSimulating(false);
    }
  };

  // Handle Manual Fallback Check-in (when staff helps an employee without phone)
  const handleManualCheckIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!manualEmpCode.trim() || !manualReason.trim()) return;
    setIsSubmittingManual(true);
    setManualMessage(null);

    try {
      const res = await fetchApi<{
        success: boolean;
        message: string;
        booking: Booking;
      }>(
        '/qr/manual-check-in',
        {
          method: 'POST',
          body: JSON.stringify({
            employeeCode: manualEmpCode.trim(),
            shiftId: manualShiftId,
            reason: manualReason.trim(),
          }),
        },
        currentUser.id
      );

      soundFX.playSuccess();
      setManualMessage({ type: 'success', text: res.message });
      setManualEmpCode('');
      fetchIpcToken();
      if (onRefreshGlobal) onRefreshGlobal();

      setTimeout(() => {
        setIsManualModalOpen(false);
        setManualMessage(null);
      }, 2000);
    } catch (err: unknown) {
      soundFX.playError();
      const errorMsg = err instanceof Error ? err.message : 'Lỗi check-in thủ công';
      setManualMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsSubmittingManual(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 select-none">
      {/* 1. Header Bar: NETCO Meal Canteen Display */}
      <div className="bg-slate-900 border border-slate-800 text-white p-5 sm:p-6 rounded-3xl shadow-2xl flex flex-wrap items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-white to-blue-600" />

        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-red-600/30 font-black text-xl shrink-0">
            IPC
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                MÀN HÌNH IPC NHÀ ĂN - NETCO MEAL
              </h1>
              <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                TRỰC TUYẾN
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5 flex items-center gap-2">
              <span>{ipcData?.canteenName || 'Nhà Ăn NETCO Post - Trụ Sở Chính'}</span>
              <span>•</span>
              <span className="text-blue-400 font-semibold">{ipcData?.shift?.name || 'Ca Trưa (11:30 - 13:30)'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => soundFX.playSuccess()}
            title="Kiểm tra âm thanh chuông báo"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold cursor-pointer border border-slate-700 transition"
          >
            <Volume2 className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">Thử Chuông</span>
          </button>

          <button
            onClick={() => setIsManualModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/20 cursor-pointer transition active:scale-95"
          >
            <UserCheck className="w-4 h-4" />
            <span>Soát Vé Thủ Công</span>
          </button>
        </div>
      </div>

      {/* Pop-up Celebration Banner when an employee successfully scans */}
      {latestScanned && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white shadow-2xl flex items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-sm font-black tracking-wide uppercase">XÁC NHẬN THÀNH CÔNG • VUI LÒNG LẤY KHAY CƠM</div>
              <div className="text-xs text-white/90">
                Nhân viên: <strong>{latestScanned.userName}</strong> ({latestScanned.employeeCode}) • Món: {latestScanned.dishName}
              </div>
            </div>
          </div>
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-lg bg-black/20">
            {latestScanned.time}
          </span>
        </div>
      )}

      {/* 2. Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Col (7 cols): The Large Rotating QR Code Display */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl text-center flex flex-col items-center justify-center relative overflow-hidden">
          {/* Top Instruction Banner */}
          <div className="w-full max-w-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-2xl p-3.5 mb-6 text-left">
            <div className="flex items-start gap-3">
              <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wide">
                  Hướng dẫn nhân viên nhận suất ăn
                </h4>
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                  1. Mở app <strong>NETCO Meal</strong> trên điện thoại cá nhân. <br />
                  2. Chọn mục <strong>&quot;Quét QR Nhà Ăn&quot;</strong> và hướng camera vào mã bên dưới.
                </p>
              </div>
            </div>
          </div>

          {/* QR Code Container with High-Visibility Border */}
          <div className="relative p-4 sm:p-5 bg-white rounded-3xl border-4 border-slate-900 dark:border-red-600 shadow-2xl flex flex-col items-center justify-center max-w-[360px] sm:max-w-[400px] w-full">
            {isLoading ? (
              <div className="w-72 h-72 flex flex-col items-center justify-center gap-3 text-slate-400">
                <RotateCw className="w-8 h-8 animate-spin text-red-600" />
                <span className="text-xs font-semibold">Đang khởi tạo mã IPC Nhà Ăn...</span>
              </div>
            ) : qrDataUrl ? (
              <div className="relative">
                <img
                  src={qrDataUrl}
                  alt="Mã QR Nhà Ăn NETCO"
                  className="w-64 sm:w-72 h-64 sm:h-72 object-contain mx-auto rounded-xl"
                />

                {/* Center NETCO Brand Emblem */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-12 h-12 bg-white rounded-xl shadow-md border-2 border-red-600 flex items-center justify-center font-black text-red-600 text-xs">
                    NETCO
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-72 h-72 flex items-center justify-center text-red-500 text-sm">
                Không thể hiển thị mã QR
              </div>
            )}

            {/* Countdown Badge & Progress */}
            <div className="w-full mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-red-600" />
                  <span>Mã tự đổi sau:</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 font-mono text-xs">
                  {countdown} giây
                </span>
              </div>

              {/* Smooth Progress Bar */}
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-red-600 to-blue-600 h-full transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${(countdown / 30) * 100}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                <span>Chống chụp ảnh lại (Anti-Replay)</span>
                <button
                  onClick={fetchIpcToken}
                  className="text-blue-600 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                >
                  <RefreshCw className="w-3 h-3" /> Làm mới ngay
                </button>
              </div>
            </div>
          </div>

          {/* Quick Simulation Sandbox (Convenient for live testing on 1 screen) */}
          <div className="w-full max-w-md mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-left">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Mô phỏng nhân viên quét mã từ điện thoại (Test)</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Demo Quick-Scan</span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={simulatedUserId}
                onChange={(e) => setSimulatedUserId(e.target.value)}
                className="flex-1 text-xs px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                {allUsersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.employeeCode} - {u.email})
                  </option>
                ))}
              </select>

              <button
                onClick={() => handleSimulatePhoneScan(simulatedUserId)}
                disabled={isSimulating}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow transition cursor-pointer shrink-0 disabled:opacity-50"
              >
                {isSimulating ? 'Đang gửi...' : 'Quét Thử'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Col (5 cols): Live Stats & Real-time Check-in Feed */}
        <div className="lg:col-span-5 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block truncate">
                Tổng Suất Đã Đặt
              </span>
              <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">
                {ipcData?.stats?.totalBooked ?? 0}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center">
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 block truncate">
                Đã Nhận Cơm
              </span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                {ipcData?.stats?.checkedInCount ?? 0}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center">
              <span className="text-[11px] font-medium text-red-600 dark:text-red-400 block truncate">
                Còn Lại
              </span>
              <span className="text-2xl font-black text-red-600 dark:text-red-400 mt-1 block">
                {ipcData?.stats?.remainingCount ?? 0}
              </span>
            </div>
          </div>

          {/* Real-time Ticker: Latest Check-ins */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Danh sách vừa Check-in (Thời gian thực)
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">Hôm nay</span>
            </div>

            <div className="mt-3.5 divide-y divide-slate-100 dark:divide-slate-800 max-h-[480px] overflow-y-auto pr-1">
              {recentCheckins.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Coffee className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-xs">Chưa có ai check-in cho ca này.</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Hãy mở app điện thoại và quét mã để bắt đầu!
                  </p>
                </div>
              ) : (
                recentCheckins.map((item, idx) => (
                  <div key={item.id || idx} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={
                          item.avatarUrl ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                        }
                        alt={item.userName}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {item.userName}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0 font-semibold">
                            {item.userEmployeeCode}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {item.dishName}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                        <Check className="w-3 h-3" />
                        <span>Đã lấy</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                        {item.checkedInAt ? new Date(item.checkedInAt).toLocaleTimeString('vi-VN') : ''}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Manual Check-in Modal (Fallback for staff) */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-red-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Soát Vé Thủ Công (Quên ĐT)
                </h3>
              </div>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {manualMessage && (
              <div
                className={`p-3 rounded-xl mb-4 text-xs font-semibold ${
                  manualMessage.type === 'success'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-red-100 text-red-800 border border-red-200'
                }`}
              >
                {manualMessage.text}
              </div>
            )}

            <form onSubmit={handleManualCheckIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mã Nhân Viên (@netcovn.com.vn)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: EMP001 hoặc tuan.hm"
                  value={manualEmpCode}
                  onChange={(e) => setManualEmpCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:border-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ca Ăn Áp Dụng
                </label>
                <select
                  value={manualShiftId}
                  onChange={(e) => setManualShiftId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:border-red-500"
                >
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.startTime} - {s.endTime})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lý do ghi log Audit
                </label>
                <input
                  type="text"
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:border-red-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingManual}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/20 disabled:opacity-50"
                >
                  {isSubmittingManual ? 'Đang xử lý...' : 'Xác Nhận Cho Nhận Suất'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
