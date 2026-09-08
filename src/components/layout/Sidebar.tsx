import { useState, useEffect } from 'react';
import {
  UtensilsCrossed,
  ChefHat,
  UserCheck,
  Building2,
  Clock,
  Users,
  ShieldCheck,
  QrCode,
  Package,
  KeyRound,
  FileText,
  ChevronDown,
  User as UserIcon,
  Menu as MenuIcon,
  X,
  Sparkles,
  ChevronRight,
  SlidersHorizontal,
  ExternalLink,
  LogOut,
  Smartphone,
  Tv,
} from 'lucide-react';
import { User, UserRole } from '../../types';

export type NavTabId =
  | 'employee'
  | 'kiosk'
  | 'kitchen'
  | 'inventory'
  | 'hr'
  | 'departments'
  | 'shifts'
  | 'users'
  | 'roles'
  | 'admin';

interface SidebarProps {
  currentUser: User;
  allUsers: User[];
  onSelectUser: (user: User) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenProfile: () => void;
  onLogout?: () => void;
}

export function Sidebar({
  currentUser,
  allUsers,
  onSelectUser,
  activeTab,
  setActiveTab,
  onOpenProfile,
  onLogout,
}: SidebarProps) {
  const [timeStr, setTimeStr] = useState('');
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

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
          label: 'Quản Trị Viên',
          bg: 'bg-red-950 text-red-300 border-red-800',
          dot: 'bg-red-500',
        };
      case 'HR_GA':
        return {
          label: 'Hành Chính - GA',
          bg: 'bg-blue-950 text-blue-300 border-blue-800',
          dot: 'bg-blue-500',
        };
      case 'Kitchen_Staff':
        return {
          label: 'Nhân Viên Bếp',
          bg: 'bg-amber-950 text-amber-300 border-amber-800',
          dot: 'bg-amber-500',
        };
      case 'Department_Representative':
        return {
          label: 'Đại Diện Phòng',
          bg: 'bg-sky-950 text-sky-300 border-sky-800',
          dot: 'bg-sky-500',
        };
      case 'QR_Checkin_Operator':
        return {
          label: 'Vận Hành IPC Căng Tin',
          bg: 'bg-emerald-950 text-emerald-300 border-emerald-800',
          dot: 'bg-emerald-500',
        };
      case 'Regular_Employee':
      default:
        return {
          label: 'Nhân Viên NETCO',
          bg: 'bg-slate-800 text-slate-300 border-slate-700',
          dot: 'bg-slate-400',
        };
    }
  };

  const badge = getRoleBadge(currentUser.role);

  // Grouped Navigation Items with CRUD labels (All aligned on the left as requested)
  const navSections = [
    {
      group: 'DỊCH VỤ SUẤT ĂN NETCO',
      items: [
        {
          id: 'employee',
          label: 'Đặt Suất Cả Tuần & Quét QR',
          desc: 'Đặt cơm tuần (Thứ 2-6), quét mã IPC',
          icon: UtensilsCrossed,
          crud: false,
          badgeText: 'TUẦN',
        },
        {
          id: 'kiosk',
          label: 'Màn Hình IPC Nhà Ăn',
          desc: 'Mã QR động 30s tại quầy căng tin',
          icon: Tv,
          crud: false,
          badgeText: 'IPC LIVE',
        },
      ],
    },
    {
      group: 'BẾP & NGUYÊN LIỆU (CRUD)',
      items: [
        {
          id: 'kitchen',
          label: 'Thực Đơn & Món Ăn',
          desc: 'CRUD món ăn, duyệt, xuất bản',
          icon: ChefHat,
          crud: true,
          badgeText: 'CRUD',
        },
        {
          id: 'inventory',
          label: 'Kho & Dự Báo Masan 100%',
          desc: 'BOM suất ăn, PO đề xuất mua hàng',
          icon: Package,
          crud: true,
          badgeText: 'MASAN',
        },
      ],
    },
    {
      group: 'HÀNH CHÍNH GA & ĐỐI SOÁT',
      items: [
        {
          id: 'hr',
          label: 'Chấm Công & Chi Phí (GA)',
          desc: 'Đối soát máy vân tay, báo cáo hạch toán',
          icon: UserCheck,
          crud: false,
        },
      ],
    },
    {
      group: 'TỔ CHỨC & VẬN HÀNH (CRUD)',
      items: [
        {
          id: 'departments',
          label: 'Quản Lý Phòng Ban',
          desc: 'CRUD phòng ban, gán đại diện',
          icon: Building2,
          crud: true,
          badgeText: 'CRUD',
        },
        {
          id: 'shifts',
          label: 'Quản Lý Ca & Cut-off',
          desc: 'CRUD ca ăn, giờ chốt đặt/hủy',
          icon: Clock,
          crud: true,
          badgeText: 'CRUD',
        },
      ],
    },
    {
      group: 'QUẢN TRỊ & BẢO MẬT (CRUD)',
      items: [
        {
          id: 'users',
          label: 'Quản Lý Người Dùng',
          desc: 'CRUD tài khoản, email @netcovn',
          icon: Users,
          crud: true,
          badgeText: 'CRUD',
        },
        {
          id: 'roles',
          label: 'Vai Trò & Phân Quyền RBAC',
          desc: 'CRUD vai trò, ma trận phân quyền',
          icon: KeyRound,
          crud: true,
          badgeText: 'CRUD',
        },
        {
          id: 'admin',
          label: 'Bật/Tắt Tính Năng & Tham Số',
          desc: 'Feature flags, cấu hình, vết kiểm toán',
          icon: SlidersHorizontal,
          crud: false,
          badgeText: 'MỚI',
        },
      ],
    },
  ];

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    setIsMobileOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 select-none border-r border-slate-800">
      {/* 1. Header: NETCO Brand Logo & Server Time */}
      <div className="p-4 border-b border-slate-800 bg-black/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-blue-700 flex items-center justify-center text-white shadow-lg shadow-red-600/30 font-black text-sm shrink-0 border border-white/20">
              NETCO
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base text-white tracking-tight">NETCO Meal</span>
                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-red-600 text-white shadow-xs">
                  ENTERPRISE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">Hệ Thống Suất Ăn Doanh Nghiệp</p>
            </div>
          </div>

          {/* Close for mobile */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Real-time Server Clock */}
        <div className="mt-3.5 flex items-center justify-between text-[11px] bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
          <span className="flex items-center gap-1.5 text-slate-400">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>Giờ máy chủ:</span>
          </span>
          <span className="font-mono font-bold text-white">
            {timeStr || '11:30:00'}
          </span>
        </div>
      </div>

      {/* 2. Navigation Items (Grouped on Left) */}
      <div className="flex-1 overflow-y-auto px-3 py-3.5 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
        {navSections.map((section) => (
          <div key={section.group} className="space-y-1">
            <div className="px-2.5 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>{section.group}</span>
            </div>

            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition cursor-pointer group ${
                    isActive
                      ? 'bg-red-600 text-white font-bold shadow-lg shadow-red-600/30'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition ${
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-red-400'
                      }`}
                    />
                    <div className="truncate">
                      <div className="text-xs tracking-tight truncate">{item.label}</div>
                      <div
                        className={`text-[10px] truncate ${
                          isActive ? 'text-red-100' : 'text-slate-500'
                        }`}
                      >
                        {item.desc}
                      </div>
                    </div>
                  </div>

                  {item.badgeText && (
                    <span
                      className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                        isActive
                          ? 'bg-white text-red-600'
                          : 'bg-slate-800 text-blue-400 border border-blue-500/30'
                      }`}
                    >
                      {item.badgeText}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* 3. Footer: User Profile, Role Quick Switcher, & Logout */}
      <div className="p-3 border-t border-slate-800 bg-black/60 space-y-2">
        {/* Profile Card Button */}
        <button
          onClick={onOpenProfile}
          className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-red-500/40 transition cursor-pointer text-left group"
          title="Bấm để xem hồ sơ, chế độ ăn kiêng & quyền hạn cá nhân"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <img
                src={
                  currentUser.avatarUrl ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                }
                alt={currentUser.name}
                className="w-8 h-8 rounded-lg object-cover ring-1 ring-red-500/40 group-hover:ring-red-400"
              />
              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${badge.dot} ring-2 ring-slate-900`} />
            </div>
            <div className="truncate">
              <div className="font-bold text-xs text-white group-hover:text-red-300 truncate">
                {currentUser.name}
              </div>
              <div className="text-[10px] text-slate-400 font-mono truncate">
                {currentUser.employeeCode} • {badge.label}
              </div>
            </div>
          </div>

          <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 shrink-0">
            Hồ sơ
          </span>
        </button>

        {/* Quick Role Switcher + Logout buttons */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <button
              onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 transition cursor-pointer"
            >
              <span className="text-slate-400 truncate">Đổi user test:</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {isRoleDropdownOpen && (
              <div className="absolute bottom-full left-0 mb-1 w-64 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 py-1 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  Chọn người dùng kiểm thử (@netcovn):
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-800">
                  {allUsers.map((u) => {
                    const isSelected = u.id === currentUser.id;
                    return (
                      <button
                        key={u.id}
                        onClick={() => {
                          onSelectUser(u);
                          setIsRoleDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-800 transition cursor-pointer text-xs ${
                          isSelected ? 'bg-red-950/60 text-red-300 font-bold' : 'text-slate-200'
                        }`}
                      >
                        <div className="truncate">
                          <div className="font-semibold truncate">{u.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono truncate">
                            {u.employeeCode} - {u.email}
                          </div>
                        </div>
                        {isSelected && <span className="text-red-400 text-xs">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              title="Đăng xuất về màn hình đăng nhập"
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-red-950/60 border border-slate-800 hover:border-red-800 text-slate-400 hover:text-red-400 transition cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Left Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 h-screen sticky top-0 shrink-0 z-30 shadow-2xl">
        {sidebarContent}
      </aside>

      {/* Mobile Top Navbar with Hamburger */}
      <div className="lg:hidden sticky top-0 z-40 bg-slate-950 border-b border-slate-800 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
          >
            <MenuIcon className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-red-600 to-blue-600 flex items-center justify-center text-white font-black text-xs">
              NET
            </div>
            <span className="font-bold text-sm text-white">NETCO Meal</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-800 border border-slate-700 text-xs cursor-pointer"
          >
            <img
              src={
                currentUser.avatarUrl ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
              }
              alt={currentUser.name}
              className="w-6 h-6 rounded-md object-cover"
            />
            <span className="font-medium text-[11px] text-slate-200 hidden sm:inline">{currentUser.name}</span>
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-red-400 cursor-pointer"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs"
            onClick={() => setIsMobileOpen(false)}
          />
          <div className="relative w-80 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
