import { useState, useEffect } from 'react';
import {
  UtensilsCrossed,
  ShieldCheck,
  UserCheck,
  ChefHat,
  Users,
  QrCode,
  Clock,
  ChevronDown,
  Building2,
  CalendarDays,
  User as UserIcon,
  Sparkles
} from 'lucide-react';
import { User, UserRole } from '../types';

interface HeaderProps {
  currentUser: User;
  allUsers: User[];
  onSelectUser: (user: User) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenProfile: () => void;
}

export function Header({
  currentUser,
  allUsers,
  onSelectUser,
  activeTab,
  setActiveTab,
  onOpenProfile,
}: HeaderProps) {
  const [timeStr, setTimeStr] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'Administrator':
        return {
          label: 'Quản Trị Viên (Admin)',
          bg: 'bg-rose-100 text-rose-800 border-rose-200',
          icon: ShieldCheck,
        };
      case 'HR_GA':
        return {
          label: 'Nhân Sự & Hành Chính (HR/GA)',
          bg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
          icon: UserCheck,
        };
      case 'Kitchen_Staff':
        return {
          label: 'Nhân Viên Bếp (Kitchen)',
          bg: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: ChefHat,
        };
      case 'Department_Representative':
        return {
          label: 'Đại Diện Phòng Ban',
          bg: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: Building2,
        };
      case 'QR_Checkin_Operator':
        return {
          label: 'Soát Vé Căng Tin (QR Kiosk)',
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          icon: QrCode,
        };
      case 'Regular_Employee':
      default:
        return {
          label: 'Nhân Viên (Employee)',
          bg: 'bg-slate-100 text-slate-800 border-slate-200',
          icon: Users,
        };
    }
  };

  const badge = getRoleBadge(currentUser.role);
  const BadgeIcon = badge.icon;

  const navigationTabs = [
    { id: 'employee', label: 'Đặt Suất & QR Ăn', icon: UtensilsCrossed },
    { id: 'kitchen', label: 'Bếp & Kho Thực Phẩm', icon: ChefHat },
    { id: 'hr', label: 'Duyệt & Xem Chấm Công', icon: UserCheck },
    { id: 'admin', label: 'Cấu Hình & Audit Log', icon: ShieldCheck },
    { id: 'kiosk', label: 'Kiosk Quét QR Căng Tin', icon: QrCode },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 shadow-xs">
      {/* Top Banner with Server Time & Role Quick-Switcher */}
      <div className="bg-slate-900 text-slate-200 text-xs px-4 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-medium text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Hệ thống hoạt động trực tiếp (Production Ready)
          </span>
          <span className="text-slate-500">|</span>
          <span className="flex items-center gap-1 text-slate-300 font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Giờ máy chủ: <strong className="text-white">{timeStr || '11:30:00'}</strong> (Asia/Ho_Chi_Minh)
          </span>
        </div>

        {/* Demo Fast Role Switcher */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-2.5 py-1 rounded-md border border-slate-700 transition cursor-pointer"
            title="Nhấn để đổi vai trò kiểm thử nhanh"
          >
            <span className="text-slate-400">Chuyển vai trò thử nghiệm:</span>
            <span className="font-semibold text-emerald-300">{currentUser.name}</span>
            <span className="text-slate-400">({currentUser.role})</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-1 w-80 bg-white text-slate-800 rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95">
              <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                Chọn tài khoản kiểm thử 6 vai trò:
              </div>
              <div className="max-h-80 overflow-y-auto">
                {allUsers.map((u) => {
                  const isSelected = u.id === currentUser.id;
                  return (
                    <button
                      key={u.id}
                      onClick={() => {
                        onSelectUser(u);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer text-xs ${
                        isSelected ? 'bg-emerald-50 text-emerald-900 font-semibold' : ''
                      }`}
                    >
                      <div>
                        <div className="font-medium text-slate-900">{u.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{u.employeeCode} - {u.email}</div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {u.role}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Header Row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-slate-900 tracking-tight">Kiro Meal</span>
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                  Enterprise
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">Hệ Thống Quản Lý Suất Ăn Doanh Nghiệp Toàn Diện</p>
            </div>
          </div>

          {/* Current User Profile Card - Clickable to View & Edit Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onOpenProfile}
              className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-emerald-300 transition cursor-pointer text-left group"
              title="Xem thông tin cá nhân, chỉnh sửa sở thích ăn uống và quyền hạn"
            >
              <div className="hidden md:flex flex-col items-end">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition">
                    {currentUser.name}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">({currentUser.employeeCode})</span>
                </div>
                <div className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.2 rounded-full border ${badge.bg}`}>
                  <BadgeIcon className="w-3 h-3" />
                  <span>{badge.label}</span>
                </div>
              </div>

              <div className="relative">
                <img
                  src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt={currentUser.name}
                  className="w-9 h-9 rounded-full ring-2 ring-emerald-500/40 object-cover group-hover:ring-emerald-600 transition"
                />
                <span className="absolute -bottom-1 -right-1 bg-emerald-600 text-white p-0.5 rounded-full ring-1 ring-white">
                  <UserIcon className="w-2.5 h-2.5" />
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Portals / Navigation Tabs */}
        <div className="flex space-x-1 border-t border-slate-100 overflow-x-auto py-1">
          {navigationTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
