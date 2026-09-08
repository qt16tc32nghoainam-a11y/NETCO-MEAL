import { useState, useEffect } from 'react';
import {
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  Sliders,
  Sparkles,
  ShieldCheck,
  Package,
  Calendar,
  Users,
  Tv,
  Utensils,
  Clock,
  Heart,
  Save,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  Zap,
} from 'lucide-react';
import { FeatureFlags, User } from '../../types';
import { fetchApi } from '../../utils/api';

interface FeatureFlagsManagerProps {
  currentUser: User;
  onUpdated?: () => void;
  onRefreshGlobal?: () => void;
  isModal?: boolean;
  onCloseModal?: () => void;
}

interface FeatureItemDef {
  key: keyof FeatureFlags;
  title: string;
  category: 'core' | 'operations' | 'convenience';
  categoryLabel: string;
  badge: string;
  description: string;
  impact: string;
  icon: typeof Calendar;
}

const FEATURE_DEFINITIONS: FeatureItemDef[] = [
  {
    key: 'enableWeeklyBooking',
    title: 'Đặt Cơm Theo Tuần (Weekly Booking)',
    category: 'convenience',
    categoryLabel: 'Tiện Ích Đặt Suất',
    badge: 'MỚI CẬP NHẬT',
    description: 'Cho phép nhân viên đăng ký trước suất ăn cho cả tuần (Thứ 2 đến Thứ 6) chỉ với 1 cú nhấp chuột hoặc chọn từng ngày linh hoạt.',
    impact: 'Áp dụng cho: Mọi Nhân Viên NETCO, Đại Diện Phòng Ban',
    icon: Calendar,
  },
  {
    key: 'enableBOMForecasting',
    title: 'Dự Toán Nhu Cầu & Cân Đối Tồn Kho (BOM)',
    category: 'operations',
    categoryLabel: 'Kho & Dự Báo',
    badge: 'MỚI CẬP NHẬT',
    description: 'Tự động bóc tách định mức nguyên vật liệu từ số lượng món ăn đã đặt, suy ra thiếu hay đủ tồn kho để lập kế hoạch mua sắm kịp thời.',
    impact: 'Áp dụng cho: Bếp Trưởng, Quản Lý Kho, Hành Chính GA',
    icon: Sparkles,
  },
  {
    key: 'enableInventoryAndSuppliers',
    title: 'Cung Ứng Masan 100% & Quản Lý Kho Lương Thực',
    category: 'operations',
    categoryLabel: 'Kho & Dự Báo',
    badge: 'CHUẨN MASAN 100%',
    description: 'Chuẩn hóa danh mục 100% nguồn cung từ Masan Group: MML (Thịt & Trứng), WinEco (Rau Củ Quả), CHIN-SU (Gia Vị), WinCommerce (Gạo & Hàng Khô).',
    impact: 'Áp dụng cho: Bộ Phận Mua Hàng, Thủ Kho, Bếp',
    icon: Package,
  },
  {
    key: 'enableGuestBooking',
    title: 'Đăng Ký Suất Ăn Cho Khách VIP & Đối Tác',
    category: 'convenience',
    categoryLabel: 'Tiện Ích Đặt Suất',
    badge: 'TIỆN ÍCH',
    description: 'Cho phép đăng ký suất ăn tiếp đón đoàn khách, chuyên gia, đối tác công tác tại trụ sở NETCO có thông tin người bảo lãnh và mục đích.',
    impact: 'Áp dụng cho: Trưởng Phòng, Hành Chính GA',
    icon: Users,
  },
  {
    key: 'enableDepartmentBooking',
    title: 'Đặt Suất Ăn Tập Thể Cho Cả Phòng Ban',
    category: 'convenience',
    categoryLabel: 'Tiện Ích Đặt Suất',
    badge: 'TIỆN ÍCH',
    description: 'Đại diện phòng ban có thể chọn nhiều nhân viên trong phòng để đặt đồng loạt cho ca làm việc.',
    impact: 'Áp dụng cho: Đại Diện Phòng Ban, Admin',
    icon: Users,
  },
  {
    key: 'enableAttendanceSync',
    title: 'Đối Soát Với Hệ Thống Chấm Công Độc Lập',
    category: 'core',
    categoryLabel: 'Nghiệp Vụ Cốt Lõi',
    badge: 'CỐT LÕI',
    description: 'Lấy số lượng & danh sách nhân viên chấm công hôm nay từ hệ thống chấm công độc lập bên ngoài (chỉ đọc qua API), rồi đối chiếu với danh sách đặt cơm để phát hiện người đi làm quên đặt hoặc đặt mà không ăn. Ứng dụng không tự ghi nhận chấm công.',
    impact: 'Áp dụng cho: Hành Chính GA, Nhân Sự HR',
    icon: Clock,
  },
  {
    key: 'enableMasterDishCatalog',
    title: 'Ngân Hàng Món Ăn Chuẩn & Quy Trình GA Duyệt',
    category: 'core',
    categoryLabel: 'Nghiệp Vụ Cốt Lõi',
    badge: 'CỐT LÕI',
    description: 'Quản lý thư viện món ăn định mức dinh dưỡng, calo; quy trình Bếp soạn thực đơn tuần -> Hành chính GA thẩm định phê duyệt trước khi công bố.',
    impact: 'Áp dụng cho: Bếp Trưởng, GA Thẩm Định',
    icon: Utensils,
  },
  {
    key: 'enableKioskQrCheckin',
    title: 'Màn Hình IPC Căng Tin & Mã QR Động 30 Giây',
    category: 'core',
    categoryLabel: 'Nghiệp Vụ Cốt Lõi',
    badge: 'CỐT LÕI',
    description: 'Hiển thị mã QR xoay vòng chống chụp lại màn hình trên máy tính công nghiệp IPC tại quầy để nhân viên quét nhận khay cơm.',
    impact: 'Áp dụng cho: Nhân Viên Nhận Suất, Quầy Căng Tin',
    icon: Tv,
  },
  {
    key: 'enableDietaryPreference',
    title: 'Quản Lý Chế Độ Ăn Kiêng & Cảnh Báo Dị Ứng',
    category: 'convenience',
    categoryLabel: 'Tiện Ích Đặt Suất',
    badge: 'SỨC KHỎE',
    description: 'Theo dõi sở thích ăn chay, kiêng đường, dị ứng hải sản/đậu phộng của từng nhân viên để Bếp điều chỉnh khẩu phần phù hợp.',
    impact: 'Áp dụng cho: Hồ Sơ Cá Nhân, Bếp',
    icon: Heart,
  },
  {
    key: 'enableMealRatingFeedback',
    title: 'Đánh Giá Sao & Phản Hồi Chất Lượng Bữa Ăn',
    category: 'convenience',
    categoryLabel: 'Tiện Ích Đặt Suất',
    badge: 'TIỆN ÍCH',
    description: 'Thu thập đánh giá 1-5 sao và góp ý hương vị, định lượng, vệ sinh từ cán bộ nhân viên để nhà bếp cải tiến liên tục.',
    impact: 'Áp dụng cho: Cán Bộ Nhân Viên, Bếp Trưởng, GA',
    icon: Sparkles,
  },
];

