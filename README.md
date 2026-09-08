# NETCO Meal

Hệ thống quản lý suất ăn doanh nghiệp NETCO. Frontend dùng React 19 + Vite 6 + Tailwind v4, backend là Express 4 (mock API) gắn tại đường dẫn `/api/v1`.

## Kiến trúc & lưu ý quan trọng

Frontend gọi API qua đường dẫn tương đối `/api/v1`, và các đường dẫn này được phục vụ bởi **cùng một máy chủ Express** (xem `server.ts` + `server/api.ts`).

> ⚠️ Nếu bạn chỉ mở các file tĩnh đã build (thư mục `dist/`) mà **không** chạy máy chủ Express, thì mọi lời gọi API như đăng nhập (`/api/v1/auth/login`) sẽ không tới được backend. Khi đó máy chủ tĩnh thường trả về một trang HTML (ví dụ "The page cannot be found") thay vì JSON, và ứng dụng sẽ báo lỗi không kết nối được máy chủ API. Hãy luôn chạy ứng dụng kèm máy chủ Express như hướng dẫn bên dưới.

## Yêu cầu môi trường

- Node.js (khuyến nghị bản LTS mới) hoặc [Bun](https://bun.sh/) (repo có sẵn `bun.lock`).
- Cài đặt phụ thuộc trước khi chạy:

```bash
npm install
# hoặc
bun install
```

## Chạy ở chế độ phát triển (Development)

```bash
npm run dev
```

- Lệnh này chạy `tsx server.ts`, khởi động Express **và** gắn Vite ở chế độ middleware trên **cổng 3000**.
- Truy cập ứng dụng tại `http://localhost:3000`.
- Backend API và frontend cùng chạy trên một cổng nên các lời gọi `/api/v1/*` (đăng nhập, đặt cơm, v.v.) hoạt động ngay.

## Chạy ở chế độ sản xuất (Production)

```bash
npm run build   # build frontend (Vite) và đóng gói server thành dist/server.cjs
npm run start   # node dist/server.cjs — phục vụ dist/ tĩnh + API Express
```

- `npm run start` phục vụ các file đã build trong `dist/` đồng thời gắn cùng bộ API Express tại `/api/v1`.

## Thông tin đăng nhập demo

- **Quản trị viên:** tên đăng nhập `admin` / mật khẩu `admin`.
- **Người dùng khác:** đăng nhập bằng **email** hoặc **mã nhân viên** kèm mật khẩu `123456`. Ví dụ:
  - Hành chính GA: `ga@netcovn.com.vn` hoặc `GA001`
  - Nhân viên: `tuan.hm@netcovn.com.vn` hoặc `EMP001`

## Kiểm tra kiểu (Typecheck)

```bash
npm run lint   # tsc --noEmit
```
