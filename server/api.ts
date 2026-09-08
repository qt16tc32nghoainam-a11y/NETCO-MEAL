import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  users,
  departments,
  shifts,
  menus,
  bookings,
  attendanceRecords,
  attendanceSyncRuns,
  inventoryItems,
  inventoryTransactions,
  auditLogs,
  systemSettings,
  usedQrNonces,
  generateId,
  getTodayDateString,
  addAuditLog,
  roles,
  systemPermissions,
  masterDishes,
  dishRecipes,
  masanPurchaseOrders,
} from './db';
import {
  User,
  Menu,
  MenuItem,
  Booking,
  QRTokenPayload,
  AttendanceComparison,
  UnbookedEmployee,
  UnattendedBooking,
  DepartmentAttendanceBreakdown,
  InventoryTransactionType,
  Department,
  Shift,
  MasanPurchaseOrder,
  InventoryRequirementAnalysis,
  FeatureFlags,
} from '../src/types';

export const apiRouter = Router();

// Middleware: Standard API Response wrapper & Request ID
apiRouter.use((req, res, next) => {
  const requestId = (req.headers['x-request-id'] as string) || generateId('req');
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

// Helper for success response
function sendSuccess(res: Response, data: unknown, meta?: Record<string, unknown>, statusCode = 200) {
  return res.status(statusCode).json({
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...(meta || {}),
    },
    requestId: res.locals.requestId,
  });
}

// Helper for error response
function sendError(res: Response, code: string, message: string, details?: Record<string, unknown>, statusCode = 400) {
  return res.status(statusCode).json({
    error: {
      code,
      message,
      details: details || {},
    },
    requestId: res.locals.requestId,
  });
}

// Loại bỏ trường password nhạy cảm trước khi trả về client.
// Không bao giờ để mật khẩu (dù là bản demo plaintext) lọt ra ngoài response API.
function sanitizeUser(user: User): User {
  const { password: _password, ...safe } = user;
  return safe;
}

// Helper to extract actor from headers or body
function getActorUser(req: Request): User {
  const actorId = (req.headers['x-user-id'] as string) || (req.body?.actorUserId as string);
  const found = users.find((u) => u.id === actorId);
  return (
    found ||
    users[0] // fallback to admin
  );
}

// ==========================================
// 1. AUTHENTICATION & USERS
// ==========================================

apiRouter.post('/auth/login', (req, res) => {
  const { credential, password } = req.body;
  if (!credential) {
    return sendError(res, 'INVALID_CREDENTIALS', 'Vui lòng cung cấp tên đăng nhập, email hoặc mã nhân viên.');
  }
  if (!password) {
    return sendError(res, 'INVALID_CREDENTIALS', 'Vui lòng nhập mật khẩu.');
  }

  const cleanCredential = String(credential).trim();

  // Quản trị viên có thể đăng nhập trực tiếp bằng tên đăng nhập "admin"
  // (ngoài email/mã nhân viên như các tài khoản khác).
  const user =
    cleanCredential.toLowerCase() === 'admin'
      ? users.find((u) => u.role === 'Administrator')
      : users.find(
          (u) =>
            u.email.toLowerCase() === cleanCredential.toLowerCase() ||
            u.employeeCode.toUpperCase() === cleanCredential.toUpperCase()
        );

  if (!user) {
    return sendError(res, 'USER_NOT_FOUND', 'Không tìm thấy tài khoản nhân viên tương ứng.');
  }

  if (user.status === 'LOCKED') {
    return sendError(res, 'ACCOUNT_LOCKED', 'Tài khoản đã bị tạm khóa. Vui lòng liên hệ Administrator.');
  }

  if (String(password) !== (user.password ?? '')) {
    return sendError(res, 'INVALID_CREDENTIALS', 'Mật khẩu không chính xác. Vui lòng thử lại.');
  }

  // Generate mock JWT tokens
  const accessToken = `jwt_acc_${user.id}_${Date.now()}`;
  const refreshToken = `jwt_ref_${user.id}_${Date.now()}`;

  addAuditLog({
    actorUserId: user.id,
    actorName: user.name,
    action: 'USER_LOGIN',
    resourceType: 'AUTH',
    resourceId: user.id,
    newValue: `Đăng nhập thành công với vai trò ${user.role}`,
    ipAddress: req.ip || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
    expiresIn: 900, // 15 mins
  });
});

apiRouter.get('/users/me', (req, res) => {
  const actor = getActorUser(req);
  return sendSuccess(res, sanitizeUser(actor));
});

apiRouter.get('/users', (req, res) => {
  const { departmentId, role, status, q } = req.query;
  let result = [...users];

  if (departmentId) {
    result = result.filter((u) => u.departmentId === departmentId);
  }
  if (role) {
    result = result.filter((u) => u.role === role);
  }
  if (status) {
    result = result.filter((u) => u.status === status);
  }
  if (q && typeof q === 'string') {
    const query = q.toLowerCase();
    result = result.filter(
      (u) =>
        u.name.toLowerCase().includes(query) ||
        u.employeeCode.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query)
    );
  }

  // Ensure departmentName is populated (và loại bỏ trường password nhạy cảm)
  result = result.map((u) => {
    const dept = departments.find((d) => d.id === u.departmentId);
    return sanitizeUser({
      ...u,
      departmentName: u.departmentName || dept?.name || 'Chưa phân bổ',
    });
  });

  return sendSuccess(res, result);
});

// Get User Profile with Stats & Effective Permissions
apiRouter.get('/users/:id', (req, res) => {
  const { id } = req.params;
  const user = users.find((u) => u.id === id);
  if (!user) {
    return sendError(res, 'NOT_FOUND', 'Không tìm thấy hồ sơ người dùng', {}, 404);
  }

  const dept = departments.find((d) => d.id === user.departmentId);
  const userRole = roles.find((r) => r.roleKey === user.role || r.id === user.role);

  // Effective permissions: role permissions + user custom permissions
  const rolePerms = userRole ? userRole.permissions : [];
  const customPerms = user.customPermissions || [];
  const effectivePermissions = Array.from(new Set([...rolePerms, ...customPerms]));

  // User booking statistics
  const userBookings = bookings.filter((b) => b.userId === user.id);
  const checkedInCount = userBookings.filter((b) => b.status === 'CHECKED_IN').length;
  const noShowCount = userBookings.filter((b) => b.status === 'NO_SHOW').length;
  const cancelledCount = userBookings.filter((b) => b.status === 'CANCELLED').length;
  const confirmedCount = userBookings.filter((b) => b.status === 'CONFIRMED').length;

  return sendSuccess(res, {
    ...sanitizeUser(user),
    departmentName: user.departmentName || dept?.name || 'Chưa phân bổ',
    roleDetails: userRole || null,
    effectivePermissions,
    stats: {
      totalBookings: userBookings.length,
      checkedInCount,
      noShowCount,
      cancelledCount,
      confirmedCount,
      attendanceRate: userBookings.length > 0 ? Math.round((checkedInCount / userBookings.length) * 100) : 100,
    },
  });
});

