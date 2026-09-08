export type UserRole =
  | 'Administrator'
  | 'HR_GA'
  | 'Kitchen_Staff'
  | 'Department_Representative'
  | 'Regular_Employee'
  | 'QR_Checkin_Operator'
  | string;

export type PermissionId =
  | 'MEAL_ORDER_SELF'
  | 'MEAL_ORDER_BULK'
  | 'MEAL_ORDER_GUEST'
  | 'MENU_CREATE'
  | 'MENU_APPROVE'
  | 'MENU_PUBLISH'
  | 'KITCHEN_PLAN'
  | 'KITCHEN_INVENTORY'
  | 'KIOSK_SCAN_QR'
  | 'KIOSK_MANUAL_CHECKIN'
  | 'HR_RECONCILIATION'
  | 'HR_EXPENSE_REPORTS'
  | 'SYSTEM_SETTINGS'
  | 'USER_MANAGEMENT'
  | 'ROLE_PERMISSION_MANAGEMENT'
  | 'AUDIT_LOG_VIEW';

export interface PermissionDefinition {
  id: PermissionId;
  name: string;
  category: 'Ăn uống' | 'Bếp & Thực đơn' | 'Kiosk Căng tin' | 'Nhân sự & Báo cáo' | 'Quản trị hệ thống';
  description: string;
}

export interface RoleDefinition {
  id: string;
  roleKey: string;
  name: string;
  description: string;
  isSystem: boolean;
  badgeColor: string;
  permissions: PermissionId[];
}

export interface User {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  // Mật khẩu chỉ dùng nội bộ ở backend (bản demo in-memory). KHÔNG BAO GIỜ trả về
  // trường này trong các response API (được loại bỏ trước khi gửi cho client).
  password?: string;
  role: UserRole;
  departmentId: string;
  departmentName?: string;
  phone: string;
  status: 'ACTIVE' | 'LOCKED' | 'PENDING';
  avatarUrl?: string;
  isMfaEnabled?: boolean;
  dietaryPreference?: 'NONE' | 'VEGETARIAN' | 'HALAL' | 'LOW_CARB' | 'DIABETIC';
  allergens?: string[];
  dietaryNote?: string;
  customPermissions?: PermissionId[];
  joinedDate?: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  representativeUserId?: string;
  totalEmployees?: number;
}

export interface Shift {
  id: string;
  name: string;
  code: string;
  startTime: string; // "11:30"
  endTime: string;   // "13:30"
  cutoffOrderMinutesBefore: number; // e.g. 120 minutes before startTime
  cutoffCancelMinutesBefore: number; // e.g. 60 minutes before startTime
  checkinStartWindowMinutes: number; // e.g. 30 minutes before
  checkinEndWindowMinutes: number;   // e.g. 30 minutes after
  isActive: boolean;
  orderCutoffDisplay: string; // e.g. "09:30"
  cancelCutoffDisplay: string; // e.g. "10:30"
}

export type MenuStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'ARCHIVED';

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  isVegetarian: boolean;
  allergens: string[];
  calories: number;
  category: 'Món chính' | 'Món chay' | 'Món phụ' | 'Canh' | 'Tráng miệng';
  status?: 'APPROVED' | 'PENDING_APPROVAL' | 'REJECTED';
  createdById?: string;
  createdByName?: string;
  createdAt?: string;
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

export interface Menu {
  id: string;
  date: string; // YYYY-MM-DD
  shiftId: string;
  title: string;
  description: string;
  price: number; // in VND
  status: MenuStatus;
  createdById: string;
  createdByName?: string;
  approvedById?: string;
  approvedByName?: string;
  rejectionReason?: string;
  approvedAt?: string;
  publishedAt?: string;
  items: MenuItem[];
}

export type BookingStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'EXPIRED';

export interface Booking {
  id: string;
  bookingCode: string;
  userId: string;
  userName: string;
  userEmployeeCode: string;
  departmentId: string;
  departmentName: string;
  mealDate: string; // YYYY-MM-DD
  shiftId: string;
  shiftName: string;
  menuId: string;
  selectedItemIds: string[];
  selectedItemNames: string[];
  status: BookingStatus;
  isGuest: boolean;
  guestName?: string;
  guestCount?: number;
  purpose?: string;
  note?: string;
  specialDiet?: string;
  priceSnapshot: number;
  bookedAt: string;
  checkedInAt?: string;
  checkedInBy?: string; // QR Scanner Operator or Self
  cancelledAt?: string;
  bookedByUserId: string;
  bookedByName: string;
  qrNonceUsed?: string;
}

