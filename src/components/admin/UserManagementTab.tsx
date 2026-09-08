import { useState, useEffect, useCallback, type FormEvent } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Mail,
  Phone,
  ShieldCheck,
  Utensils,
  RefreshCw,
  X,
  Sparkles
} from 'lucide-react';
import { User, Department, RoleDefinition } from '../../types';
import { fetchApi } from '../../utils/api';

interface UserManagementTabProps {
  currentUser: User;
  onRefreshGlobal?: () => void;
}

const COMMON_ALLERGENS = [
  'Hải sản có vỏ (Tôm, Cua, Mực)',
  'Đậu phộng / Lạc',
  'Trứng gia cầm',
  'Sữa & Lactose',
  'Gluten / Bột mì',
  'Đậu nành & Đậu tương',
  'Thịt bò',
  'Ớt cay nồng',
];

export function UserManagementTab({ currentUser, onRefreshGlobal }: UserManagementTabProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  // Form State
  const [formEmployeeCode, setFormEmployeeCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formDeptId, setFormDeptId] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'LOCKED' | 'PENDING'>('ACTIVE');
  const [formDietaryPreference, setFormDietaryPreference] = useState<'NONE' | 'VEGETARIAN' | 'LOW_CARB' | 'DIABETIC' | 'HALAL'>('NONE');
  const [formAllergens, setFormAllergens] = useState<string[]>([]);
  const [formDietaryNote, setFormDietaryNote] = useState('');

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [uList, dList, rList] = await Promise.all([
        fetchApi<User[]>('/users', {}, currentUser.id),
        fetchApi<Department[]>('/departments', {}, currentUser.id),
        fetchApi<RoleDefinition[]>('/roles', {}, currentUser.id),
      ]);
      setUsers(uList);
      setDepartments(dList);
      setRoles(rList);
      if (dList.length > 0 && !formDeptId) {
        setFormDeptId(dList[0].id);
      }
      if (rList.length > 0 && !formRole) {
        setFormRole(rList[0].roleKey);
      }
    } catch (err) {
      console.error('Failed to load user management data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser.id, formDeptId, formRole]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    // Generate next employee code
    const nextNum = users.length + 1;
    const padded = String(nextNum).padStart(3, '0');
    setFormEmployeeCode(`EMP${padded}`);
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormDeptId(departments[0]?.id || 'dept_it');
    setFormRole(roles.find((r) => r.roleKey === 'Regular_Employee')?.roleKey || 'Regular_Employee');
    setFormStatus('ACTIVE');
    setFormDietaryPreference('NONE');
    setFormAllergens([]);
    setFormDietaryNote('');
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (u: User) => {
    setEditingUser(u);
    setFormEmployeeCode(u.employeeCode);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormPhone(u.phone || '');
    setFormDeptId(u.departmentId);
    setFormRole(u.role);
    setFormStatus(u.status);
    setFormDietaryPreference(u.dietaryPreference || 'NONE');
    setFormAllergens(u.allergens || []);
    setFormDietaryNote(u.dietaryNote || '');
  };

  const handleToggleAllergen = (item: string) => {
    setFormAllergens((prev) =>
      prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
    );
  };

  // Submit Create User
  const handleSubmitCreate = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    try {
      const newUser = await fetchApi<User>(
        '/users',
        {
          method: 'POST',
          body: JSON.stringify({
            employeeCode: formEmployeeCode,
            name: formName,
            email: formEmail,
            phone: formPhone,
            departmentId: formDeptId,
            role: formRole,
            status: formStatus,
            dietaryPreference: formDietaryPreference,
            allergens: formAllergens,
            dietaryNote: formDietaryNote,
          }),
        },
        currentUser.id
      );

      setMessage({ type: 'success', text: `Đã tạo nhân viên ${newUser.name} (${newUser.employeeCode}) thành công!` });
      setIsCreateModalOpen(false);
      await loadData();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi tạo nhân viên',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit User
  const handleSubmitEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
      const updated = await fetchApi<User>(
        `/users/${editingUser.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: formName,
            email: formEmail,
            phone: formPhone,
            departmentId: formDeptId,
            role: formRole,
            status: formStatus,
            dietaryPreference: formDietaryPreference,
            allergens: formAllergens,
            dietaryNote: formDietaryNote,
          }),
        },
        currentUser.id
      );

      setMessage({ type: 'success', text: `Cập nhật thông tin nhân viên ${updated.name} thành công!` });
      setEditingUser(null);
      await loadData();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi cập nhật nhân viên',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Lock/Unlock
  const handleToggleStatus = async (user: User) => {
    const newStatus = user.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
    try {
      await fetchApi<User>(
        `/users/${user.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: newStatus }),
        },
        currentUser.id
      );
      setMessage({
        type: 'success',
        text: `Đã ${newStatus === 'ACTIVE' ? 'mở khóa' : 'khóa'} tài khoản ${user.name} (${user.employeeCode})`,
      });
      await loadData();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể thay đổi trạng thái tài khoản',
      });
    }
  };

  // Delete User
  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    try {
      await fetchApi(
        `/users/${deletingUser.id}`,
        {
          method: 'DELETE',
        },
        currentUser.id
      );
      setMessage({
        type: 'success',
        text: `Đã xóa nhân viên ${deletingUser.name} khỏi hệ thống`,
      });
      setDeletingUser(null);
      await loadData();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi xóa người dùng',
      });
    }
  };

  // Filtered Users List
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.employeeCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = !selectedDept || u.departmentId === selectedDept;
    const matchesRole = !selectedRole || u.role === selectedRole;
    const matchesStatus = !selectedStatus || u.status === selectedStatus;
    return matchesSearch && matchesDept && matchesRole && matchesStatus;
  });

  // Calculate Quick Stats
  const activeCount = users.filter((u) => u.status === 'ACTIVE').length;
  const lockedCount = users.filter((u) => u.status === 'LOCKED').length;
  const specialDietCount = users.filter((u) => u.dietaryPreference && u.dietaryPreference !== 'NONE').length;

  return (
    <div className="space-y-6">
      {/* Friendly Notification Banner */}
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
          <button
            onClick={() => setMessage(null)}
            className="text-xs hover:opacity-75 cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tổng Nhân Sự</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{users.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">Hồ sơ đã định danh</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Đang Hoạt Động</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">{activeCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">Được phép đặt & nhận cơm</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wide">Ăn Kiêng / Dị Ứng</span>
            <Utensils className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2">{specialDietCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">Cần khay phục vụ riêng</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-600 uppercase tracking-wide">Tài Khoản Khóa</span>
            <Lock className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-700 mt-2">{lockedCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">Tạm dừng quyền đặt ăn</p>
        </div>
      </div>

      {/* Action Bar: Search, Filters & Add User Button */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[300px]">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên, mã NV (EMP001), email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
            />
          </div>

          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white"
          >
            <option value="">Tất cả phòng ban ({departments.length})</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Role Filter */}
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white"
          >
            <option value="">Tất cả vai trò</option>
            {roles.map((r) => (
              <option key={r.id} value={r.roleKey}>
                {r.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Hoạt động (ACTIVE)</option>
            <option value="LOCKED">Đang khóa (LOCKED)</option>
            <option value="PENDING">Chờ duyệt (PENDING)</option>
          </select>

          {(searchQuery || selectedDept || selectedRole || selectedStatus) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedDept('');
                setSelectedRole('');
                setSelectedStatus('');
              }}
              className="text-xs text-slate-500 hover:text-slate-800 underline px-2 cursor-pointer"
            >
              Xóa lọc
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>Thêm Nhân Viên Mới</span>
          </button>
        </div>
      </div>

      {/* Users Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Nhân Viên</th>
                <th className="py-3 px-4">Phòng Ban</th>
                <th className="py-3 px-4">Vai Trò Hệ Thống</th>
                <th className="py-3 px-4">Chế Độ Ăn Uống</th>
                <th className="py-3 px-4">Trạng Thái</th>
                <th className="py-3 px-4 text-right">Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Không tìm thấy nhân viên nào phù hợp với bộ lọc tìm kiếm.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = u.id === currentUser.id;
                  const isLocked = u.status === 'LOCKED';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition">
                      {/* Name & Avatar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={u.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                            alt={u.name}
                            className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-200"
                          />
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {u.name}
                              {isCurrent && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-normal">
                                  Bạn
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {u.employeeCode} • {u.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{u.departmentName || 'Chưa phân bổ'}</span>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                          <ShieldCheck className="w-3 h-3 text-indigo-600" />
                          {u.role}
                        </span>
                      </td>

                      {/* Dietary Preference */}
                      <td className="py-3 px-4">
                        <div>
                          {u.dietaryPreference === 'VEGETARIAN' && (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                              Ăn Chay
                            </span>
                          )}
                          {u.dietaryPreference === 'LOW_CARB' && (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
                              Low-Carb
                            </span>
                          )}
                          {u.dietaryPreference === 'DIABETIC' && (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-100 text-indigo-800">
                              Tiểu Đường
                            </span>
                          )}
                          {u.dietaryPreference === 'HALAL' && (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-100 text-purple-800">
                              Halal
                            </span>
                          )}
                          {(!u.dietaryPreference || u.dietaryPreference === 'NONE') && (
                            <span className="text-slate-400 text-[11px]">Tiêu chuẩn</span>
                          )}

                          {u.allergens && u.allergens.length > 0 && (
                            <div className="text-[10px] text-rose-600 font-medium mt-0.5">
                              Dị ứng: {u.allergens.join(', ')}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {u.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            Hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-100 text-rose-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                            Đang khóa
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(u)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition cursor-pointer"
                            title="Sửa thông tin"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {!isCurrent && (
                            <>
                              <button
                                onClick={() => handleToggleStatus(u)}
                                className={`p-1.5 rounded-md transition cursor-pointer ${
                                  isLocked
                                    ? 'text-emerald-600 hover:bg-emerald-50'
                                    : 'text-amber-600 hover:bg-amber-50'
                                }`}
                                title={isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                              >
                                {isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                              </button>

                              <button
                                onClick={() => setDeletingUser(u)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition cursor-pointer"
                                title="Xóa tài khoản"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-gradient-to-r from-rose-700 to-rose-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-rose-200" />
                <h3 className="font-bold text-base">Thêm Hồ Sơ Nhân Viên Mới</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCreate} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mã Nhân Viên *</label>
                  <input
                    type="text"
                    required
                    value={formEmployeeCode}
                    onChange={(e) => setFormEmployeeCode(e.target.value.toUpperCase())}
                    placeholder="VD: EMP006"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Họ Và Tên *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="VD: Nguyễn Văn A"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email Công Ty *</label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="VD: a.nv@enterprise.vn"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Số Điện Thoại</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="VD: 0912 345 678"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phòng Ban *</label>
                  <select
                    required
                    value={formDeptId}
                    onChange={(e) => setFormDeptId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Vai Trò Hệ Thống *</label>
                  <select
                    required
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.roleKey}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Trạng Thái Tài Khoản</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  >
                    <option value="ACTIVE">Hoạt động (ACTIVE)</option>
                    <option value="LOCKED">Khóa (LOCKED)</option>
                    <option value="PENDING">Chờ kích hoạt (PENDING)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Chế Độ Ăn Ban Đầu</label>
                  <select
                    value={formDietaryPreference}
                    onChange={(e) => setFormDietaryPreference(e.target.value as any)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  >
                    <option value="NONE">Tiêu chuẩn bình thường</option>
                    <option value="VEGETARIAN">Ăn chay</option>
                    <option value="LOW_CARB">Low-Carb / Healthy</option>
                    <option value="DIABETIC">Tiểu đường / Ít ngọt</option>
                    <option value="HALAL">Halal</option>
                  </select>
                </div>
              </div>

              {/* Allergens selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Cảnh Báo Dị Ứng (Nếu có):
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {COMMON_ALLERGENS.map((a) => {
                    const checked = formAllergens.includes(a);
                    return (
                      <label
                        key={a}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer ${
                          checked ? 'bg-rose-50 border-rose-300 font-semibold' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleAllergen(a)}
                          className="rounded text-rose-600 focus:ring-rose-500 h-3.5 w-3.5"
                        />
                        <span className="truncate">{a}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Ghi Chú Cho Nhà Bếp
                </label>
                <input
                  type="text"
                  value={formDietaryNote}
                  onChange={(e) => setFormDietaryNote(e.target.value)}
                  placeholder="VD: Không ăn tôm, thích nhiều rau"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                />
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
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang tạo...' : 'Xác Nhận Tạo Nhân Viên'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emerald-300" />
                <h3 className="font-bold text-base">Cập Nhật Nhân Viên: {editingUser.name} ({editingUser.employeeCode})</h3>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-white/80 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mã Nhân Viên</label>
                  <input
                    type="text"
                    disabled
                    value={formEmployeeCode}
                    className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-600 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Họ Và Tên *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email Công Ty *</label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Số Điện Thoại</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phòng Ban *</label>
                  <select
                    required
                    value={formDeptId}
                    onChange={(e) => setFormDeptId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-slate-800"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Vai Trò Hệ Thống *</label>
                  <select
                    required
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-slate-800"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.roleKey}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Trạng Thái</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-slate-800"
                  >
                    <option value="ACTIVE">Hoạt động (ACTIVE)</option>
                    <option value="LOCKED">Khóa (LOCKED)</option>
                    <option value="PENDING">Chờ kích hoạt (PENDING)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Chế Độ Ăn</label>
                  <select
                    value={formDietaryPreference}
                    onChange={(e) => setFormDietaryPreference(e.target.value as any)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-slate-800"
                  >
                    <option value="NONE">Tiêu chuẩn bình thường</option>
                    <option value="VEGETARIAN">Ăn chay</option>
                    <option value="LOW_CARB">Low-Carb / Healthy</option>
                    <option value="DIABETIC">Tiểu đường / Ít ngọt</option>
                    <option value="HALAL">Halal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Dị Ứng Thực Phẩm</label>
                <div className="grid grid-cols-2 gap-2">
                  {COMMON_ALLERGENS.map((a) => {
                    const checked = formAllergens.includes(a);
                    return (
                      <label
                        key={a}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer ${
                          checked ? 'bg-rose-50 border-rose-300 font-semibold' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleAllergen(a)}
                          className="rounded text-rose-600 focus:ring-rose-500 h-3.5 w-3.5"
                        />
                        <span className="truncate">{a}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Ghi Chú Cho Nhà Bếp</label>
                <input
                  type="text"
                  value={formDietaryNote}
                  onChange={(e) => setFormDietaryNote(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-slate-800"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-base text-slate-900">Xác Nhận Xóa Người Dùng</h3>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Bạn có chắc chắn muốn xóa tài khoản <strong>{deletingUser.name}</strong> ({deletingUser.employeeCode}) không? Thao tác này sẽ được ghi nhận vào Audit Log an ninh.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
              >
                Xác Nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
