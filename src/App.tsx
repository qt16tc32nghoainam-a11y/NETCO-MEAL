import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { LoginPage } from './components/auth/LoginPage';
import { EmployeePortal } from './components/employee/EmployeePortal';
import { KitchenPortal } from './components/kitchen/KitchenPortal';
import { HrPortal } from './components/hr/HrPortal';
import { AdminPortal } from './components/admin/AdminPortal';
import { QrScannerKiosk } from './components/qr/QrScannerKiosk';
import { UserProfileModal } from './components/profile/UserProfileModal';
import { DepartmentManagementTab } from './components/admin/DepartmentManagementTab';
import { ShiftManagementTab } from './components/admin/ShiftManagementTab';
import { UserManagementTab } from './components/admin/UserManagementTab';
import { RolePermissionTab } from './components/admin/RolePermissionTab';
import { User } from './types';
import { fetchApi } from './utils/api';
import {
  Loader2,
  RefreshCw,
  User as UserIcon,
  ShieldCheck,
  Building2,
  Clock,
  Users,
  KeyRound,
  UtensilsCrossed,
  Package,
  QrCode,
  FileSpreadsheet,
  SlidersHorizontal,
  ChevronRight,
  LogOut,
  Tv,
} from 'lucide-react';

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('employee');
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);

  // Load all users on mount
  useEffect(() => {
    fetchApi<User[]>('/users')
      .then((data) => {
        setUsers(data);
        if (data.length > 0) {
          const defaultUser = data.find((u) => u.employeeCode === 'EMP001') || data[0];
          setCurrentUser(defaultUser);
        }
      })
      .catch((err) => console.error('Failed to load users:', err))
      .finally(() => setIsLoading(false));
  }, []);

  const handleRefreshGlobal = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // When user logs in from LoginPage
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setIsAuthenticated(true);

    if (user.role === 'Kitchen_Staff') {
      setActiveTab('kitchen');
    } else if (user.role === 'HR_GA') {
      setActiveTab('hr');
    } else if (user.role === 'Administrator') {
      setActiveTab('admin');
    } else if (user.role === 'QR_Checkin_Operator') {
      setActiveTab('kiosk');
    } else {
      setActiveTab('employee');
    }
  };

  // When switching user role in sidebar tester
  const handleSelectUser = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'Kitchen_Staff') {
      setActiveTab('kitchen');
    } else if (user.role === 'HR_GA') {
      setActiveTab('hr');
    } else if (user.role === 'Administrator') {
      setActiveTab('admin');
    } else if (user.role === 'QR_Checkin_Operator') {
      setActiveTab('kiosk');
    } else {
      setActiveTab('employee');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  // Module Header Information dictionary
  const getModuleMeta = (tab: string) => {
    switch (tab) {
      case 'employee':
        return {
          title: 'Đặt Suất Cơm Tuần & Quét QR Nhà Ăn (User)',
          category: 'DỊCH VỤ SUẤT ĂN NETCO',
          desc: 'Đăng ký suất ăn theo ngày hoặc theo cả tuần (Thứ 2 - Thứ 6), đặt suất phòng ban/khách và quét mã QR IPC nhà ăn',
          icon: UtensilsCrossed,
          hasCrud: false,
        };
      case 'kiosk':
        return {
          title: 'Màn Hình IPC Nhà Ăn (NETCO Meal)',
          category: 'MÀN HÌNH CĂNG TIN',
          desc: 'Hiển thị mã QR tự động đổi mỗi 30s tại quầy ăn, cập nhật danh sách check-in thời gian thực',
          icon: Tv,
          hasCrud: false,
        };
      case 'kitchen':
        return {
          title: 'Quản Lý Thực Đơn & Món Ăn (CRUD)',
          category: 'BẾP & THỰC ĐƠN',
          desc: 'Lên thực đơn dinh dưỡng, thêm/sửa/xóa món ăn (CRUD), kế hoạch nấu và xuất bản thực đơn',
          icon: UtensilsCrossed,
          hasCrud: true,
        };
      case 'inventory':
        return {
          title: 'Kho & Dự Báo Nhu Cầu Masan 100% (BOM)',
          category: 'KHO & MUA HÀNG MASAN',
          desc: 'Bóc tách định mức món ăn (BOM) theo số suất đã đặt, tính toán thiếu hụt tồn kho và tự động xuất đơn PO theo 4 đơn vị Masan: MML, WinEco, CHIN-SU, WinCommerce',
          icon: Package,
          hasCrud: true,
        };
      case 'hr':
        return {
          title: 'Đối Soát Chấm Công & Chi Phí (Hành Chính - GA)',
          category: 'HÀNH CHÍNH GA',
          desc: 'Đồng bộ dữ liệu máy vân tay, so sánh suất ăn thực tế, xuất báo cáo chi phí suất ăn @netcovn',
          icon: FileSpreadsheet,
          hasCrud: false,
        };
      case 'departments':
        return {
          title: 'Quản Lý Phòng Ban & Đơn Vị (CRUD)',
          category: 'TỔ CHỨC DOANH NGHIỆP',
          desc: 'Thêm mới, sửa, xóa phòng ban (CRUD), gán đại diện đặt ăn và quản lý số lượng nhân viên',
          icon: Building2,
          hasCrud: true,
        };
      case 'shifts':
        return {
          title: 'Quản Lý Ca Ăn & Thời Điểm Cut-off (CRUD)',
          category: 'CẤU HÌNH VẬN HÀNH',
          desc: 'Thêm mới, sửa, xóa ca ăn (CRUD), cài đặt giờ chốt đặt/hủy và bật/tắt kích hoạt ca',
          icon: Clock,
          hasCrud: true,
        };
      case 'users':
        return {
          title: 'Quản Lý Người Dùng & Email @netcovn (CRUD)',
          category: 'QUẢN TRỊ NGƯỜI DÙNG',
          desc: 'Thêm mới nhân viên, cập nhật phòng ban, phân quyền vai trò, khóa/mở tài khoản và dị ứng',
          icon: Users,
          hasCrud: true,
        };
      case 'roles':
        return {
          title: 'Vai Trò & Ma Trận Phân Quyền RBAC (CRUD)',
          category: 'BẢO MẬT HỆ THỐNG',
          desc: 'Tạo vai trò mới, gán quyền chi tiết theo 5 nhóm nghiệp vụ và kiểm soát truy cập',
          icon: KeyRound,
          hasCrud: true,
        };
      case 'admin':
      default:
        return {
          title: 'Bật/Tắt Tính Năng & Tham Số Hệ Thống',
          category: 'HỆ THỐNG & AN NINH CẤP CAO',
          desc: 'Bật/tắt linh hoạt các tính năng chưa cần dùng, thiết lập tham số chốt suất, cơ sở hạch toán và nhật ký kiểm toán',
          icon: SlidersHorizontal,
          hasCrud: false,
        };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-300">
        <Loader2 className="w-10 h-10 animate-spin text-red-500 mb-3" />
        <h3 className="font-bold text-base text-white">Đang khởi động hệ thống NETCO Meal...</h3>
        <p className="text-xs text-slate-400 mt-1">Đồng bộ danh mục ca ăn, phòng ban và tài khoản @netcovn.com.vn</p>
      </div>
    );
  }

  // 1. If not authenticated, show the Login Page as requested
  if (!isAuthenticated || !currentUser) {
    return (
      <LoginPage
        allUsers={users}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  const currentMeta = getModuleMeta(activeTab);
  const MetaIcon = currentMeta.icon;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col lg:flex-row font-sans selection:bg-red-600 selection:text-white">
      {/* 1. LEFT SIDEBAR (All features arranged on the left with full CRUD) */}
      <Sidebar
        currentUser={currentUser}
        allUsers={users}
        onSelectUser={handleSelectUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenProfile={() => setIsProfileOpen(true)}
        onLogout={handleLogout}
      />

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header Bar with Breadcrumb & Quick Actions */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-3.5 sticky top-0 z-20 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-950 text-red-500 border border-slate-800 flex items-center justify-center shadow-xs shrink-0">
              <MetaIcon className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <span>{currentMeta.category}</span>
                <ChevronRight className="w-3 h-3 text-slate-300" />
                <span className="text-slate-600 dark:text-slate-300 truncate">{currentMeta.title}</span>
                {currentMeta.hasCrud && (
                  <span className="bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-[10px] font-black px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800">
                    CRUD ĐẦY ĐỦ
                  </span>
                )}
              </div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">
                {currentMeta.title}
              </h1>
            </div>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Refresh button */}
            <button
              onClick={handleRefreshGlobal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              title="Làm mới dữ liệu toàn hệ thống"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Làm Mới</span>
            </button>

            {/* Profile trigger button */}
            <button
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer"
              title="Xem và chỉnh sửa hồ sơ cá nhân"
            >
              <img
                src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                alt={currentUser.name}
                className="w-6 h-6 rounded-md object-cover ring-1 ring-red-500/40"
              />
              <span className="text-xs font-bold text-slate-900 dark:text-white hidden sm:inline">{currentUser.name}</span>
              <span className="text-[10px] text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 font-bold px-1.5 py-0.5 rounded">
                Hồ Sơ
              </span>
            </button>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60 text-xs font-bold transition cursor-pointer"
              title="Đăng xuất về trang chủ đăng nhập"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Đăng Xuất</span>
            </button>
          </div>
        </header>

        {/* User Profile & Dietary Preference Modal */}
        {isProfileOpen && (
          <UserProfileModal
            currentUser={currentUser}
            onClose={() => setIsProfileOpen(false)}
            onUpdateUser={(updated) => {
              setCurrentUser(updated);
              setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
              handleRefreshGlobal();
            }}
          />
        )}

        {/* Dynamic Portal / CRUD View */}
        <main className="flex-1 pb-16">
          {activeTab === 'employee' && (
            <div key={`emp-${refreshKey}-${currentUser.id}`}>
              <EmployeePortal
                currentUser={currentUser}
                onRefreshGlobal={handleRefreshGlobal}
              />
            </div>
          )}

          {activeTab === 'kiosk' && (
            <div key={`kiosk-${refreshKey}-${currentUser.id}`}>
              <QrScannerKiosk
                currentUser={currentUser}
                onRefreshGlobal={handleRefreshGlobal}
              />
            </div>
          )}

          {activeTab === 'kitchen' && (
            <div key={`kitchen-${refreshKey}-${currentUser.id}`}>
              <KitchenPortal
                currentUser={currentUser}
                onRefreshGlobal={handleRefreshGlobal}
                initialSubTab="menus"
              />
            </div>
          )}

          {activeTab === 'inventory' && (
            <div key={`inventory-${refreshKey}-${currentUser.id}`}>
              <KitchenPortal
                currentUser={currentUser}
                onRefreshGlobal={handleRefreshGlobal}
                initialSubTab="inventory"
              />
            </div>
          )}

          {activeTab === 'hr' && (
            <div key={`hr-${refreshKey}-${currentUser.id}`}>
              <HrPortal
                currentUser={currentUser}
                onRefreshGlobal={handleRefreshGlobal}
              />
            </div>
          )}

          {/* Dedicated Department Management Tab with full CRUD */}
          {activeTab === 'departments' && (
            <div key={`dept-${refreshKey}-${currentUser.id}`} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <DepartmentManagementTab
                currentUser={currentUser}
                onRefreshGlobal={handleRefreshGlobal}
              />
            </div>
          )}

          {/* Dedicated Shift Management Tab with full CRUD */}
          {activeTab === 'shifts' && (
            <div key={`shift-${refreshKey}-${currentUser.id}`} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <ShiftManagementTab
                currentUser={currentUser}
                onRefreshGlobal={handleRefreshGlobal}
              />
            </div>
          )}

          {/* Dedicated User Management Tab with full CRUD */}
          {activeTab === 'users' && (
            <div key={`users-${refreshKey}-${currentUser.id}`} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <UserManagementTab
                currentUser={currentUser}
                onRefreshGlobal={handleRefreshGlobal}
              />
            </div>
          )}

          {/* Dedicated Role & Permission Tab with full CRUD & RBAC matrix */}
          {activeTab === 'roles' && (
            <div key={`roles-${refreshKey}-${currentUser.id}`} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <RolePermissionTab
                currentUser={currentUser}
                onRefreshGlobal={handleRefreshGlobal}
              />
            </div>
          )}

          {/* System Settings & Audit Logs */}
          {activeTab === 'admin' && (
            <div key={`admin-${refreshKey}-${currentUser.id}`}>
              <AdminPortal
                currentUser={currentUser}
                onRefreshGlobal={handleRefreshGlobal}
                initialTab="settings"
              />
            </div>
          )}
        </main>

        {/* Enterprise Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 px-6 text-center text-xs text-slate-500">
          <div className="flex flex-wrap items-center justify-between gap-2 max-w-7xl mx-auto">
            <span>© 2026 NETCO Meal Enterprise — Hệ Thống Quản Lý Suất Ăn Doanh Nghiệp NETCO Post (@netcovn.com.vn).</span>
            <div className="flex items-center gap-4 text-slate-400 text-[11px]">
              <span>Chống Thất Thoát Thực Phẩm</span>
              <span>•</span>
              <span>Màn Hình IPC Nhà Ăn</span>
              <span>•</span>
              <span>RBAC & Audit Trail Đầy Đủ</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
