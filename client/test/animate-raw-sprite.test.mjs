/** Sprite raw (nút AI tắt): vùng canvas cắt ra có thật sự thành hình vẽ bay
 *  lượn, hay chỉ là một tấm thẻ trắng?
 *
 *  Mắt nhìn màn hình rất dễ bỏ qua chỗ này: sprite trắng trên nền trắng trông
 *  y như "không có gì hiện ra", còn lề trắng thừa thì chỉ thấy sprite va tường
 *  hơi sớm. Nên kiểm bằng số, trên frame nhân tạo có toạ độ mực biết trước:
 *   1. Nền trắng bị bóc hết, mực giữ nguyên, mép xám mờ dần (không răng cưa).
 *   2. Khung cắt bám sát mực đúng bằng TRIM_PADDING_PX, không hơn.
 *   3. Nét mờ (opacity thấp) không bị bóc nhầm thành nền.
 *   4. Vùng trắng trơn trả null — không sinh sprite rỗng, không xoá oan canvas.
 *   5. Cỡ sprite trên màn hình luôn nằm giữa hai chặn, kể cả zoom sâu.
 */
import { ANIMATE_CONFIG as CFG } from '../src/animate/config.js'
import {
  lumaOverWhite, alphaForLuma, stripBackground, inkBounds, cropPixels,
  extractRawTexture, textureScale,
} from '../src/animate/rawSprite.js'
import { computeSpriteBox } from '../src/animate/layout.js'
import { getBehavior, pickRawBehavior } from '../src/animate/behavior.js'

let fails = 0
const t = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
  if (!cond) fails++
}

/** Frame nhân tạo: canvas trắng đục, vẽ một hình chữ nhật mực đen. */
function whiteFrame(w, h) {
  const data = new Uint8ClampedArray(w * h * 4).fill(255)
  return { data, width: w, height: h }
}
function paint(img, x, y, w, h, [r, g, b, a = 255]) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const i = (yy * img.width + xx) * 4
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = a
    }
  }
}
const alphaAt = (img, x, y) => img.data[(y * img.width + x) * 4 + 3]

// ── 1. Bóc nền ───────────────────────────────────────────────────────────────
{
  const img = whiteFrame(40, 30)
  paint(img, 10, 8, 12, 9, [0, 0, 0])          // mực đen đặc
  paint(img, 10, 17, 12, 1, [220, 220, 220])   // mép xám (khử răng cưa)

  const s = stripBackground(img)
  t('nền trắng → alpha 0', alphaAt(s, 0, 0) === 0, `alpha=${alphaAt(s, 0, 0)}`)
  t('mực đen → alpha 255', alphaAt(s, 12, 10) === 255, `alpha=${alphaAt(s, 12, 10)}`)

  const edge = alphaAt(s, 12, 17)
  t('mép xám → alpha trung gian', edge > 0 && edge < 255, `alpha=${edge}`)
  t('mực giữ nguyên màu',
    s.data[(10 * s.width + 12) * 4] === 0 && s.data[(10 * s.width + 12) * 4 + 1] === 0)
  t('đếm đúng số pixel còn mực', s.inkPixels === 12 * 9 + 12, `ink=${s.inkPixels}`)
  t('không sửa ảnh gốc', img.data[0] === 255 && img.data[3] === 255)
}

// ── 2. Ngưỡng alpha khớp config ──────────────────────────────────────────────
{
  t('luma ngưỡng: đúng INK_LUMA vẫn đặc', alphaForLuma(CFG.INK_LUMA) === 255)
  t('luma ngưỡng: đúng BG_LUMA đã trong suốt', alphaForLuma(CFG.BG_LUMA) === 0)
  const mid = alphaForLuma((CFG.INK_LUMA + CFG.BG_LUMA) / 2)
  t('giữa hai ngưỡng ≈ nửa alpha', Math.abs(mid - 128) <= 2, `alpha=${mid}`)
  t('pixel trong suốt tính như nền trắng', lumaOverWhite(0, 0, 0, 0) === 255)
  t('pixel đen đục → luma 0', lumaOverWhite(0, 0, 0, 255) === 0)
}