// Create New User
apiRouter.post('/users', (req, res) => {
  const actor = getActorUser(req);
  const {
    employeeCode,
    name,
    email,
    role,
    departmentId,
    phone,
    status = 'ACTIVE',
    dietaryPreference = 'NONE',
    allergens = [],
    dietaryNote = '',
    avatarUrl,
  } = req.body;

  if (!employeeCode || !name || !email || !departmentId || !role) {
    return sendError(
      res,
      'VALIDATION_ERROR',
      'Vui lòng cung cấp đầy đủ thông tin bắt buộc: Mã NV, Họ tên, Email, Phòng ban và Vai trò.'
    );
  }

  // Check duplicate employeeCode or email
  const existingCode = users.find(
    (u) => u.employeeCode.toLowerCase() === employeeCode.trim().toLowerCase()
  );
  if (existingCode) {
    return sendError(res, 'DUPLICATE_CODE', `Mã nhân viên "${employeeCode}" đã tồn tại trong hệ thống.`, {}, 409);
  }

  const existingEmail = users.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase()
  );
  if (existingEmail) {
    return sendError(res, 'DUPLICATE_EMAIL', `Email "${email}" đã được đăng ký tài khoản khác.`, {}, 409);
  }

  const dept = departments.find((d) => d.id === departmentId);
  const newUser: User = {
    id: generateId('usr'),
    employeeCode: employeeCode.trim().toUpperCase(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role,
    departmentId,
    departmentName: dept?.name || 'Phòng ban mới',
    phone: phone?.trim() || '',
    status: status as 'ACTIVE' | 'LOCKED' | 'PENDING',
    avatarUrl:
      avatarUrl ||
      `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
    isMfaEnabled: false,
    dietaryPreference,
    allergens: Array.isArray(allergens) ? allergens : [],
    dietaryNote,
    joinedDate: getTodayDateString(),
    // Mật khẩu mặc định cho nhân viên mới (giống các tài khoản thường): "123456".
    password: role === 'Administrator' ? 'admin' : '123456',
  };

  users.push(newUser);

  // Log audit trail
  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    actorEmployeeCode: actor.employeeCode,
    actorRole: actor.role,
    action: 'USER_CREATE',
    resourceType: 'USER',
    resourceId: newUser.id,
    newValue: `Tạo tài khoản nhân viên mới ${newUser.name} (${newUser.employeeCode}) - Vai trò: ${newUser.role}`,
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, sanitizeUser(newUser));
});

// Update User (Admin / HR)
apiRouter.patch('/users/:id', (req, res) => {
  const actor = getActorUser(req);
  const { id } = req.params;
  const user = users.find((u) => u.id === id);

  if (!user) {
    return sendError(res, 'NOT_FOUND', 'Không tìm thấy người dùng cần cập nhật', {}, 404);
  }

  const {
    name,
    email,
    role,
    departmentId,
    phone,
    status,
    dietaryPreference,
    allergens,
    dietaryNote,
    isMfaEnabled,
    customPermissions,
    avatarUrl,
  } = req.body;

  const oldValue = JSON.stringify({
    name: user.name,
    role: user.role,
    departmentId: user.departmentId,
    status: user.status,
  });

  if (name !== undefined) user.name = name.trim();
  if (email !== undefined) user.email = email.trim().toLowerCase();
  if (role !== undefined) user.role = role;
  if (departmentId !== undefined) {
    user.departmentId = departmentId;
    const dept = departments.find((d) => d.id === departmentId);
    user.departmentName = dept?.name || user.departmentName;
  }
  if (phone !== undefined) user.phone = phone.trim();
  if (status !== undefined) user.status = status;
  if (dietaryPreference !== undefined) user.dietaryPreference = dietaryPreference;
  if (allergens !== undefined) user.allergens = allergens;
  if (dietaryNote !== undefined) user.dietaryNote = dietaryNote;
  if (isMfaEnabled !== undefined) user.isMfaEnabled = isMfaEnabled;
  if (customPermissions !== undefined) user.customPermissions = customPermissions;
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;

  // Log audit
  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    actorEmployeeCode: actor.employeeCode,
    actorRole: actor.role,
    action: 'USER_UPDATE',
    resourceType: 'USER',
    resourceId: user.id,
    oldValue,
    newValue: JSON.stringify({
      name: user.name,
      role: user.role,
      departmentId: user.departmentId,
      status: user.status,
    }),
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, sanitizeUser(user));
});

// Self-service User Profile Update
apiRouter.patch('/users/:id/profile', (req, res) => {
  const { id } = req.params;
  const user = users.find((u) => u.id === id);

  if (!user) {
    return sendError(res, 'NOT_FOUND', 'Không tìm thấy tài khoản người dùng', {}, 404);
  }

  const { phone, dietaryPreference, allergens, dietaryNote, avatarUrl } = req.body;

  if (phone !== undefined) user.phone = phone.trim();
  if (dietaryPreference !== undefined) user.dietaryPreference = dietaryPreference;
  if (allergens !== undefined) user.allergens = allergens;
  if (dietaryNote !== undefined) user.dietaryNote = dietaryNote;
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;

  addAuditLog({
    actorUserId: user.id,
    actorName: user.name,
    actorEmployeeCode: user.employeeCode,
    actorRole: user.role,
    action: 'USER_PROFILE_UPDATE',
    resourceType: 'USER',
    resourceId: user.id,
    newValue: `Cập nhật hồ sơ cá nhân & chế độ ăn uống: ${dietaryPreference || user.dietaryPreference}`,
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, sanitizeUser(user));
});

// Delete or Deactivate User
apiRouter.delete('/users/:id', (req, res) => {
  const actor = getActorUser(req);
  const { id } = req.params;
  const userIndex = users.findIndex((u) => u.id === id);

  if (userIndex === -1) {
    return sendError(res, 'NOT_FOUND', 'Không tìm thấy người dùng', {}, 404);
  }

  const user = users[userIndex];
  if (user.id === actor.id) {
    return sendError(res, 'FORBIDDEN', 'Không thể tự xóa tài khoản của chính mình.', {}, 403);
  }

  // Remove user
  users.splice(userIndex, 1);

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    actorEmployeeCode: actor.employeeCode,
    actorRole: actor.role,
    action: 'USER_DELETE',
    resourceType: 'USER',
    resourceId: id,
    oldValue: `${user.name} (${user.employeeCode}) - Vai trò: ${user.role}`,
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, { message: 'Đã xóa người dùng thành công', deletedUserId: id });
});

// ==========================================
// 1.1 ROLES & PERMISSIONS MANAGEMENT (RBAC)
// ==========================================

// Get All Permissions
apiRouter.get('/permissions', (req, res) => {
  return sendSuccess(res, systemPermissions);
});

// Get All Roles with Assigned User Counts
apiRouter.get('/roles', (req, res) => {
  const result = roles.map((r) => ({
    ...r,
    userCount: users.filter((u) => u.role === r.roleKey || u.role === r.id).length,
  }));
  return sendSuccess(res, result);
});

// Create Custom Role
apiRouter.post('/roles', (req, res) => {
  const actor = getActorUser(req);
  const { roleKey, name, description, badgeColor = 'blue', permissions = [] } = req.body;

  if (!roleKey || !name) {
    return sendError(res, 'VALIDATION_ERROR', 'Vui lòng cung cấp Mã vai trò (roleKey) và Tên hiển thị vai trò.');
  }

  const existingRole = roles.find(
    (r) => r.roleKey.toLowerCase() === roleKey.trim().toLowerCase()
  );
  if (existingRole) {
    return sendError(res, 'DUPLICATE_ROLE', `Mã vai trò "${roleKey}" đã tồn tại trong hệ thống.`, {}, 409);
  }

  const newRole = {
    id: generateId('role'),
    roleKey: roleKey.trim().replace(/\s+/g, '_'),
    name: name.trim(),
    description: description?.trim() || '',
    isSystem: false,
    badgeColor,
    permissions: Array.isArray(permissions) ? permissions : [],
  };

  roles.push(newRole);

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    actorEmployeeCode: actor.employeeCode,
    actorRole: actor.role,
    action: 'ROLE_CREATE',
    resourceType: 'ROLE',
    resourceId: newRole.id,
    newValue: `Tạo vai trò mới: ${newRole.name} (${newRole.roleKey}) với ${newRole.permissions.length} quyền`,
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, newRole);
});

// Update Role (Permissions & Description)
apiRouter.patch('/roles/:id', (req, res) => {
  const actor = getActorUser(req);
  const { id } = req.params;
  const role = roles.find((r) => r.id === id || r.roleKey === id);

  if (!role) {
    return sendError(res, 'NOT_FOUND', 'Không tìm thấy vai trò cần cập nhật', {}, 404);
  }

  const { name, description, badgeColor, permissions } = req.body;

  const oldPermsCount = role.permissions.length;
  if (name !== undefined) role.name = name.trim();
  if (description !== undefined) role.description = description.trim();
  if (badgeColor !== undefined) role.badgeColor = badgeColor;
  if (permissions !== undefined && Array.isArray(permissions)) {
    role.permissions = permissions;
  }

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    actorEmployeeCode: actor.employeeCode,
    actorRole: actor.role,
    action: 'ROLE_UPDATE',
    resourceType: 'ROLE',
    resourceId: role.id,
    oldValue: `Số quyền trước: ${oldPermsCount}`,
    newValue: `Cập nhật quyền cho vai trò ${role.name}: ${role.permissions.length} quyền được gán`,
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, role);
});

// Delete Custom Role
apiRouter.delete('/roles/:id', (req, res) => {
  const actor = getActorUser(req);
  const { id } = req.params;
  const roleIndex = roles.findIndex((r) => r.id === id || r.roleKey === id);

  if (roleIndex === -1) {
    return sendError(res, 'NOT_FOUND', 'Không tìm thấy vai trò', {}, 404);
  }

  const role = roles[roleIndex];
  if (role.isSystem) {
    return sendError(res, 'SYSTEM_ROLE_PROTECTED', 'Không thể xóa vai trò mặc định của hệ thống.', {}, 403);
  }

  const assignedUsers = users.filter((u) => u.role === role.roleKey || u.role === role.id);
  if (assignedUsers.length > 0) {
    return sendError(
      res,
      'ROLE_IN_USE',
      `Không thể xóa vai trò này vì đang có ${assignedUsers.length} nhân viên được gán. Vui lòng chuyển vai trò của họ trước.`,
      {},
      400
    );
  }

  roles.splice(roleIndex, 1);

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    actorEmployeeCode: actor.employeeCode,
    actorRole: actor.role,
    action: 'ROLE_DELETE',
    resourceType: 'ROLE',
    resourceId: id,
    oldValue: `Xóa vai trò: ${role.name} (${role.roleKey})`,
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, { message: 'Đã xóa vai trò thành công', deletedRoleId: id });
});

apiRouter.get('/departments', (req, res) => {
  const result = departments.map((d) => ({
    ...d,
    totalEmployees: users.filter((u) => u.departmentId === d.id).length,
  }));
  return sendSuccess(res, result);
});

apiRouter.get('/departments/:id/employees', (req, res) => {
  const { id } = req.params;
  const employees = users.filter((u) => u.departmentId === id && u.status === 'ACTIVE');
  return sendSuccess(res, employees);
});

// Create Department (POST /departments)
apiRouter.post('/departments', (req, res) => {
  const actor = getActorUser(req);
  const { code, name, representativeUserId } = req.body;

  if (!code || !name) {
    return sendError(res, 'VALIDATION_ERROR', 'Mã phòng ban và tên phòng ban là bắt buộc.');
  }

  const existing = departments.find((d) => d.code.toUpperCase() === code.trim().toUpperCase());
  if (existing) {
    return sendError(res, 'CODE_EXISTS', `Mã phòng ban "${code}" đã tồn tại trên hệ thống.`);
  }

  const newDept: Department = {
    id: generateId('dept'),
    code: code.trim().toUpperCase(),
    name: name.trim(),
    representativeUserId: representativeUserId || undefined,
    totalEmployees: 0,
  };

  departments.push(newDept);

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    actorEmployeeCode: actor.employeeCode,
    actorRole: actor.role,
    action: 'DEPARTMENT_CREATE',
    resourceType: 'DEPARTMENT',
    resourceId: newDept.id,
    newValue: `Tạo phòng ban: ${newDept.name} (${newDept.code})`,
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, newDept, {}, 201);
});

// Update Department (PATCH /departments/:id)
apiRouter.patch('/departments/:id', (req, res) => {
  const actor = getActorUser(req);
  const { id } = req.params;
  const dept = departments.find((d) => d.id === id);

  if (!dept) {
    return sendError(res, 'NOT_FOUND', 'Không tìm thấy phòng ban', {}, 404);
  }

  const { code, name, representativeUserId } = req.body;
  const oldValue = JSON.stringify({ code: dept.code, name: dept.name, representativeUserId: dept.representativeUserId });

  if (code !== undefined) {
    const codeCheck = departments.find((d) => d.id !== id && d.code.toUpperCase() === code.trim().toUpperCase());
    if (codeCheck) {
      return sendError(res, 'CODE_EXISTS', `Mã phòng ban "${code}" đã thuộc về phòng ban khác.`);
    }
    dept.code = code.trim().toUpperCase();
  }
  if (name !== undefined) {
    dept.name = name.trim();
    // Update department name in users list for denormalization
    users.forEach((u) => {
      if (u.departmentId === id) {
        u.departmentName = dept.name;
      }
    });
  }
  if (representativeUserId !== undefined) {
    dept.representativeUserId = representativeUserId || undefined;
  }

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    actorEmployeeCode: actor.employeeCode,
    actorRole: actor.role,
    action: 'DEPARTMENT_UPDATE',
    resourceType: 'DEPARTMENT',
    resourceId: dept.id,
    oldValue,
    newValue: JSON.stringify({ code: dept.code, name: dept.name, representativeUserId: dept.representativeUserId }),
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, {
    ...dept,
    totalEmployees: users.filter((u) => u.departmentId === dept.id).length,
  });
});

// Delete Department (DELETE /departments/:id)
apiRouter.delete('/departments/:id', (req, res) => {
  const actor = getActorUser(req);
  const { id } = req.params;
  const deptIndex = departments.findIndex((d) => d.id === id);

  if (deptIndex === -1) {
    return sendError(res, 'NOT_FOUND', 'Không tìm thấy phòng ban', {}, 404);
  }

  const dept = departments[deptIndex];
  const assignedUsers = users.filter((u) => u.departmentId === id);
  if (assignedUsers.length > 0) {
    return sendError(
      res,
      'DEPARTMENT_NOT_EMPTY',
      `Không thể xóa phòng ban "${dept.name}" vì còn ${assignedUsers.length} nhân viên trực thuộc. Hãy chuyển phòng ban cho nhân viên trước.`,
      {},
      400
    );
  }

  departments.splice(deptIndex, 1);

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    actorEmployeeCode: actor.employeeCode,
    actorRole: actor.role,
    action: 'DEPARTMENT_DELETE',
    resourceType: 'DEPARTMENT',
    resourceId: id,
    oldValue: `Xóa phòng ban: ${dept.name} (${dept.code})`,
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, { message: 'Đã xóa phòng ban thành công', deletedDeptId: id });
});

// ==========================================
// 2. SHIFTS & CUT-OFF TIME CHECK
// ==========================================

apiRouter.get('/shifts', (req, res) => {
  const todayStr = getTodayDateString();
  const now = new Date();

  const shiftsWithEligibility = shifts.map((shift) => {
    // Cut-off evaluation
    return {
      ...shift,
      serverTime: now.toISOString(),
      today: todayStr,
    };
  });

  return sendSuccess(res, shiftsWithEligibility);
});

// Vai trò được phép quản lý ca ăn: Hành chính (HR_GA) tạo ca theo nhu cầu, cùng Quản trị viên.
// Không giới hạn số lượng ca (ca được tạo linh hoạt theo nhu cầu vận hành).
const SHIFT_MANAGER_ROLES = ['Administrator', 'HR_GA'];
const SHIFT_FORBIDDEN_MESSAGE =
  'Chỉ Hành chính (GA) và Quản trị viên mới được phép quản lý ca ăn.';

// Create Shift (POST /shifts)
apiRouter.post('/shifts', (req, res) => {
  const actor = getActorUser(req);
  if (!SHIFT_MANAGER_ROLES.includes(actor.role)) {
    return sendError(res, 'FORBIDDEN', SHIFT_FORBIDDEN_MESSAGE, {}, 403);
  }
  const {
    name,
    code,
    startTime,
    endTime,
    cutoffOrderMinutesBefore,
    cutoffCancelMinutesBefore,
    checkinStartWindowMinutes,
    checkinEndWindowMinutes,
    isActive,
    orderCutoffDisplay,
    cancelCutoffDisplay,
  } = req.body;

  if (!name || !code || !startTime || !endTime) {
    return sendError(res, 'VALIDATION_ERROR', 'Tên ca, mã ca, giờ bắt đầu và giờ kết thúc là bắt buộc.');
  }

  const existing = shifts.find((s) => s.code.toUpperCase() === code.trim().toUpperCase());
  if (existing) {
    return sendError(res, 'CODE_EXISTS', `Mã ca "${code}" đã tồn tại.`);
  }

  const newShift: Shift = {
    id: generateId('shift'),
    name: name.trim(),
    code: code.trim().toUpperCase(),
    startTime: startTime.trim(),
    endTime: endTime.trim(),
    cutoffOrderMinutesBefore: Number(cutoffOrderMinutesBefore) || 120,
    cutoffCancelMinutesBefore: Number(cutoffCancelMinutesBefore) || 60,
    checkinStartWindowMinutes: Number(checkinStartWindowMinutes) || 30,
    checkinEndWindowMinutes: Number(checkinEndWindowMinutes) || 30,
    isActive: isActive !== false,
    orderCutoffDisplay: orderCutoffDisplay || `${cutoffOrderMinutesBefore || 120}p trước ca`,
    cancelCutoffDisplay: cancelCutoffDisplay || `${cutoffCancelMinutesBefore || 60}p trước ca`,
  };

  shifts.push(newShift);

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    actorEmployeeCode: actor.employeeCode,
    actorRole: actor.role,
    action: 'SHIFT_CREATE',
    resourceType: 'SHIFT',
    resourceId: newShift.id,
    newValue: `Tạo ca ăn mới: ${newShift.name} (${newShift.startTime} - ${newShift.endTime})`,
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, newShift, {}, 201);
});

// Update Shift (PATCH /shifts/:id)
apiRouter.patch('/shifts/:id', (req, res) => {
  const actor = getActorUser(req);
  if (!SHIFT_MANAGER_ROLES.includes(actor.role)) {
    return sendError(res, 'FORBIDDEN', SHIFT_FORBIDDEN_MESSAGE, {}, 403);
  }
  const { id } = req.params;
  const shift = shifts.find((s) => s.id === id);

  if (!shift) {
    return sendError(res, 'NOT_FOUND', 'Không tìm thấy ca ăn', {}, 404);
  }

  const {
    name,
    code,
    startTime,
    endTime,
    cutoffOrderMinutesBefore,
    cutoffCancelMinutesBefore,
    checkinStartWindowMinutes,
    checkinEndWindowMinutes,
    isActive,
    orderCutoffDisplay,
    cancelCutoffDisplay,
  } = req.body;

  const oldValue = JSON.stringify(shift);

  if (name !== undefined) shift.name = name.trim();
  if (code !== undefined) {
    const check = shifts.find((s) => s.id !== id && s.code.toUpperCase() === code.trim().toUpperCase());
    if (check) return sendError(res, 'CODE_EXISTS', `Mã ca "${code}" đã tồn tại.`);
    shift.code = code.trim().toUpperCase();
  }
  if (startTime !== undefined) shift.startTime = startTime.trim();
  if (endTime !== undefined) shift.endTime = endTime.trim();
  if (cutoffOrderMinutesBefore !== undefined) shift.cutoffOrderMinutesBefore = Number(cutoffOrderMinutesBefore);
  if (cutoffCancelMinutesBefore !== undefined) shift.cutoffCancelMinutesBefore = Number(cutoffCancelMinutesBefore);
  if (checkinStartWindowMinutes !== undefined) shift.checkinStartWindowMinutes = Number(checkinStartWindowMinutes);
  if (checkinEndWindowMinutes !== undefined) shift.checkinEndWindowMinutes = Number(checkinEndWindowMinutes);
  if (isActive !== undefined) shift.isActive = Boolean(isActive);
  if (orderCutoffDisplay !== undefined) shift.orderCutoffDisplay = orderCutoffDisplay.trim();
  if (cancelCutoffDisplay !== undefined) shift.cancelCutoffDisplay = cancelCutoffDisplay.trim();

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    actorEmployeeCode: actor.employeeCode,
    actorRole: actor.role,
    action: 'SHIFT_UPDATE',
    resourceType: 'SHIFT',
    resourceId: shift.id,
    oldValue,
    newValue: JSON.stringify(shift),
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, shift);
});

// Delete Shift (DELETE /shifts/:id)
apiRouter.delete('/shifts/:id', (req, res) => {
  const actor = getActorUser(req);
  if (!SHIFT_MANAGER_ROLES.includes(actor.role)) {
    return sendError(res, 'FORBIDDEN', SHIFT_FORBIDDEN_MESSAGE, {}, 403);
  }
  const { id } = req.params;
  const shiftIndex = shifts.findIndex((s) => s.id === id);

  if (shiftIndex === -1) {
    return sendError(res, 'NOT_FOUND', 'Không tìm thấy ca ăn', {}, 404);
  }

  const shift = shifts[shiftIndex];
  // Check if any booking uses this shift
  const relatedBookings = bookings.filter((b) => b.shiftId === id && b.status !== 'CANCELLED');
  if (relatedBookings.length > 0) {
    return sendError(
      res,
      'SHIFT_HAS_BOOKINGS',
      `Không thể xóa ca "${shift.name}" vì đang có ${relatedBookings.length} suất ăn đã đặt thuộc ca này. Bạn có thể chọn "Tạm ngưng" ca thay vì xóa.`,
      {},
      400
    );
  }

  shifts.splice(shiftIndex, 1);

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    actorEmployeeCode: actor.employeeCode,
    actorRole: actor.role,
    action: 'SHIFT_DELETE',
    resourceType: 'SHIFT',
    resourceId: id,
    oldValue: `Xóa ca ăn: ${shift.name} (${shift.code})`,
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, { message: 'Đã xóa ca ăn thành công', deletedShiftId: id });
});

apiRouter.get('/shifts/:id/booking-eligibility', (req, res) => {
  const { id } = req.params;
  const { mealDate } = req.query;
  const targetDate = (mealDate as string) || getTodayDateString();

  const shift = shifts.find((s) => s.id === id);
  if (!shift) {
    return sendError(res, 'SHIFT_NOT_FOUND', 'Ca làm việc không tồn tại', {}, 404);
  }

  const now = new Date();
  const target = new Date(targetDate);
  const isPastDate = target < new Date(getTodayDateString());

  // Check cutoff
  const isCutoffPassed = isPastDate; // For demonstration, if date is today or future, allow booking unless admin override off

  return sendSuccess(res, {
    shiftId: shift.id,
    mealDate: targetDate,
    canOrder: !isCutoffPassed,
    canCancel: !isCutoffPassed,
    reason: isCutoffPassed ? 'Đã quá thời gian quy định chốt ca' : 'Hợp lệ',
  });
});

// ==========================================
// 2.5 MASTER DISH CATALOG (NGÂN HÀNG MÓN ĂN CHUẨN)
// ==========================================

// Get All Master Dishes (Filter by status, category, search)
apiRouter.get('/dishes', (req, res) => {
  const { status, category, search } = req.query;
  let result = [...masterDishes];

  if (status) {
    result = result.filter((d) => d.status === status);
  }
  if (category) {
    result = result.filter((d) => d.category === category);
  }
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    result = result.filter(
      (d) => d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q)
    );
  }

  return sendSuccess(res, result);
});

// Create Dish in Master Catalog
apiRouter.post('/dishes', (req, res) => {
  const actor = getActorUser(req);
  const { name, description, imageUrl, isVegetarian, allergens, calories, category } = req.body;

  if (!name || !category) {
    return sendError(res, 'VALIDATION_ERROR', 'Tên món ăn và danh mục là bắt buộc.');
  }

  // If created by Admin or HR_GA -> direct APPROVED; if Chef -> PENDING_APPROVAL
  const initialStatus =
    actor.role === 'HR_GA' || actor.role === 'Administrator' ? 'APPROVED' : 'PENDING_APPROVAL';

  const newDish: MenuItem = {
    id: generateId('dish'),
    name: name.trim(),
    description: description?.trim() || '',
    imageUrl:
      imageUrl?.trim() ||
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
    isVegetarian: Boolean(isVegetarian),
    allergens: Array.isArray(allergens) ? allergens : [],
    calories: Number(calories) || 450,
    category: category as any,
    status: initialStatus,
    createdById: actor.id,
    createdByName: actor.name,
    createdAt: new Date().toISOString(),
    ...(initialStatus === 'APPROVED'
      ? {
          approvedById: actor.id,
          approvedByName: actor.name,
          approvedAt: new Date().toISOString(),
        }
      : {}),
  };

  masterDishes.unshift(newDish);

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    actorEmployeeCode: actor.employeeCode,
    actorRole: actor.role,
    action: 'DISH_CREATE',
    resourceType: 'MENU',
    resourceId: newDish.id,
    newValue: `Tạo món ăn mới "${newDish.name}" (Trạng thái: ${newDish.status})`,
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, newDish, {}, 201);
});

// Update Dish in Master Catalog
apiRouter.patch('/dishes/:id', (req, res) => {
  const actor = getActorUser(req);
  const dish = masterDishes.find((d) => d.id === req.params.id);

  if (!dish) {
    return sendError(res, 'NOT_FOUND', 'Món ăn không tồn tại trong thư viện', {}, 404);
  }

  const { name, description, imageUrl, isVegetarian, allergens, calories, category } = req.body;

  if (name !== undefined) dish.name = name.trim();
  if (description !== undefined) dish.description = description.trim();
  if (imageUrl !== undefined) dish.imageUrl = imageUrl.trim();
  if (isVegetarian !== undefined) dish.isVegetarian = Boolean(isVegetarian);
  if (allergens !== undefined && Array.isArray(allergens)) dish.allergens = allergens;
  if (calories !== undefined) dish.calories = Number(calories);
  if (category !== undefined) dish.category = category;

  return sendSuccess(res, dish);
});

// Delete Dish from Master Catalog
apiRouter.delete('/dishes/:id', (req, res) => {
  const actor = getActorUser(req);
  const idx = masterDishes.findIndex((d) => d.id === req.params.id);

  if (idx === -1) {
    return sendError(res, 'NOT_FOUND', 'Món ăn không tồn tại', {}, 404);
  }

  const dish = masterDishes[idx];
  masterDishes.splice(idx, 1);

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    actorEmployeeCode: actor.employeeCode,
    actorRole: actor.role,
    action: 'DISH_DELETE',
    resourceType: 'MENU',
    resourceId: req.params.id,
    newValue: `Xóa món ăn "${dish.name}" khỏi ngân hàng món chuẩn`,
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, { deletedId: req.params.id });
});

// Approve Dish (Hành chính GA / Admin approves dish to master library)
apiRouter.post('/dishes/:id/approve', (req, res) => {
  const actor = getActorUser(req);
  if (actor.role !== 'HR_GA' && actor.role !== 'Administrator') {
    return sendError(
      res,
      'FORBIDDEN',
      'Chỉ Hành chính GA hoặc Admin mới có quyền phê duyệt món ăn mới vào danh mục món chuẩn',
      {},
      403
    );
  }

  const dish = masterDishes.find((d) => d.id === req.params.id);
  if (!dish) {
    return sendError(res, 'NOT_FOUND', 'Món ăn không tồn tại', {}, 404);
  }

  dish.status = 'APPROVED';
  dish.approvedById = actor.id;
  dish.approvedByName = actor.name;
  dish.approvedAt = new Date().toISOString();
  dish.rejectionReason = undefined;

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    actorEmployeeCode: actor.employeeCode,
    actorRole: actor.role,
    action: 'DISH_APPROVE',
    resourceType: 'MENU',
    resourceId: dish.id,
    newValue: `Duyệt món ăn "${dish.name}" vào danh mục món chuẩn NETCO Meal`,
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, dish);
});

// Reject Dish (Hành chính GA / Admin rejects dish with reason)
apiRouter.post('/dishes/:id/reject', (req, res) => {
  const actor = getActorUser(req);
  if (actor.role !== 'HR_GA' && actor.role !== 'Administrator') {
    return sendError(
      res,
      'FORBIDDEN',
      'Chỉ Hành chính GA hoặc Admin mới có quyền từ chối duyệt món ăn',
      {},
      403
    );
  }

  const dish = masterDishes.find((d) => d.id === req.params.id);
  if (!dish) {
    return sendError(res, 'NOT_FOUND', 'Món ăn không tồn tại', {}, 404);
  }

  const { reason } = req.body;
  dish.status = 'REJECTED';
  dish.rejectionReason = reason || 'Không phù hợp định mức chi phí hoặc tiêu chuẩn dinh dưỡng';

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    actorEmployeeCode: actor.employeeCode,
    actorRole: actor.role,
    action: 'DISH_REJECT',
    resourceType: 'MENU',
    resourceId: dish.id,
    newValue: `Từ chối duyệt món "${dish.name}". Lý do: ${dish.rejectionReason}`,
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, dish);
});

// ==========================================
// 3. MENUS & STATE MACHINE
// ==========================================

apiRouter.get('/menus', (req, res) => {
  const { date, shiftId, status } = req.query;
  let result = [...menus];

  if (date) {
    result = result.filter((m) => m.date === date);
  }
  if (shiftId) {
    result = result.filter((m) => m.shiftId === shiftId);
  }
  if (status) {
    result = result.filter((m) => m.status === status);
  }

  return sendSuccess(res, result);
});

apiRouter.post('/menus', (req, res) => {
  const actor = getActorUser(req);
  if (actor.role !== 'Kitchen_Staff' && actor.role !== 'Administrator') {
    return sendError(res, 'FORBIDDEN', 'Chỉ nhân viên Bếp hoặc Quản trị viên mới được tạo thực đơn', {}, 403);
  }

  const { date, shiftId, title, description, price, items } = req.body;
  if (!date || !shiftId || !title || !items || !Array.isArray(items)) {
    return sendError(res, 'VALIDATION_ERROR', 'Vui lòng cung cấp đầy đủ ngày, ca, tiêu đề và danh sách món ăn.');
  }

  // Guardrail: mỗi ngày chỉ có 3 ca cố định (Ca A, Ca B, Ca C) nên tối đa 3 thực đơn/ngày,
  // và mỗi ca chỉ được có 1 thực đơn. Bếp có thể tạo 2 hoặc 3 thực đơn tùy nhu cầu trong ngày.
  // Chỉ tính các thực đơn còn hiệu lực: thực đơn đã bị TỪ CHỐI (REJECTED) hoặc LƯU TRỮ (ARCHIVED)
  // không chiếm chỗ của ca, để Bếp có thể tạo lại thực đơn mới cho ca đó trong cùng ngày.
  const activeMenusForDate = menus.filter(
    (m) => m.date === date && m.status !== 'REJECTED' && m.status !== 'ARCHIVED'
  );
  if (activeMenusForDate.some((m) => m.shiftId === shiftId)) {
    return sendError(
      res,
      'VALIDATION_ERROR',
      'Ca này đã có thực đơn trong ngày. Mỗi ca chỉ được tạo 1 thực đơn cho mỗi ngày.'
    );
  }
  if (activeMenusForDate.length >= 3) {
    return sendError(
      res,
      'VALIDATION_ERROR',
      'Mỗi ngày chỉ có tối đa 3 thực đơn theo 3 ca (Ca A, Ca B, Ca C).'
    );
  }

  const newMenu: Menu = {
    id: generateId('menu'),
    date,
    shiftId,
    title,
    description: description || '',
    price: Number(price) || 45000,
    status: 'DRAFT',
    createdById: actor.id,
    createdByName: actor.name,
    items: items.map((item: MenuItem) => ({
      ...item,
      id: item.id || generateId('dish'),
    })),
  };

  menus.unshift(newMenu);

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: 'MENU_CREATE',
    resourceType: 'MENU',
    resourceId: newMenu.id,
    newValue: `Tạo thực đơn DRAFT: ${newMenu.title} cho ngày ${date}`,
    ipAddress: req.ip || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, newMenu, {}, 201);
});

// State Transition: Submit for approval
apiRouter.post('/menus/:id/submit', (req, res) => {
  const actor = getActorUser(req);
  const menu = menus.find((m) => m.id === req.params.id);
  if (!menu) return sendError(res, 'NOT_FOUND', 'Thực đơn không tồn tại', {}, 404);

  if (menu.status !== 'DRAFT' && menu.status !== 'REJECTED') {
    return sendError(res, 'INVALID_STATE', `Không thể gửi duyệt thực đơn đang ở trạng thái ${menu.status}`);
  }

  const oldStatus = menu.status;
  menu.status = 'PENDING_APPROVAL';

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: 'MENU_SUBMIT',
    resourceType: 'MENU',
    resourceId: menu.id,
    oldValue: oldStatus,
    newValue: 'PENDING_APPROVAL',
    ipAddress: req.ip || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, menu);
});

// State Transition: Approve menu (HR / Admin only, Separation of Duties)
apiRouter.post('/menus/:id/approve', (req, res) => {
  const actor = getActorUser(req);
  if (actor.role !== 'HR_GA' && actor.role !== 'Administrator') {
    return sendError(res, 'FORBIDDEN', 'Chỉ HR/GA hoặc Quản trị viên mới có quyền phê duyệt thực đơn', {}, 403);
  }

  const menu = menus.find((m) => m.id === req.params.id);
  if (!menu) return sendError(res, 'NOT_FOUND', 'Thực đơn không tồn tại', {}, 404);

  // Separation of duties rule: creator cannot approve their own menu
  if (menu.createdById === actor.id && actor.role !== 'Administrator') {
    return sendError(res, 'SEPARATION_OF_DUTIES', 'Không thể tự phê duyệt thực đơn do chính mình tạo.');
  }

  if (menu.status !== 'PENDING_APPROVAL') {
    return sendError(res, 'INVALID_STATE', `Thực đơn phải ở trạng thái CHỜ DUYỆT (hiện tại: ${menu.status})`);
  }

  const oldStatus = menu.status;
  menu.status = 'APPROVED';
  menu.approvedById = actor.id;
  menu.approvedByName = actor.name;
  menu.approvedAt = new Date().toISOString();

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: 'MENU_APPROVE',
    resourceType: 'MENU',
    resourceId: menu.id,
    oldValue: oldStatus,
    newValue: 'APPROVED',
    ipAddress: req.ip || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, menu);
});

// State Transition: Reject menu with mandatory reason
apiRouter.post('/menus/:id/reject', (req, res) => {
  const actor = getActorUser(req);
  if (actor.role !== 'HR_GA' && actor.role !== 'Administrator') {
    return sendError(res, 'FORBIDDEN', 'Chỉ HR/GA hoặc Quản trị viên mới có quyền từ chối thực đơn', {}, 403);
  }

  const { reason } = req.body;
  if (!reason || !reason.trim()) {
    return sendError(res, 'REASON_REQUIRED', 'Bắt buộc nhập lý do khi từ chối phê duyệt thực đơn.');
  }

  const menu = menus.find((m) => m.id === req.params.id);
  if (!menu) return sendError(res, 'NOT_FOUND', 'Thực đơn không tồn tại', {}, 404);

  if (menu.status !== 'PENDING_APPROVAL') {
    return sendError(res, 'INVALID_STATE', `Thực đơn phải ở trạng thái CHỜ DUYỆT (hiện tại: ${menu.status})`);
  }

  const oldStatus = menu.status;
  menu.status = 'REJECTED';
  menu.rejectionReason = reason;

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: 'MENU_REJECT',
    resourceType: 'MENU',
    resourceId: menu.id,
    oldValue: oldStatus,
    newValue: `REJECTED: ${reason}`,
    ipAddress: req.ip || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, menu);
});

// State Transition: Publish menu (so employees can view and book)
apiRouter.post('/menus/:id/publish', (req, res) => {
  const actor = getActorUser(req);
  const menu = menus.find((m) => m.id === req.params.id);
  if (!menu) return sendError(res, 'NOT_FOUND', 'Thực đơn không tồn tại', {}, 404);

  if (menu.status !== 'APPROVED') {
    return sendError(res, 'INVALID_STATE', 'Chỉ thực đơn đã được APPROVED mới có thể PUBLISH.');
  }

  menu.status = 'PUBLISHED';
  menu.publishedAt = new Date().toISOString();

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: 'MENU_PUBLISH',
    resourceType: 'MENU',
    resourceId: menu.id,
    newValue: 'PUBLISHED',
    ipAddress: req.ip || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, menu);
});

// ==========================================
// 4. BOOKINGS (PERSONAL, DEPARTMENT, GUEST)
// ==========================================

apiRouter.get('/bookings', (req, res) => {
  const { date, shiftId, departmentId, userId, status } = req.query;
  let result = [...bookings];

  if (date) result = result.filter((b) => b.mealDate === date);
  if (shiftId) result = result.filter((b) => b.shiftId === shiftId);
  if (departmentId) result = result.filter((b) => b.departmentId === departmentId);
  if (userId) result = result.filter((b) => b.userId === userId);
  if (status) result = result.filter((b) => b.status === status);

  return sendSuccess(res, result);
});

apiRouter.get('/bookings/me', (req, res) => {
  const actor = getActorUser(req);
  const myBookings = bookings.filter((b) => b.userId === actor.id || b.bookedByUserId === actor.id);
  return sendSuccess(res, myBookings);
});

// 4.1 Personal Booking
apiRouter.post('/bookings/personal', (req, res) => {
  const actor = getActorUser(req);
  const { mealDate, shiftId, menuId, selectedItemIds, note, specialDiet } = req.body;

  if (!mealDate || !shiftId || !menuId) {
    return sendError(res, 'VALIDATION_ERROR', 'Vui lòng cung cấp ngày ăn, ca ăn và thực đơn.');
  }

  // Duplicate Check: 1 active booking per user per date & shift
  const existing = bookings.find(
    (b) =>
      b.userId === actor.id &&
      b.mealDate === mealDate &&
      b.shiftId === shiftId &&
      b.status !== 'CANCELLED'
  );

  if (existing) {
    return sendError(
      res,
      'DUPLICATE_BOOKING',
      `Bạn đã đặt suất ăn cho ca này vào ngày ${mealDate} (Mã booking: ${existing.bookingCode}).`
    );
  }

  const shift = shifts.find((s) => s.id === shiftId);
  const menu = menus.find((m) => m.id === menuId);
  const dept = departments.find((d) => d.id === actor.departmentId);

  // Collect item names
  const selectedItems = menu?.items.filter((i) => selectedItemIds?.includes(i.id)) || [];
  const selectedItemNames = selectedItems.map((i) => i.name);

  const newBooking: Booking = {
    id: generateId('bk'),
    bookingCode: `BK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    userId: actor.id,
    userName: actor.name,
    userEmployeeCode: actor.employeeCode,
    departmentId: actor.departmentId,
    departmentName: dept ? dept.name : 'Khác',
    mealDate,
    shiftId,
    shiftName: shift ? shift.name : shiftId,
    menuId,
    selectedItemIds: selectedItemIds || [],
    selectedItemNames,
    status: 'CONFIRMED',
    isGuest: false,
    note,
    specialDiet,
    priceSnapshot: menu ? menu.price : 45000,
    bookedAt: new Date().toISOString(),
    bookedByUserId: actor.id,
    bookedByName: actor.name,
  };

  bookings.unshift(newBooking);

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: 'BOOKING_PERSONAL_CREATE',
    resourceType: 'BOOKING',
    resourceId: newBooking.id,
    newValue: `Đặt suất ăn cá nhân [${newBooking.bookingCode}] ca ${shift?.name} ngày ${mealDate}`,
    ipAddress: req.ip || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, newBooking, {}, 201);
});

