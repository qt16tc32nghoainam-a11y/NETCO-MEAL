import React, { useState } from 'react';
import {
  UtensilsCrossed,
  ShieldCheck,
  UserCheck,
  ChefHat,
  Monitor,
  Users,
  Building2,
  Lock,
  Mail,
  ArrowRight,
  Sparkles,
  QrCode,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { User, UserRole } from '../../types';

interface LoginPageProps {
  allUsers: User[];
  onLoginSuccess: (user: User) => void;
}

export function LoginPage({ allUsers, onLoginSuccess }: LoginPageProps) {
  const [identifier, setIdentifier] = useState('tuan.hm@netcovn.com.vn');
  const [password, setPassword] = useState('••••••••');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    setTimeout(() => {
      const cleanInput = identifier.trim().toLowerCase();
      // Match by email or employeeCode
      const matchedUser = allUsers.find(
        (u) =>
          u.email.toLowerCase() === cleanInput ||
          u.employeeCode.toLowerCase() === cleanInput ||
          u.email.toLowerCase().startsWith(cleanInput)
      );

      if (matchedUser) {
        setIsLoading(false);
        onLoginSuccess(matchedUser);
      } else {
        setIsLoading(false);
        setErrorMsg('Không tìm thấy tài khoản với email hoặc mã nhân viên này trong hệ thống NETCO (@netcovn.com.vn).');
      }
    }, 400);
  };

  const handleQuickSelect = (user: User) => {
    setIdentifier(user.email);
    setPassword('••••••••');
    setErrorMsg('');
    onLoginSuccess(user);
  };

  const demoPersonas: {
    roleTitle: string;
    roleKey: UserRole;
    user: User | undefined;
    badgeColor: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      roleTitle: 'Nhân Viên (Standard)',
      roleKey: 'Regular_Employee',
      user: allUsers.find((u) => u.employeeCode === 'EMP001') || allUsers.find((u) => u.role === 'Regular_Employee'),
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      description: 'Đặt cơm trưa/tối, bật camera quét mã IPC tại quầy ăn',
      icon: Users,
    },
    {
      roleTitle: 'Hành Chính GA',
      roleKey: 'HR_GA',
      user: allUsers.find((u) => u.role === 'HR_GA') || allUsers.find((u) => u.employeeCode === 'GA001'),
      badgeColor: 'bg-red-50 text-red-700 border-red-200',
      description: 'Duyệt thực đơn, xem tổng hợp chấm công read-only, kiểm soát chi phí',
      icon: UserCheck,
    },
    {
      roleTitle: 'Bếp Trưởng',
      roleKey: 'Kitchen_Staff',
      user: allUsers.find((u) => u.role === 'Kitchen_Staff') || allUsers.find((u) => u.employeeCode === 'BEP001'),
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      description: 'Lên thực đơn dinh dưỡng, quản lý kho nguyên vật liệu',
      icon: ChefHat,
    },
    {
      roleTitle: 'Quản Trị Viên (Admin)',
      roleKey: 'Administrator',
      user: allUsers.find((u) => u.role === 'Administrator') || allUsers.find((u) => u.employeeCode === 'ADMIN001'),
      badgeColor: 'bg-slate-900 text-white border-slate-700',
      description: 'CRUD phòng ban, ca làm việc, phân quyền RBAC toàn diện',
      icon: ShieldCheck,
    },
    {
      roleTitle: 'Đại Diện Phòng Ban (IT)',
      roleKey: 'Department_Representative',
      user: allUsers.find((u) => u.role === 'Department_Representative'),
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      description: 'Đặt cơm gộp cho thành viên phòng ban, đặt suất khách',
      icon: Building2,
    },
    {
      roleTitle: 'Màn Hình IPC Nhà Ăn',
      roleKey: 'QR_Checkin_Operator',
      user: allUsers.find((u) => u.role === 'QR_Checkin_Operator'),
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      description: 'Kiosk IPC hiển thị mã QR động 30s cho nhân viên tự quét',
      icon: QrCode,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col justify-between text-slate-100 selection:bg-red-600 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-red-600/30 font-black text-lg">
              NM
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xl text-white tracking-tight">NETCO Meal</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-600/20 text-red-400 border border-red-500/30">
                  ENTERPRISE
                </span>
              </div>
              <p className="text-xs text-slate-400">Hệ Thống Quản Lý Suất Ăn Doanh Nghiệp @netcovn.com.vn</p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Hệ thống trực tuyến</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Bảo mật 2 lớp MFA</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Login Canvas */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Login Form */}
          <div className="lg:col-span-5 w-full">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
              {/* Subtle top brand glow: Red & Blue */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-white to-blue-600" />

              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white tracking-tight">Đăng nhập tài khoản</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Nhập email doanh nghiệp <span className="text-blue-400 font-medium">@netcovn.com.vn</span> hoặc mã nhân viên để tiếp tục.
                </p>
              </div>

              {errorMsg && (
                <div className="mb-5 p-3.5 rounded-xl bg-red-950/50 border border-red-800/80 text-red-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Email / Mã nhân viên
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="tuan.hm@netcovn.com.vn hoặc EMP001"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Mật khẩu
                    </label>
                    <span className="text-[11px] text-blue-400 hover:underline cursor-pointer">
                      Quên mật khẩu?
                    </span>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded bg-slate-950 border-slate-700 text-red-600 focus:ring-red-500 w-3.5 h-3.5"
                    />
                    <span>Ghi nhớ đăng nhập trên thiết bị này</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-sm shadow-lg shadow-red-700/30 hover:shadow-red-700/50 flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.99] disabled:opacity-50"
                >
                  {isLoading ? (
                    <span>Đang xác thực thông tin...</span>
                  ) : (
                    <>
                      <span>Đăng Nhập Vào NETCO Meal</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Note about IPC Screen */}
              <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-blue-400" />
                  <span>Quét QR tại màn hình IPC nhà ăn</span>
                </span>
                <span className="text-[11px] font-mono text-slate-500">v2.4 Enterprise</span>
              </div>
            </div>
          </div>

          {/* Right Column: Quick Demo Persona Selector */}
          <div className="lg:col-span-7">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 sm:p-7 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    <h3 className="text-base font-bold text-white">Đăng nhập nhanh theo vai trò (Demo Switch)</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Chọn nhanh một trong các vai trò nhân sự thuộc hệ thống NETCO Meal để trải nghiệm ngay:
                  </p>
                </div>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium shrink-0">
                  6 Vai trò hệ thống
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {demoPersonas.map((persona, idx) => {
                  const targetUser = persona.user;
                  if (!targetUser) return null;
                  const IconComp = persona.icon;

                  return (
                    <button
                      key={idx}
                      onClick={() => handleQuickSelect(targetUser)}
                      className="group text-left p-3.5 rounded-xl bg-slate-950/80 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 transition cursor-pointer flex flex-col justify-between relative overflow-hidden"
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={targetUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                          alt={targetUser.name}
                          className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-xs text-white group-hover:text-blue-400 transition truncate">
                              {targetUser.name}
                            </span>
                            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                              {targetUser.employeeCode}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                            {targetUser.email}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 truncate flex items-center gap-1.5">
                          <IconComp className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          <span className="truncate">{persona.roleTitle}</span>
                        </span>
                        <span className="text-[11px] font-semibold text-blue-400 group-hover:translate-x-0.5 transition flex items-center gap-0.5">
                          Chọn <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Workflow explanation box */}
              <div className="mt-5 p-4 rounded-xl bg-gradient-to-r from-red-950/30 via-slate-900 to-blue-950/30 border border-slate-800 text-xs text-slate-300">
                <div className="font-semibold text-white flex items-center gap-2 mb-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <span>Quy trình Check-in Nhà Ăn NETCO kiểu mới:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-400 leading-relaxed">
                  <li><strong className="text-white">Màn hình IPC Nhà Ăn:</strong> Hiển thị mã QR xoay vòng 30s chống chụp trộm.</li>
                  <li><strong className="text-white">Nhân viên dùng điện thoại:</strong> Mở app NETCO Meal, bấm &quot;Quét QR Nhà Ăn&quot; hướng camera vào màn hình IPC.</li>
                  <li><strong className="text-white">Xác nhận tức thì:</strong> Hệ thống đối soát suất ăn đã đăng ký và hiển thị thông báo nhận khay cơm ngay lập tức!</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 px-6 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>© 2026 NETCO Meal. Bản quyền thuộc Tổng Công Ty Cổ Phần NETCO.</div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Chính sách suất ăn</span>
            <span>•</span>
            <span>Hỗ trợ GA: 1900 6868</span>
            <span>•</span>
            <span className="text-slate-500">Server: HCM-PRD-01</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