// ── 3. Cắt sát mực ───────────────────────────────────────────────────────────
{
  const img = whiteFrame(100, 80)
  const INK = { x: 30, y: 20, w: 15, h: 10 }
  paint(img, INK.x, INK.y, INK.w, INK.h, [10, 10, 10])

  const pad = CFG.TRIM_PADDING_PX
  const box = inkBounds(stripBackground(img), pad)
  t('hộp mực đúng vị trí', box.x === INK.x - pad && box.y === INK.y - pad,
    `box=(${box.x},${box.y})`)
  t('hộp mực đúng kích thước', box.w === INK.w + 2 * pad && box.h === INK.h + 2 * pad,
    `${box.w}x${box.h}`)

  const tex = extractRawTexture(img)
  t('texture nhỏ hơn hẳn khung chọn', tex.width < img.width / 2 && tex.height < img.height / 2,
    `${tex.width}x${tex.height} từ ${img.width}x${img.height}`)
  t('texture giữ đúng tỉ lệ hình', tex.width === INK.w + 2 * pad && tex.height === INK.h + 2 * pad)
  t('mọi hàng/cột mép texture vẫn trong ảnh', tex.box.x >= 0 && tex.box.y >= 0)

  // Mực nằm đúng chỗ sau khi cắt, không bị lệch một hàng.
  t('mực nằm giữa texture', alphaAt(tex, pad, pad) === 255 && alphaAt(tex, 0, 0) === 0)

  // Hộp mực sát mép ảnh thì padding bị cắt bớt chứ không tràn ra ngoài.
  const edgeImg = whiteFrame(20, 20)
  paint(edgeImg, 0, 0, 4, 4, [0, 0, 0])
  const eb = inkBounds(stripBackground(edgeImg), pad)
  t('mực sát mép: hộp không âm', eb.x === 0 && eb.y === 0 && eb.w === 4 + pad && eb.h === 4 + pad,
    `${eb.x},${eb.y},${eb.w}x${eb.h}`)
}

// ── 4. Nét mờ và vùng trắng trơn ─────────────────────────────────────────────
{
  const faint = whiteFrame(30, 30)
  paint(faint, 5, 5, 10, 10, [0, 0, 0, 128]) // nét vẽ opacity 0.5
  const ft = extractRawTexture(faint)
  t('nét mờ không bị bóc mất', ft !== null)
  const a = alphaAt(ft, CFG.TRIM_PADDING_PX, CFG.TRIM_PADDING_PX)
  t('nét mờ giữ được độ mờ', a > 0 && a < 255, `alpha=${a}`)

  t('vùng trắng trơn → null', extractRawTexture(whiteFrame(50, 50)) === null)

  // Một chấm bụi lẻ dưới ngưỡng MIN_INK_RATIO cũng coi như chọn hụt.
  const dust = whiteFrame(100, 100)
  paint(dust, 50, 50, 1, 1, [0, 0, 0])
  const ratio = 1 / (100 * 100)
  t('ngưỡng bụi khớp config', ratio < CFG.MIN_INK_RATIO)
  t('một chấm bụi → null', extractRawTexture(dust) === null)
}

// ── 5. Thu nhỏ texture trước khi gửi qua socket ──────────────────────────────
{
  const max = CFG.MAX_TEXTURE_PX
  t('texture nhỏ không bị phóng to', textureScale(60, 40) === 1)
  t('texture đúng trần giữ nguyên', textureScale(max, max) === 1)
  const k = textureScale(max * 4, max * 2)
  t('cạnh dài quá trần bị thu', Math.round(max * 4 * k) === max, `k=${k.toFixed(3)}`)
  t('thu nhỏ giữ tỉ lệ', Math.abs((max * 4 * k) / (max * 2 * k) - 2) < 1e-9)
}