// 4.2 Department Bulk Booking (Department_Representative or Admin/HR only)
apiRouter.post('/bookings/department', (req, res) => {
  const actor = getActorUser(req);
  const { departmentId, employeeIds, mealDate, shiftId, menuId, selectedItemIds } = req.body;

  if (!departmentId || !employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
    return sendError(res, 'VALIDATION_ERROR', 'Vui lòng chọn phòng ban và ít nhất 1 nhân viên.');
  }

  // Authorization check: Must be rep of this department or HR/Admin
  if (actor.role === 'Department_Representative' && actor.departmentId !== departmentId) {
    return sendError(res, 'FORBIDDEN', 'Bạn chỉ có quyền đặt suất ăn cho nhân viên thuộc phòng ban được phân công.', {}, 403);
  }

  const shift = shifts.find((s) => s.id === shiftId);
  const menu = menus.find((m) => m.id === menuId);
  const dept = departments.find((d) => d.id === departmentId);

  // Determine dishes to associate with bookings
  const menuItems = menu?.items || [];
  const chosenItems =
    Array.isArray(selectedItemIds) && selectedItemIds.length > 0
      ? menuItems.filter((i) => selectedItemIds.includes(i.id))
      : menuItems;

  const results: { employeeId: string; success: boolean; message: string; booking?: Booking }[] = [];

  for (const empId of employeeIds) {
    const emp = users.find((u) => u.id === empId && u.departmentId === departmentId);
    if (!emp) {
      results.push({ employeeId: empId, success: false, message: 'Nhân viên không thuộc phòng ban này' });
      continue;
    }

    // Check duplicate
    const existing = bookings.find(
      (b) =>
        b.userId === emp.id &&
        b.mealDate === mealDate &&
        b.shiftId === shiftId &&
        b.status !== 'CANCELLED'
    );

    if (existing) {
      results.push({
        employeeId: empId,
        success: false,
        message: `Đã có booking (${existing.bookingCode})`,
      });
      continue;
    }

    const newBooking: Booking = {
      id: generateId('bk'),
      bookingCode: `BK-DEPT-${Math.floor(1000 + Math.random() * 9000)}`,
      userId: emp.id,
      userName: emp.name,
      userEmployeeCode: emp.employeeCode,
      departmentId: emp.departmentId,
      departmentName: dept ? dept.name : 'Phòng ban',
      mealDate,
      shiftId,
      shiftName: shift ? shift.name : shiftId,
      menuId,
      selectedItemIds: chosenItems.map((i) => i.id),
      selectedItemNames: chosenItems.map((i) => i.name),
      status: 'CONFIRMED',
      isGuest: false,
      note: `Đặt hộ bởi Đại diện phòng ban: ${actor.name} (${chosenItems.length} món)`,
      priceSnapshot: menu ? menu.price : 45000,
      bookedAt: new Date().toISOString(),
      bookedByUserId: actor.id,
      bookedByName: actor.name,
    };

    bookings.unshift(newBooking);
    results.push({ employeeId: empId, success: true, message: 'Thành công', booking: newBooking });
  }

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: 'BOOKING_BULK_DEPARTMENT',
    resourceType: 'BOOKING',
    resourceId: departmentId,
    newValue: `Đặt hộ ${results.filter((r) => r.success).length}/${employeeIds.length} nhân viên phòng ${dept?.name}`,
    ipAddress: req.ip || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, {
    totalRequested: employeeIds.length,
    successCount: results.filter((r) => r.success).length,
    results,
  });
});

