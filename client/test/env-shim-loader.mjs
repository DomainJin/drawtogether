// Node không có import.meta.env (đó là của Vite). Thay bằng object rỗng để
// chạy được store trong node cho mục đích test.
export async function load(url, context, nextLoad) {
  const r = await nextLoad(url, context)
  if (r.format === 'module' && url.startsWith('file:') && !url.includes('node_modules')) {
    const src = typeof r.source === 'string' ? r.source : Buffer.from(r.source).toString('utf8')
    return { ...r, source: src.replaceAll('import.meta.env', '({})') }
  }
  return r
}