// NOTE: AttendanceRecord represents a record RETURNED BY an external, independent
// time-attendance system (hệ thống chấm công độc lập). This app does NOT record
// attendance itself; it only reads today's count + employee names via that external API.
// machineId/deviceId are optional legacy device-source hints from the external system.
export interface AttendanceRecord {
  id: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  date: string; // YYYY-MM-DD
  checkInTime: string; // HH:mm:ss (thời điểm chấm công ghi nhận bởi hệ thống bên ngoài)
  checkOutTime?: string;
  machineId?: string; // Nguồn thiết bị (tùy chọn) do hệ thống chấm công bên ngoài cung cấp
  deviceId?: string;  // Nguồn thiết bị (tùy chọn) do hệ thống chấm công bên ngoài cung cấp
}

// NOTE: AttendanceSyncRun records one PULL of today's attendance data from the
// external independent attendance system (lần lấy dữ liệu từ hệ thống chấm công độc lập).
// It never creates/records attendance in this app; it only logs the fetch result.
export interface AttendanceSyncRun {
  id: string;
  syncedAt: string; // Thời điểm lấy dữ liệu từ hệ thống chấm công bên ngoài
  totalProcessed: number;
  matchedEmployees: number;
  discrepancyCount: number;
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  triggeredBy: string;
  notes?: string;
}

export interface UnbookedEmployee {
  employeeId: string;
  employeeCode: string;
  name: string;
  departmentId: string;
  departmentName: string;
  checkInTime: string;
  machineId?: string; // Nguồn thiết bị (tùy chọn) từ hệ thống chấm công bên ngoài
  status: 'ATTENDED_NO_BOOKING';
  phone?: string;
  email?: string;
}

export interface UnattendedBooking {
  bookingId: string;
  bookingCode: string;
  employeeCode: string;
  name: string;
  departmentId?: string;
  departmentName: string;
  mealDate: string;
  shiftName: string;
  status: 'BOOKED_NO_ATTENDANCE';
}

export interface DepartmentAttendanceBreakdown {
  departmentId: string;
  departmentName: string;
  totalEmployees: number;
  clockedInCount: number;
  bookedCount: number;
  unbookedCount: number;
  unattendedCount: number;
  complianceRate: number;
}

export interface AttendanceComparison {
  date: string;
  shiftId: string;
  shiftName: string;
  totalAttendance: number;
  totalBookings: number;
  totalCheckedIn: number;
  noShowCount: number;
  unbookedAttendanceCount: number; // Nhân viên đi làm nhưng chưa đặt cơm
  unattendedBookingCount: number;  // Đặt nhưng không có chấm công
  discrepancyRatio: number; // percentage
  unbookedEmployees?: UnbookedEmployee[];
  unattendedBookings?: UnattendedBooking[];
  departmentBreakdown?: DepartmentAttendanceBreakdown[];
}

export type InventoryTransactionType =
  | 'IN'
  | 'OUT'
  | 'ADJUSTMENT'
  | 'WASTE'
  | 'RETURN';

export type MasanSupplier =
  | 'MML'           // Masan MEATLife: Thịt heo MEATDeli, thịt gà MML, trứng gà MML
  | 'CHIN_SU'       // CHIN-SU / Masan Consumer: Nước tương, tương ớt, nước mắm Nam Ngư, hạt nêm Chinsu
  | 'WINECO'        // WinEco: 100% Rau, Củ, Quả tươi chuẩn VietGAP
  | 'WINCOMMERCE';  // WinCommerce: Gạo ST25, ngũ cốc, thực phẩm khô đóng gói

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: 'Thực phẩm tươi sống' | 'Gia vị & Khô' | 'Rau củ quả' | 'Đồ uống' | 'Khác';
  unit: string;
  supplier: string;
  masanSupplier?: MasanSupplier;
  masanSupplierName?: string;
  brand?: string;
  currentStock: number;
  minimumStock: number;
  unitCost: number; // VND
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  status: 'OK' | 'LOW' | 'EXPIRED';
  updatedAt: string;
}

export interface DishIngredientRecipe {
  dishId: string;
  dishName: string;
  inventoryItemId: string;
  ingredientName: string;
  masanSupplier: MasanSupplier;
  masanSupplierName: string;
  quantityPerPortion: number; // e.g. 0.15 kg, 1 quả, 0.02 lít
  unit: string;
}