// 4.3 Guest Booking (HR/Admin or authorized Department Rep)
apiRouter.post('/bookings/guest', (req, res) => {
  const actor = getActorUser(req);
  const {
    guestName,
    guestCount,
    purpose,
    departmentId,
    mealDate,
    shiftId,
    menuId,
    note,
    selectedItemIds,
  } = req.body;

  if (!guestName || !guestCount || guestCount <= 0 || !mealDate || !shiftId || !menuId) {
    return sendError(res, 'VALIDATION_ERROR', 'Vui lòng cung cấp tên khách, số lượng khách, mục đích và ca ăn.');
  }

  const shift = shifts.find((s) => s.id === shiftId);
  const menu = menus.find((m) => m.id === menuId);
  const dept = departments.find((d) => d.id === (departmentId || actor.departmentId));

  const menuItems = menu?.items || [];
  const chosenItems =
    Array.isArray(selectedItemIds) && selectedItemIds.length > 0
      ? menuItems.filter((i) => selectedItemIds.includes(i.id))
      : menuItems;

  const newBooking: Booking = {
    id: generateId('bk_guest'),
    bookingCode: `BK-GST-${Math.floor(1000 + Math.random() * 9000)}`,
    userId: actor.id,
    userName: `Khách: ${guestName}`,
    userEmployeeCode: 'GUEST',
    departmentId: dept ? dept.id : actor.departmentId,
    departmentName: dept ? dept.name : 'Phòng ban',
    mealDate,
    shiftId,
    shiftName: shift ? shift.name : shiftId,
    menuId,
    selectedItemIds: chosenItems.map((i) => i.id),
    selectedItemNames: chosenItems.map((i) => i.name),
    status: 'CONFIRMED',
    isGuest: true,
    guestName,
    guestCount: Number(guestCount),
    purpose,
    note: note ? `${note} (${chosenItems.length} món)` : `Khách đặt ${chosenItems.length} món`,
    priceSnapshot: menu ? menu.price : 45000,
    bookedAt: new Date().toISOString(),
    bookedByUserId: actor.id,
    bookedByName: actor.name,
  };

  bookings.unshift(newBooking);

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: 'BOOKING_GUEST_CREATE',
    resourceType: 'BOOKING',
    resourceId: newBooking.id,
    newValue: `Đặt ${guestCount} suất khách [${guestName}] - Mục đích: ${purpose} (${chosenItems.length} món)`,
    ipAddress: req.ip || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, newBooking, {}, 201);
});

