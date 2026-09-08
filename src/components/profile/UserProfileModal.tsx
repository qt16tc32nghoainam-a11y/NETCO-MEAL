import { useState, useEffect, type FormEvent } from 'react';
import {
  X,
  User as UserIcon,
  Mail,
  Phone,
  Building2,
  Calendar,
  ShieldCheck,
  QrCode,
  HeartPulse,
  Utensils,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  Save,
  Tag
} from 'lucide-react';
import { User, PermissionDefinition } from '../../types';
import { fetchApi } from '../../utils/api';

interface UserProfileModalProps {
  currentUser: User;
  onClose: () => void;
  onUpdateUser: (updated: User) => void;
}

interface UserProfileDetails extends User {
  departmentName?: string;
  effectivePermissions?: string[];
  stats?: {
    totalBookings: number;
    checkedInCount: number;
    noShowCount: number;
    cancelledCount: number;
    confirmedCount: number;
    attendanceRate: number;
  };
}

const COMMON_ALLERGENS = [
  'Hải sản có vỏ (Tôm, Cua, Mực)',
  'Đậu phộng / Lạc',
  'Trứng gia cầm',
  'Sữa động vật & Lactose',
  'Gluten / Bột mì',
  'Đậu nành & Đậu tương',
  'Thịt bò',
  'Ớt cay nồng',
];

