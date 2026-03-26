import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import WhiteboardPage from './pages/WhiteboardPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/:roomId" element={<WhiteboardPage />} />
      </Routes>
    </BrowserRouter>
  )
}
