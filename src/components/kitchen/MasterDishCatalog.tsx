import { useState, type FormEvent } from 'react';
import {
  Utensils,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  Leaf,
  Flame,
  AlertTriangle,
  Check,
  Trash2,
  Info,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { MenuItem, User } from '../../types';
import { fetchApi } from '../../utils/api';

interface MasterDishCatalogProps {
  currentUser: User;
  masterDishes: MenuItem[];
  onRefresh: () => void;
  isPickerMode?: boolean;
  initialSelectedIds?: string[];
  onConfirmSelection?: (selected: MenuItem[]) => void;
  onClosePicker?: () => void;
}

const PRESET_IMAGES: { label: string; url: string }[] = [
  {
    label: 'Cơm & Món Mặn',
    url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80',
  },
  {
    label: 'Món Cá Kho',
    url: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&auto=format&fit=crop&q=80',
  },
  {
    label: 'Gà Nướng',
    url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=500&auto=format&fit=crop&q=80',
  },
  {
    label: 'Canh Chua & Canh Rau',
    url: 'https://images.unsplash.com/photo-1547496502-affa22d38842?w=500&auto=format&fit=crop&q=80',
  },
  {
    label: 'Món Chay Dinh Dưỡng',
    url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
  },
  {
    label: 'Tráng Miệng / Hoa Quả',
    url: 'https://images.unsplash.com/photo-1519996529931-28324d5a630e?w=500&auto=format&fit=crop&q=80',
  },
];

const COMMON_ALLERGENS = [
  'Hải sản',
  'Tôm cua',
  'Đậu phộng',
  'Trứng',
  'Sữa/Bơ',
  'Đậu nành',
  'Gluten bột mì',
  'Mè vừng',
];

export function MasterDishCatalog({
  currentUser,
  masterDishes,
  onRefresh,
  isPickerMode = false,
  initialSelectedIds = [],
  onConfirmSelection,
  onClosePicker,
}: MasterDishCatalogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>(isPickerMode ? 'APPROVED' : 'ALL');

  // Picker selection state
  const [pickerSelectedIds, setPickerSelectedIds] = useState<string[]>(initialSelectedIds);

  // Modal Create Dish State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [dishName, setDishName] = useState('');
  const [dishDescription, setDishDescription] = useState('');
  const [dishCategory, setDishCategory] = useState<
    'Món chính' | 'Món chay' | 'Món phụ' | 'Canh' | 'Tráng miệng'
  >('Món chính');
  const [dishCalories, setDishCalories] = useState<number>(450);
  const [isVegetarian, setIsVegetarian] = useState(false);
  const [dishImageUrl, setDishImageUrl] = useState(PRESET_IMAGES[0].url);
  const [dishAllergens, setDishAllergens] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Filter dishes
  const filteredDishes = masterDishes.filter((dish) => {
    if (selectedCategory !== 'ALL' && dish.category !== selectedCategory) return false;
    if (selectedStatus !== 'ALL') {
      const status = dish.status || 'APPROVED';
      if (status !== selectedStatus) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = dish.name.toLowerCase().includes(q);
      const matchDesc = dish.description.toLowerCase().includes(q);
      const matchAllergen = dish.allergens.some((a) => a.toLowerCase().includes(q));
      if (!matchName && !matchDesc && !matchAllergen) return false;
    }
    return true;
  });

  // Handle Create Dish
  const handleCreateDish = async (e: FormEvent) => {
    e.preventDefault();
    if (!dishName.trim()) {
      setActionMessage({ type: 'error', text: 'Vui lòng nhập tên món ăn.' });
      return;
    }

    setIsSubmitting(true);
    setActionMessage(null);

    try {
      await fetchApi(
        '/dishes',
        {
          method: 'POST',
          body: JSON.stringify({
            name: dishName.trim(),
            description: dishDescription.trim(),
            category: dishCategory,
            calories: dishCalories,
            isVegetarian,
            imageUrl: dishImageUrl,
            allergens: dishAllergens,
          }),
        },
        currentUser.id
      );

      const isChef = currentUser.role === 'Kitchen_Staff';
      setActionMessage({
        type: 'success',
        text: isChef
          ? `Món "${dishName}" đã được tạo và gửi tới Ban Hành Chính (GA) chờ duyệt vào thực đơn chuẩn!`
          : `Món "${dishName}" đã được tạo và phê duyệt trực tiếp vào Thư viện món ăn chuẩn!`,
      });

      // Reset form
      setDishName('');
      setDishDescription('');
      setDishCalories(450);
      setIsVegetarian(false);
      setDishAllergens([]);
      setIsCreateModalOpen(false);

      onRefresh();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi tạo món ăn mới';
      setActionMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle allergen tag in form
  const toggleAllergen = (allergen: string) => {
    setDishAllergens((prev) =>
      prev.includes(allergen) ? prev.filter((a) => a !== allergen) : [...prev, allergen]
    );
  };

  // Toggle Picker Selection
  const togglePickerItem = (dish: MenuItem) => {
    setPickerSelectedIds((prev) =>
      prev.includes(dish.id) ? prev.filter((id) => id !== dish.id) : [...prev, dish.id]
    );
  };

  // Confirm Picker
  const handleConfirmPicker = () => {
    if (!onConfirmSelection) return;
    const selectedObjects = masterDishes.filter((d) => pickerSelectedIds.includes(d.id));
    onConfirmSelection(selectedObjects);
  };

  // Delete Dish
  const handleDeleteDish = async (dishId: string, dishName: string) => {
    if (!confirm(`Bạn có chắc muốn xóa món "${dishName}" khỏi ngân hàng món?`)) return;
    try {
      await fetchApi(`/dishes/${dishId}`, { method: 'DELETE' }, currentUser.id);
      setActionMessage({ type: 'success', text: `Đã xóa món "${dishName}" thành công.` });
      onRefresh();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi xóa món ăn';
      setActionMessage({ type: 'error', text: errorMsg });
    }
  };

  const approvedCount = masterDishes.filter((d) => (d.status || 'APPROVED') === 'APPROVED').length;
  const pendingCount = masterDishes.filter((d) => d.status === 'PENDING_APPROVAL').length;
  const rejectedCount = masterDishes.filter((d) => d.status === 'REJECTED').length;

  return (
    <div className="space-y-5">
      {/* Alert message */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl text-xs sm:text-sm flex items-start justify-between gap-3 shadow-xs animate-in fade-in ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-rose-50 text-rose-900 border border-rose-200'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs font-bold underline cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              {isPickerMode ? 'Chọn Món Cho Thực Đơn Từ Ngân Hàng Món Chuẩn' : 'Ngân Hàng Món Ăn (Master Dish Catalog)'}
            </h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900">
              {masterDishes.length} món lưu trữ
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Bếp trưởng chọn các món đã được Ban Hành Chính (GA) phê duyệt để tạo thực đơn ca. Nếu có món mới, tạo món và gửi Hành chính duyệt.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Món Ăn Mới</span>
          </button>

          {isPickerMode && (
            <button
              onClick={handleConfirmPicker}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
            >
              <Check className="w-4 h-4" />
              <span>Xong ({pickerSelectedIds.length} món)</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setSelectedStatus('ALL')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                selectedStatus === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất Cả ({masterDishes.length})
            </button>
            <button
              onClick={() => setSelectedStatus('APPROVED')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                selectedStatus === 'APPROVED' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Đã Duyệt ({approvedCount})</span>
            </button>
            <button
              onClick={() => setSelectedStatus('PENDING_APPROVAL')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                selectedStatus === 'PENDING_APPROVAL' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Chờ GA Duyệt ({pendingCount})</span>
            </button>
            <button
              onClick={() => setSelectedStatus('REJECTED')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                selectedStatus === 'REJECTED' ? 'bg-white text-rose-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>Bị Từ Chối ({rejectedCount})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm theo tên món, mô tả, dị ứng..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="font-bold text-slate-400 text-[11px] uppercase tracking-wider mr-1">
            Phân loại món:
          </span>
          {['ALL', 'Món chính', 'Món chay', 'Canh', 'Món phụ', 'Tráng miệng'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat === 'ALL' ? 'Tất cả nhóm món' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Picker Selection Summary Banner */}
      {isPickerMode && (
        <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-emerald-950 font-bold">
              Đã chọn {pickerSelectedIds.length} món cho thực đơn này:
            </span>
            <span className="text-emerald-800">
              {masterDishes
                .filter((d) => pickerSelectedIds.includes(d.id))
                .map((d) => d.name)
                .join(', ') || 'Chưa chọn món nào'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setPickerSelectedIds(
                  masterDishes.filter((d) => (d.status || 'APPROVED') === 'APPROVED').map((d) => d.id)
                )
              }
              className="text-emerald-800 font-bold hover:underline cursor-pointer"
            >
              Chọn tất cả món đã duyệt
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => setPickerSelectedIds([])}
              className="text-rose-700 font-bold hover:underline cursor-pointer"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {/* Dishes Cards Grid */}
      {filteredDishes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
          <Utensils className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">Không tìm thấy món ăn nào phù hợp</p>
          <p className="text-xs text-slate-400 mt-1">Thử thay đổi bộ lọc hoặc bấm "Tạo Món Ăn Mới" để bổ sung</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDishes.map((dish) => {
            const status = dish.status || 'APPROVED';
            const isSelected = pickerSelectedIds.includes(dish.id);

            return (
              <div
                key={dish.id}
                onClick={() => {
                  if (isPickerMode) {
                    if (status === 'APPROVED') {
                      togglePickerItem(dish);
                    } else {
                      alert('Chỉ những món ăn đã được Ban Hành Chính (GA) phê duyệt mới có thể đưa vào thực đơn chính thức!');
                    }
                  }
                }}
                className={`rounded-2xl border overflow-hidden transition flex flex-col justify-between bg-white shadow-xs ${
                  isPickerMode
                    ? isSelected
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/10 cursor-pointer'
                      : status === 'APPROVED'
                      ? 'border-slate-200 hover:border-slate-300 cursor-pointer'
                      : 'border-slate-200 opacity-60 cursor-not-allowed'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Image and badges */}
                  <div className="relative h-40 w-full overflow-hidden bg-slate-100">
                    <img
                      src={dish.imageUrl}
                      alt={dish.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      <span className="bg-slate-900/80 backdrop-blur text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                        {dish.category}
                      </span>
                      {dish.isVegetarian && (
                        <span className="flex items-center gap-1 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                          <Leaf className="w-3 h-3" /> Món Chay
                        </span>
                      )}
                    </div>

                    <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                      <span className="bg-slate-900/80 backdrop-blur text-white text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Flame className="w-3 h-3 text-amber-400" /> {dish.calories} kcal
                      </span>

                      {/* Status indicator */}
                      {status === 'APPROVED' && (
                        <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Đã Duyệt
                        </span>
                      )}
                      {status === 'PENDING_APPROVAL' && (
                        <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Chờ GA Duyệt
                        </span>
                      )}
                      {status === 'REJECTED' && (
                        <span className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Từ Chối
                        </span>
                      )}
                    </div>

                    {isPickerMode && status === 'APPROVED' && (
                      <div
                        className={`absolute bottom-2 right-2 w-6 h-6 rounded-lg border flex items-center justify-center shadow-xs transition ${
                          isSelected
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-white/90 border-slate-300 text-transparent'
                        }`}
                      >
                        <Check className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-2">
                    <h4 className="font-bold text-sm text-slate-900 leading-snug">{dish.name}</h4>
                    <p className="text-xs text-slate-500 line-clamp-2">{dish.description || 'Chưa có mô tả chi tiết'}</p>

                    {dish.allergens && dish.allergens.length > 0 && (
                      <div className="flex items-center gap-1 text-[11px] text-amber-800 bg-amber-50 p-1.5 rounded-lg border border-amber-200">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                        <span className="truncate">Dị ứng: {dish.allergens.join(', ')}</span>
                      </div>
                    )}

                    {status === 'REJECTED' && dish.rejectionReason && (
                      <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-800">
                        <strong>Lý do từ chối:</strong> {dish.rejectionReason}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Metadata & Actions */}
                <div className="p-4 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <div>
                    {dish.createdByName ? `Tạo bởi: ${dish.createdByName}` : 'Danh mục chuẩn'}
                  </div>

                  {!isPickerMode && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDish(dish.id, dish.name);
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition cursor-pointer"
                      title="Xóa món ăn"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: TẠO MÓN ĂN MỚI */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateDish}
            className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 my-8"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Utensils className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-slate-900">Thêm Món Ăn Mới Vào Thư Viện</h4>
                  <p className="text-xs text-slate-500">Món ăn sau khi tạo sẽ gửi Hành chính (GA) duyệt</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Informational Box */}
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Quy trình phê duyệt món ăn NETCO Meal:</strong>
                <p className="mt-0.5 text-amber-800">
                  Khi Đội Bếp tạo món ăn mới, hệ thống tự động gán trạng thái <strong>Chờ Duyệt (PENDING_APPROVAL)</strong> và thông báo cho Ban Hành Chính - GA. Khi Hành chính duyệt, món sẽ có mặt trong danh sách để bếp chọn đưa vào thực đơn ngày/tuần.
                </p>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Tên món ăn (*):</label>
                <input
                  type="text"
                  required
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  placeholder="Ví dụ: Sườn Cốt Lết Nướng Sốt Cam Tươi"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Phân loại món (*):</label>
                  <select
                    value={dishCategory}
                    onChange={(e) => setDishCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="Món chính">Món chính (Thịt, Cá, Tôm)</option>
                    <option value="Món chay">Món chay (Đậu hũ, Nấm, Rau củ)</option>
                    <option value="Canh">Món canh dinh dưỡng</option>
                    <option value="Món phụ">Món xào / Món phụ kèm</option>
                    <option value="Tráng miệng">Tráng miệng (Trái cây, Chè, Yaourt)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Định mức calo ước tính (kcal):</label>
                  <input
                    type="number"
                    value={dishCalories}
                    onChange={(e) => setDishCalories(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer pt-1 font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={isVegetarian}
                    onChange={(e) => setIsVegetarian(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Đây là món ăn thuần chay (Dành cho nhân viên ăn chay dinh dưỡng)</span>
                </label>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Cảnh báo dị ứng tiềm ẩn:</label>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_ALLERGENS.map((alg) => {
                    const isTagged = dishAllergens.includes(alg);
                    return (
                      <button
                        type="button"
                        key={alg}
                        onClick={() => toggleAllergen(alg)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer border ${
                          isTagged
                            ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {isTagged && '✓ '}
                        {alg}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Mô tả nguyên liệu & cách chế biến:</label>
                <textarea
                  rows={2}
                  value={dishDescription}
                  onChange={(e) => setDishDescription(e.target.value)}
                  placeholder="Ghi chú nguyên liệu chính, hương vị, tiêu chuẩn dinh dưỡng..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Photo presets */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Ảnh minh họa món ăn:</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {PRESET_IMAGES.map((preset, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setDishImageUrl(preset.url)}
                      className={`text-[10px] px-2.5 py-1 rounded-md border font-semibold cursor-pointer transition ${
                        dishImageUrl === preset.url
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <input
                  type="url"
                  value={dishImageUrl}
                  onChange={(e) => setDishImageUrl(e.target.value)}
                  placeholder="Nhập link ảnh HTTPS..."
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !dishName.trim()}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer disabled:bg-slate-300"
              >
                {isSubmitting ? 'Đang lưu...' : 'Tạo Món & Gửi GA Duyệt'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