export function FeatureFlagsManager({
  currentUser,
  onUpdated,
  onRefreshGlobal,
  isModal = false,
  onCloseModal,
}: FeatureFlagsManagerProps) {
  const [flags, setFlags] = useState<FeatureFlags>({
    enableWeeklyBooking: true,
    enableBOMForecasting: true,
    enableInventoryAndSuppliers: true,
    enableGuestBooking: true,
    enableDepartmentBooking: true,
    enableAttendanceSync: true,
    enableMasterDishCatalog: true,
    enableKioskQrCheckin: true,
    enableDietaryPreference: true,
    enableMealRatingFeedback: true,
  });

  const [initialFlags, setInitialFlags] = useState<FeatureFlags | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filterCategory, setFilterCategory] = useState<'all' | 'core' | 'operations' | 'convenience'>('all');

  // Load existing flags from system settings
  useEffect(() => {
    fetchApi<{ featureFlags?: FeatureFlags }>('/settings', {}, currentUser.id)
      .then((settings) => {
        if (settings.featureFlags) {
          setFlags(settings.featureFlags);
          setInitialFlags(settings.featureFlags);
        }
      })
      .catch((err) => {
        console.error('Failed to load feature flags:', err);
      })
      .finally(() => setIsLoading(false));
  }, [currentUser.id]);

  const handleToggle = (key: keyof FeatureFlags) => {
    setFlags((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleToggleAll = (enabled: boolean) => {
    const updated: FeatureFlags = {
      enableWeeklyBooking: enabled,
      enableBOMForecasting: enabled,
      enableInventoryAndSuppliers: enabled,
      enableGuestBooking: enabled,
      enableDepartmentBooking: enabled,
      enableAttendanceSync: enabled,
      enableMasterDishCatalog: enabled,
      enableKioskQrCheckin: enabled,
      enableDietaryPreference: enabled,
      enableMealRatingFeedback: enabled,
    };
    setFlags(updated);
  };

  const handleCoreOnly = () => {
    const coreOnly: FeatureFlags = {
      enableWeeklyBooking: false,
      enableBOMForecasting: false,
      enableInventoryAndSuppliers: false,
      enableGuestBooking: false,
      enableDepartmentBooking: false,
      enableAttendanceSync: true,
      enableMasterDishCatalog: true,
      enableKioskQrCheckin: true,
      enableDietaryPreference: false,
      enableMealRatingFeedback: false,
    };
    setFlags(coreOnly);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setMessage(null);

      const res = await fetchApi<{ message: string; featureFlags: FeatureFlags }>(
        '/settings/features',
        {
          method: 'PATCH',
          body: JSON.stringify({ featureFlags: flags }),
        },
        currentUser.id
      );

      setFlags(res.featureFlags);
      setInitialFlags(res.featureFlags);
      setMessage({
        type: 'success',
        text: 'Đã lưu cấu hình bật/tắt tính năng thành công! Toàn bộ giao diện hệ thống sẽ cập nhật theo cấu hình mới.',
      });

      if (onUpdated) onUpdated();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Không thể lưu cấu hình';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = initialFlags ? JSON.stringify(flags) !== JSON.stringify(initialFlags) : false;
  const activeCount = Object.values(flags).filter(Boolean).length;
  const totalCount = Object.keys(flags).length;

  const filteredDefs = FEATURE_DEFINITIONS.filter(
    (def) => filterCategory === 'all' || def.category === filterCategory
  );

  return (
    <div className={`bg-white dark:bg-slate-900 ${isModal ? 'p-6 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto' : 'p-6'}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Trung Tâm Quản Lý Bật/Tắt Tính Năng
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  {activeCount}/{totalCount} Đang Bật
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Bật hoặc tạm tắt các tính năng chưa cần dùng để giao diện gọn gàng, tối ưu quy trình cho công ty NETCO.
              </p>
            </div>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => handleToggleAll(true)}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
            title="Bật tất cả tính năng"
          >
            Bật Tất Cả
          </button>
          <button
            onClick={handleCoreOnly}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
            title="Chỉ giữ 3 tính năng cốt lõi bắt buộc"
          >
            Chỉ Giữ Cốt Lõi
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg transition shadow-sm ${
              hasChanges
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Đang Lưu...' : hasChanges ? 'Lưu Thay Đổi (*)' : 'Đã Lưu'}</span>
          </button>
          {isModal && onCloseModal && (
            <button
              onClick={onCloseModal}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Notification Banner */}
      {message && (
        <div
          className={`mt-4 p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mt-5 border-b border-slate-200 dark:border-slate-800 pb-3">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-2">Nhóm tính năng:</span>
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
            filterCategory === 'all'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Tất Cả ({FEATURE_DEFINITIONS.length})
        </button>
        <button
          onClick={() => setFilterCategory('convenience')}
          className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
            filterCategory === 'convenience'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Tiện Ích Đặt Suất
        </button>
        <button
          onClick={() => setFilterCategory('operations')}
          className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
            filterCategory === 'operations'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Kho & Dự Báo Masan
        </button>
        <button
          onClick={() => setFilterCategory('core')}
          className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
            filterCategory === 'core'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Nghiệp Vụ Cốt Lõi
        </button>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        {filteredDefs.map((item) => {
          const isEnabled = Boolean(flags[item.key]);
          const Icon = item.icon;

          return (
            <div
              key={item.key}
              onClick={() => handleToggle(item.key)}
              className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                isEnabled
                  ? 'border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 opacity-75 hover:opacity-100'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                        isEnabled
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                        {item.title}
                      </h3>
                      <span className="inline-block mt-0.5 px-2 py-0.2 text-[10px] font-semibold rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {item.categoryLabel}
                      </span>
                    </div>
                  </div>

                  {/* Visual Toggle Switch */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    <span
                      className={`text-xs font-bold ${
                        isEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                      }`}
                    >
                      {isEnabled ? 'BẬT' : 'TẮT'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(item.key);
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        isEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          isEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2.5 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span className="italic">{item.impact}</span>
                <span
                  className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                    item.badge === 'CỐT LÕI'
                      ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                      : item.badge === 'CHUẨN MASAN 100%'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  }`}
                >
                  {item.badge}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Helpful Instructions Box */}
      <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300">
        <HelpCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-800 dark:text-white">
            Gợi ý vận hành cho Quản trị viên NETCO:
          </p>
          <p>
            • Khi tắt tính năng <strong>"Đặt Cơm Theo Tuần"</strong>, giao diện Đặt Suất của nhân viên sẽ chỉ hiển thị form đặt từng ngày đơn lẻ.
          </p>
          <p>
            • Khi bật <strong>"Dự Toán Nhu Cầu & Tồn Kho (BOM)"</strong> và <strong>"Cung Ứng Masan 100%"</strong>, Bếp Trưởng và Thủ Kho có thể xem ngay lượng thịt MML, rau WinEco, gia vị CHIN-SU thiếu hay đủ dựa trên số suất đã đặt để đi mua kịp thời.
          </p>
        </div>
      </div>
    </div>
  );
}
