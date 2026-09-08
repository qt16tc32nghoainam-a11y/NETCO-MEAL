import { useState, useEffect, useCallback, type FormEvent } from 'react';
import {
  Clock,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Power,
  ShieldCheck,
  Calendar,
  Info,
  Timer
} from 'lucide-react';
import { Shift, User } from '../../types';
import { fetchApi } from '../../utils/api';

interface ShiftManagementTabProps {
  currentUser: User;
  onRefreshGlobal?: () => void;
}

export function ShiftManagementTab({ currentUser, onRefreshGlobal }: ShiftManagementTabProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [deletingShift, setDeletingShift] = useState<Shift | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formStartTime, setFormStartTime] = useState('11:30');
  const [formEndTime, setFormEndTime] = useState('13:30');
  const [formCutoffOrder, setFormCutoffOrder] = useState('120');
  const [formCutoffCancel, setFormCutoffCancel] = useState('60');
  const [formCheckinStart, setFormCheckinStart] = useState('30');
  const [formCheckinEnd, setFormCheckinEnd] = useState('30');
  const [formOrderDisplay, setFormOrderDisplay] = useState('09:30');
  const [formCancelDisplay, setFormCancelDisplay] = useState('10:30');
  const [formIsActive, setFormIsActive] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadShifts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchApi<Shift[]>('/shifts', {}, currentUser.id);
      setShifts(data);
    } catch (err) {
      console.error('Failed to load shifts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  // Open Create
  const handleOpenCreate = () => {
    setFormName('');
    setFormCode('');
    setFormStartTime('11:30');
    setFormEndTime('13:30');
    setFormCutoffOrder('120');
    setFormCutoffCancel('60');
    setFormCheckinStart('30');
    setFormCheckinEnd('30');
    setFormOrderDisplay('09:30');
    setFormCancelDisplay('10:30');
    setFormIsActive(true);
    setIsCreateOpen(true);
  };

  // Open Edit
  const handleOpenEdit = (shift: Shift) => {
    setEditingShift(shift);
    setFormName(shift.name);
    setFormCode(shift.code);
    setFormStartTime(shift.startTime);
    setFormEndTime(shift.endTime);
    setFormCutoffOrder(String(shift.cutoffOrderMinutesBefore || 120));
    setFormCutoffCancel(String(shift.cutoffCancelMinutesBefore || 60));
    setFormCheckinStart(String(shift.checkinStartWindowMinutes || 30));
    setFormCheckinEnd(String(shift.checkinEndWindowMinutes || 30));
    setFormOrderDisplay(shift.orderCutoffDisplay || '');
    setFormCancelDisplay(shift.cancelCutoffDisplay || '');
    setFormIsActive(shift.isActive);
  };

  // Submit Create
  const handleSubmitCreate = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    try {
      const created = await fetchApi<Shift>(
        '/shifts',
        {
          method: 'POST',
          body: JSON.stringify({
            name: formName,
            code: formCode,
            startTime: formStartTime,
            endTime: formEndTime,
            cutoffOrderMinutesBefore: Number(formCutoffOrder),
            cutoffCancelMinutesBefore: Number(formCutoffCancel),
            checkinStartWindowMinutes: Number(formCheckinStart),
            checkinEndWindowMinutes: Number(formCheckinEnd),
            orderCutoffDisplay: formOrderDisplay,
            cancelCutoffDisplay: formCancelDisplay,
            isActive: formIsActive,
          }),
        },
        currentUser.id
      );

      setMessage({ type: 'success', text: `Đã tạo ca ăn "${created.name}" thành công!` });
      setIsCreateOpen(false);
      await loadShifts();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi tạo ca ăn',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit
  const handleSubmitEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingShift) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
      const updated = await fetchApi<Shift>(
        `/shifts/${editingShift.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: formName,
            code: formCode,
            startTime: formStartTime,
            endTime: formEndTime,
            cutoffOrderMinutesBefore: Number(formCutoffOrder),
            cutoffCancelMinutesBefore: Number(formCutoffCancel),
            checkinStartWindowMinutes: Number(formCheckinStart),
            checkinEndWindowMinutes: Number(formCheckinEnd),
            orderCutoffDisplay: formOrderDisplay,
            cancelCutoffDisplay: formCancelDisplay,
            isActive: formIsActive,
          }),
        },
        currentUser.id
      );

      setMessage({ type: 'success', text: `Đã cập nhật ca ăn "${updated.name}" thành công!` });
      setEditingShift(null);
      await loadShifts();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi cập nhật ca ăn',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Active/Inactive
  const handleToggleActive = async (shift: Shift) => {
    try {
      const updated = await fetchApi<Shift>(
        `/shifts/${shift.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            isActive: !shift.isActive,
          }),
        },
        currentUser.id
      );

      setMessage({
        type: 'success',
        text: `Đã ${updated.isActive ? 'kích hoạt' : 'tạm ngưng'} ca "${updated.name}"!`,
      });
      await loadShifts();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi đổi trạng thái ca',
      });
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingShift) return;
    try {
      await fetchApi(`/shifts/${deletingShift.id}`, { method: 'DELETE' }, currentUser.id);
      setMessage({ type: 'success', text: `Đã xóa ca "${deletingShift.name}" thành công!` });
      setDeletingShift(null);
      await loadShifts();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể xóa ca ăn này',
      });
    }
  };

  const activeCount = shifts.filter((s) => s.isActive).length;
  const filteredShifts = shifts.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Info Banner: ai được quản lý ca */}
      <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-sm text-indigo-900 flex items-start gap-2.5">
        <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <span>
          <strong>Hành chính (GA)</strong> tạo ca ăn theo nhu cầu vận hành, không giới hạn số lượng ca.
          Quản trị viên và Hành chính (GA) đều có quyền thêm, sửa, tạm ngưng hoặc xóa ca ăn.
        </span>
      </div>

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
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tổng Ca Ăn</span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{shifts.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">Cấu hình ca phục vụ căng tin</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Đang Kích Hoạt</span>
            <Power className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">{activeCount} / {shifts.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">Nhân viên được phép đặt suất</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wide">Quy Định Cut-Off</span>
            <Timer className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-sm font-bold text-slate-800 mt-2">Tự Động Chốt Suất</div>
          <p className="text-[11px] text-slate-400 mt-1">Khóa đặt và khóa hủy theo ca</p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <input
          type="text"
          placeholder="Tìm theo tên ca (Ca A, Ca B...) hoặc mã (CA_A)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[260px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-indigo-500"
        />

        <div className="flex items-center gap-2">
          <button
            onClick={loadShifts}
            disabled={isLoading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
            title="Làm mới"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Ca Ăn Mới</span>
          </button>
        </div>
      </div>

      {/* Shifts Grid/Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredShifts.map((shift) => (
          <div
            key={shift.id}
            className={`bg-white rounded-xl border p-5 transition shadow-xs flex flex-col justify-between ${
              shift.isActive ? 'border-slate-200 hover:border-indigo-300' : 'border-slate-200 bg-slate-50/60 opacity-80'
            }`}
          >
            <div>
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {shift.code}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        shift.isActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {shift.isActive ? 'HOẠT ĐỘNG' : 'TẠM NGƯNG'}
                    </span>
                  </div>
                  <h4 className="font-bold text-base text-slate-900 mt-2">{shift.name}</h4>
                </div>

                {/* Quick Toggle */}
                <button
                  onClick={() => handleToggleActive(shift)}
                  className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    shift.isActive
                      ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                      : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                  }`}
                  title={shift.isActive ? 'Nhấn để tạm ngưng ca' : 'Nhấn để kích hoạt ca'}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{shift.isActive ? 'Bật' : 'Tắt'}</span>
                </button>
              </div>

              {/* Time Details */}
              <div className="mt-4 grid grid-cols-2 gap-3 py-3 border-y border-slate-100 text-xs">
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium">Khung Giờ Ăn:</span>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{shift.startTime} — {shift.endTime}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium">Cửa Sổ Check-in QR:</span>
                  <div className="font-semibold text-slate-700">
                    ±{shift.checkinStartWindowMinutes || 30} phút
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium">Giờ Chốt Đặt (Cut-off):</span>
                  <div className="font-bold text-amber-700">
                    {shift.orderCutoffDisplay || `${shift.cutoffOrderMinutesBefore}p trước ca`}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium">Giờ Chốt Hủy Suất:</span>
                  <div className="font-bold text-rose-700">
                    {shift.cancelCutoffDisplay || `${shift.cutoffCancelMinutesBefore}p trước ca`}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 pt-3 flex items-center justify-between">
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                <span>Chốt đặt trước {shift.cutoffOrderMinutesBefore} phút</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEdit(shift)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Sửa Ca</span>
                </button>

                <button
                  onClick={() => setDeletingShift(shift)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                  title="Xóa ca"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CREATE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-indigo-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-200" />
                <h3 className="font-bold text-base">Thêm Ca Phục Vụ Ăn Mới</h3>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="text-white/80 hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCreate} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tên Ca Ăn *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Ca A / Ca B"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mã Ca (Code) *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: CA_A"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Giờ Bắt Đầu Phục Vụ *</label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Giờ Kết Thúc Phục Vụ *</label>
                  <input
                    type="time"
                    required
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Chốt Đặt Suất Trước (Phút) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formCutoffOrder}
                    onChange={(e) => setFormCutoffOrder(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Hiển Thị Giờ Chốt Đặt (Label)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: 09:30 hoặc 20:30 hôm trước"
                    value={formOrderDisplay}
                    onChange={(e) => setFormOrderDisplay(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Chốt Hủy Suất Trước (Phút) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formCutoffCancel}
                    onChange={(e) => setFormCutoffCancel(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Hiển Thị Giờ Chốt Hủy (Label)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: 10:30"
                    value={formCancelDisplay}
                    onChange={(e) => setFormCancelDisplay(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="create-active"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded-md"
                />
                <label htmlFor="create-active" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Kích hoạt ca ăn ngay sau khi tạo
                </label>
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
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang tạo...' : 'Tạo Ca Mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingShift && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-300" />
                <h3 className="font-bold text-base">Cập Nhật Ca: {editingShift.name}</h3>
              </div>
              <button onClick={() => setEditingShift(null)} className="text-white/80 hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tên Ca Ăn *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mã Ca (Code) *</label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Giờ Bắt Đầu Phục Vụ *</label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Giờ Kết Thúc Phục Vụ *</label>
                  <input
                    type="time"
                    required
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Chốt Đặt Suất Trước (Phút) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formCutoffOrder}
                    onChange={(e) => setFormCutoffOrder(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Hiển Thị Giờ Chốt Đặt (Label)
                  </label>
                  <input
                    type="text"
                    value={formOrderDisplay}
                    onChange={(e) => setFormOrderDisplay(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Chốt Hủy Suất Trước (Phút) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formCutoffCancel}
                    onChange={(e) => setFormCutoffCancel(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Hiển Thị Giờ Chốt Hủy (Label)
                  </label>
                  <input
                    type="text"
                    value={formCancelDisplay}
                    onChange={(e) => setFormCancelDisplay(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="edit-active"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded-md"
                />
                <label htmlFor="edit-active" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Kích hoạt ca ăn này
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingShift(null)}
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
      {deletingShift && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-base text-slate-900">Xác Nhận Xóa Ca Ăn</h3>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Bạn có chắc chắn muốn xóa ca <strong>{deletingShift.name}</strong> ({deletingShift.code}) không? Hệ thống sẽ kiểm tra xem đã có suất ăn nào được đặt cho ca này chưa.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingShift(null)}
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
