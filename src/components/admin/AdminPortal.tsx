import { useState, useEffect, useCallback, type FormEvent } from 'react';
import {
  ShieldCheck,
  Settings,
  Clock,
  Building,
  Users,
  FileText,
  Save,
  CheckCircle2,
  Lock,
  Search,
  Eye,
  RefreshCw,
  KeyRound,
  UserPlus,
  Sliders,
  ToggleLeft
} from 'lucide-react';
import { User, Shift, SystemSettings, Department, AuditLog } from '../../types';
import { fetchApi } from '../../utils/api';
import { UserManagementTab } from './UserManagementTab';
import { RolePermissionTab } from './RolePermissionTab';
import { DepartmentManagementTab } from './DepartmentManagementTab';
import { ShiftManagementTab } from './ShiftManagementTab';
import { FeatureFlagsManager } from './FeatureFlagsManager';

interface AdminPortalProps {
  currentUser: User;
  onRefreshGlobal?: () => void;
  initialTab?: 'users' | 'roles' | 'settings' | 'shifts' | 'departments' | 'audit' | 'features';
}

export function AdminPortal({ currentUser, onRefreshGlobal, initialTab = 'users' }: AdminPortalProps) {
  const [adminTab, setAdminTab] = useState<'users' | 'roles' | 'settings' | 'shifts' | 'departments' | 'audit' | 'features'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setAdminTab(initialTab);
    }
  }, [initialTab]);

  const [config, setConfig] = useState<SystemSettings | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [cfg, sfts, depts, usrs, logs] = await Promise.all([
        fetchApi<SystemSettings>('/settings', {}, currentUser.id),
        fetchApi<Shift[]>('/shifts', {}, currentUser.id),
        fetchApi<Department[]>('/departments', {}, currentUser.id),
        fetchApi<User[]>('/users', {}, currentUser.id),
        fetchApi<AuditLog[]>('/audit-logs', {}, currentUser.id),
      ]);
      setConfig(cfg);
      setShifts(sfts);
      setDepartments(depts);
      setUsers(usrs);
      setAuditLogs(logs);
    } catch (err: unknown) {
      console.error('Error loading Admin data:', err);
    }
  }, [currentUser.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save System Config
  const handleSaveConfig = async (e: FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setIsSavingConfig(true);
    try {
      const updated = await fetchApi<SystemSettings>(
        '/settings',
        {
          method: 'PATCH',
          body: JSON.stringify(config),
        },
        currentUser.id
      );
      setConfig(updated);
      setMessage({ type: 'success', text: 'Cập nhật cấu hình hệ thống thành công và đã ghi vào Audit Log!' });
      await loadData();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi khi lưu cấu hình';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsSavingConfig(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Sub Navigation */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setAdminTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
              adminTab === 'users'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Quản Lý Người Dùng ({users.length})</span>
          </button>
          <button
            onClick={() => setAdminTab('roles')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
              adminTab === 'roles'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Vai Trò & Phân Quyền (RBAC)</span>
          </button>
          <button
            onClick={() => setAdminTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
              adminTab === 'settings'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Tham Số Hệ Thống</span>
          </button>
          <button
            onClick={() => setAdminTab('features')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
              adminTab === 'features'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Bật/Tắt Tính Năng</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800">
              MỚI
            </span>
          </button>
          <button
            onClick={() => setAdminTab('shifts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
              adminTab === 'shifts'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Quản Lý Ca & Cut-off ({shifts.length})</span>
          </button>
          <button
            onClick={() => setAdminTab('departments')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
              adminTab === 'departments'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Phòng Ban & Phân Quyền ({departments.length})</span>
          </button>
          <button
            onClick={() => setAdminTab('audit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
              adminTab === 'audit'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Nhật Ký Kiểm Toán (Audit Logs: {auditLogs.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-rose-700 font-bold bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
          <Lock className="w-3.5 h-3.5" />
          <span>Khu Vực Quản Trị Cấp Cao (Administrator Privileged)</span>
        </div>
      </div>

      {/* Alert Message */}
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

      {/* TAB 0.1: USER MANAGEMENT */}
      {adminTab === 'users' && (
        <UserManagementTab currentUser={currentUser} onRefreshGlobal={onRefreshGlobal} />
      )}

      {/* TAB 0.2: ROLE & PERMISSIONS RBAC */}
      {adminTab === 'roles' && (
        <RolePermissionTab currentUser={currentUser} onRefreshGlobal={onRefreshGlobal} />
      )}

      {/* TAB 1: SYSTEM SETTINGS */}
      {adminTab === 'settings' && config && (
        <form onSubmit={handleSaveConfig} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Cấu Hình Tham Số Nghiệp Vụ Toàn Doanh Nghiệp</h3>
            <p className="text-xs text-slate-500">
              Kiểm soát quy tắc nghiệp vụ nghiêm ngặt, cơ chế tính chi phí và an toàn kho thực phẩm.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
              <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-rose-600" />
                <span>Quy Tắc Quét QR & Kiểm Soát</span>
              </h4>

              <label className="flex items-start gap-3 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.isQrCheckinEnabled}
                  onChange={(e) => setConfig({ ...config, isQrCheckinEnabled: e.target.checked })}
                  className="w-4 h-4 mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <div className="font-bold text-slate-800">Bắt buộc quét mã QR khi nhận cơm tại căng tin</div>
                  <div className="text-slate-500">Nếu tắt, nhân viên có thể nhận cơm mà không cần quét máy kiểm soát.</div>
                </div>
              </label>

              <label className="flex items-start gap-3 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.isAttendanceSyncEnabled}
                  onChange={(e) => setConfig({ ...config, isAttendanceSyncEnabled: e.target.checked })}
                  className="w-4 h-4 mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <div className="font-bold text-slate-800">Tự động đồng bộ máy chấm công định kỳ (Cronjob)</div>
                  <div className="text-slate-500">Chạy định kỳ vào 09:30 và 14:00 hàng ngày đối soát nhân sự đi làm.</div>
                </div>
              </label>

              <label className="flex items-start gap-3 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.allowNegativeInventory}
                  onChange={(e) => setConfig({ ...config, allowNegativeInventory: e.target.checked })}
                  className="w-4 h-4 mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <div className="font-bold text-slate-800">Cho phép xuất kho âm (Negative Stock)</div>
                  <div className="text-slate-500">
                    Mặc định tắt: Hệ thống chặn mọi giao dịch xuất kho nếu số dư hiện tại không đủ.
                  </div>
                </div>
              </label>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
              <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-600" />
                <span>Phương Thức Hạch Toán Chi Phí Suất Ăn</span>
              </h4>

              <div className="space-y-2 text-xs">
                <label className="font-bold text-slate-700 block">Cơ sở tính ngân sách:</label>
                <select
                  value={config.costBasis}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      costBasis: e.target.value as 'BOOKED' | 'CHECKED_IN' | 'COOKED',
                    })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold"
                >
                  <option value="BOOKED">BOOKED - Tính theo số suất nhân viên đã đăng ký</option>
                  <option value="CHECKED_IN">CHECKED_IN - Chỉ tính theo số suất thực tế đã quét QR ăn</option>
                  <option value="COOKED">COOKED - Tính theo tổng số suất bếp đã nấu</option>
                </select>
                <div className="text-slate-500 text-[11px] pt-1">
                  Doanh nghiệp tiêu chuẩn nên chọn <strong>BOOKED</strong> để ràng buộc trách nhiệm của người đăng ký và tránh lãng phí đồ ăn.
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSavingConfig}
              className="flex items-center gap-2 px-6 py-2.5 bg-rose-700 hover:bg-rose-800 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-md shadow-rose-700/20"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingConfig ? 'Đang lưu...' : 'Lưu Thay Đổi Cấu Hình'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: SHIFTS & CUT-OFF (CRUD) */}
      {adminTab === 'shifts' && (
        <ShiftManagementTab currentUser={currentUser} onRefreshGlobal={onRefreshGlobal} />
      )}

      {/* TAB: FEATURE FLAGS TOGGLING */}
      {adminTab === 'features' && (
        <FeatureFlagsManager currentUser={currentUser} onRefreshGlobal={onRefreshGlobal} />
      )}

      {/* TAB 3: DEPARTMENTS & RBAC (CRUD) */}
      {adminTab === 'departments' && (
        <DepartmentManagementTab currentUser={currentUser} onRefreshGlobal={onRefreshGlobal} />
      )}

      {/* TAB 4: AUDIT LOGS */}
      {adminTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Nhật Ký Kiểm Toán Toàn Diện (Audit Trail)</h3>
              <p className="text-xs text-slate-500">
                Ghi lại mọi thay đổi dữ liệu, hành động nhạy cảm, phê duyệt thực đơn, check-in và IP truy vết.
              </p>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Tìm theo hành động hoặc người thực hiện..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg w-72"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3">Thời Gian</th>
                  <th className="p-3">Người Thực Hiện</th>
                  <th className="p-3">Hành Động</th>
                  <th className="p-3">Đối Tượng</th>
                  <th className="p-3">Chi Tiết / Lý Do</th>
                  <th className="p-3">Địa Chỉ IP</th>
                  <th className="p-3 text-right">Chi Tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs
                  .filter(
                    (l) =>
                      l.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
                      l.actorName.toLowerCase().includes(auditSearch.toLowerCase())
                  )
                  .map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3 font-mono text-[11px]">
                        {new Date(log.createdAt || log.timestamp || '').toLocaleTimeString('vi-VN')}{' '}
                        {new Date(log.createdAt || log.timestamp || '').toLocaleDateString('vi-VN')}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{log.actorName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {log.actorEmployeeCode || log.actorUserId}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-sm font-mono text-[10px] font-bold bg-slate-100 text-slate-800">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-medium">{log.resourceType || log.resource}</td>
                      <td className="p-3 max-w-xs truncate text-slate-700">
                        {log.newValue || (log.details ? JSON.stringify(log.details) : 'Thành công')}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-400">{log.ipAddress}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setSelectedAuditLog(log)}
                          className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Detail Modal */}
      {selectedAuditLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="font-bold text-base text-slate-900">Chi Tiết Bản Ghi Nhật Ký Kiểm Toán</h4>
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Request ID:</span>
                <span className="font-mono text-slate-700">{selectedAuditLog.requestId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Thời gian:</span>
                <span className="font-mono text-slate-700">{selectedAuditLog.timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Actor:</span>
                <span className="font-semibold text-slate-800">
                  {selectedAuditLog.actorName} ({selectedAuditLog.actorEmployeeCode} - {selectedAuditLog.actorRole})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Hành động:</span>
                <span className="font-mono font-bold text-rose-700">{selectedAuditLog.action}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tài nguyên:</span>
                <span className="font-mono text-slate-700">
                  {selectedAuditLog.resource} (ID: {selectedAuditLog.resourceId})
                </span>
              </div>
            </div>

            <div>
              <span className="text-slate-500 font-bold block mb-1">Dữ liệu chi tiết (JSON Payload):</span>
              <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48">
                {JSON.stringify(selectedAuditLog.details || {}, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