// 4.3b Weekly Meal Booking (Đặt cơm theo tuần: Thứ 2 đến Thứ 6)
apiRouter.post('/bookings/weekly', (req, res) => {
  const actor = getActorUser(req);
  const { weekDays } = req.body;

  if (!Array.isArray(weekDays) || weekDays.length === 0) {
    return sendError(res, 'VALIDATION_ERROR', 'Vui lòng chọn ít nhất 1 ngày trong tuần để đặt cơm.');
  }

  const results: { mealDate: string; success: boolean; message: string; booking?: Booking }[] = [];

  for (const day of weekDays) {
    const { mealDate, shiftId, menuId, selectedItemIds, note } = day;
    if (!mealDate || !shiftId) {
      results.push({ mealDate, success: false, message: 'Thiếu thông tin ngày hoặc ca ăn' });
      continue;
    }

    const shift = shifts.find((s) => s.id === shiftId) || shifts[0];
    // Chỉ đặt cơm dựa trên thực đơn thực sự đã công bố (PUBLISHED) cho đúng ngày + ca.
    // Không dùng menus[0] làm phương án dự phòng: nếu ngày/ca không có thực đơn thì phải
    // báo lỗi rõ ràng để khớp với giao diện đặt cơm (hiển thị "chưa có thực đơn").
    const explicitMenu = menuId
      ? menus.find((m) => m.id === menuId && m.date === mealDate && m.shiftId === shiftId && m.status === 'PUBLISHED')
      : undefined;
    const menu =
      explicitMenu ||
      menus.find((m) => m.date === mealDate && m.shiftId === shiftId && m.status === 'PUBLISHED');

    if (!menu) {
      results.push({
        mealDate,
        success: false,
        message: 'Ngày này chưa có thực đơn được công bố cho ca đã chọn nên chưa thể đặt cơm.',
      });
      continue;
    }

    const menuItems = menu?.items || [];
    const chosenItems =
      Array.isArray(selectedItemIds) && selectedItemIds.length > 0
        ? menuItems.filter((i) => selectedItemIds.includes(i.id))
        : menuItems;

    // Check existing booking
    const existing = bookings.find(
      (b) => b.userId === actor.id && b.mealDate === mealDate && b.shiftId === shiftId && b.status !== 'CANCELLED'
    );

    if (existing) {
      if (existing.status !== 'CHECKED_IN') {
        existing.menuId = menu.id;
        existing.selectedItemIds = chosenItems.map((i) => i.id);
        existing.selectedItemNames = chosenItems.map((i) => i.name);
        existing.note = note ? `[Đặt theo tuần] ${note}` : existing.note;
        results.push({
          mealDate,
          success: true,
          message: `Cập nhật thành công (${existing.bookingCode})`,
          booking: existing,
        });
      } else {
        results.push({
          mealDate,
          success: false,
          message: 'Suất ăn đã check-in không thể thay đổi',
          booking: existing,
        });
      }
      continue;
    }

    const userDept = departments.find((d) => d.id === actor.departmentId);
    const newBooking: Booking = {
      id: generateId('bk_wk'),
      bookingCode: `BK-WK-${Math.floor(1000 + Math.random() * 9000)}`,
      userId: actor.id,
      userName: actor.name,
      userEmployeeCode: actor.employeeCode,
      bookedByUserId: actor.id,
      bookedByName: actor.name,
      departmentId: actor.departmentId,
      departmentName: userDept ? userDept.name : 'Phòng ban NETCO',
      mealDate,
      shiftId: shift.id,
      shiftName: shift.name,
      menuId: menu.id,
      selectedItemIds: chosenItems.map((i) => i.id),
      selectedItemNames: chosenItems.map((i) => i.name),
      status: 'CONFIRMED',
      isGuest: false,
      note: note ? `[Đặt theo tuần] ${note}` : `[Đặt theo tuần] ${chosenItems.length} món tiêu chuẩn`,
      priceSnapshot: menu.price,
      bookedAt: new Date().toISOString(),
    };

    bookings.push(newBooking);
    results.push({
      mealDate,
      success: true,
      message: `Đặt thành công (${newBooking.bookingCode})`,
      booking: newBooking,
    });
  }

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    actorEmployeeCode: actor.employeeCode,
    actorRole: actor.role,
    action: 'WEEKLY_BOOKING_CREATE',
    resourceType: 'BOOKING',
    resourceId: `WEEKLY_${actor.id}`,
    newValue: `Đặt cơm theo tuần: ${results.filter((r) => r.success).length}/${weekDays.length} ngày thành công`,
    ipAddress: req.ip || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, {
    totalRequested: weekDays.length,
    successCount: results.filter((r) => r.success).length,
    results,
  });
});

// 4.4 Cancel Booking
apiRouter.delete('/bookings/:id', (req, res) => {
  const actor = getActorUser(req);
  const booking = bookings.find((b) => b.id === req.params.id);

  if (!booking) {
    return sendError(res, 'NOT_FOUND', 'Không tìm thấy booking tương ứng', {}, 404);
  }

  // Ownership check
  if (
    booking.userId !== actor.id &&
    booking.bookedByUserId !== actor.id &&
    actor.role !== 'Administrator' &&
    actor.role !== 'HR_GA'
  ) {
    return sendError(res, 'FORBIDDEN', 'Bạn không có quyền hủy suất ăn của người khác.', {}, 403);
  }

  // Cannot cancel if already checked-in
  if (booking.status === 'CHECKED_IN') {
    return sendError(res, 'ALREADY_CHECKED_IN', 'Không thể hủy suất ăn đã được quét mã Check-in tại căng tin.');
  }

  booking.status = 'CANCELLED';
  booking.cancelledAt = new Date().toISOString();

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: 'BOOKING_CANCEL',
    resourceType: 'BOOKING',
    resourceId: booking.id,
    newValue: `Hủy suất ăn [${booking.bookingCode}]`,
    ipAddress: req.ip || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, { success: true, booking });
});

// ==========================================
// 5. ATTENDANCE INTEGRATION & COMPARISON
// ==========================================

// LẤY dữ liệu chấm công hôm nay TỪ hệ thống chấm công ĐỘC LẬP BÊN NGOÀI.
// Endpoint này CHỈ ĐỌC (pull) số lượng + danh sách nhân viên đã chấm công từ hệ thống ngoài;
// KHÔNG tạo/ghi nhận bất kỳ lượt chấm công nào trong ứng dụng. Giữ nguyên path để tương thích frontend.
apiRouter.post('/attendance/sync', (req, res) => {
  const actor = getActorUser(req);
  if (!systemSettings.isAttendanceSyncEnabled) {
    return sendError(res, 'SYNC_DISABLED', 'Tính năng đối soát với hệ thống chấm công độc lập hiện đang tắt trong Cấu hình hệ thống.');
  }

  const todayStr = getTodayDateString();

  // Đọc dữ liệu chấm công hôm nay từ hệ thống bên ngoài (ở đây dùng mock attendanceRecords)
  const externalToday = attendanceRecords.filter((a) => a.date === todayStr);
  const totalFetched = externalToday.length || attendanceRecords.length;

  // Ghi lại kết quả lần LẤY dữ liệu (fetch run), không phải lượt chấm công mới
  const newSyncRun = {
    id: generateId('sync'),
    syncedAt: new Date().toISOString(),
    totalProcessed: totalFetched,
    matchedEmployees: totalFetched,
    discrepancyCount: 1, // Demo disparity
    status: 'SUCCESS' as const,
    triggeredBy: `${actor.name} (${actor.role})`,
    notes: 'Lấy số lượng & danh sách nhân viên chấm công hôm nay từ hệ thống chấm công độc lập bên ngoài thành công qua REST API.',
  };

  attendanceSyncRuns.unshift(newSyncRun);

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: 'ATTENDANCE_FETCH_EXTERNAL',
    resourceType: 'ATTENDANCE',
    resourceId: newSyncRun.id,
    newValue: `Lấy dữ liệu chấm công hôm nay từ hệ thống chấm công độc lập bên ngoài: ${newSyncRun.totalProcessed} nhân viên đã chấm công`,
    ipAddress: req.ip || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, newSyncRun);
});

// GET dữ liệu chấm công hôm nay từ hệ thống chấm công độc lập bên ngoài (chỉ đọc):
// trả về số lượng và danh sách nhân viên đã chấm công (mã, tên, phòng ban, giờ chấm công).
apiRouter.get('/attendance/external-today', (req, res) => {
  const targetDate = (req.query.date as string) || getTodayDateString();
  const externalToday = attendanceRecords.filter((a) => a.date === targetDate);

  return sendSuccess(res, {
    source: 'Hệ thống chấm công độc lập bên ngoài (external attendance API)',
    date: targetDate,
    totalCount: externalToday.length,
    employees: externalToday.map((a) => ({
      employeeCode: a.employeeCode,
      employeeName: a.employeeName,
      departmentName: a.departmentName,
      checkInTime: a.checkInTime,
    })),
  });
});

apiRouter.get('/attendance/comparison', (req, res) => {
  const targetDate = (req.query.date as string) || getTodayDateString();
  const targetShiftId = (req.query.shiftId as string) || 'shift_b';
  const shiftObj = shifts.find((s) => s.id === targetShiftId) || shifts[0];

  // Records for target date
  const attForDate = attendanceRecords.filter((a) => a.date === targetDate);
  const bookingsForDate = bookings.filter(
    (b) => b.mealDate === targetDate && b.shiftId === targetShiftId && b.status !== 'CANCELLED'
  );

  const checkedInCount = bookingsForDate.filter((b) => b.status === 'CHECKED_IN').length;
  const noShowCount = bookingsForDate.filter((b) => b.status === 'NO_SHOW').length;

  // 1. Unbooked Employees: Clocked in today BUT have no booking for this date & shift
  const unbookedEmployees: UnbookedEmployee[] = [];
  for (const att of attForDate) {
    const userObj = users.find(
      (u) => u.employeeCode === att.employeeCode || u.name === att.employeeName
    );
    const hasBooking = bookingsForDate.some(
      (b) => b.userEmployeeCode === att.employeeCode || (userObj && b.userId === userObj.id)
    );

    if (!hasBooking) {
      unbookedEmployees.push({
        employeeId: userObj?.id || att.employeeCode,
        employeeCode: att.employeeCode,
        name: att.employeeName,
        departmentId: userObj?.departmentId || '',
        departmentName: att.departmentName || userObj?.departmentName || 'Chưa phân bổ',
        checkInTime: att.checkInTime,
        machineId: att.machineId,
        status: 'ATTENDED_NO_BOOKING',
        phone: userObj?.phone,
        email: userObj?.email,
      });
    }
  }

  // 2. Unattended Bookings: Placed a booking BUT no clock-in recorded for today
  const unattendedBookings: UnattendedBooking[] = [];
  for (const b of bookingsForDate) {
    if (b.isGuest) continue; // Skip guests
    const hasClockIn = attForDate.some(
      (a) => a.employeeCode === b.userEmployeeCode || a.employeeName === b.userName
    );
    if (!hasClockIn) {
      unattendedBookings.push({
        bookingId: b.id,
        bookingCode: b.bookingCode,
        employeeCode: b.userEmployeeCode,
        name: b.userName,
        departmentId: b.departmentId,
        departmentName: b.departmentName,
        mealDate: b.mealDate,
        shiftName: b.shiftName,
        status: 'BOOKED_NO_ATTENDANCE',
      });
    }
  }

  // 3. Department Breakdown
  const departmentBreakdown: DepartmentAttendanceBreakdown[] = departments.map((dept) => {
    const deptUsers = users.filter((u) => u.departmentId === dept.id);
    const deptAttCount = attForDate.filter((a) => {
      const u = users.find((usr) => usr.employeeCode === a.employeeCode);
      return (u && u.departmentId === dept.id) || a.departmentName === dept.name;
    }).length;

    const deptBookedCount = bookingsForDate.filter((b) => b.departmentId === dept.id).length;
    const deptUnbookedCount = unbookedEmployees.filter(
      (ub) => ub.departmentId === dept.id || ub.departmentName === dept.name
    ).length;
    const deptUnattendedCount = unattendedBookings.filter(
      (ua) => ua.departmentId === dept.id || ua.departmentName === dept.name
    ).length;

    const complianceRate =
      deptAttCount > 0
        ? Math.round((Math.max(0, deptAttCount - deptUnbookedCount) / deptAttCount) * 100)
        : 100;

    return {
      departmentId: dept.id,
      departmentName: dept.name,
      totalEmployees: deptUsers.length,
      clockedInCount: deptAttCount,
      bookedCount: deptBookedCount,
      unbookedCount: deptUnbookedCount,
      unattendedCount: deptUnattendedCount,
      complianceRate,
    };
  });

  const comparison: AttendanceComparison = {
    date: targetDate,
    shiftId: targetShiftId,
    shiftName: shiftObj?.name || 'Ca B',
    totalAttendance: attForDate.length,
    totalBookings: bookingsForDate.length,
    totalCheckedIn: checkedInCount,
    noShowCount,
    unbookedAttendanceCount: unbookedEmployees.length,
    unattendedBookingCount: unattendedBookings.length,
    discrepancyRatio:
      bookingsForDate.length > 0
        ? Math.round(
            (Math.abs(attForDate.length - bookingsForDate.length) / bookingsForDate.length) * 100
          )
        : 0,
    unbookedEmployees,
    unattendedBookings,
    departmentBreakdown,
  };

  return sendSuccess(res, {
    comparison,
    syncRuns: attendanceSyncRuns,
    records: attForDate,
  });
});

