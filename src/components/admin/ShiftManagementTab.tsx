import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit2,
  Info,
  Power,
  RefreshCw,
  ShieldCheck,
  Timer,
  X,
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
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formStartTime, setFormStartTime] = useState('11:30');
  const [formEndTime, setFormEndTime] = useState('13:30');
  const [formCutoffOrder, setFormCutoffOrder] = useState('120');
  const [formCutoffCancel, setFormCutoffCancel] = useState('60');
  const [formCheckinStart, setFormCheckinStart] = useState('30');
  const [formCheckinEnd, setFormCheckinEnd] = useState('30');
  const [formOrderDisplay, setFormOrderDisplay] = useState('09:30');
  const [formCancelDisplay, setFormCancelDisplay] = useState('10:30');
  const [formIsActive, setFormIsActive] = useState(true);

  const loadShifts = useCallback(async () => {
    setIsLoading(true);
    try {
      setShifts(await fetchApi<Shift[]>('/shifts', {}, currentUser.id));
    } catch (error: unknown) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Không thể tải danh sách ca' });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  const openEdit = (shift: Shift) => {
    setEditingShift(shift);
    setFormStartTime(shift.startTime);
    setFormEndTime(shift.endTime);
    setFormCutoffOrder(String(shift.cutoffOrderMinutesBefore));
    setFormCutoffCancel(String(shift.cutoffCancelMinutesBefore));
    setFormCheckinStart(String(shift.checkinStartWindowMinutes));
    setFormCheckinEnd(String(shift.checkinEndWindowMinutes));
    setFormOrderDisplay(shift.orderCutoffDisplay);
    setFormCancelDisplay(shift.cancelCutoffDisplay);
    setFormIsActive(shift.isActive);
  };

  const updateShift = async (shift: Shift, values: Partial<Shift>) => {
    const updated = await fetchApi<Shift>(
      `/shifts/${shift.id}`,
      { method: 'PATCH', body: JSON.stringify(values) },
      currentUser.id
    );
    await loadShifts();
    if (onRefreshGlobal) onRefreshGlobal();
    return updated;
  };

  const handleSubmitEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingShift) return;
    setIsSubmitting(true);
    try {
      const updated = await updateShift(editingShift, {
        startTime: formStartTime,
        endTime: formEndTime,
        cutoffOrderMinutesBefore: Number(formCutoffOrder),
        cutoffCancelMinutesBefore: Number(formCutoffCancel),
        checkinStartWindowMinutes: Number(formCheckinStart),
        checkinEndWindowMinutes: Number(formCheckinEnd),
        orderCutoffDisplay: formOrderDisplay,
        cancelCutoffDisplay: formCancelDisplay,
        isActive: formIsActive,
      });
      setMessage({ type: 'success', text: `Đã cập nhật cấu hình ${updated.name}. Mã ${updated.code} vẫn được giữ cố định.` });
      setEditingShift(null);
    } catch (error: unknown) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Không thể cập nhật ca' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (shift: Shift) => {
    try {
      const updated = await updateShift(shift, { isActive: !shift.isActive });
      setMessage({ type: 'success', text: `Đã ${updated.isActive ? 'kích hoạt' : 'tạm ngưng'} ${updated.name}.` });
    } catch (error: unknown) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Không thể đổi trạng thái ca' });
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-xl flex items-center justify-between text-sm font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
          <div className="flex items-center gap-2.5">
            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="p-1 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-indigo-700 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-slate-900">Ba mã ca cố định</h3>
            <p className="text-xs text-slate-600 mt-1">Hệ thống chỉ có Ca A, Ca B và Ca C. Không thể thêm, xóa, đổi tên hoặc đổi mã ca. Chức năng tăng ca sẽ được bổ sung sau khi có quy tắc nghiệp vụ.</p>
          </div>
        </div>
        <button onClick={loadShifts} disabled={isLoading} className="p-2 bg-white border border-indigo-200 rounded-lg text-indigo-700 cursor-pointer disabled:opacity-50" title="Làm mới">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200"><Clock className="w-4 h-4 text-indigo-500" /><div className="text-2xl font-black mt-2">{shifts.length}</div><p className="text-[11px] text-slate-500">Tổng ca cố định</p></div>
        <div className="bg-white p-4 rounded-xl border border-slate-200"><Power className="w-4 h-4 text-emerald-500" /><div className="text-2xl font-black text-emerald-700 mt-2">{shifts.filter((shift) => shift.isActive).length} / 3</div><p className="text-[11px] text-slate-500">Ca đang hoạt động</p></div>
        <div className="bg-white p-4 rounded-xl border border-slate-200"><Timer className="w-4 h-4 text-amber-500" /><div className="text-sm font-bold mt-2">Cấu hình giờ & cut-off</div><p className="text-[11px] text-slate-500">Không thay đổi mã ca</p></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {shifts.map((shift) => (
          <div key={shift.id} className={`bg-white rounded-2xl border p-5 shadow-xs ${shift.isActive ? 'border-slate-200' : 'border-slate-200 opacity-70'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="font-mono text-[11px] font-bold px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">{shift.code}</span>
                <h4 className="font-black text-xl text-slate-900 mt-3">{shift.name}</h4>
              </div>
              <button onClick={() => handleToggleActive(shift)} className={`p-2 rounded-lg cursor-pointer ${shift.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`} title="Đổi trạng thái"><Power className="w-4 h-4" /></button>
            </div>
            <div className="mt-4 space-y-3 text-xs border-y border-slate-100 py-4">
              <div className="flex justify-between"><span className="text-slate-500">Khung giờ</span><strong>{shift.startTime} — {shift.endTime}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Chốt đặt</span><strong className="text-amber-700">{shift.orderCutoffDisplay}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Chốt hủy</span><strong className="text-rose-700">{shift.cancelCutoffDisplay}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">QR nhận suất</span><strong>−{shift.checkinStartWindowMinutes}/+{shift.checkinEndWindowMinutes} phút</strong></div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${shift.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{shift.isActive ? 'HOẠT ĐỘNG' : 'TẠM NGƯNG'}</span>
              <button onClick={() => openEdit(shift)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer"><Edit2 className="w-3.5 h-3.5" />Cấu hình</button>
            </div>
          </div>
        ))}
      </div>

      {editingShift && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSubmitEdit} className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div><h3 className="font-bold text-base">Cấu hình {editingShift.name}</h3><p className="text-xs text-slate-500 mt-1">Mã cố định: <strong className="font-mono">{editingShift.code}</strong></p></div>
              <button type="button" onClick={() => setEditingShift(null)} className="p-1 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 flex gap-2"><Info className="w-4 h-4 shrink-0" />Chỉ được sửa giờ phục vụ, cut-off, cửa sổ nhận suất và trạng thái hoạt động.</div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <label className="font-bold text-slate-700">Giờ bắt đầu<input type="time" required value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label>
              <label className="font-bold text-slate-700">Giờ kết thúc<input type="time" required value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label>
              <label className="font-bold text-slate-700">Chốt đặt trước (phút)<input type="number" min="0" required value={formCutoffOrder} onChange={(e) => setFormCutoffOrder(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label>
              <label className="font-bold text-slate-700">Nhãn chốt đặt<input required value={formOrderDisplay} onChange={(e) => setFormOrderDisplay(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label>
              <label className="font-bold text-slate-700">Chốt hủy trước (phút)<input type="number" min="0" required value={formCutoffCancel} onChange={(e) => setFormCutoffCancel(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label>
              <label className="font-bold text-slate-700">Nhãn chốt hủy<input required value={formCancelDisplay} onChange={(e) => setFormCancelDisplay(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label>
              <label className="font-bold text-slate-700">Mở QR trước (phút)<input type="number" min="0" required value={formCheckinStart} onChange={(e) => setFormCheckinStart(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label>
              <label className="font-bold text-slate-700">Đóng QR sau (phút)<input type="number" min="0" required value={formCheckinEnd} onChange={(e) => setFormCheckinEnd(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={formIsActive} onChange={(e) => setFormIsActive(e.target.checked)} />Kích hoạt ca</label>
            <div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={() => setEditingShift(null)} className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer">Đóng</button><button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50">{isSubmitting ? 'Đang lưu...' : 'Lưu cấu hình'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
