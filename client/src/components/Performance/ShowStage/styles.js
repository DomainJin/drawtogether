export const containerStyle = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  background: '#000',
}

export function frameStyle(output, fit) {
  return {
    position: 'absolute',
    left: fit.x,
    top: fit.y,
    width: output.frameW,
    height: output.frameH,
    transform: `scale(${fit.scale})`,
    transformOrigin: '0 0',
    background: '#000',
  }
}

export function regionStyle(output, outline, scale) {
  return {
    position: 'absolute',
    left: output.x,
    top: output.y,
    width: output.w,
    height: output.h,
    overflow: 'hidden',
    // Viền chỉ ở preview trong setup — độ dày theo px màn hình, không theo khung.
    outline: outline ? `${2 / Math.max(scale, 0.01)}px dashed rgba(255,209,102,0.9)` : 'none',
  }
}

export const canvasStyle = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
}

export function qrBoxStyle(q) {
  return {
    position: 'absolute',
    left: q.x,
    top: q.y,
    width: q.size,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    pointerEvents: 'none',
  }
}

export function qrCaptionStyle(q) {
  return {
    height: q.captionH,
    lineHeight: `${q.captionH}px`,
    fontSize: Math.round(q.captionH * 0.62),
    fontWeight: 600,
    color: '#fff',
    whiteSpace: 'nowrap',
    textShadow: '0 1px 4px rgba(0,0,0,0.8)',
  }
}