// Send reminders to unbooked employees
apiRouter.post('/attendance/send-reminders', (req, res) => {
  const actor = getActorUser(req);
  const { employeeCodes } = req.body;
  const count = Array.isArray(employeeCodes) ? employeeCodes.length : 1;

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: 'ATTENDANCE_SEND_REMINDER',
    resourceType: 'ATTENDANCE',
    resourceId: 'reminders',
    newValue: `Gửi thông báo nhắc đặt cơm trưa cho ${count} nhân viên có mặt nhưng chưa đặt`,
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, {
    success: true,
    remindedCount: count,
    message: `Đã gửi thông báo nhắc nhở đặt cơm tới ${count} nhân viên thành công qua Zalo/Email NETCO.`,
  });
});

// GA Emergency bulk booking for unbooked employees
apiRouter.post('/attendance/emergency-book-bulk', (req, res) => {
  const actor = getActorUser(req);
  if (actor.role !== 'HR_GA' && actor.role !== 'Administrator') {
    return sendError(
      res,
      'FORBIDDEN',
      'Chỉ Hành chính GA hoặc Admin mới có quyền đặt cơm bổ sung khẩn cấp',
      {},
      403
    );
  }

  const { employeeCodes, mealDate, shiftId } = req.body;
  const targetDate = mealDate || getTodayDateString();
  const targetShiftId = shiftId || 'shift_b';
  const menu =
    menus.find((m) => m.date === targetDate && m.shiftId === targetShiftId) || menus[0];
  const shift = shifts.find((s) => s.id === targetShiftId);

  const createdBookings: Booking[] = [];

  if (Array.isArray(employeeCodes)) {
    for (const empCode of employeeCodes) {
      const userObj = users.find((u) => u.employeeCode === empCode);
      if (!userObj) continue;

      // check duplicate
      const exist = bookings.find(
        (b) =>
          b.userId === userObj.id &&
          b.mealDate === targetDate &&
          b.shiftId === targetShiftId &&
          b.status !== 'CANCELLED'
      );
      if (exist) continue;

      const newBooking: Booking = {
        id: generateId('bk_emg'),
        bookingCode: `BK-EMG-${Math.floor(1000 + Math.random() * 9000)}`,
        userId: userObj.id,
        userName: userObj.name,
        userEmployeeCode: userObj.employeeCode,
        departmentId: userObj.departmentId,
        departmentName:
          userObj.departmentName ||
          departments.find((d) => d.id === userObj.departmentId)?.name ||
          'Chưa phân bổ',
        mealDate: targetDate,
        shiftId: targetShiftId,
        shiftName: shift ? shift.name : targetShiftId,
        menuId: menu ? menu.id : 'menu_today_lunch',
        selectedItemIds: menu?.items.map((i) => i.id) || [],
        selectedItemNames: menu?.items.map((i) => i.name) || [],
        status: 'CONFIRMED',
        isGuest: false,
        note: `Hành chính GA đặt bổ sung khẩn cấp theo dữ liệu từ hệ thống chấm công độc lập bên ngoài`,
        priceSnapshot: menu ? menu.price : 45000,
        bookedAt: new Date().toISOString(),
        bookedByUserId: actor.id,
        bookedByName: actor.name,
      };

      bookings.unshift(newBooking);
      createdBookings.push(newBooking);
    }
  }

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: 'BOOKING_EMERGENCY_BULK',
    resourceType: 'BOOKING',
    resourceId: 'bulk_emergency',
    newValue: `Hành chính GA đặt bổ sung khẩn cấp ${createdBookings.length} suất ăn cho nhân viên có mặt`,
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, {
    createdCount: createdBookings.length,
    bookings: createdBookings,
    message: `Đã đặt bổ sung thành công ${createdBookings.length} suất ăn cho nhân viên có mặt chưa đặt. Bếp đã nhận được số lượng cập nhật.`,
  });
});

// ==========================================
// 6. INVENTORY MANAGEMENT
// ==========================================

apiRouter.get('/inventory', (req, res) => {
  return sendSuccess(res, inventoryItems);
});

apiRouter.get('/inventory/transactions', (req, res) => {
  return sendSuccess(res, inventoryTransactions);
});

apiRouter.post('/inventory/transactions', (req, res) => {
  const actor = getActorUser(req);
  const { inventoryItemId, type, quantity, reason } = req.body;

  if (!inventoryItemId || !type || quantity === undefined || !reason) {
    return sendError(res, 'VALIDATION_ERROR', 'Vui lòng cung cấp mặt hàng, loại giao dịch, số lượng và lý do bắt buộc.');
  }

  const item = inventoryItems.find((i) => i.id === inventoryItemId);
  if (!item) {
    return sendError(res, 'NOT_FOUND', 'Mặt hàng kho không tồn tại', {}, 404);
  }

  const numQty = Number(quantity);
  const newBalance = item.currentStock + numQty;

  if (newBalance < 0 && !systemSettings.allowNegativeInventory) {
    return sendError(
      res,
      'NEGATIVE_INVENTORY_NOT_ALLOWED',
      `Tồn kho không đủ để xuất (Hiện tồn: ${item.currentStock} ${item.unit}, Yêu cầu xuất: ${Math.abs(numQty)} ${item.unit}).`
    );
  }

  item.currentStock = newBalance;
  item.updatedAt = new Date().toISOString();
  if (item.currentStock <= item.minimumStock) {
    item.status = 'LOW';
  } else {
    item.status = 'OK';
  }

  const transaction = {
    id: generateId('inv_tx'),
    inventoryItemId: item.id,
    inventoryItemName: item.name,
    type: type as InventoryTransactionType,
    quantity: numQty,
    reason,
    performedByUserId: actor.id,
    performedByName: actor.name,
    createdAt: new Date().toISOString(),
    balanceAfter: newBalance,
  };

  inventoryTransactions.unshift(transaction);

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: `INVENTORY_${type}`,
    resourceType: 'INVENTORY',
    resourceId: item.id,
    newValue: `Giao dịch ${type}: ${numQty > 0 ? '+' : ''}${numQty} ${item.unit} (${item.name}). Tồn sau: ${newBalance}. Lý do: ${reason}`,
    ipAddress: req.ip || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, { item, transaction }, {}, 201);
});

// 6.2 Get Bill of Materials (BOM) Dish Ingredient Recipes
apiRouter.get('/inventory/recipes', (req, res) => {
  return sendSuccess(res, dishRecipes);
});

// 6.3 Inventory Requirement & Shortage/Surplus Analysis (BOM Forecasting Engine)
apiRouter.get('/inventory/analysis', (req, res) => {
  const { date, scope } = req.query;
  const targetDate = (date as string) || getTodayDateString();

  let relevantBookings: Booking[] = [];
  if (scope === 'week') {
    const curr = new Date(targetDate);
    const day = curr.getDay(); // 0 is Sun, 1 is Mon
    const diffToMonday = curr.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(curr.setDate(diffToMonday));
    const weekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekDates.push(d.toISOString().split('T')[0]);
    }
    relevantBookings = bookings.filter((b) => weekDates.includes(b.mealDate) && b.status !== 'CANCELLED');
  } else {
    relevantBookings = bookings.filter((b) => b.mealDate === targetDate && b.status !== 'CANCELLED');
  }

  // Aggregate dish portions
  const dishPortions: Record<string, { dishName: string; count: number }> = {};
  for (const b of relevantBookings) {
    const portions = b.isGuest ? b.guestCount || 1 : 1;
    let dishIds = b.selectedItemIds || [];
    if (dishIds.length === 0 && b.menuId) {
      const menu = menus.find((m) => m.id === b.menuId);
      if (menu) {
        dishIds = menu.items.map((i) => i.id);
      }
    }
    if (dishIds.length === 0) {
      dishIds = ['dish_1'];
    }

    for (const dId of dishIds) {
      const recipeDish = dishRecipes.find((r) => r.dishId === dId);
      const dishName = recipeDish ? recipeDish.dishName : masterDishes.find((m) => m.id === dId)?.name || dId;
      if (!dishPortions[dId]) {
        dishPortions[dId] = { dishName, count: 0 };
      }
      dishPortions[dId].count += portions;
    }
  }

  // Calculate required ingredients from BOM recipes
  const ingredientNeeds: Record<
    string,
    {
      requiredQty: number;
      affectedDishes: { dishName: string; portionCount: number }[];
    }
  > = {};

  for (const [dId, info] of Object.entries(dishPortions)) {
    const recipesForDish = dishRecipes.filter((r) => r.dishId === dId);
    for (const r of recipesForDish) {
      if (!ingredientNeeds[r.inventoryItemId]) {
        ingredientNeeds[r.inventoryItemId] = { requiredQty: 0, affectedDishes: [] };
      }
      ingredientNeeds[r.inventoryItemId].requiredQty += r.quantityPerPortion * info.count;
      ingredientNeeds[r.inventoryItemId].affectedDishes.push({
        dishName: info.dishName,
        portionCount: info.count,
      });
    }
  }

  // Build analysis for all inventory items
  const analysis: InventoryRequirementAnalysis[] = inventoryItems.map((item) => {
    const need = ingredientNeeds[item.id] || { requiredQty: 0, affectedDishes: [] };
    const requiredForBookings = Math.round(need.requiredQty * 100) / 100;
    const balanceStock = Math.round((item.currentStock - requiredForBookings) * 100) / 100;
    const isShortage = balanceStock < 0;
    const shortageQuantity = isShortage ? Math.abs(balanceStock) : 0;
    const estimatedPurchaseCost = Math.round(shortageQuantity * item.unitCost);

    let status: 'SUFFICIENT' | 'LOW' | 'CRITICAL_SHORTAGE' = 'SUFFICIENT';
    if (balanceStock < 0) {
      status = 'CRITICAL_SHORTAGE';
    } else if (balanceStock <= item.minimumStock) {
      status = 'LOW';
    }

    return {
      itemId: item.id,
      sku: item.sku,
      name: item.name,
      category: item.category,
      unit: item.unit,
      masanSupplier: item.masanSupplier || 'WINCOMMERCE',
      masanSupplierName: item.masanSupplierName || item.supplier,
      brand: item.brand || 'Masan Group',
      currentStock: item.currentStock,
      requiredForBookings,
      balanceStock,
      isShortage,
      shortageQuantity,
      unitCost: item.unitCost,
      estimatedPurchaseCost,
      status,
      affectedDishes: need.affectedDishes,
    };
  });

  const shortageItems = analysis.filter((a) => a.isShortage);
  const lowItems = analysis.filter((a) => a.status === 'LOW');
  const totalEstimatedCost = shortageItems.reduce((sum, a) => sum + a.estimatedPurchaseCost, 0);

  return sendSuccess(res, {
    targetDate,
    scope: scope || 'today',
    totalMealsBooked: relevantBookings.length,
    summary: {
      totalItems: analysis.length,
      shortageCount: shortageItems.length,
      lowStockCount: lowItems.length,
      sufficientCount: analysis.filter((a) => a.status === 'SUFFICIENT').length,
      totalEstimatedCost,
    },
    items: analysis,
    bySupplier: {
      MML: analysis.filter((a) => a.masanSupplier === 'MML'),
      CHIN_SU: analysis.filter((a) => a.masanSupplier === 'CHIN_SU'),
      WINECO: analysis.filter((a) => a.masanSupplier === 'WINECO'),
      WINCOMMERCE: analysis.filter((a) => a.masanSupplier === 'WINCOMMERCE'),
    },
  });
});