export function UserProfileModal({ currentUser, onClose, onUpdateUser }: UserProfileModalProps) {
  const [profile, setProfile] = useState<UserProfileDetails>(currentUser);
  const [allPermissions, setAllPermissions] = useState<PermissionDefinition[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'dietary' | 'permissions' | 'stats'>('info');

  // Form states for self-service editing
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [dietaryPreference, setDietaryPreference] = useState<'NONE' | 'VEGETARIAN' | 'LOW_CARB' | 'DIABETIC' | 'HALAL'>(
    currentUser.dietaryPreference || 'NONE'
  );
  const [allergens, setAllergens] = useState<string[]>(currentUser.allergens || []);
  const [dietaryNote, setDietaryNote] = useState(currentUser.dietaryNote || '');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    // Load full profile details from API
    async function loadProfile() {
      try {
        const [userData, perms] = await Promise.all([
          fetchApi<UserProfileDetails>(`/users/${currentUser.id}`, {}, currentUser.id),
          fetchApi<PermissionDefinition[]>('/permissions', {}, currentUser.id),
        ]);
        setProfile(userData);
        setPhone(userData.phone || '');
        setDietaryPreference(userData.dietaryPreference || 'NONE');
        setAllergens(userData.allergens || []);
        setDietaryNote(userData.dietaryNote || '');
        setAllPermissions(perms);
      } catch (err) {
        console.error('Failed to load profile details:', err);
      }
    }
    loadProfile();
  }, [currentUser.id]);

  const handleToggleAllergen = (item: string) => {
    setAllergens((prev) =>
      prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
    );
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      const updated = await fetchApi<User>(
        `/users/${currentUser.id}/profile`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            phone,
            dietaryPreference,
            allergens,
            dietaryNote,
          }),
        },
        currentUser.id
      );

      setProfile((prev) => ({ ...prev, ...updated }));
      onUpdateUser(updated);
      setMessage({ type: 'success', text: 'Cập nhật thông tin hồ sơ & chế độ dinh dưỡng thành công!' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi cập nhật hồ sơ',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getDietLabel = (diet: string) => {
    switch (diet) {
      case 'VEGETARIAN':
        return { label: 'Ăn Chay (Chay tịnh / Thuần chay)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'LOW_CARB':
        return { label: 'Low-Carb (Hạn chế tinh bột / Healthy)', color: 'bg-amber-100 text-amber-800 border-amber-300' };
      case 'DIABETIC':
        return { label: 'Chế độ ăn cho người tiểu đường / ít ngọt', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' };
      case 'HALAL':
        return { label: 'Chứng nhận Halal (Hồi giáo)', color: 'bg-purple-100 text-purple-800 border-purple-300' };
      case 'NONE':
      default:
        return { label: 'Khẩu phần ăn tiêu chuẩn đầy đủ', color: 'bg-slate-100 text-slate-800 border-slate-300' };
    }
  };

  const dietBadge = getDietLabel(dietaryPreference);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Top Header with User Banner */}
        <div className="relative bg-gradient-to-r from-emerald-700 via-teal-700 to-slate-800 text-white p-6 sm:p-8">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition cursor-pointer"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="relative">
              <img
                src={profile.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                alt={profile.name}
                className="w-24 h-24 rounded-2xl object-cover ring-4 ring-white/30 shadow-lg"
              />
              <span className="absolute -bottom-2 -right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-white shadow-xs">
                ONLINE
              </span>
            </div>

            <div className="text-center sm:text-left flex-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-2xl font-bold tracking-tight text-white">{profile.name}</h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-white/20 text-emerald-200 border border-white/20">
                  {profile.employeeCode}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500 text-white font-semibold">
                  {profile.role}
                </span>
              </div>

              <p className="text-sm text-emerald-100 mt-1 flex items-center justify-center sm:justify-start gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-300" />
                {profile.departmentName || 'Phòng ban công ty'}
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-white/80">
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-emerald-300" />
                  {profile.email}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-300" />
                  {profile.phone || 'Chưa cập nhật SĐT'}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-300" />
                  Gia nhập: {profile.joinedDate || '2023-01-01'}
                </span>
              </div>
            </div>

            {/* Quick Digital QR Identity Card */}
            <div className="hidden lg:flex flex-col items-center bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20 text-center">
              <QrCode className="w-12 h-12 text-white" />
              <span className="text-[11px] font-mono text-emerald-200 mt-1">ID: {profile.employeeCode}</span>
              <span className="text-[10px] text-white/70">Mã quẹt nhận suất ăn</span>
            </div>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 gap-2 text-sm font-medium overflow-x-auto">
          <button
            onClick={() => setActiveTab('info')}
            className={`py-3 px-4 flex items-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'info'
                ? 'border-emerald-600 text-emerald-700 font-bold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            Thông Tin Cá Nhân & Liên Hệ
          </button>
          <button
            onClick={() => setActiveTab('dietary')}
            className={`py-3 px-4 flex items-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'dietary'
                ? 'border-emerald-600 text-emerald-700 font-bold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <HeartPulse className="w-4 h-4 text-rose-500" />
            Chế Độ Ăn & Cảnh Báo Dị Ứng
            {dietaryPreference !== 'NONE' && (
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`py-3 px-4 flex items-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'permissions'
                ? 'border-emerald-600 text-emerald-700 font-bold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            Vai Trò & Quyền Hạn Thực Tế ({profile.effectivePermissions?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`py-3 px-4 flex items-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'stats'
                ? 'border-emerald-600 text-emerald-700 font-bold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4 text-amber-600" />
            Lịch Sử Suất Ăn & Chấm Công
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[65vh] overflow-y-auto">
          {message && (
            <div
              className={`p-4 rounded-xl mb-5 flex items-center gap-3 text-sm font-medium ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* TAB 1: THÔNG TIN CÁ NHÂN */}
          {activeTab === 'info' && (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mã Nhân Viên</label>
                  <input
                    type="text"
                    value={profile.employeeCode}
                    disabled
                    className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 cursor-not-allowed"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Được đồng bộ từ phòng Nhân Sự (HR-IS)</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Họ Và Tên</label>
                  <input
                    type="text"
                    value={profile.name}
                    disabled
                    className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Công Ty</label>
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Số Điện Thoại Liên Hệ</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Nhập số điện thoại nhận SMS / thông báo"
                    className="w-full bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3 py-2 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phòng Ban Trực Thuộc</label>
                  <input
                    type="text"
                    value={profile.departmentName || 'Chưa cập nhật'}
                    disabled
                    className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vai Trò Hệ Thống</label>
                  <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <span className="font-semibold text-indigo-900">{profile.role}</span>
                  </div>
                </div>
              </div>

              {/* Digital Badge Preview */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-emerald-50/40 border border-emerald-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-xs">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Mã QR Động Tiếp Nhận Suất Ăn</h4>
                    <p className="text-xs text-slate-500">Mã QR tự động đổi sau mỗi 60 giây để chống gian lận và chụp màn hình gửi cho người khác.</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">
                  Sẵn Sàng Sử Dụng
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi Thông Tin'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: CHẾ ĐỘ ĂN UỐNG & DỊ ỨNG */}
          {activeTab === 'dietary' && (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 flex items-start gap-3">
                <Utensils className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 leading-relaxed">
                  <strong>Thông báo từ Bếp Trưởng & Dinh Dưỡng:</strong> Thiết lập chế độ ăn giúp bếp lên kế hoạch chuẩn bị suất ăn phù hợp, định lượng nguyên liệu và dán nhãn phân biệt riêng biệt khi nhận cơm tại khay.
                </div>
              </div>

              {/* Dietary preference selection */}
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">Chế Độ Ăn Chính Của Bạn</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 'NONE', title: 'Tiêu Chuẩn (Bình thường)', desc: 'Ăn đầy đủ thịt cá rau củ, không kiêng đặc biệt' },
                    { id: 'VEGETARIAN', title: 'Ăn Chay (Chay tịnh)', desc: 'Không thịt cá động vật, sử dụng đậu hũ, nấm, rau củ hữu cơ' },
                    { id: 'LOW_CARB', title: 'Low-Carb / Healthy', desc: 'Hạn chế cơm trắng và tinh bột, tăng cường rau củ và protein nạc' },
                    { id: 'DIABETIC', title: 'Chế độ Tiểu Đường / Ít Ngọt', desc: 'Không đường tinh luyện, kiểm soát chỉ số đường huyết (GI)' },
                    { id: 'HALAL', title: 'Chuẩn Halal', desc: 'Tuân thủ nghiêm ngặt quy định thực phẩm theo luật Hồi giáo' },
                  ].map((item) => (
                    <label
                      key={item.id}
                      className={`p-3.5 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                        dietaryPreference === item.id
                          ? 'border-emerald-600 bg-emerald-50/60 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-900">{item.title}</span>
                        <input
                          type="radio"
                          name="dietaryPreference"
                          value={item.id}
                          checked={dietaryPreference === item.id}
                          onChange={() => setDietaryPreference(item.id as any)}
                          className="text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
                    </label>
                  ))}
                </div>
              </div>

              {/* Allergens selection */}
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">
                  Cảnh Báo Dị Ứng Thực Phẩm (Chọn nếu có):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {COMMON_ALLERGENS.map((allergen) => {
                    const isChecked = allergens.includes(allergen);
                    return (
                      <label
                        key={allergen}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                          isChecked
                            ? 'bg-rose-50 border-rose-300 text-rose-900 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleAllergen(allergen)}
                          className="rounded text-rose-600 focus:ring-rose-500 h-4 w-4"
                        />
                        <span>{allergen}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Note for kitchen */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Ghi Chú Đặc Biệt Cho Nhà Bếp
                </label>
                <textarea
                  value={dietaryNote}
                  onChange={(e) => setDietaryNote(e.target.value)}
                  placeholder="Ví dụ: Ăn cay nhẹ, không ăn được rau ngò / hành lá,..."
                  rows={3}
                  className="w-full bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg p-3 text-sm text-slate-900"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${dietBadge.color}`}>
                  Trạng thái hiện tại: {dietBadge.label}
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Đang lưu...' : 'Lưu Tùy Chọn Ăn Uống'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: VAI TRÒ & PHÂN QUYỀN THỰC TẾ */}
          {activeTab === 'permissions' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-indigo-50/80 border border-indigo-200 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-950 leading-relaxed">
                  <strong>Phân quyền theo vai trò (Role-Based Access Control - RBAC):</strong> Đây là các quyền hạn mà tài khoản của bạn được phép thực hiện trên hệ thống Quản lý Suất ăn Doanh nghiệp.
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-3">Danh Sách Quyền Hạn Đang Hoạt Động:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {allPermissions.map((perm) => {
                    const hasPerm = profile.effectivePermissions?.includes(perm.id);
                    return (
                      <div
                        key={perm.id}
                        className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${
                          hasPerm
                            ? 'bg-emerald-50/50 border-emerald-200'
                            : 'bg-slate-50/70 border-slate-200 opacity-60'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-slate-900">{perm.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                              {perm.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 leading-snug">{perm.description}</p>
                        </div>
                        {hasPerm ? (
                          <span className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Được phép
                          </span>
                        ) : (
                          <span className="shrink-0 text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            Không có quyền
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LỊCH SỬ ĂN UỐNG & CHẤM CÔNG */}
          {activeTab === 'stats' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Tổng Suất Đã Đặt</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {profile.stats?.totalBookings || 0}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <span className="text-xs font-semibold text-emerald-700 uppercase">Đã Quét Nhận Cơm</span>
                  <div className="text-2xl font-black text-emerald-800 mt-1">
                    {profile.stats?.checkedInCount || 0}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center">
                  <span className="text-xs font-semibold text-amber-700 uppercase">Tỷ Lệ Check-in</span>
                  <div className="text-2xl font-black text-amber-800 mt-1">
                    {profile.stats?.attendanceRate || 100}%
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-center">
                  <span className="text-xs font-semibold text-rose-700 uppercase">Bỏ Bữa (No-Show)</span>
                  <div className="text-2xl font-black text-rose-800 mt-1">
                    {profile.stats?.noShowCount || 0}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  Quy định sử dụng suất ăn văn phòng & nhà máy
                </h4>
                <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                  <li>Nhân viên cần đăng ký hoặc hủy suất ăn trước giờ cut-off của ca tương ứng (Ca trưa trước 09:30).</li>
                  <li>Nếu đăng ký nhưng không quét mã nhận cơm (No-show quá 3 lần/tháng), hệ thống sẽ gửi thông báo cảnh báo đến bộ phận HR.</li>
                  <li>Hệ thống tự động đối soát với dữ liệu quẹt thẻ ra vào máy chấm công vân tay/khuôn mặt mỗi ngày.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Hồ sơ nhân viên ID: <span className="font-mono font-bold text-slate-700">{profile.id}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
