import { useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "../store/index.js";
import { useSocket } from "../hooks/useSocket.js";
import WhiteboardCanvas from "../components/WhiteboardCanvas.jsx";
import Toolbar from "../components/Toolbar.jsx";
import CursorOverlay from "../components/CursorOverlay.jsx";
import UserList from "../components/UserList.jsx";

export default function WhiteboardPage() {
  const { roomId } = useParams();
  const { token, room } = useStore();
  const canvasRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) navigate("/", { replace: true });
  }, [token, navigate]);

  // Khoá scroll body khi ở whiteboard
  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.height = "100%";
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
    };
  }, []);

  useSocket(roomId, canvasRef);

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `whiteboard-${roomId}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Đã copy link! Gửi cho bạn bè để vẽ cùng.");
  };

  if (!token) return null;

  return (
    <div
      style={{
        width: "100vw",
        height: "100dvh" /* dvh: dynamic viewport height, đúng trên mobile */,
        position: "fixed",
        top: 0,
        left: 0,
        background: "#fafafa",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 12,
          padding: "8px 16px",
          zIndex: 100,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: 18 }}>🎨</span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          {room?.name || roomId}
        </span>
        <button
          onClick={handleCopyLink}
          style={{
            fontSize: 12,
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "transparent",
            cursor: "pointer",
            color: "#378ADD",
          }}
        >
          📋 Copy link
        </button>
      </div>

      {/* Canvas full screen */}
      <div style={{ position: "absolute", inset: 0 }}>
        <WhiteboardCanvas canvasRef={canvasRef} />
        <CursorOverlay canvasRef={canvasRef} />
      </div>

      <UserList />
      <Toolbar onExport={handleExport} />
    </div>
  );
}