// 6.4 Auto-Generate Masan Purchase Orders from Deficit
apiRouter.post('/inventory/purchase-orders/auto-generate', (req, res) => {
  const actor = getActorUser(req);
  const { mealDate, scope, safetyBufferPercent = 20 } = req.body;
  const targetDate = mealDate || getTodayDateString();

  const relevantBookings =
    scope === 'week'
      ? bookings.filter((b) => b.status !== 'CANCELLED')
      : bookings.filter((b) => b.mealDate === targetDate && b.status !== 'CANCELLED');

  const dishPortions: Record<string, number> = {};
  for (const b of relevantBookings) {
    const portions = b.isGuest ? b.guestCount || 1 : 1;
    let dishIds = b.selectedItemIds || [];
    if (dishIds.length === 0 && b.menuId) {
      const menu = menus.find((m) => m.id === b.menuId);
      if (menu) dishIds = menu.items.map((i) => i.id);
    }
    if (dishIds.length === 0) dishIds = ['dish_1'];
    for (const dId of dishIds) {
      dishPortions[dId] = (dishPortions[dId] || 0) + portions;
    }
  }

  const ingredientNeeds: Record<string, number> = {};
  for (const [dId, count] of Object.entries(dishPortions)) {
    const recipesForDish = dishRecipes.filter((r) => r.dishId === dId);
    for (const r of recipesForDish) {
      ingredientNeeds[r.inventoryItemId] = (ingredientNeeds[r.inventoryItemId] || 0) + r.quantityPerPortion * count;
    }
  }

  const missingItemsBySupplier: Record<
    string,
    {
      inventoryItemId: string;
      name: string;
      unit: string;
      requiredQty: number;
      purchaseQty: number;
      unitPrice: number;
      subtotal: number;
    }[]
  > = {
    MML: [],
    CHIN_SU: [],
    WINECO: [],
    WINCOMMERCE: [],
  };

  const bufferMultiplier = 1 + Number(safetyBufferPercent || 0) / 100;

  for (const item of inventoryItems) {
    const reqQty = Math.round((ingredientNeeds[item.id] || 0) * 100) / 100;
    const balance = item.currentStock - reqQty;
    if (balance < 0 || item.currentStock <= item.minimumStock) {
      const neededRaw = balance < 0 ? Math.abs(balance) : Math.max(1, item.minimumStock - item.currentStock + 5);
      const purchaseQty = Math.ceil(neededRaw * bufferMultiplier);
      const subtotal = purchaseQty * item.unitCost;
      const supp = item.masanSupplier || 'WINCOMMERCE';
      if (missingItemsBySupplier[supp]) {
        missingItemsBySupplier[supp].push({
          inventoryItemId: item.id,
          name: item.name,
          unit: item.unit,
          requiredQty: reqQty,
          purchaseQty,
          unitPrice: item.unitCost,
          subtotal,
        });
      }
    }
  }

  const supplierNames: Record<string, string> = {
    MML: 'MML (Masan MEATLife - 100% Thịt & Trứng)',
    CHIN_SU: 'CHIN-SU / Masan Consumer (100% Gia Vị & Nước Tương)',
    WINECO: 'WinEco (100% Rau Củ Quả Nông Trường Masan)',
    WINCOMMERCE: 'WinCommerce (100% Gạo & Hàng Khô WinMart)',
  };

  const createdPOs: MasanPurchaseOrder[] = [];
  const dateCompact = targetDate.replace(/-/g, '');

  for (const [suppKey, items] of Object.entries(missingItemsBySupplier)) {
    if (items.length > 0) {
      const totalAmount = items.reduce((sum, it) => sum + it.subtotal, 0);
      const newPO: MasanPurchaseOrder = {
        id: generateId('po_masan'),
        poCode: `PO-${suppKey}-${dateCompact}-${Math.floor(10 + Math.random() * 90)}`,
        supplier: suppKey as any,
        supplierName: supplierNames[suppKey] || suppKey,
        items,
        totalAmount,
        createdAt: new Date().toISOString(),
        status: 'PENDING_GA_APPROVAL',
        notes: `Đề xuất mua bổ sung nguyên vật liệu tự động theo định mức suất ăn ngày ${targetDate} (Dự phòng an toàn: +${safetyBufferPercent}%)`,
        forMealDate: targetDate,
      };
      masanPurchaseOrders.unshift(newPO);
      createdPOs.push(newPO);
    }
  }

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    actorEmployeeCode: actor.employeeCode,
    actorRole: actor.role,
    action: 'MASAN_PO_AUTOGENERATED',
    resourceType: 'INVENTORY',
    resourceId: `PO_BATCH_${targetDate}`,
    newValue: `Tạo ${createdPOs.length} đơn đề xuất mua hàng Masan tự động (Tổng: ${createdPOs
      .reduce((s, p) => s + p.totalAmount, 0)
      .toLocaleString('vi-VN')} VND)`,
    ipAddress: req.ip || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, {
    createdCount: createdPOs.length,
    purchaseOrders: createdPOs,
    message:
      createdPOs.length > 0
        ? `Đã tự động lập ${createdPOs.length} phiếu đề xuất mua hàng Masan gửi ban Hành Chính GA phê duyệt!`
        : 'Tồn kho hiện tại đã đủ đáp ứng cho toàn bộ suất ăn đã đặt, không phát sinh thiếu hụt.',
  });
});

// 6.5 Get Masan Purchase Orders
apiRouter.get('/inventory/purchase-orders', (req, res) => {
  return sendSuccess(res, masanPurchaseOrders);
});

// 6.6 Update Purchase Order Status (Approval or Delivery)
apiRouter.patch('/inventory/purchase-orders/:id', (req, res) => {
  const actor = getActorUser(req);
  const { id } = req.params;
  const { status, notes } = req.body;

  const po = masanPurchaseOrders.find((p) => p.id === id);
  if (!po) {
    return sendError(res, 'NOT_FOUND', 'Không tìm thấy đơn mua hàng', {}, 404);
  }

  const oldStatus = po.status;
  if (status) po.status = status;
  if (notes) po.notes = notes;

  // When marked DELIVERED, automatically add goods into inventory!
  if (status === 'DELIVERED' && oldStatus !== 'DELIVERED') {
    for (const line of po.items) {
      const invItem = inventoryItems.find((i) => i.id === line.inventoryItemId);
      if (invItem) {
        invItem.currentStock += line.purchaseQty;
        invItem.updatedAt = new Date().toISOString();
        if (invItem.currentStock > invItem.minimumStock) {
          invItem.status = 'OK';
        }
        inventoryTransactions.unshift({
          id: generateId('inv_tx'),
          inventoryItemId: invItem.id,
          inventoryItemName: invItem.name,
          type: 'IN',
          quantity: line.purchaseQty,
          reason: `Nhập kho từ đơn hàng Masan [${po.poCode}] (${po.supplierName})`,
          performedByUserId: actor.id,
          performedByName: actor.name,
          createdAt: new Date().toISOString(),
          balanceAfter: invItem.currentStock,
        });
      }
    }
  }

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    actorEmployeeCode: actor.employeeCode,
    actorRole: actor.role,
    action: 'MASAN_PO_UPDATE',
    resourceType: 'INVENTORY',
    resourceId: po.id,
    newValue: `Cập nhật đơn hàng [${po.poCode}] thành [${status || oldStatus}]`,
    ipAddress: req.ip || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, po);
});

// ==========================================
// 7. QR CODE ENGINE & CHECK-IN
// ==========================================

// 7.1 Generate 60-second secure rotating QR token
apiRouter.post('/qr/token', (req, res) => {
  const actor = getActorUser(req);
  const { bookingId } = req.body;

  let targetBooking = bookings.find((b) => b.id === bookingId);
  if (!targetBooking) {
    // If not specified, find today's active booking for this user
    const todayStr = getTodayDateString();
    targetBooking = bookings.find(
      (b) => b.userId === actor.id && b.mealDate === todayStr && b.status === 'CONFIRMED'
    );
  }

  if (!targetBooking) {
    return sendError(res, 'NO_CONFIRMED_BOOKING', 'Bạn chưa có suất ăn nào đã xác nhận cho hôm nay.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + 60; // 60 seconds lifetime
  const jti = crypto.randomBytes(16).toString('hex');

  const payload: QRTokenPayload = {
    sub: targetBooking.userId,
    booking_id: targetBooking.id,
    meal_date: targetBooking.mealDate,
    shift_id: targetBooking.shiftId,
    jti,
    iat: nowSec,
    exp: expSec,
    employee_code: targetBooking.userEmployeeCode,
    display_name: targetBooking.userName,
  };

  // HMAC-SHA256 mock signature for tamper protection
  const signature = crypto
    .createHmac('sha256', 'SECRET_KIRO_ENTERPRISE_KEY_2026')
    .update(JSON.stringify(payload))
    .digest('hex')
    .substring(0, 16);

  const qrToken = `MEALQR.${Buffer.from(JSON.stringify(payload)).toString('base64')}.${signature}`;

  return sendSuccess(res, {
    qrToken,
    expiresIn: 60,
    expiresAt: expSec * 1000,
    payload,
    booking: targetBooking,
  });
});

// 7.2 QR Check-in Endpoint (Called by Canteen Scanner Tablet)
apiRouter.post('/qr/check-in', (req, res) => {
  const actor = getActorUser(req);
  const { qrToken } = req.body;

  if (!systemSettings.isQrCheckinEnabled) {
    return sendError(res, 'QR_CHECKIN_DISABLED', 'Tính năng quét QR Check-in hiện đang tạm tắt trong cấu hình.');
  }

  if (!qrToken || typeof qrToken !== 'string') {
    return sendError(res, 'INVALID_QR', 'Mã QR không hợp lệ hoặc không đúng định dạng');
  }

  const parts = qrToken.split('.');
  if (parts.length !== 3 || parts[0] !== 'MEALQR') {
    return sendError(res, 'MALFORMED_TOKEN', 'Mã QR không phải mã chuẩn của Hệ Thống Quản Lý Suất Ăn.');
  }

  let payload: QRTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
  } catch {
    return sendError(res, 'TOKEN_PARSE_ERROR', 'Không thể giải mã dữ liệu QR');
  }

  const nowSec = Math.floor(Date.now() / 1000);

  // 1. Expiration check
  if (payload.exp < nowSec) {
    return sendError(res, 'QR_EXPIRED', 'Mã QR đã hết hạn (chỉ có hiệu lực trong 60 giây). Vui lòng tải lại mã mới trên điện thoại.');
  }

  // 2. Replay protection via Nonce (jti)
  if (usedQrNonces.has(payload.jti)) {
    return sendError(res, 'QR_REPLAY_DETECTED', 'Cảnh báo: Mã QR này đã được sử dụng rồi (Chống tái sử dụng Nonce).');
  }

  // 3. Booking existence & status check
  const booking = bookings.find((b) => b.id === payload.booking_id);
  if (!booking) {
    return sendError(res, 'BOOKING_NOT_FOUND', 'Không tìm thấy thông tin đăng ký suất ăn tương ứng trong hệ thống.');
  }

  if (booking.status === 'CHECKED_IN') {
    return sendError(res, 'ALREADY_CHECKED_IN', `Suất ăn này đã được Check-in lúc ${booking.checkedInAt ? new Date(booking.checkedInAt).toLocaleTimeString('vi-VN') : 'trước đó'}.`);
  }

  if (booking.status === 'CANCELLED') {
    return sendError(res, 'BOOKING_CANCELLED', 'Suất ăn này đã bị hủy trước đó.');
  }

  // Mark Nonce as used
  usedQrNonces.add(payload.jti);

  // Update booking status
  booking.status = 'CHECKED_IN';
  booking.checkedInAt = new Date().toISOString();
  booking.checkedInBy = `${actor.name} (${actor.employeeCode})`;
  booking.qrNonceUsed = payload.jti;

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: 'QR_CHECKIN_SUCCESS',
    resourceType: 'BOOKING',
    resourceId: booking.id,
    newValue: `Check-in thành công nhân viên ${booking.userName} (${booking.userEmployeeCode}) cho ca ${booking.shiftName}`,
    ipAddress: req.ip || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Canteen Tablet Kiosk',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, {
    success: true,
    booking,
    message: 'Check-in thành công! Chúc bạn dùng bữa ngon miệng.',
    checkedInAt: booking.checkedInAt,
  });
});

