# Performance mode — hướng dẫn vận hành & trạng thái

Spec kỹ thuật: [SPEC.md](SPEC.md).

## Vận hành trong sự kiện

1. Trang chủ → **🎤 Performance — ký tên lên LED**. Mở lại sự kiện gần nhất
   của máy này, chưa có thì tạo mới. Tạo thêm: nút **+ Sự kiện mới** trong setup.
2. Tab **Màn hình**:
   - Chọn khung xuất (card đồ hoạ ra bộ xử lý LED, mặc định 1920×1080).
   - Nhập **vùng LED** (x, y, rộng, cao) = phần khung thực sự hiện trên tấm
     LED. Preview viền vàng đúng vùng đó.
   - Nền màn show: màu / ảnh / video (upload ≤ 300MB, hoặc URL).
3. Khung **Link ký tên**: chọn **Gốc link** = IP LAN của máy chủ (không để
   localhost — trang sẽ cảnh báo đỏ). QR trên preview và màn show đổi theo.
4. **▶ Mở màn Show** → kéo cửa sổ sang màn LED → bấm nút / phím **F** để toàn
   màn hình. Con trỏ tự ẩn. Chấm đỏ góc phải-trên = mất kết nối server (tự nối lại).
5. Chỉnh style/hiệu ứng trong lúc diễn: mọi thay đổi hiện ngay trên màn show.
6. Tab **Quản lý**: duyệt / ẩn / xoá chữ ký, tải PNG từng cái, **ZIP tất cả**,
   **📸 Chụp màn show** (PNG đúng độ phân giải vùng LED).

Mở setup trên máy khác: **🔑 Link quản trị** (chứa khoá — ai có link đều sửa được).

Nên bật **Duyệt trước khi hiện** (tab Trang ký) khi khán giả đông/lạ.

## Các phase

| Phase | Nội dung | Done | Kiểm chứng |
|---|---|---|---|
| 1 | Server: schema/sanitize config, validate chữ ký, DB, socket, REST media | ✅ | `server: npm test` (3 file); e2e socket 27/27 với server + Postgres thật |
| 2 | Core client pure: codec nét (RDP), bố cục, lưới, trôi, hiệu ứng, cảnh, ZIP | ✅ | `client: npm test` (perf-core, perf-zip, perf-store); ZIP mở bằng Python `zipfile` |
| 3 | Renderer canvas dùng chung + 3 trang (setup / show / ký) | ✅ | Chrome headless: ký trên viewport điện thoại → hiện trên show; grid/float; đổi style trực tiếp; vùng LED lệch; nền ảnh; chụp 1920×1080; ZIP 13 PNG |
| 4 | Thử trên thiết bị thật | ⏳ | Xem checklist dưới |

### Checklist thiết bị thật (chưa làm)

- [ ] iPhone Safari + Android Chrome: ký bằng ngón tay, trang không cuộn khi ký, gửi qua Wi-Fi sự kiện.
- [ ] Màn LED thật qua bộ xử lý: vùng LED khớp pixel (dùng x/y/rộng/cao), không bị scale mờ.
- [ ] Video nền 1080p chạy lặp mượt trên máy xuất cùng lúc 200+ chữ ký trôi (xem FPS trong DevTools → Rendering).
- [ ] 50 người ký cùng lúc: hàng đợi spotlight rút ngắn, không mất chữ ký.
- [ ] Rút dây mạng máy show 30s rồi cắm lại → tự nối lại, đủ chữ ký.
- [ ] Bản portable (LAN không internet): font tên rơi về font hệ thống, QR vẫn hiện.

## Giới hạn đã biết

- Cooldown gửi (1.5s) tính theo socket — tải lại trang là gửi tiếp được. Chặn spam thật thì bật duyệt.
- Font tên là Google Fonts: không có internet thì dùng font dự phòng.
- Cache config trong `perfHandlers.js` là theo process — chạy nhiều instance server sau Redis adapter thì phải bỏ cache.
- Nền từ URL ngoài không bật CORS thì **Chụp màn show** báo lỗi (canvas bị khoá) — upload nền lên server để chụp được.
