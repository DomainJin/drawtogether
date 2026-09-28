/** State Performance mode (một sự kiện đang mở). Tách khỏi store whiteboard.
 *
 *  Render loop của màn show đọc thẳng getState() mỗi frame — không subscribe,
 *  không re-render React theo từng chữ ký. */
import { create } from 'zustand'

/** Gán giá trị theo đường dẫn 'a.b.c', trả object mới (các nhánh khác giữ
 *  nguyên tham chiếu). Pure. */
export function setIn(obj, path, value) {
  const [head, ...rest] = path.split('.')
  return { ...obj, [head]: rest.length ? setIn(obj?.[head] ?? {}, rest.join('.'), value) : value }
}

export function getIn(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

/** Chèn giữ thứ tự createdAt tăng dần; trùng id → thay. */
export function upsertSignature(list, sig) {
  const without = list.filter((s) => s.id !== sig.id)
  let i = without.length
  while (i > 0 && without[i - 1].createdAt > sig.createdAt) i--
  return [...without.slice(0, i), sig, ...without.slice(i)]
}

const initial = {
  eventId: null,
  event: null,
  config: null,
  schema: null,
  signatures: [],
  isAdmin: false,
  connected: false,
  error: '',
}

export const usePerformanceStore = create((set) => ({
  ...initial,

  reset: (eventId) => set({ ...initial, eventId }),
  setConnected: (connected) => set({ connected }),
  setError: (error) => set({ error }),

  /** Ack của perf:join — state đầy đủ, thay toàn bộ (reconnect = đồng bộ lại). */
  applyJoin: (res) => set((s) => ({
    event: res.event,
    config: res.config,
    schema: res.schema ?? s.schema,
    signatures: res.signatures ?? s.signatures,
    isAdmin: !!res.isAdmin,
    error: '',
  })),

  setConfig: (config) => set({ config }),
  setConfigPath: (path, value) => set((s) => ({ config: setIn(s.config, path, value) })),

  addSignature: (sig) => set((s) => ({ signatures: upsertSignature(s.signatures, sig) })),
  updateSignature: ({ id, status }) => set((s) => ({
    signatures: s.signatures.map((x) => (x.id === id ? { ...x, status } : x)),
  })),
  removeSignature: ({ id }) => set((s) => ({ signatures: s.signatures.filter((x) => x.id !== id) })),
  clearSignatures: () => set({ signatures: [] }),
}))