export interface InventoryRequirementAnalysis {
  itemId: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  masanSupplier: MasanSupplier;
  masanSupplierName: string;
  brand: string;
  currentStock: number;
  requiredForBookings: number;
  balanceStock: number; // currentStock - requiredForBookings
  isShortage: boolean;
  shortageQuantity: number; // if isShortage, requiredForBookings - currentStock
  unitCost: number;
  estimatedPurchaseCost: number;
  status: 'SUFFICIENT' | 'LOW' | 'CRITICAL_SHORTAGE';
  affectedDishes: { dishName: string; portionCount: number }[];
}

export interface MasanPurchaseOrder {
  id: string;
  poCode: string;
  supplier: MasanSupplier;
  supplierName: string;
  items: {
    inventoryItemId: string;
    name: string;
    unit: string;
    requiredQty: number;
    purchaseQty: number;
    unitPrice: number;
    subtotal: number;
  }[];
  totalAmount: number;
  createdAt: string;
  status: 'PENDING_GA_APPROVAL' | 'APPROVED' | 'DELIVERED';
  notes: string;
  forMealDate: string;
}

export interface FeatureFlags {
  enableWeeklyBooking: boolean;          // Đặt cơm theo tuần (Weekly Meal Booking)
  enableBOMForecasting: boolean;         // Dự toán nhu cầu & Cân đối tồn kho Masan
  enableDepartmentBooking: boolean;      // Đặt cơm theo phòng ban
  enableGuestBooking: boolean;           // Đặt cơm cho khách VIP/đối tác
  enableAttendanceSync: boolean;         // Đối soát dữ liệu từ hệ thống chấm công độc lập bên ngoài & Suất ăn
  enableMasterDishCatalog: boolean;      // Ngân hàng món ăn chuẩn & Quy trình GA duyệt món
  enableKioskQrCheckin: boolean;         // Kiosk QR Check-in & Màn hình IPC
  enableInventoryAndSuppliers: boolean;  // Quản lý kho & Định mức nguyên vật liệu Masan
  enableMealRatingFeedback: boolean;     // Đánh giá sao & Phản hồi chất lượng bữa ăn
  enableDietaryPreference: boolean;      // Đăng ký chế độ ăn kiêng / dị ứng
}

export interface InventoryTransaction {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  type: InventoryTransactionType;
  quantity: number; // positive or negative
  reason: string;
  performedByUserId: string;
  performedByName: string;
  createdAt: string;
  balanceAfter: number;
}

export interface QRTokenPayload {
  sub: string;
  booking_id: string;
  meal_date: string;
  shift_id: string;
  jti: string;
  iat: number;
  exp: number;
  employee_code?: string;
  display_name?: string;
}

export interface AuditLog {
  id: string;
  actorUserId: string;
  actorName: string;
  actorEmployeeCode?: string;
  actorRole?: string;
  action: string;
  resourceType: string;
  resource?: string;
  resourceId: string;
  oldValue?: string;
  newValue?: string;
  ipAddress: string;
  userAgent: string;
  requestId: string;
  createdAt: string;
  timestamp?: string;
  details?: Record<string, unknown>;
}

export interface SystemSettings {
  isQrCheckinEnabled: boolean;
  isAttendanceSyncEnabled: boolean;
  allowNegativeInventory: boolean;
  allowAdminCutoffOverride: boolean;
  costBasis: 'BOOKED' | 'CHECKED_IN' | 'COOKED';
  defaultCurrency: 'VND';
  timezone: string; // 'Asia/Ho_Chi_Minh'
  canteenName: string;
  featureFlags: FeatureFlags;
}

export type SystemConfig = SystemSettings;

export interface RecentCheckin {
  id: string;
  userName: string;
  userEmployeeCode: string;
  departmentName?: string;
  shiftName: string;
  checkedInAt: string;
  dishName: string;
  avatarUrl?: string;
}

export interface IPCTokenData {
  ipcToken: string;
  canteenName: string;
  shift: Shift;
  date: string;
  expiresIn: number;
  expiresAt: number;
  serverTime: string;
  stats: {
    totalBooked: number;
    checkedInCount: number;
    remainingCount: number;
  };
  recentCheckins: RecentCheckin[];
}

export interface ApiResponse<T> {
  data?: T;
  meta?: Record<string, unknown>;
  requestId: string;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
