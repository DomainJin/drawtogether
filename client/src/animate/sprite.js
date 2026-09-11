/** Sprite bay lượn trên lớp animation — vật lý và vẽ, không biết gì về React
 *  hay socket. Tách khỏi AnimateOverlay để component chỉ còn lo UI và luồng
 *  chụp vùng chọn.
 *
 *  Ảnh vào theo một trong hai đường: `svgString` (AI vẽ lại) hoặc `imageUrl`
 *  (PNG data URL — ảnh raw cắt từ canvas). Cả hai đều là chuỗi gửi được qua
 *  socket, nên máy khác dựng lại được đúng sprite đó; ImageData thì không.
 */
export class Sprite {
  constructor({ id, svgString, imageUrl, x, y, w, h, behavior, label }) {
    this.id = id
    this.label = label
    this.behavior = behavior
    this.w = w; this.h = h
    this.x = x; this.y = y

    // Vận tốc ban đầu random — đủ mạnh để di chuyển rõ
    const speed = behavior === 'drive' || behavior === 'swim' ? 2.5
                : behavior === 'fly' ? 2
                : behavior === 'bounce' ? 3.5 : 2
    const angle = Math.random() * Math.PI * 2
    this.vx = Math.cos(angle) * speed
    this.vy = Math.sin(angle) * speed

    this.angle = 0          // rotation hiển thị
    this.wobble = Math.random() * Math.PI * 2
    this.wobbleAmp = 0

    this.img = new Image()
    this.ready = false

    if (svgString) {
      // SVG → blob URL, thu hồi ngay sau khi decode xong để khỏi rò bộ nhớ.
      const blob = new Blob([svgString], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      this.img.onload = () => { this.ready = true; URL.revokeObjectURL(url) }
      this.img.src = url
    } else if (imageUrl) {
      this.img.onload = () => { this.ready = true }
      this.img.src = imageUrl
    }
  }

  update(W, H) {
    this.wobble += 0.06

    switch (this.behavior) {

      case 'swim': {
        this.wobbleAmp = 0.12
        this.x += this.vx
        this.y += this.vy * 0.4
        // Thỉnh thoảng đổi hướng y
        if (Math.random() < 0.008) this.vy = (Math.random() - 0.5) * 2
        this._bounceWalls(W, H)
        this.angle = Math.sin(this.wobble) * this.wobbleAmp
        break
      }

      case 'drive': {
        this.wobbleAmp = 0.03
        // Xe chỉ di chuyển ngang, lăn bánh nhẹ
        this.x += this.vx
        // Thỉnh thoảng nhảy lên nhỏ
        if (Math.random() < 0.005) this.vy = -2
        this.vy += 0.1 // gravity nhẹ
        this.y += this.vy
        if (this.y + this.h > H) { this.y = H - this.h; this.vy = 0 }
        if (this.y < 0) { this.y = 0; this.vy = Math.abs(this.vy) * 0.5 }
        if (this.x < 0) { this.x = 0; this.vx = Math.abs(this.vx); }
        if (this.x + this.w > W) { this.x = W - this.w; this.vx = -Math.abs(this.vx) }
        this.angle = Math.sin(this.wobble * 0.5) * this.wobbleAmp
        break
      }

      case 'fly': {
        this.wobbleAmp = 0.15
        this.x += this.vx
        this.y += this.vy
        // Random turbulence
        this.vx += (Math.random() - 0.5) * 0.15
        this.vy += (Math.random() - 0.5) * 0.15
        // Clamp speed
        const spd = Math.sqrt(this.vx*this.vx + this.vy*this.vy)
        if (spd > 3.5) { this.vx = this.vx/spd*3.5; this.vy = this.vy/spd*3.5 }
        if (spd < 1)   { this.vx *= 1.5; this.vy *= 1.5 }
        this._bounceWalls(W, H)
        this.angle = Math.sin(this.wobble) * this.wobbleAmp
        break
      }

      case 'bounce': {
        // Full gravity + bounce
        this.vy += 0.25
        this.x += this.vx
        this.y += this.vy
        this.angle = this.vx * 0.04
        if (this.x < 0) { this.x = 0; this.vx = Math.abs(this.vx) * 0.85 }
        if (this.x + this.w > W) { this.x = W - this.w; this.vx = -Math.abs(this.vx) * 0.85 }
        if (this.y + this.h > H) {
          this.y = H - this.h
          this.vy = -Math.abs(this.vy) * 0.75
          this.vx += (Math.random() - 0.5) * 1.5
        }
        if (this.y < 0) { this.y = 0; this.vy = Math.abs(this.vy) * 0.75 }
        break
      }

      case 'fall': {
        this.vy += 0.08
        this.x += Math.sin(this.wobble * 0.5) * 0.6 + this.vx * 0.2
        this.y += this.vy
        this.angle += 0.015
        if (this.y > H + this.h) {
          this.y = -this.h
          this.x = Math.random() * W
          this.vy = 0.5 + Math.random() * 1.5
        }
        break
      }

      case 'walk': {
        // Bước đi, nảy lên xuống nhịp nhàng
        this.x += this.vx
        this.y += H * 0.85 - this.h + Math.sin(this.wobble * 2) * 8 - this.y
        this.y = H * 0.85 - this.h + Math.sin(this.wobble * 2) * 8
        if (this.x < 0) { this.x = 0; this.vx = Math.abs(this.vx) }
        if (this.x + this.w > W) { this.x = W - this.w; this.vx = -Math.abs(this.vx) }
        this.angle = Math.sin(this.wobble) * 0.06
        break
      }

      case 'float': {
        // Trôi lơ lửng chậm rãi
        this.x += Math.sin(this.wobble * 0.4) * 0.5 + this.vx * 0.15
        this.y += Math.cos(this.wobble * 0.3) * 0.4 + this.vy * 0.1
        this.angle = Math.sin(this.wobble * 0.5) * 0.08
        // Wrap quanh màn hình
        if (this.x < -this.w) this.x = W
        if (this.x > W) this.x = -this.w
        if (this.y < -this.h) this.y = H
        if (this.y > H) this.y = -this.h
        break
      }

      case 'spin': {
        // Bay vòng tròn + xoay bản thân
        const cx = W / 2, cy = H / 2
        const orbitR = Math.min(W, H) * 0.3
        this.spinAngle = (this.spinAngle || Math.atan2(this.y - cy, this.x - cx)) + 0.02
        this.x = cx + Math.cos(this.spinAngle) * orbitR - this.w / 2
        this.y = cy + Math.sin(this.spinAngle) * orbitR - this.h / 2
        this.angle += 0.04
        break
      }

      default: // 'roam' — di chuyển tự do random
      {
        this.x += this.vx
        this.y += this.vy
        this.vx += (Math.random() - 0.5) * 0.12
        this.vy += (Math.random() - 0.5) * 0.12
        const spd = Math.sqrt(this.vx*this.vx + this.vy*this.vy)
        if (spd > 3) { this.vx = this.vx/spd*3; this.vy = this.vy/spd*3 }
        if (spd < 0.8) { this.vx *= 1.3; this.vy *= 1.3 }
        this._bounceWalls(W, H)
        this.angle = Math.sin(this.wobble * 0.7) * 0.08
        break
      }
    }
  }

  _bounceWalls(W, H) {
    if (this.x < 0) { this.x = 0; this.vx = Math.abs(this.vx) }
    if (this.x + this.w > W) { this.x = W - this.w; this.vx = -Math.abs(this.vx) }
    if (this.y < 0) { this.y = 0; this.vy = Math.abs(this.vy) }
    if (this.y + this.h > H) { this.y = H - this.h; this.vy = -Math.abs(this.vy) }
  }

  draw(ctx) {
    if (!this.ready) return
    ctx.save()
    const cx = this.x + this.w / 2
    const cy = this.y + this.h / 2
    ctx.translate(cx, cy)
    ctx.rotate(this.angle)
    // Lật theo hướng đi
    if (this.vx < -0.1) ctx.scale(-1, 1)
    ctx.drawImage(this.img, -this.w / 2, -this.h / 2, this.w, this.h)
    ctx.restore()
  }
}
