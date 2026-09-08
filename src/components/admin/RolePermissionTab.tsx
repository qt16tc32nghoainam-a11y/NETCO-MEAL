import { useState, useEffect, useCallback, type FormEvent } from 'react';
import {
  ShieldCheck,
  ShieldPlus,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Users,
  Lock,
  Save,
  Trash2,
  X,
  RefreshCw,
  Info
} from 'lucide-react';
import { RoleDefinition, PermissionDefinition, User } from '../../types';
import { fetchApi } from '../../utils/api';

interface RolePermissionTabProps {
  currentUser: User;
  onRefreshGlobal?: () => void;
}

export function RolePermissionTab({ currentUser, onRefreshGlobal }: RolePermissionTabProps) {
  const [roles, setRoles] = useState<(RoleDefinition & { userCount?: number })[]>([]);
  const [permissions, setPermissions] = useState<PermissionDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Selected role for editing permissions matrix
  const [activeRoleKey, setActiveRoleKey] = useState<string>('Administrator');
  const [rolePermissionsDraft, setRolePermissionsDraft] = useState<Record<string, string[]>>({});

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRoleKey, setNewRoleKey] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('blue');
  const [newRolePerms, setNewRolePerms] = useState<string[]>(['MEAL_ORDER_SELF']);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rList, pList] = await Promise.all([
        fetchApi<(RoleDefinition & { userCount?: number })[]>('/roles', {}, currentUser.id),
        fetchApi<PermissionDefinition[]>('/permissions', {}, currentUser.id),
      ]);
      setRoles(rList);
      setPermissions(pList);

      // Initialize draft mapping
      const draft: Record<string, string[]> = {};
      rList.forEach((r) => {
        draft[r.id] = [...r.permissions];
      });
      setRolePermissionsDraft(draft);

      if (rList.length > 0 && !activeRoleKey) {
        setActiveRoleKey(rList[0].roleKey);
      }
    } catch (err) {
      console.error('Failed to load role & permission data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser.id, activeRoleKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Group permissions by category
  const groupedPermissions = permissions.reduce((acc, perm) => {
    const cat = perm.category || 'Khác';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(perm);
    return acc;
  }, {} as Record<string, PermissionDefinition[]>);

  // Toggle permission in matrix draft
  const handleTogglePermission = (roleId: string, permId: string) => {
    setRolePermissionsDraft((prev) => {
      const current = prev[roleId] || [];
      const updated = current.includes(permId)
        ? current.filter((id) => id !== permId)
        : [...current, permId];
      return { ...prev, [roleId]: updated };
    });
  };

  // Save updated permissions for a role
  const handleSaveRolePermissions = async (role: RoleDefinition) => {
    setIsSaving(true);
    setMessage(null);
    try {
      const updatedPerms = rolePermissionsDraft[role.id] || [];
      const updated = await fetchApi<RoleDefinition>(
        `/roles/${role.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            permissions: updatedPerms,
          }),
        },
        currentUser.id
      );

      setMessage({
        type: 'success',
        text: `Đã lưu cập nhật ma trận phân quyền cho vai trò "${updated.name}" (${updatedPerms.length} quyền)!`,
      });
      await loadData();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi lưu phân quyền',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Create new Role
  const handleCreateRole = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      const newRole = await fetchApi<RoleDefinition>(
        '/roles',
        {
          method: 'POST',
          body: JSON.stringify({
            roleKey: newRoleKey,
            name: newRoleName,
            description: newRoleDesc,
            badgeColor: newRoleColor,
            permissions: newRolePerms,
          }),
        },
        currentUser.id
      );

      setMessage({
        type: 'success',
        text: `Đã tạo thành công vai trò mới: "${newRole.name}"!`,
      });
      setIsCreateModalOpen(false);
      setActiveRoleKey(newRole.roleKey);
      await loadData();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi tạo vai trò mới',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Custom Role
  const handleDeleteRole = async (role: RoleDefinition) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa vai trò "${role.name}" không?`)) return;
    try {
      await fetchApi(
        `/roles/${role.id}`,
        {
          method: 'DELETE',
        },
        currentUser.id
      );
      setMessage({
        type: 'success',
        text: `Đã xóa vai trò "${role.name}" thành công!`,
      });
      await loadData();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể xóa vai trò này',
      });
    }
  };

  const selectedRole = roles.find((r) => r.roleKey === activeRoleKey) || roles[0];

  return (
    <div className="space-y-6">
      {/* Alert Message */}
      {message && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm font-medium transition ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            Cơ Chế Phân Quyền Vai Trò (Role-Based Access Control - RBAC)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý các nhóm chức năng, gán quyền chi tiết theo nguyên tắc đặc quyền tối thiểu (Principle of Least Privilege).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
            title="Làm mới"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              setNewRoleKey('');
              setNewRoleName('');
              setNewRoleDesc('');
              setNewRolePerms(['MEAL_ORDER_SELF']);
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer shadow-xs"
          >
            <ShieldPlus className="w-4 h-4" />
            <span>Tạo Vai Trò Mới</span>
          </button>
        </div>
      </div>

      {/* Roles Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((r) => {
          const isSelected = r.roleKey === activeRoleKey;
          const assignedPermsCount = rolePermissionsDraft[r.id]?.length ?? r.permissions.length;

          return (
            <div
              key={r.id}
              onClick={() => setActiveRoleKey(r.roleKey)}
              className={`p-4 rounded-xl border-2 transition cursor-pointer relative flex flex-col justify-between ${
                isSelected
                  ? 'border-indigo-600 bg-indigo-50/40 shadow-sm ring-1 ring-indigo-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-800">
                      <KeyRound className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 leading-tight">{r.name}</h4>
                      <span className="text-[11px] font-mono text-slate-500">{r.roleKey}</span>
                    </div>
                  </div>

                  {r.isSystem ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                      Mặc định
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRole(r);
                      }}
                      className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50"
                      title="Xóa vai trò tùy chỉnh này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-600 mt-2.5 line-clamp-2">{r.description}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-slate-600">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <strong>{r.userCount || 0}</strong> nhân viên
                </span>

                <span className="font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md text-[11px]">
                  {assignedPermsCount} / {permissions.length} quyền
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ACTIVE ROLE PERMISSION MATRIX */}
      {selectedRole && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Ma Trận Phân Quyền Chi Tiết Cho:
                </span>
                <span className="font-extrabold text-slate-900 text-base">{selectedRole.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-mono">
                  {selectedRole.roleKey}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{selectedRole.description}</p>
            </div>

            <button
              onClick={() => handleSaveRolePermissions(selectedRole)}
              disabled={isSaving}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi Phân Quyền'}
            </button>
          </div>

          <div className="p-4 sm:p-6 space-y-6">
            {(Object.entries(groupedPermissions) as [string, PermissionDefinition[]][]).map(([category, catPerms]) => (
              <div key={category} className="space-y-3">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                  <span className="font-bold text-xs uppercase tracking-wider text-indigo-900">
                    Nhóm Quyền: {category}
                  </span>
                  <span className="text-[11px] text-slate-400">({catPerms.length} quyền hạn)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {catPerms.map((perm) => {
                    const isGranted = (
                      rolePermissionsDraft[selectedRole.id] || selectedRole.permissions
                    ).includes(perm.id);

                    return (
                      <label
                        key={perm.id}
                        className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                          isGranted
                            ? 'bg-indigo-50/50 border-indigo-200'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isGranted}
                          onChange={() => handleTogglePermission(selectedRole.id, perm.id)}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs text-slate-900">{perm.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">{perm.id}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            {perm.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE NEW ROLE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-gradient-to-r from-indigo-700 to-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldPlus className="w-5 h-5 text-indigo-300" />
                <h3 className="font-bold text-base">Tạo Vai Trò Người Dùng Mới</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Mã Định Danh Vai Trò (Role Key) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Dietitian_Specialist hoặc Canteen_Supervisor"
                  value={newRoleKey}
                  onChange={(e) => setNewRoleKey(e.target.value.replace(/\s+/g, '_'))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">Dùng để phân quyền trong logic hệ thống và API.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Tên Hiển Thị Vai Trò *
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Chuyên Viên Dinh Dưỡng hoặc Giám Sát Căng Tin"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mô Tả Chức Năng</label>
                <textarea
                  rows={2}
                  placeholder="Mô tả trách nhiệm và phạm vi công việc của vai trò này"
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Initial Permissions Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                  Chọn Các Quyền Ban Đầu:
                </label>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50">
                  {permissions.map((p) => {
                    const checked = newRolePerms.includes(p.id);
                    return (
                      <label key={p.id} className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setNewRolePerms((prev) =>
                              prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                            )
                          }
                          className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                        />
                        <span className="font-semibold">{p.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({p.category})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSaving ? 'Đang tạo...' : 'Xác Nhận Tạo Vai Trò'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
