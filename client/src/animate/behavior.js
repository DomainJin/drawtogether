/** Chọn kiểu chuyển động cho sprite.
 *
 *  Hai nguồn: nhãn do AI trả về (cá → bơi, xe → chạy), hoặc — khi tắt AI render
 *  — không có nhãn nào cả. Tách khỏi component để test bằng số: bản đồ nhãn
 *  từng sai âm thầm (regex /fly/ nuốt luôn "butterfly" trước khi tới nhánh
 *  đúng) mà nhìn màn hình không phát hiện ra. */
import { ANIMATE_CONFIG as CFG } from './config.js'

/** Nhãn AI → hành vi. Thứ tự nhánh là thứ tự ưu tiên. */
export function getBehavior(label) {
  const l = (label || '').toLowerCase()
  if (/fish|whale|shark|dolphin|cá|seal|octopus|tuna|clown/.test(l)) return 'swim'
  if (/car|truck|bus|vehicle|xe|train|motorcycle|bike|tank|van|jeep/.test(l)) return 'drive'
  if (/bird|butterfly|bee|fly|plane|airplane|dragon|kite|ufo|rocket|eagle|dove|owl/.test(l)) return 'fly'
  if (/ball|balloon|bubble|bóng|sphere/.test(l)) return 'bounce'
  if (/leaf|snow|rain|star|petal|snowflake|confetti/.test(l)) return 'fall'
  if (/person|human|man|woman|boy|girl|stick|người|cat|dog|rabbit|bear|fox/.test(l)) return 'walk'
  if (/cloud|jelly|jellyfish|ghost|feather|smoke/.test(l)) return 'float'
  if (/flower|sun|wheel|spiral|pinwheel/.test(l)) return 'spin'
  return 'roam'
}

/** Hành vi cho sprite raw (AI tắt). Không có nhãn thì đoán bừa "xe" rồi cho nó
 *  rơi xuống đáy màn hình là sai hơn hẳn: chỉ chọn trong nhóm bay lượn, để hình
 *  vẽ trôi tự do giữa khung nhìn. `rand` nhận vào được để test tất định. */
export function pickRawBehavior(rand = Math.random) {
  const list = CFG.RAW_BEHAVIORS
  const i = Math.min(list.length - 1, Math.max(0, Math.floor(rand() * list.length)))
  return list[i]
}
