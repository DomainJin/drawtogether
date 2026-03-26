# 🎨 Whiteboard – Real-time Collaborative Drawing

Ứng dụng vẽ cộng tác real-time. Nhiều người cùng truy cập một link và vẽ cùng nhau.

## Stack

- **Frontend**: React 18 + Canvas API + Socket.IO client + Zustand
- **Backend**: Node.js + Fastify + Socket.IO + Redis Adapter
- **Database**: PostgreSQL (lưu lịch sử) + Redis (pub/sub + session)
- **Proxy**: Nginx (WebSocket support)

---

## Chạy local (dev)

### 1. Cài đặt PostgreSQL + Redis

```bash
# macOS
brew install postgresql redis
brew services start postgresql redis

# Ubuntu
sudo apt install postgresql redis-server -y
sudo systemctl start postgresql redis
```

### 2. Tạo database

```bash
psql -U postgres -c "CREATE USER whiteboard WITH PASSWORD 'whiteboard';"
psql -U postgres -c "CREATE DATABASE whiteboard OWNER whiteboard;"
```

### 3. Chạy backend

```bash
cd server
cp .env.example .env      # chỉnh nếu cần
npm install
npm run dev               # chạy trên port 3001
```

### 4. Chạy frontend

```bash
cd client
cp .env.example .env
npm install
npm run dev               # chạy trên port 5173
```

Mở http://localhost:5173 → nhập tên → tạo phòng → copy link gửi bạn bè.

---

## Deploy với Docker (production)

### Yêu cầu
- VPS/server có Docker + Docker Compose
- Domain trỏ về IP server (nếu muốn HTTPS)

### Bước 1 – Clone và cấu hình

```bash
git clone <your-repo> whiteboard
cd whiteboard
cp .env.example .env
```

Chỉnh file `.env`:
```env
CLIENT_URL=https://yourdomain.com          # hoặc http://IP_SERVER
JWT_SECRET=<random 64 ký tự>               # bắt buộc đổi!
```

Tạo JWT secret ngẫu nhiên:
```bash
openssl rand -base64 48
```

### Bước 2 – Build và chạy

```bash
docker compose up -d --build
```

Kiểm tra:
```bash
docker compose ps          # tất cả services phải Up
docker compose logs -f     # xem log real-time
curl http://localhost/health
```

### Bước 3 – Cài HTTPS với Let's Encrypt (tuỳ chọn)

```bash
# Cài certbot
sudo apt install certbot -y

# Lấy cert (tạm dừng nginx trước)
docker compose stop nginx
sudo certbot certonly --standalone -d yourdomain.com

# Copy cert vào thư mục nginx
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/certs/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/certs/

# Bỏ comment phần HTTPS trong nginx/nginx.conf
# Sau đó:
docker compose up -d nginx
```

Auto-renew cert:
```bash
# Thêm vào crontab
0 3 * * * certbot renew --quiet && docker compose restart nginx
```

---

## Cấu trúc project

```
whiteboard/
├── server/
│   └── src/
│       ├── index.js              # Entry point
│       ├── db/index.js           # PostgreSQL queries + migration
│       ├── routes/rooms.js       # HTTP API: auth, tạo/kiểm tra phòng
│       └── socket/handlers.js    # WebSocket events (vẽ, cursor, undo...)
├── client/
│   └── src/
│       ├── store/index.js        # Zustand global state
│       ├── hooks/useSocket.js    # Socket.IO connection + canvas renderer
│       ├── components/
│       │   ├── WhiteboardCanvas  # Canvas drawing logic
│       │   ├── Toolbar           # Công cụ vẽ
│       │   ├── CursorOverlay     # Hiển thị cursor người khác
│       │   └── UserList          # Danh sách người online
│       └── pages/
│           ├── HomePage          # Tạo/join phòng
│           └── WhiteboardPage    # Màn hình vẽ
├── nginx/nginx.conf              # Reverse proxy + WebSocket
└── docker-compose.yml
```

---

## Các lệnh hữu ích

```bash
# Xem log từng service
docker compose logs server -f
docker compose logs nginx -f

# Restart một service
docker compose restart server

# Backup database
docker compose exec postgres pg_dump -U whiteboard whiteboard > backup.sql

# Restore database
cat backup.sql | docker compose exec -T postgres psql -U whiteboard whiteboard

# Scale server (nhiều instance, Redis Adapter lo sync)
docker compose up -d --scale server=3
```

---

## WebSocket events

| Event | Chiều | Mô tả |
|-------|-------|-------|
| `room:join` | Client → Server | Vào phòng, nhận lịch sử |
| `draw:stroke` | Client ↔ Server | Gửi/nhận nét vẽ hoàn chỉnh |
| `draw:preview` | Client ↔ Server | Preview real-time đang vẽ |
| `cursor:move` | Client ↔ Server | Vị trí chuột |
| `draw:undo` | Client ↔ Server | Undo nét cuối của mình |
| `board:clear` | Client ↔ Server | Xóa toàn bộ bảng |
| `user:joined` | Server → Client | Có người vào phòng |
| `user:left` | Server → Client | Có người rời phòng |

---

## Troubleshooting

**WebSocket không kết nối được**
- Kiểm tra nginx có `proxy_set_header Upgrade $http_upgrade` chưa
- Kiểm tra firewall mở port 80/443

**Nhiều người không thấy nhau khi scale**
- Đảm bảo `REDIS_URL` đúng và Redis đang chạy
- Redis Adapter cần cùng Redis instance

**Canvas bị trắng khi vào phòng**
- Kiểm tra `room:join` callback có `strokes` không
- Kiểm tra log server có lỗi DB không
