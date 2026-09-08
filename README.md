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

## Triển khai trên Vercel

Trên Vercel, `server.ts` **không** được chạy (Vercel chỉ phục vụ bản build tĩnh của Vite trong thư mục `dist/`). Vì vậy API được đóng gói lại dưới dạng **Serverless Function**:

- API chạy dưới dạng Serverless Function tại `api/index.ts`. File này tạo một app Express tối giản và gắn lại **chính** `apiRouter` từ `server/api.ts` (không nhân bản logic route) tại base `/api/v1`. Default export là một handler `(req, res) => app(req, res)` (không export thẳng app Express) để tương thích rộng nhất với runtime `@vercel/node`, kèm middleware bắt lỗi trả JSON để tránh lỗi 500 mờ mịt.
- `api/tsconfig.json` cấu hình riêng cho function (`module: CommonJS`, `moduleResolution: Node`, `esModuleInterop`) để Vercel biên dịch function sạch sẽ, không kế thừa các thiết lập chỉ dành cho Vite ở tsconfig gốc (`allowImportingTsExtensions`, `noEmit`, `moduleResolution: bundler`) vốn có thể khiến function lỗi lúc chạy.
- `vercel.json` cấu hình `rewrites`: mọi lời gọi `/api/v1/*` được chuyển tới function `api/index`; các đường dẫn còn lại (không thuộc `api/`) fallback về `index.html` để React SPA (định tuyến phía client, refresh trang) hoạt động.
- Frontend được build bằng Vite (`vite build`) và phục vụ tĩnh từ `dist/`.

> ⚠️ **Cảnh báo quan trọng về dữ liệu:** dữ liệu hiện được lưu **in-memory** trong `server/db.ts`. Trên Vercel serverless, mỗi lần gọi có thể chạy ở một instance khác nhau, nên dữ liệu **KHÔNG bền vững giữa các request**. Đăng nhập vẫn hoạt động vì seed users được nạp lại mỗi lần function khởi tạo, nhưng dữ liệu đặt cơm / tạo mới sẽ **mất** khi function cold-start hoặc scale. Để chạy thật (production), cần thay kho in-memory bằng một cơ sở dữ liệu thực.

Lưu ý: script `npm run build` trong `package.json` vẫn giữ nguyên (build frontend + đóng gói `server.ts` bằng esbuild) để phục vụ chạy standalone/local (`npm run start`) và các nền tảng khác. Vercel chỉ dùng `buildCommand` là `vite build` khai báo trong `vercel.json`.

## Thông tin đăng nhập demo

- **Quản trị viên:** tên đăng nhập `admin` / mật khẩu `admin`.
- **Người dùng khác:** đăng nhập bằng **email** hoặc **mã nhân viên** kèm mật khẩu `123456`. Ví dụ:
  - Hành chính GA: `ga@netcovn.com.vn` hoặc `GA001`
  - Nhân viên: `tuan.hm@netcovn.com.vn` hoặc `EMP001`

## Kiểm tra kiểu (Typecheck)

```bash
npm run lint   # tsc --noEmit
```