// ── 6. Cỡ sprite trên màn hình ───────────────────────────────────────────────
{
  const VP = { viewportW: 1200, viewportH: 800 }
  const capPx = Math.min(VP.viewportW, VP.viewportH) * CFG.MAX_SPRITE_VIEWPORT_RATIO

  const tiny = computeSpriteBox({ cropW: 20, cropH: 10, zoom: 0.29, ...VP })
  t('hình nhỏ được phóng tới MIN_SPRITE_PX',
    Math.abs(Math.min(tiny.w, tiny.h) - CFG.MIN_SPRITE_PX) < 1e-6,
    `${tiny.w.toFixed(1)}x${tiny.h.toFixed(1)}`)
  t('phóng to vẫn giữ tỉ lệ', Math.abs(tiny.w / tiny.h - 2) < 1e-9)

  const huge = computeSpriteBox({ cropW: 900, cropH: 600, zoom: 4, ...VP })
  t('hình lớn bị chặn trong khung nhìn',
    Math.max(huge.w, huge.h) <= capPx + 1e-6,
    `${huge.w.toFixed(1)}x${huge.h.toFixed(1)} cap=${capPx}`)
  t('chặn trên giữ tỉ lệ', Math.abs(huge.w / huge.h - 1.5) < 1e-9)
  t('sprite nằm giữa khung nhìn',
    Math.abs(huge.x + huge.w / 2 - VP.viewportW / 2) < 1e-6 &&
    Math.abs(huge.y + huge.h / 2 - VP.viewportH / 2) < 1e-6)
  t('sprite lớn vẫn lọt màn hình', huge.x >= 0 && huge.y >= 0)

  const mid = computeSpriteBox({ cropW: 200, cropH: 150, zoom: 1, ...VP })
  t('cỡ vừa giữ nguyên cỡ thật', Math.abs(mid.w - 200) < 1e-6 && Math.abs(mid.h - 150) < 1e-6)
}

// ── 7. Hành vi khi không có nhãn AI ──────────────────────────────────────────
{
  const list = CFG.RAW_BEHAVIORS
  t('sprite raw chỉ bay lượn, không rơi/đi bộ',
    list.every(b => ['fly', 'float', 'roam'].includes(b)), list.join(','))
  t('rand=0 → phần tử đầu', pickRawBehavior(() => 0) === list[0])
  t('rand≈1 không tràn mảng', list.includes(pickRawBehavior(() => 0.999999)))
  t('mọi giá trị rand đều ra hành vi hợp lệ',
    [0, 0.25, 0.5, 0.75, 1].every(v => list.includes(pickRawBehavior(() => v))))

  // Bản đồ nhãn AI vẫn nguyên như trước khi tách file.
  t('nhãn AI: fish → swim', getBehavior('a fish') === 'swim')
  t('nhãn AI: butterfly → fly', getBehavior('butterfly') === 'fly')
  t('nhãn AI: không rõ → roam', getBehavior('xyzzy') === 'roam')
  t('nhãn rỗng → roam', getBehavior('') === 'roam' && getBehavior(null) === 'roam')
}

// ── 8. cropPixels giữ đúng pixel ─────────────────────────────────────────────
{
  const img = whiteFrame(8, 6)
  paint(img, 3, 2, 2, 2, [255, 0, 0])
  const c = cropPixels(img, { x: 3, y: 2, w: 2, h: 2 })
  t('crop đúng cỡ', c.width === 2 && c.height === 2)
  t('crop đúng pixel', [0, 1, 2, 3].every(i => c.data[i * 4] === 255 && c.data[i * 4 + 1] === 0))
}

console.log(fails === 0 ? '\nAll animate raw-sprite tests passed' : `\n${fails} test(s) FAILED`)
process.exit(fails === 0 ? 0 : 1)
