import { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  QrCode,
  Utensils,
  Sparkles,
  RefreshCw,
  Check,
  Building2,
  Clock,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { User, Booking, Shift, IPCTokenData } from '../../types';
import { fetchApi, formatVND } from '../../utils/api';
import { soundFX } from '../../utils/audio';

interface UserIpcScannerProps {
  currentUser: User;
  onRefreshData: () => void;
  onGoToOrderTab: () => void;
}

export function UserIpcScanner({ currentUser, onRefreshData, onGoToOrderTab }: UserIpcScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [manualIpcCode, setManualIpcCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [todayBooking, setTodayBooking] = useState<Booking | null>(null);
  const [isLoadingBooking, setIsLoadingBooking] = useState(true);

  const [scanResult, setScanResult] = useState<{
    status: 'SUCCESS' | 'ERROR';
    message: string;
    booking?: Booking;
    checkedInAt?: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load today's active booking for currentUser
  const loadTodayBooking = async () => {
    try {
      setIsLoadingBooking(true);
      const bookings = await fetchApi<Booking[]>('/bookings/me', {}, currentUser.id);
      const todayStr = new Date().toISOString().split('T')[0];
      const found = bookings.find(
        (b) => b.mealDate === todayStr && b.status !== 'CANCELLED'
      );
      setTodayBooking(found || null);
    } catch (err) {
      console.error('Lỗi tải booking:', err);
    } finally {
      setIsLoadingBooking(false);
    }
  };

  useEffect(() => {
    loadTodayBooking();
  }, [currentUser.id]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Toggle Camera
  const handleStartCamera = async () => {
    setIsScanning(true);
    setScanResult(null);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }
    } catch (err) {
      console.warn('Không thể khởi chạy camera phần cứng hoặc trong iframe:', err);
      // Fallback is available
    }
  };

  const handleStopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  // Perform the scan verification with IPC token
  const handleVerifyIpcToken = async (token: string) => {
    if (!token.trim()) return;
    setIsProcessing(true);
    setScanResult(null);

    try {
      const res = await fetchApi<{
        success: boolean;
        message: string;
        booking: Booking;
        checkedInAt: string;
      }>(
        '/qr/user-scan-ipc',
        {
          method: 'POST',
          body: JSON.stringify({
            ipcToken: token.trim(),
            targetUserId: currentUser.id,
          }),
        },
        currentUser.id
      );

      soundFX.playSuccess();
      setScanResult({
        status: 'SUCCESS',
        message: res.message,
        booking: res.booking,
        checkedInAt: res.checkedInAt,
      });

      handleStopCamera();
      loadTodayBooking();
      onRefreshData();
    } catch (err: unknown) {
      soundFX.playError();
      const errorMsg = err instanceof Error ? err.message : 'Mã QR không hợp lệ hoặc đã hết hạn';
      setScanResult({
        status: 'ERROR',
        message: errorMsg,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick One-Click Scan Canteen Screen (Simulates pointing phone camera at the active canteen IPC screen)
  const handleScanLiveCanteenScreen = async () => {
    setIsProcessing(true);
    setScanResult(null);

    try {
      // 1. Fetch current rotating token from the canteen IPC screen
      const ipcData = await fetchApi<IPCTokenData>('/qr/ipc-current-token', {}, currentUser.id);
      if (!ipcData || !ipcData.ipcToken) {
        throw new Error('Không thể kết nối đến màn hình IPC nhà ăn lúc này.');
      }

      // 2. Submit verify scan for this user
      await handleVerifyIpcToken(ipcData.ipcToken);
    } catch (err: unknown) {
      soundFX.playError();
      const errorMsg = err instanceof Error ? err.message : 'Lỗi kết nối tới màn hình nhà ăn';
      setScanResult({
        status: 'ERROR',
        message: errorMsg,
      });
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 1. Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-red-600/20 shrink-0">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Quét Mã QR Nhà Ăn (Màn Hình IPC)
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                TỰ XÁC NHẬN
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Khi đến nhà ăn NETCO, mở màn hình này và hướng camera điện thoại vào mã QR đang hiển thị trên màn hình IPC quầy căng tin để nhận khay cơm.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Today's Booking Status Card */}
      <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
            <Utensils className="w-3.5 h-3.5 text-red-600" />
            <span>Suất ăn hôm nay của bạn</span>
          </span>
          <button
            onClick={loadTodayBooking}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
          >
            <RefreshCw className="w-3 h-3" /> Cập nhật
          </button>
        </div>

        {isLoadingBooking ? (
          <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RotateCw className="w-4 h-4 animate-spin text-red-600" />
            <span>Đang kiểm tra đăng ký suất ăn...</span>
          </div>
        ) : todayBooking ? (
          <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-bold text-sm text-slate-900 dark:text-white">
                {todayBooking.shiftName}
              </div>
              <div>
                {todayBooking.status === 'CHECKED_IN' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    ĐÃ NHẬN KHAY CƠM
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-xs font-bold border border-amber-300 dark:border-amber-800">
                    <Clock className="w-3.5 h-3.5" />
                    CHƯA QUÉT CHECK-IN
                  </span>
                )}
              </div>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <div>
                Món ăn: <strong className="text-slate-800 dark:text-slate-200">{todayBooking.selectedItemNames.join(', ')}</strong>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
                <span>Mã booking: {todayBooking.bookingCode}</span>
                {todayBooking.checkedInAt && (
                  <span>Check-in: {new Date(todayBooking.checkedInAt).toLocaleTimeString('vi-VN')}</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-center space-y-2">
            <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
              Bạn chưa có suất ăn nào được xác nhận cho ngày hôm nay.
            </p>
            <button
              onClick={onGoToOrderTab}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>Xem thực đơn & Đặt cơm ngay</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 3. Success / Error Feedback Alert */}
      {scanResult && (
        <div
          className={`p-5 rounded-2xl border text-sm animate-in zoom-in-95 duration-200 ${
            scanResult.status === 'SUCCESS'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 shadow-xl'
              : 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-800 text-red-900 dark:text-red-100 shadow-xl'
          }`}
        >
          <div className="flex items-start gap-3">
            {scanResult.status === 'SUCCESS' ? (
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
            )}
            <div className="flex-1">
              <h4 className="font-extrabold text-base">
                {scanResult.status === 'SUCCESS'
                  ? '🎉 XÁC NHẬN THÀNH CÔNG!'
                  : 'XÁC NHẬN KHÔNG THÀNH CÔNG'}
              </h4>
              <p className="text-xs mt-1 leading-relaxed opacity-95">{scanResult.message}</p>

              {scanResult.booking && (
                <div className="mt-3 p-3 rounded-xl bg-white/60 dark:bg-black/30 border border-emerald-200 dark:border-emerald-900 text-xs space-y-1">
                  <div>
                    Nhân viên: <strong>{currentUser.name}</strong> ({currentUser.employeeCode})
                  </div>
                  <div>
                    Ca ăn: <strong>{scanResult.booking.shiftName}</strong>
                  </div>
                  <div>
                    Món ăn: <strong>{scanResult.booking.selectedItemNames.join(', ')}</strong>
                  </div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold pt-1">
                    ➡️ Vui lòng tiến lại quầy phục vụ để nhận khay cơm nóng sốt!
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Action Area: Camera Scanner & Quick Scan Simulation */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
        <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
          <Camera className="w-4 h-4 text-blue-600" />
          <span>Thực Hiện Quét Mã Trên Màn Hình IPC</span>
        </h3>

        {/* Primary One-Click Scan Action */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-blue-700 text-white shadow-lg space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-extrabold text-base">Quét Ngay Mã Đang Mở Tại Quầy Căng Tin</div>
              <p className="text-xs text-white/80 mt-0.5">
                Bấm nút này khi bạn đang đứng trước màn hình IPC nhà ăn để tự động bắt mã và xác nhận suất ăn tức thì.
              </p>
            </div>
            <Sparkles className="w-5 h-5 text-amber-300 shrink-0" />
          </div>

          <button
            onClick={handleScanLiveCanteenScreen}
            disabled={isProcessing}
            className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-black text-sm shadow-md transition cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin text-red-600" />
                <span>Đang xác thực suất ăn...</span>
              </>
            ) : (
              <>
                <QrCode className="w-4 h-4 text-red-600" />
                <span>QUÉT VÀ NHẬN KHAY CƠM NGAY</span>
              </>
            )}
          </button>
        </div>

        {/* Camera Viewfinder Section */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Hoặc mở Camera điện thoại để quét trực tiếp:
            </span>
            {isScanning ? (
              <button
                onClick={handleStopCamera}
                className="text-red-600 font-semibold hover:underline cursor-pointer"
              >
                Tắt Camera
              </button>
            ) : (
              <button
                onClick={handleStartCamera}
                className="text-blue-600 font-semibold hover:underline cursor-pointer"
              >
                Bật Camera
              </button>
            )}
          </div>

          {isScanning && (
            <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-inner flex items-center justify-center border-2 border-red-500">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Target Box with animated scanline */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-red-500 rounded-2xl relative shadow-2xl">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-white"></div>
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-white"></div>
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-white"></div>
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-white"></div>

                  {/* Scanline */}
                  <div className="absolute left-0 right-0 h-0.5 bg-red-400 shadow-md animate-pulse top-1/2"></div>
                </div>
              </div>

              <div className="absolute bottom-3 left-3 right-3 text-center">
                <button
                  onClick={handleScanLiveCanteenScreen}
                  className="px-4 py-1.5 bg-red-600/90 hover:bg-red-600 text-white font-bold text-xs rounded-xl shadow backdrop-blur-xs cursor-pointer"
                >
                  Xác nhận quét mã IPC
                </button>
              </div>
            </div>
          )}

          {/* Manual IPC token paste / input */}
          <div className="pt-2">
            <details className="text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
              <summary className="hover:text-slate-700 dark:hover:text-slate-300 font-medium">
                Nhập chuỗi mã IPC thủ công (Dự phòng trường hợp camera bị lỗi)
              </summary>
              <div className="mt-2.5 flex items-center gap-2">
                <input
                  type="text"
                  value={manualIpcCode}
                  onChange={(e) => setManualIpcCode(e.target.value)}
                  placeholder="Dán mã NETCO_IPC... vào đây"
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs focus:outline-none focus:border-red-500"
                />
                <button
                  onClick={() => handleVerifyIpcToken(manualIpcCode)}
                  disabled={!manualIpcCode.trim() || isProcessing}
                  className="px-4 py-2 bg-slate-900 dark:bg-slate-800 text-white rounded-xl font-semibold disabled:opacity-40"
                >
                  Gửi
                </button>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
