import { ApiResponse } from '../types';

export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
  currentUserId?: string
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (currentUserId) {
    headers.set('x-user-id', currentUserId);
  }

  const res = await fetch(`/api/v1${endpoint}`, {
    ...options,
    headers,
  });

  // Đọc body dưới dạng text trước để có thể xử lý trường hợp máy chủ trả về
  // HTML (ví dụ trang lỗi 404 "The page cannot be found") thay vì JSON API.
  const rawBody = await res.text();
  const contentType = res.headers.get('content-type') || '';
  const looksLikeJson = contentType.includes('application/json') || /^\s*[[{]/.test(rawBody);

  if (!looksLikeJson) {
    // Backend Express phục vụ /api/v1 không chạy hoặc host trả về trang HTML dự phòng.
    const statusInfo = res.status ? ` (HTTP ${res.status})` : '';
    throw new Error(
      `Không kết nối được máy chủ API NETCO Meal (/api/v1)${statusInfo}. ` +
        'Máy chủ backend có thể chưa chạy. ' +
        'Vui lòng chạy ứng dụng kèm server (npm run dev hoặc npm run start).'
    );
  }

  let json: ApiResponse<T>;
  try {
    json = JSON.parse(rawBody) as ApiResponse<T>;
  } catch {
    const statusInfo = res.status ? ` (HTTP ${res.status})` : '';
    throw new Error(
      `Máy chủ API NETCO Meal (/api/v1) trả về dữ liệu không hợp lệ${statusInfo}. ` +
        'Vui lòng kiểm tra máy chủ backend (npm run dev hoặc npm run start).'
    );
  }

  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Lỗi máy chủ (${res.status})`);
  }

  return json.data as T;
}

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}
