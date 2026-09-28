# Performance mode — ký tên lên màn LED sân khấu

Chạy song song với whiteboard, không đụng tới bảng vẽ chung. Khán giả quét QR →
ký tên trên điện thoại → chữ ký xuất hiện trên màn LED.

Spec là nguồn sự thật. Đổi format → sửa file này trước, code sau.

## 1. Ba giao diện

| Vai trò  | Route                       | Ai dùng      | Quyền                                   |
|----------|-----------------------------|--------------|-----------------------------------------|
| `admin`  | `/perf/:eventId/setup`      | Kỹ thuật     | Sửa config, duyệt/ẩn/xoá chữ ký, upload |
| `show`   | `/perf/:eventId/show`       | Máy xuất LED | Chỉ đọc                                 |
| `signer` | `/s/:eventId` (link QR ngắn) | Khán giả     | Gửi chữ ký                              |

Quyền admin = `adminKey` (sinh lúc tạo sự kiện, 24 ký tự). Client lưu ở
`localStorage['perf_key_<eventId>']`; mở setup trên máy khác bằng
`/perf/:eventId/setup?key=<adminKey>` (client lưu key rồi xoá khỏi URL).

## 2. Kiến trúc

```
server/src/perf/configSchema.js   schema + defaults + sanitizeConfig   (pure, test)
server/src/perf/signature.js      validateSignature                     (pure, test)
server/src/perf/mediaStore.js     lưu/stream file nền (Range)
server/src/db/perf.js             bảng perf_events, perf_signatures
server/src/socket/perfHandlers.js giao thức socket (mục 4)
server/src/routes/perf.js         REST (mục 5)

client/src/performance/           core pure: codec, layout, scene, zip, geometry (test)
client/src/performance/render/    canvas: vẽ chữ ký, sprite cache, snapshot
client/src/store/performanceStore.js
client/src/components/Performance/{ShowStage,SignaturePad,SetupPanel,QrCode}
client/src/pages/performance/{PerfSetupPage,PerfShowPage,PerfSignPage}.jsx
```

**WYSIWYG**: bảng ký, màn show, preview trong setup và ảnh PNG xuất ra đều vẽ
bằng MỘT hàm `drawSignature()` với cùng style lấy từ config.

**Render loop** (show + preview): `requestAnimationFrame` đọc
`usePerformanceStore.getState()`, không re-render React mỗi frame. Mỗi chữ ký
được vẽ sẵn thành sprite (pre-compute, tối đa `SPRITE_RENDER_PER_FRAME` sprite
mỗi frame); frame chỉ `drawImage`. Riêng chữ ký đang chạy hiệu ứng "viết" thì
vẽ trực tiếp theo tiến độ.

## 3. Dữ liệu

### 3.1 Chữ ký (wire + DB)

```jsonc
{
  "id": "V1StGXR8_Z12",            // server sinh
  "cid": "k3Jd9...",               // client sinh, /^[A-Za-z0-9_-]{8,32}$/ — gửi lại (retry) không tạo bản trùng
  "name": "Nguyễn Văn A",          // ≤ 40 ký tự, bỏ ký tự điều khiển, có thể ""
  "color": "#ff3366" | null,       // màu người ký chọn; chỉ dùng khi ink.mode = "signer"
  "aspect": 2,                     // rộng/cao của bảng ký lúc ký
  "strokes": [[x, y, t, x, y, t, ...], ...],
  "status": "visible" | "pending" | "hidden",
  "createdAt": 1727500000000       // ms
}
```

- `x ∈ [0,1]` theo **chiều rộng** bảng ký, `y ∈ [0,1]` theo **chiều cao**,
  làm tròn 4 chữ số thập phân. `t` = ms nguyên kể từ điểm đầu tiên của chữ ký
  (dùng cho hiệu ứng "viết" — giữ nhịp tay thật, kể cả lúc nhấc bút).
- Toạ độ vẽ ("pad units"): `(x·aspect, y)` — cao bảng ký = 1.
- Client đơn giản hoá nét bằng Ramer–Douglas–Peucker (`SIMPLIFY_EPSILON`) trước khi gửi.
- Server giới hạn: ≤ 120 nét, 1..6000 điểm tổng, `t ≤ 600000`; x,y lệch nhẹ ngoài
  [0,1] bị kẹp lại; khác → từ chối. Cooldown 1.5s / socket, ≤ 5000 chữ ký / sự kiện.
- Độ dày nét KHÔNG nằm trong dữ liệu: là `config.ink.width` (theo cao bảng ký),
  nên kỹ thuật đổi được sau khi đã ký.

### 3.2 Config sự kiện

Nguồn sự thật: `server/src/perf/configSchema.js`. Mỗi lá có mô tả
`{t, def, min, max, options, maxLen}`; server gửi schema cho admin lúc join, UI
setup dựng slider/select từ đó — không lặp lại min/max ở client.

Nhóm chính:

| Nhóm        | Nội dung |
|-------------|----------|
| `output`    | `frameW, frameH` (khung xuất, mặc định 1920×1080, `lock169`), vùng LED `x, y, w, h` nằm trong khung |
| `showBg`, `signBg` | `type: color/image/video`, `color`, `url`, `fit: cover/contain/stretch`, `dim` (lớp tối 0..0.9) |
| `ink`       | `mode: solid/gradient/rainbow/signer`, `color, color2, width, glow, glowColor` |
| `name`      | `show, font, style: plain/gradient/outline/shadow/neon, color, color2, size` |
| `layout`    | `mode: grid/float`, `maxVisible, gap, padding, floatSize, floatSpeed` |
| `effect`    | `entrance: draw/fade/zoom/fly`, `entranceMs`, `spotlight, spotlightMs, spotlightScale` |
| `qr`        | `show, corner, size, caption` (QR trên màn show) |
| `sign`      | text trang ký, `nameField: off/optional/required`, `allowAgain`, `padColor, padOpacity`, `signerColors` |
| `moderation`| `requireApproval` — chữ ký mới ở trạng thái `pending` tới khi admin duyệt |
| `publicBaseUrl` | gốc URL cho QR (vd `http://192.168.1.150:5173`); rỗng = origin trang setup |

Mọi kích thước hiển thị là **tỉ lệ** (theo cao vùng LED hoặc cao bảng ký),
không phải px — đổi độ phân giải LED không phải chỉnh lại style.

`sanitizeConfig(input, base)`: lá hợp lệ lấy từ input, sai/thiếu lấy từ base
(= config hiện tại, hoặc defaults). Key lạ bị bỏ. Config cũ trong DB luôn được
sanitize lúc đọc → thêm field mới không cần migration (forward-compatible).

## 4. Socket.IO

Tất cả sự kiện có ack; client dùng `socket.timeout(ms)` + retry có giới hạn.

| Hướng | Event | Payload | Ack / ghi chú |
|---|---|---|---|
| C→S | `perf:join` | `{eventId, role, adminKey?}` | `{ok, event, config, isAdmin, schema?, signatures?}` — `signatures` cho admin/show, `schema` cho admin. Lỗi: `not_found`, `bad_key` |
| C→S | `perf:sign` | chữ ký (không có id/status/createdAt) | `{ok, id, status}` / `{ok:false, error}` |
| C→S | `perf:config` | `{config}` (admin) | `{ok, config}` (đã sanitize) |
| C→S | `perf:sig:status` | `{id, status}` (admin) | `{ok}` |
| C→S | `perf:sig:delete` | `{id}` (admin) | `{ok}` |
| C→S | `perf:sig:clear` | `{}` (admin) | `{ok, count}` |
| S→C | `perf:config` | `{config}` | tới viewers + signers, trừ socket gửi |
| S→C | `perf:sig:add` | chữ ký đủ trường | tới viewers (admin + show) |
| S→C | `perf:sig:update` | `{id, status}` | tới viewers |
| S→C | `perf:sig:delete` | `{id}` | tới viewers |
| S→C | `perf:sig:clear` | `{}` | tới viewers |

Room: `perf:<id>:viewers` (admin, show), `perf:<id>:signers`. Reconnect →
client join lại và nhận TOÀN BỘ state (config + chữ ký) — màn show mất mạng
giữa chừng tự hồi phục.

Màn show coi chữ ký là "mới" (chạy hiệu ứng vào + spotlight) khi nó chuyển sang
`visible` SAU lần join đầu: gửi mới, hoặc admin vừa duyệt.

## 5. REST

| Method | Path | Ghi chú |
|---|---|---|
| POST | `/api/perf/events` `{name}` | → `{event, adminKey}` |
| GET  | `/api/perf/events/:id` | → `{event}` / 404 |
| POST | `/api/perf/events/:id/media` | header `x-perf-key`; body = file thô, `Content-Type` = mime. ≤ 300MB. Nhận png/jpeg/webp/gif, mp4/webm/quicktime → `{url, kind}` |
| GET  | `/api/perf/media/:eventId/:file` | hỗ trợ `Range` (Safari bắt buộc cho video) |
| GET  | `/api/perf/lan` | IPv4 LAN của máy chủ — gợi ý `publicBaseUrl` cho QR |

`url` lưu trong config là đường dẫn tương đối `/api/perf/media/...`; client ghép
`SERVER_URL`. File lưu ở `PERF_MEDIA_DIR` (mặc định `server/uploads/perf`).

## 6. Hiển thị

- **Khung xuất** `frameW×frameH` (16:9) co vừa cửa sổ; ngoài vùng LED là đen.
  Card đồ hoạ xuất 1920×1080 cho bộ xử lý LED nhưng tấm LED chỉ chiếm một phần
  → đặt `x,y,w,h` đúng vùng đó.
- **grid**: chia lưới sao cho ô lớn nhất với tỉ lệ trung bình chữ ký; cũ trước,
  mới sau. **float**: mỗi chữ ký trôi với vận tốc ngẫu nhiên (seed theo id), dội
  mép vùng, nhấp nhô nhẹ. Chỉ hiện `maxVisible` chữ ký `visible` mới nhất.
- Vị trí mọi chữ ký được làm mượt về đích (exp smoothing) → đổi mode / thêm chữ
  ký làm lưới dồn lại đều chuyển động mượt, không nhảy.
- **spotlight**: chữ ký mới hiện to giữa vùng (`spotlightScale` × cao vùng) trong
  `spotlightMs`, rồi bay về chỗ. Hàng đợi dài (>3) → mỗi cái còn một nửa thời gian
  (tối thiểu 1.5s).

## 7. Lưu ảnh

- PNG từng chữ ký (nền trong suốt, style hiện tại, cao `EXPORT_HEIGHT_PX`).
- ZIP tất cả (ZIP STORE, CRC-32, tên file UTF-8 — `performance/zipStore.js`).
- Chụp màn show: nền (màu/ảnh/frame video hiện tại) + chữ ký + QR, đúng kích
  thước vùng LED.
