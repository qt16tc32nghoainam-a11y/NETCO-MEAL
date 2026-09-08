import { useState, useEffect, useCallback, type FormEvent } from 'react';
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Trash2,
  Users,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  UserCheck,
  Building,
  Mail,
  Phone
} from 'lucide-react';
import { Department, User } from '../../types';
import { fetchApi } from '../../utils/api';

interface DepartmentManagementTabProps {
  currentUser: User;
  onRefreshGlobal?: () => void;
}

export function DepartmentManagementTab({ currentUser, onRefreshGlobal }: DepartmentManagementTabProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);
  const [viewingDeptEmployees, setViewingDeptEmployees] = useState<{ dept: Department; employees: User[] } | null>(null);

  // Form states
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formRepUserId, setFormRepUserId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dList, uList] = await Promise.all([
        fetchApi<Department[]>('/departments', {}, currentUser.id),
        fetchApi<User[]>('/users', {}, currentUser.id),
      ]);
      setDepartments(dList);
      setUsers(uList);
    } catch (err) {
      console.error('Failed to load departments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormCode('');
    setFormName('');
    setFormRepUserId('');
    setIsCreateOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (dept: Department) => {
    setEditingDept(dept);
    setFormCode(dept.code);
    setFormName(dept.name);
    setFormRepUserId(dept.representativeUserId || '');
  };

  // Submit Create
  const handleSubmitCreate = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    try {
      const created = await fetchApi<Department>(
        '/departments',
        {
          method: 'POST',
          body: JSON.stringify({
            code: formCode,
            name: formName,
            representativeUserId: formRepUserId || undefined,
          }),
        },
        currentUser.id
      );

      setMessage({ type: 'success', text: `Đã tạo phòng ban "${created.name}" (${created.code}) thành công!` });
      setIsCreateOpen(false);
      await loadData();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi tạo phòng ban',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit
  const handleSubmitEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
      const updated = await fetchApi<Department>(
        `/departments/${editingDept.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            code: formCode,
            name: formName,
            representativeUserId: formRepUserId || undefined,
          }),
        },
        currentUser.id
      );

      setMessage({ type: 'success', text: `Đã cập nhật phòng ban "${updated.name}" thành công!` });
      setEditingDept(null);
      await loadData();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi cập nhật phòng ban',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingDept) return;
    try {
      await fetchApi(
        `/departments/${deletingDept.id}`,
        {
          method: 'DELETE',
        },
        currentUser.id
      );

      setMessage({ type: 'success', text: `Đã xóa phòng ban "${deletingDept.name}" thành công!` });
      setDeletingDept(null);
      await loadData();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể xóa phòng ban này',
      });
    }
  };

  // View employees
  const handleViewEmployees = async (dept: Department) => {
    try {
      const emps = await fetchApi<User[]>(`/departments/${dept.id}/employees`, {}, currentUser.id);
      setViewingDeptEmployees({ dept, employees: emps });
    } catch (err) {
      console.error(err);
    }
  };

  // Filter departments
  const filteredDepartments = departments.filter((d) => {
    const q = searchQuery.toLowerCase();
    const rep = users.find((u) => u.id === d.representativeUserId);
    const repName = rep?.name.toLowerCase() || '';
    return (
      d.name.toLowerCase().includes(q) ||
      d.code.toLowerCase().includes(q) ||
      repName.includes(q)
    );
  });

  const totalAssignedStaff = departments.reduce((acc, d) => acc + (d.totalEmployees || 0), 0);
  const departmentsWithRep = departments.filter((d) => Boolean(d.representativeUserId)).length;

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tổng Phòng Ban</span>
            <Building2 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{departments.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">Đơn vị hạch toán chi phí</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Nhân Sự Phân Bổ</span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">{totalAssignedStaff}</div>
          <p className="text-[11px] text-slate-400 mt-1">Người thuộc các phòng ban</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">Có Đại Diện Đặt Cơm</span>
            <UserCheck className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-700 mt-2">{departmentsWithRep} / {departments.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">Được quyền đặt theo lô cho phòng</p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên phòng ban, mã (IT-DEV), người đại diện..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
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
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Phòng Ban Mới</span>
          </button>
        </div>
      </div>

      {/* Departments Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Mã Phòng</th>
                <th className="py-3 px-4">Tên Phòng Ban</th>
                <th className="py-3 px-4">Đại Diện Đặt Suất</th>
                <th className="py-3 px-4">Số Nhân Sự</th>
                <th className="py-3 px-4 text-right">Thao Tác (CRUD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
              {filteredDepartments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Không tìm thấy phòng ban nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredDepartments.map((dept) => {
                  const repUser = users.find((u) => u.id === dept.representativeUserId);

                  return (
                    <tr key={dept.id} className="hover:bg-slate-50/80 transition">
                      {/* Code */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md text-xs">
                          {dept.code}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="font-bold text-slate-900 text-sm">{dept.name}</span>
                        </div>
                      </td>

                      {/* Representative */}
                      <td className="py-3 px-4">
                        {repUser ? (
                          <div className="flex items-center gap-2">
                            <img
                              src={repUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                              alt={repUser.name}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                            <div>
                              <div className="font-semibold text-slate-800">{repUser.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {repUser.employeeCode}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Chưa chỉ định</span>
                        )}
                      </td>

                      {/* Total staff */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleViewEmployees(dept)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-slate-700 bg-slate-100 hover:bg-slate-200 font-semibold transition cursor-pointer"
                          title="Bấm để xem danh sách nhân sự"
                        >
                          <Users className="w-3.5 h-3.5 text-slate-500" />
                          <span>{dept.totalEmployees || 0} nhân viên</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(dept)}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition cursor-pointer"
                            title="Sửa phòng ban"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setDeletingDept(dept)}
                            className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                            title="Xóa phòng ban"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* CREATE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-200" />
                <h3 className="font-bold text-base">Thêm Phòng Ban Mới</h3>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="text-white/80 hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mã Phòng Ban (Code) *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: IT-DEV hoặc SALES-MKT"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tên Phòng Ban *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Phòng Phát Triển Công Nghệ"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Đại Diện Đặt Suất Phòng Ban (Tùy chọn)
                </label>
                <select
                  value={formRepUserId}
                  onChange={(e) => setFormRepUserId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Chưa chỉ định người đại diện --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.employeeCode}) - {u.role}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Nhân sự này sẽ có quyền đại diện đăng ký suất ăn theo lô cho các thành viên trong phòng.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang tạo...' : 'Xác Nhận Tạo Phòng Ban'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingDept && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-300" />
                <h3 className="font-bold text-base">Cập Nhật Phòng Ban: {editingDept.name}</h3>
              </div>
              <button onClick={() => setEditingDept(null)} className="text-white/80 hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mã Phòng Ban (Code) *</label>
                <input
                  type="text"
                  required
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tên Phòng Ban *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Đại Diện Đặt Suất</label>
                <select
                  value={formRepUserId}
                  onChange={(e) => setFormRepUserId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-slate-900"
                >
                  <option value="">-- Chưa chỉ định người đại diện --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.employeeCode}) - {u.role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingDept(null)}
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

      {/* DELETE CONFIRMATION */}
      {deletingDept && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-base text-slate-900">Xác Nhận Xóa Phòng Ban</h3>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Bạn có chắc chắn muốn xóa phòng ban <strong>{deletingDept.name}</strong> ({deletingDept.code}) không? Thao tác này sẽ kiểm tra xem phòng ban còn nhân viên hay không.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingDept(null)}
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

      {/* VIEW EMPLOYEES MODAL */}
      {viewingDeptEmployees && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Danh Sách Nhân Sự: {viewingDeptEmployees.dept.name}</h3>
                <span className="text-xs text-slate-300 font-mono">Mã: {viewingDeptEmployees.dept.code}</span>
              </div>
              <button
                onClick={() => setViewingDeptEmployees(null)}
                className="text-white/80 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-96 overflow-y-auto divide-y divide-slate-100">
              {viewingDeptEmployees.employees.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs">
                  Phòng ban này hiện chưa có nhân viên nào trực thuộc.
                </div>
              ) : (
                viewingDeptEmployees.employees.map((emp) => (
                  <div key={emp.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={emp.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                        alt={emp.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <div>
                        <div className="font-bold text-xs text-slate-900">{emp.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {emp.employeeCode} • {emp.email}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {emp.role}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setViewingDeptEmployees(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer"
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