// 7.4 IPC Screen Rotating QR Code (Displayed at Canteen IPC Screen)
apiRouter.get('/qr/ipc-current-token', (req, res) => {
  const todayStr = getTodayDateString();
  const activeShift = shifts.find((s) => s.isActive && s.id === 'shift_b') || shifts.find((s) => s.isActive) || shifts[0];
  
  const nowSec = Math.floor(Date.now() / 1000);
  const cycleSec = 30; // Rotate every 30 seconds
  const currentSlot = Math.floor(nowSec / cycleSec);
  const expSec = (currentSlot + 1) * cycleSec;
  const remainingSec = expSec - nowSec;

  const nonce = crypto.createHash('md5').update(`ipc_slot_${currentSlot}_${todayStr}`).digest('hex').substring(0, 12);
  const payloadData = {
    sys: 'NETCO_MEAL_IPC',
    canteen: systemSettings.canteenName,
    date: todayStr,
    shiftId: activeShift.id,
    shiftName: activeShift.name,
    slot: currentSlot,
    exp: expSec,
    nonce,
  };

  const signature = crypto
    .createHmac('sha256', 'SECRET_NETCO_IPC_KEY_2026')
    .update(JSON.stringify(payloadData))
    .digest('hex')
    .substring(0, 16);

  const ipcToken = `NETCO_IPC.${Buffer.from(JSON.stringify(payloadData)).toString('base64')}.${signature}`;

  // Metrics for canteen screen
  const todayBookings = bookings.filter((b) => b.mealDate === todayStr && b.status !== 'CANCELLED');
  const checkedInBookings = todayBookings.filter((b) => b.status === 'CHECKED_IN');

  const recentCheckins = checkedInBookings
    .slice()
    .sort((a, b) => (b.checkedInAt || '').localeCompare(a.checkedInAt || ''))
    .slice(0, 10)
    .map((b) => ({
      id: b.id,
      userName: b.userName,
      userEmployeeCode: b.userEmployeeCode,
      departmentName: b.departmentName,
      shiftName: b.shiftName,
      checkedInAt: b.checkedInAt,
      dishName: b.selectedItemNames?.[0] || 'Suất ăn tiêu chuẩn',
      avatarUrl: users.find((u) => u.id === b.userId)?.avatarUrl,
    }));

  return sendSuccess(res, {
    ipcToken,
    canteenName: systemSettings.canteenName,
    shift: activeShift,
    date: todayStr,
    expiresIn: remainingSec,
    expiresAt: expSec * 1000,
    serverTime: new Date().toISOString(),
    stats: {
      totalBooked: todayBookings.length,
      checkedInCount: checkedInBookings.length,
      remainingCount: Math.max(0, todayBookings.length - checkedInBookings.length),
    },
    recentCheckins,
  });
});

// 7.5 Employee Uses Phone to Scan IPC Screen QR (User self check-in)
apiRouter.post('/qr/user-scan-ipc', (req, res) => {
  const actor = getActorUser(req);
  const { ipcToken, targetUserId } = req.body;

  const targetUser = (targetUserId && users.find((u) => u.id === targetUserId)) || actor;

  if (!systemSettings.isQrCheckinEnabled) {
    return sendError(res, 'QR_CHECKIN_DISABLED', 'Tính năng quét QR Check-in hiện đang tạm tắt trong cấu hình.');
  }

  if (!ipcToken || typeof ipcToken !== 'string') {
    return sendError(res, 'INVALID_TOKEN', 'Không tìm thấy dữ liệu mã QR màn hình nhà ăn.');
  }

  // Parse IPC Token
  const parts = ipcToken.split('.');
  if (parts.length !== 3 || parts[0] !== 'NETCO_IPC') {
    return sendError(res, 'MALFORMED_IPC_TOKEN', 'Mã QR quét được không phải mã hợp lệ của Màn hình Nhà Ăn NETCO.');
  }

  let ipcPayload: {
    sys: string;
    canteen: string;
    date: string;
    shiftId: string;
    shiftName: string;
    slot: number;
    exp: number;
    nonce: string;
  };

  try {
    ipcPayload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
  } catch {
    return sendError(res, 'TOKEN_PARSE_ERROR', 'Không thể giải mã dữ liệu QR màn hình.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  // Allow grace period of 45 seconds for camera lag / network delay
  if (ipcPayload.exp + 45 < nowSec) {
    return sendError(res, 'IPC_QR_EXPIRED', 'Mã QR trên màn hình nhà ăn đã hết hiệu lực. Vui lòng quét lại mã mới đang hiển thị.');
  }

  const todayStr = getTodayDateString();

  // Find user's booking for today
  // Prioritize matching shift from IPC screen, then fallback to any confirmed booking of user today
  let userBooking = bookings.find(
    (b) =>
      b.userId === targetUser.id &&
      b.mealDate === todayStr &&
      b.shiftId === ipcPayload.shiftId &&
      b.status === 'CONFIRMED'
  );

  if (!userBooking) {
    userBooking = bookings.find(
      (b) => b.userId === targetUser.id && b.mealDate === todayStr && b.status === 'CONFIRMED'
    );
  }

  if (!userBooking) {
    // Check if already checked in
    const alreadyChecked = bookings.find(
      (b) => b.userId === targetUser.id && b.mealDate === todayStr && b.status === 'CHECKED_IN'
    );
    if (alreadyChecked) {
      return sendError(
        res,
        'ALREADY_CHECKED_IN',
        `Bạn đã nhận suất ăn hôm nay lúc ${
          alreadyChecked.checkedInAt ? new Date(alreadyChecked.checkedInAt).toLocaleTimeString('vi-VN') : 'trước đó'
        }. Mỗi nhân viên chỉ được nhận 1 suất/ca.`
      );
    }

    return sendError(
      res,
      'NO_BOOKING_FOUND',
      `Không tìm thấy đăng ký suất ăn nào của bạn (${targetUser.name} - ${targetUser.employeeCode}) cho ngày hôm nay. Vui lòng liên hệ Hành chính GA hoặc Bếp để được hỗ trợ suất phát sinh.`
    );
  }

  // Mark booking as checked in
  userBooking.status = 'CHECKED_IN';
  userBooking.checkedInAt = new Date().toISOString();
  userBooking.checkedInBy = `Tự quét mã IPC Nhà Ăn (${targetUser.name})`;
  userBooking.qrNonceUsed = ipcPayload.nonce;

  addAuditLog({
    actorUserId: targetUser.id,
    actorName: targetUser.name,
    actorEmployeeCode: targetUser.employeeCode,
    actorRole: targetUser.role,
    action: 'QR_IPC_USER_CHECKIN_SUCCESS',
    resourceType: 'BOOKING',
    resourceId: userBooking.id,
    newValue: `Nhân viên tự quét mã IPC thành công: ${userBooking.userName} (${userBooking.userEmployeeCode}) ca ${userBooking.shiftName}`,
    ipAddress: req.ip || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Mobile App',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, {
    success: true,
    booking: userBooking,
    user: targetUser,
    message: 'Xác nhận thành công! Chúc bạn dùng bữa trưa ngon miệng tại NETCO.',
    checkedInAt: userBooking.checkedInAt,
  });
});

// 7.3 Manual Check-in Fallback (with mandatory reason and audit log)
apiRouter.post('/qr/manual-check-in', (req, res) => {
  const actor = getActorUser(req);
  const { employeeCode, bookingCode, reason } = req.body;

  if (!reason || !reason.trim()) {
    return sendError(res, 'REASON_REQUIRED', 'Bắt buộc phải nhập lý do khi thực hiện Check-in thủ công.');
  }

  const todayStr = getTodayDateString();
  const booking = bookings.find((b) => {
    if (bookingCode) return b.bookingCode === bookingCode;
    if (employeeCode) return b.userEmployeeCode === employeeCode && b.mealDate === todayStr && b.status === 'CONFIRMED';
    return false;
  });

  if (!booking) {
    return sendError(res, 'BOOKING_NOT_FOUND', 'Không tìm thấy booking hợp lệ tương ứng với thông tin cung cấp.');
  }

  if (booking.status === 'CHECKED_IN') {
    return sendError(res, 'ALREADY_CHECKED_IN', 'Suất ăn đã được Check-in trước đó.');
  }

  booking.status = 'CHECKED_IN';
  booking.checkedInAt = new Date().toISOString();
  booking.checkedInBy = `Thủ công: ${actor.name} (Lý do: ${reason})`;

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: 'MANUAL_CHECKIN_OVERRIDE',
    resourceType: 'BOOKING',
    resourceId: booking.id,
    newValue: `Check-in thủ công cho [${booking.userName}] - Lý do: ${reason}`,
    ipAddress: req.ip || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Canteen Tablet Kiosk',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, {
    success: true,
    booking,
    message: 'Đã xác nhận Check-in thủ công thành công.',
  });
});

// ==========================================
// 8. REPORTS & DASHBOARD METRICS
// ==========================================

apiRouter.get('/reports/dashboard', (req, res) => {
  const todayStr = getTodayDateString();

  // 1. Kitchen metrics
  const todayBookings = bookings.filter((b) => b.mealDate === todayStr && b.status !== 'CANCELLED');
  const totalMealsToCook = todayBookings.length;
  const vegetarianMeals = todayBookings.filter((b) => b.selectedItemNames.some((n) => n.includes('Chay'))).length;
  const guestMeals = todayBookings.filter((b) => b.isGuest).reduce((acc, b) => acc + (b.guestCount || 1), 0);

  // Meals by shift
  const mealsByShift: Record<string, number> = {};
  for (const s of shifts) {
    mealsByShift[s.name] = todayBookings.filter((b) => b.shiftId === s.id).length;
  }

  // 2. HR & Admin financial metrics
  const totalCheckedIn = todayBookings.filter((b) => b.status === 'CHECKED_IN').length;
  const totalNoShow = todayBookings.filter((b) => b.status === 'NO_SHOW').length;
  const totalCostToday = todayBookings.reduce((sum, b) => sum + b.priceSnapshot * (b.guestCount || 1), 0);

  // Department cost breakdown
  const costByDept: { departmentName: string; count: number; totalCost: number }[] = [];
  for (const d of departments) {
    const deptBookings = todayBookings.filter((b) => b.departmentId === d.id);
    const count = deptBookings.reduce((acc, b) => acc + (b.guestCount || 1), 0);
    const totalCost = deptBookings.reduce((sum, b) => sum + b.priceSnapshot * (b.guestCount || 1), 0);
    costByDept.push({
      departmentName: d.name,
      count,
      totalCost,
    });
  }

  return sendSuccess(res, {
    date: todayStr,
    kitchen: {
      totalMealsToCook,
      vegetarianMeals,
      guestMeals,
      mealsByShift,
    },
    hr: {
      totalBookings: todayBookings.length,
      totalCheckedIn,
      totalNoShow,
      totalAttendance: attendanceRecords.filter((a) => a.date === todayStr).length,
      totalCostToday,
      costByDept,
      currency: 'VND',
    },
  });
});

// ==========================================
// 9. SYSTEM SETTINGS & AUDIT LOGS
// ==========================================

apiRouter.get('/settings', (req, res) => {
  return sendSuccess(res, systemSettings);
});

apiRouter.patch('/settings', (req, res) => {
  const actor = getActorUser(req);
  if (actor.role !== 'Administrator') {
    return sendError(res, 'FORBIDDEN', 'Chỉ Administrator mới có quyền sửa đổi Cấu hình hệ thống.', {}, 403);
  }

  const oldSettings = { ...systemSettings };
  Object.assign(systemSettings, req.body);

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    action: 'SETTINGS_UPDATE',
    resourceType: 'SYSTEM_SETTINGS',
    resourceId: 'CONFIG',
    oldValue: JSON.stringify(oldSettings),
    newValue: JSON.stringify(systemSettings),
    ipAddress: req.ip || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, systemSettings);
});

// 9.2 Toggle Feature Flags
apiRouter.patch('/settings/features', (req, res) => {
  const actor = getActorUser(req);
  const { featureFlags } = req.body;

  if (!featureFlags || typeof featureFlags !== 'object') {
    return sendError(res, 'VALIDATION_ERROR', 'Dữ liệu tính năng không hợp lệ.');
  }

  const oldFlags = { ...systemSettings.featureFlags };
  systemSettings.featureFlags = {
    ...systemSettings.featureFlags,
    ...featureFlags,
  };

  addAuditLog({
    actorUserId: actor.id,
    actorName: actor.name,
    actorEmployeeCode: actor.employeeCode,
    actorRole: actor.role,
    action: 'FEATURE_FLAGS_UPDATE',
    resourceType: 'SYSTEM_SETTINGS',
    resourceId: 'FEATURE_FLAGS',
    oldValue: JSON.stringify(oldFlags),
    newValue: JSON.stringify(systemSettings.featureFlags),
    ipAddress: req.ip || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    requestId: res.locals.requestId,
  });

  return sendSuccess(res, {
    message: 'Đã cập nhật cấu hình bật/tắt tính năng thành công.',
    featureFlags: systemSettings.featureFlags,
    settings: systemSettings,
  });
});

apiRouter.get('/audit-logs', (req, res) => {
  return sendSuccess(res, auditLogs);
});
