import { TodayAttendanceSummary } from '../src/types';

const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 60_000;
const MAX_RESPONSE_BYTES = 1_000_000;

export type AttendanceClientErrorCode =
  | 'ATTENDANCE_NOT_CONFIGURED'
  | 'ATTENDANCE_TIMEOUT'
  | 'ATTENDANCE_UNAVAILABLE'
  | 'ATTENDANCE_INVALID_RESPONSE';

export class AttendanceClientError extends Error {
  constructor(
    public readonly code: AttendanceClientErrorCode,
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'AttendanceClientError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getTimeoutMs(): number {
  const configured = Number(process.env.ATTENDANCE_API_TIMEOUT_MS);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.min(Math.floor(configured), MAX_TIMEOUT_MS);
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function getVietnamToday(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function mapSummary(input: unknown): TodayAttendanceSummary {
  if (!isRecord(input)) {
    throw new AttendanceClientError(
      'ATTENDANCE_INVALID_RESPONSE',
      'Hệ thống chấm công trả về dữ liệu không hợp lệ.',
      502
    );
  }

  const payload = 'data' in input ? input.data : input;
  if (!isRecord(payload)) {
    throw new AttendanceClientError(
      'ATTENDANCE_INVALID_RESPONSE',
      'Hệ thống chấm công trả về envelope data không hợp lệ.',
      502
    );
  }

  const { date, total, employees } = payload;
  if (typeof date !== 'string' || !isValidDate(date)) {
    throw new AttendanceClientError(
      'ATTENDANCE_INVALID_RESPONSE',
      'Ngày chấm công phải có định dạng YYYY-MM-DD hợp lệ.',
      502
    );
  }
  if (date !== getVietnamToday()) {
    throw new AttendanceClientError(
      'ATTENDANCE_INVALID_RESPONSE',
      'Hệ thống chấm công không trả về dữ liệu của ngày hôm nay.',
      502
    );
  }
  if (!Number.isSafeInteger(total) || (total as number) < 0) {
    throw new AttendanceClientError(
      'ATTENDANCE_INVALID_RESPONSE',
      'Tổng số chấm công phải là số nguyên không âm.',
      502
    );
  }
  if (!Array.isArray(employees)) {
    throw new AttendanceClientError(
      'ATTENDANCE_INVALID_RESPONSE',
      'Danh sách nhân viên chấm công không hợp lệ.',
      502
    );
  }

  const mappedEmployees = employees.map((employee, index) => {
    if (!isRecord(employee)) {
      throw new AttendanceClientError(
        'ATTENDANCE_INVALID_RESPONSE',
        `Nhân viên tại vị trí ${index + 1} không hợp lệ.`,
        502
      );
    }

    const name = typeof employee.name === 'string' ? employee.name.trim() : '';
    if (!name || name.length > 200) {
      throw new AttendanceClientError(
        'ATTENDANCE_INVALID_RESPONSE',
        `Tên nhân viên tại vị trí ${index + 1} không hợp lệ.`,
        502
      );
    }

    const rawEmployeeCode = employee.employeeCode;
    if (rawEmployeeCode !== undefined && rawEmployeeCode !== null) {
      if (typeof rawEmployeeCode !== 'string' || !rawEmployeeCode.trim() || rawEmployeeCode.trim().length > 100) {
        throw new AttendanceClientError(
          'ATTENDANCE_INVALID_RESPONSE',
          `Mã nhân viên tại vị trí ${index + 1} không hợp lệ.`,
          502
        );
      }

      return { employeeCode: rawEmployeeCode.trim(), name };
    }

    return { name };
  });

  if (total !== mappedEmployees.length) {
    throw new AttendanceClientError(
      'ATTENDANCE_INVALID_RESPONSE',
      'Tổng số chấm công không khớp với danh sách nhân viên.',
      502
    );
  }

  return {
    date,
    total: total as number,
    employees: mappedEmployees,
    fetchedAt: new Date().toISOString(),
  };
}

async function readBoundedResponse(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new AttendanceClientError(
      'ATTENDANCE_INVALID_RESPONSE',
      'Phản hồi từ hệ thống chấm công vượt quá giới hạn cho phép.',
      502
    );
  }
  if (!response.body) {
    throw new AttendanceClientError(
      'ATTENDANCE_INVALID_RESPONSE',
      'Phản hồi từ hệ thống chấm công không có nội dung.',
      502
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let responseText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    receivedBytes += value.byteLength;
    if (receivedBytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new AttendanceClientError(
        'ATTENDANCE_INVALID_RESPONSE',
        'Phản hồi từ hệ thống chấm công vượt quá giới hạn cho phép.',
        502
      );
    }
    responseText += decoder.decode(value, { stream: true });
  }

  responseText += decoder.decode();
  if (!responseText.trim()) {
    throw new AttendanceClientError(
      'ATTENDANCE_INVALID_RESPONSE',
      'Phản hồi từ hệ thống chấm công không có nội dung.',
      502
    );
  }

  return responseText;
}

export async function fetchTodayAttendance(): Promise<TodayAttendanceSummary> {
  const apiUrl = process.env.ATTENDANCE_API_URL?.trim();
  if (!apiUrl) {
    throw new AttendanceClientError(
      'ATTENDANCE_NOT_CONFIGURED',
      'Chưa cấu hình kết nối tới hệ thống chấm công độc lập.',
      503
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(apiUrl);
  } catch {
    throw new AttendanceClientError(
      'ATTENDANCE_NOT_CONFIGURED',
      'ATTENDANCE_API_URL không hợp lệ.',
      503
    );
  }

  const token = process.env.ATTENDANCE_API_TOKEN?.trim();
  const isLocalDevelopmentUrl =
    process.env.NODE_ENV !== 'production' &&
    parsedUrl.protocol === 'http:' &&
    (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1');
  if (parsedUrl.protocol !== 'https:' && !isLocalDevelopmentUrl) {
    throw new AttendanceClientError(
      'ATTENDANCE_NOT_CONFIGURED',
      'ATTENDANCE_API_URL phải sử dụng HTTPS (chỉ cho phép HTTP localhost khi phát triển).',
      503
    );
  }
  if (token && parsedUrl.protocol !== 'https:') {
    throw new AttendanceClientError(
      'ATTENDANCE_NOT_CONFIGURED',
      'ATTENDANCE_API_URL phải sử dụng HTTPS khi cấu hình ATTENDANCE_API_TOKEN.',
      503
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(parsedUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
      redirect: 'error',
    });

    if (!response.ok) {
      throw new AttendanceClientError(
        'ATTENDANCE_UNAVAILABLE',
        'Không thể lấy dữ liệu từ hệ thống chấm công độc lập.',
        502
      );
    }

    const responseText = await readBoundedResponse(response);

    let responseBody: unknown;
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      throw new AttendanceClientError(
        'ATTENDANCE_INVALID_RESPONSE',
        'Hệ thống chấm công không trả về JSON hợp lệ.',
        502
      );
    }

    return mapSummary(responseBody);
  } catch (error: unknown) {
    if (error instanceof AttendanceClientError) throw error;
    if (controller.signal.aborted) {
      throw new AttendanceClientError(
        'ATTENDANCE_TIMEOUT',
        'Hệ thống chấm công phản hồi quá thời gian cho phép.',
        504
      );
    }

    throw new AttendanceClientError(
      'ATTENDANCE_UNAVAILABLE',
      'Không thể kết nối tới hệ thống chấm công độc lập.',
      502
    );
  } finally {
    clearTimeout(timeout);
  }
}
