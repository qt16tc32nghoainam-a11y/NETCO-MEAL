import { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Utensils,
  ChevronRight,
  AlertCircle,
  Sparkles,
  Info,
  ShieldCheck,
  RotateCcw,
  Check,
  ChevronLeft,
} from 'lucide-react';
import { User, Menu, Shift, Booking } from '../../types';
import { fetchApi, formatVND } from '../../utils/api';

interface WeeklyMealBookingProps {
  currentUser: User;
  menus: Menu[];
  shifts: Shift[];
  existingBookings: Booking[];
  onBookingSuccess: () => void;
}

interface DayOption {
  dayOfWeekName: string; // 'Thứ Hai', 'Thứ Ba', ...
  dateStr: string; // 'YYYY-MM-DD'
  formattedDate: string; // '08/09'
  isSelected: boolean;
  shiftId: string;
  menuId: string;
  hasMenu: boolean; // ngày này có thực đơn đã công bố hay không
  selectedDishIds: string[];
  note: string;
  existingBooking?: Booking;
}

export function WeeklyMealBooking({
  currentUser,
  menus,
  shifts,
  existingBookings,
  onBookingSuccess,
}: WeeklyMealBookingProps) {
  const [weekOffset, setWeekOffset] = useState<number>(0); // 0 = current week, 1 = next week
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Compute Monday date for selected weekOffset
  const mondayDate = useMemo(() => {
    const today = new Date();
    const day = today.getDay(); // 0 is Sun, 1 is Mon
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) + weekOffset * 7;
    const mon = new Date(today.setDate(diff));
    mon.setHours(0, 0, 0, 0);
    return mon;
  }, [weekOffset]);

  // Generate 5 workdays (Mon to Fri)
  const workdays = useMemo(() => {
    const days: { dayOfWeekName: string; dateStr: string; formattedDate: string }[] = [];
    const dayNames = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu'];

    for (let i = 0; i < 5; i++) {
      const d = new Date(mondayDate);
      d.setDate(mondayDate.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dateNum = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${dateNum}`;
      const formattedDate = `${dateNum}/${month}`;

      days.push({
        dayOfWeekName: dayNames[i],
        dateStr,
        formattedDate,
      });
    }
    return days;
  }, [mondayDate]);

  // State for each workday selection
  const [dayConfigs, setDayConfigs] = useState<DayOption[]>([]);

  // Initialize day configurations when workdays or menus change
  useEffect(() => {
    const defaultShift = shifts.find((s) => s.id === 'shift_b') || shifts[0];
    const defaultShiftId = defaultShift ? defaultShift.id : 'shift_b';

    const configs: DayOption[] = workdays.map((w) => {
      // Mỗi ngày có thể có 2 hoặc 3 thực đơn (mỗi ca 1 thực đơn). Chỉ lấy các thực đơn
      // đã công bố (PUBLISHED) ĐÚNG ngày này, không mượn thực đơn của ngày khác.
      const publishedMenusForDay = menus.filter(
        (m) => m.date === w.dateStr && m.status === 'PUBLISHED'
      );

      // Check existing booking
      const existing = existingBookings.find(
        (b) => b.mealDate === w.dateStr && b.status !== 'CANCELLED'
      );

      // Ưu tiên thực đơn theo ca đang chọn (ca mặc định hoặc ca của lượt đặt đã có),
      // nếu ca đó không có thực đơn thì dùng thực đơn công bố đầu tiên của ngày.
      const preferredShiftId = existing ? existing.shiftId : defaultShiftId;
      const matchedMenu =
        publishedMenusForDay.find((m) => m.shiftId === preferredShiftId) ||
        publishedMenusForDay[0];

      const allDishIds = matchedMenu ? matchedMenu.items.map((i) => i.id) : [];
      const hasMenu = Boolean(matchedMenu);

      return {
        dayOfWeekName: w.dayOfWeekName,
        dateStr: w.dateStr,
        formattedDate: w.formattedDate,
        // Ngày chưa có thực đơn được công bố thì không tự chọn để tránh gửi lên máy chủ
        // và bị từ chối; nhân viên vẫn có thể tự tick nếu muốn.
        isSelected: hasMenu,
        shiftId: existing ? existing.shiftId : matchedMenu ? matchedMenu.shiftId : defaultShiftId,
        menuId: matchedMenu ? matchedMenu.id : 'menu_default',
        hasMenu,
        selectedDishIds: existing ? existing.selectedItemIds : allDishIds,
        note: existing ? existing.note || '' : '',
        existingBooking: existing,
      };
    });

    setDayConfigs(configs);
  }, [workdays, menus, shifts, existingBookings]);

  const handleToggleDay = (index: number) => {
    setDayConfigs((prev) =>
      prev.map((c, i) => (i === index ? { ...c, isSelected: !c.isSelected } : c))
    );
  };

  const handleToggleAll = (select: boolean) => {
    setDayConfigs((prev) => prev.map((c) => ({ ...c, isSelected: select })));
  };

  const handleSelectDays = (dayIndices: number[]) => {
    setDayConfigs((prev) =>
      prev.map((c, i) => ({ ...c, isSelected: dayIndices.includes(i) }))
    );
  };

  const handleDishToggle = (dayIndex: number, dishId: string) => {
    setDayConfigs((prev) =>
      prev.map((c, i) => {
        if (i !== dayIndex) return c;
        const exists = c.selectedDishIds.includes(dishId);
        const updated = exists
          ? c.selectedDishIds.filter((id) => id !== dishId)
          : [...c.selectedDishIds, dishId];
        return { ...c, selectedDishIds: updated };
      })
    );
  };

  const handleNoteChange = (dayIndex: number, note: string) => {
    setDayConfigs((prev) =>
      prev.map((c, i) => (i === dayIndex ? { ...c, note } : c))
    );
  };

  const selectedCount = dayConfigs.filter((c) => c.isSelected).length;
  const subsidyAmountPerMeal = 45000;
  const totalSubsidy = selectedCount * subsidyAmountPerMeal;

  const handleSubmitWeekly = async () => {
    const selectedDays = dayConfigs.filter((c) => c.isSelected);
    if (selectedDays.length === 0) {
      setMessage({ type: 'error', text: 'Vui lòng chọn ít nhất 1 ngày để đặt cơm.' });
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage(null);

      const payload = {
        weekDays: selectedDays.map((d) => ({
          mealDate: d.dateStr,
          shiftId: d.shiftId,
          menuId: d.menuId,
          selectedItemIds: d.selectedDishIds,
          note: d.note,
        })),
      };

      const res = await fetchApi<{
        totalRequested: number;
        successCount: number;
        results: { mealDate: string; success: boolean; message: string }[];
      }>('/bookings/weekly', {
        method: 'POST',
        body: JSON.stringify(payload),
      }, currentUser.id);

      setMessage({
        type: 'success',
        text: `Đã xác nhận đặt cơm theo tuần thành công cho ${res.successCount}/${res.totalRequested} ngày! Hệ thống đã cập nhật số lượng đến bộ phận Bếp.`,
      });

      onBookingSuccess();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi khi đặt cơm theo tuần';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Week Selector & Quick Presets */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 transition cursor-pointer"
            title="Tuần trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="text-sm font-bold text-slate-900 dark:text-white px-2">
            Tuần: {workdays[0]?.formattedDate} → {workdays[4]?.formattedDate}{' '}
            {weekOffset === 0 ? (
              <span className="ml-1.5 px-2 py-0.5 text-[11px] font-bold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                Tuần Này
              </span>
            ) : weekOffset === 1 ? (
              <span className="ml-1.5 px-2 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                Tuần Tới
              </span>
            ) : null}
          </div>

          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 transition cursor-pointer"
            title="Tuần sau"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Selection Shortcuts */}
        <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-auto">
          <button
            onClick={() => handleToggleAll(true)}
            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-red-600 text-white hover:bg-red-700 transition"
          >
            ⚡ Chọn Cả 5 Ngày
          </button>
          <button
            onClick={() => handleSelectDays([0, 2, 4])}
            className="px-2.5 py-1.5 text-xs font-medium rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
          >
            Thứ 2, 4, 6
          </button>
          <button
            onClick={() => handleSelectDays([1, 3])}
            className="px-2.5 py-1.5 text-xs font-medium rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
          >
            Thứ 3, 5
          </button>
          <button
            onClick={() => handleToggleAll(false)}
            className="px-2.5 py-1.5 text-xs font-medium rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition"
          >
            Bỏ Chọn Hết
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* 5 Workdays Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {dayConfigs.map((day, idx) => {
          const menu = menus.find((m) => m.id === day.menuId);
          const menuShift = shifts.find((s) => s.id === (menu ? menu.shiftId : day.shiftId));
          const hasExisting = Boolean(day.existingBooking);

          return (
            <div
              key={day.dateStr}
              className={`rounded-2xl border transition flex flex-col justify-between overflow-hidden ${
                day.isSelected
                  ? 'border-red-500 dark:border-red-600 bg-white dark:bg-slate-900 shadow-md ring-1 ring-red-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 opacity-70 hover:opacity-100'
              }`}
            >
              {/* Day Header */}
              <div
                onClick={() => handleToggleDay(idx)}
                className={`p-3.5 border-b cursor-pointer transition flex items-center justify-between ${
                  day.isSelected
                    ? 'bg-red-50/70 dark:bg-red-950/30 border-red-200 dark:border-red-900/60'
                    : 'bg-slate-100/70 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div>
                  <div className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                    {day.dayOfWeekName}
                  </div>
                  <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
                    Ngày {day.formattedDate}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={day.isSelected}
                    onChange={() => handleToggleDay(idx)}
                    className="w-4 h-4 text-red-600 rounded border-slate-300 cursor-pointer"
                  />
                </div>
              </div>

              {/* Day Content */}
              <div className="p-3.5 space-y-3 flex-1">
                {/* Existing Booking Status Badge */}
                {hasExisting && (
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Đã đặt ({day.existingBooking?.bookingCode})</span>
                  </div>
                )}

                {/* Menu Preview */}
                {menu ? (
                  <div>
                    <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 line-clamp-1">
                      {menu.title}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{menuShift ? `${menuShift.name} (${menuShift.startTime} - ${menuShift.endTime})` : 'Thực đơn theo ca'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-1.5 rounded-lg bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] font-semibold">
                    Ngày này chưa có thực đơn được công bố nên chưa thể đặt cơm.
                  </div>
                )}

                {/* Dishes checkbox list */}
                {menu && menu.items && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase">
                      Món ăn ({menu.items.length} món):
                    </div>
                    {menu.items.map((dish) => {
                      const isDishChecked = day.selectedDishIds.includes(dish.id);
                      return (
                        <label
                          key={dish.id}
                          className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer hover:text-slate-900 dark:hover:text-white"
                        >
                          <input
                            type="checkbox"
                            checked={isDishChecked}
                            disabled={!day.isSelected}
                            onChange={() => handleDishToggle(idx, dish.id)}
                            className="w-3.5 h-3.5 text-red-600 rounded border-slate-300"
                          />
                          <span className="line-clamp-1">{dish.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Note */}
                {day.isSelected && (
                  <div className="pt-2">
                    <input
                      type="text"
                      value={day.note}
                      onChange={(e) => handleNoteChange(idx, e.target.value)}
                      placeholder="Ghi chú (ít cơm, kiêng cay...)"
                      className="w-full px-2 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                )}
              </div>

              {/* Day Footer */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-semibold">Trợ cấp NETCO:</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                  {formatVND(subsidyAmountPerMeal)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Box & Submit Button */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              Đăng Ký Suất Ăn Tuần ({selectedCount}/5 Ngày Làm Việc)
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              Công Ty Tài Trợ 100%
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tổng giá trị chế độ ăn ca tuần:{' '}
            <strong className="text-slate-900 dark:text-white font-black text-sm">
              {formatVND(totalSubsidy)}
            </strong>{' '}
            (Nhân viên không phải chi trả).
          </p>
        </div>

        <button
          onClick={handleSubmitWeekly}
          disabled={isSubmitting || selectedCount === 0}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-bold text-sm transition shadow-sm cursor-pointer w-full sm:w-auto justify-center"
        >
          <Sparkles className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
          <span>
            {isSubmitting ? 'Đang Đặt Cả Tuần...' : `⚡ Xác Nhận Đặt Cơm (${selectedCount} Ngày)`}
          </span>
        </button>
      </div>
    </div>
  );
}
