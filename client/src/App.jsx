import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import WhiteboardPage from './pages/WhiteboardPage.jsx'
import PerfSetupPage from './pages/performance/PerfSetupPage.jsx'
import PerfShowPage from './pages/performance/PerfShowPage.jsx'
import PerfSignPage from './pages/performance/PerfSignPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        {/* Performance mode — route cụ thể phải đứng trước /:roomId */}
        <Route path="/perf/:eventId/setup" element={<PerfSetupPage />} />
        <Route path="/perf/:eventId/show" element={<PerfShowPage />} />
        <Route path="/s/:eventId" element={<PerfSignPage />} />
        <Route path="/:roomId" element={<WhiteboardPage />} />
      </Routes>
    </BrowserRouter>
  )
}
