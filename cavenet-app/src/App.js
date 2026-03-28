import { useState } from "react";
import PostCard from "./components/PostCard";

function App() {

  // =========================
  // STATE
  // =========================
  const [posts, setPosts] = useState([]);
  const [text, setText] = useState("");

  // =========================
  // CREATE POST
  // =========================
  function carvePost() {
    if (!text) return;

    const newPost = {
      text: text,
      fire: 0,
      food: 0,
      user: "Hunter-" + Math.floor(Math.random() * 100)
    };

    setPosts([newPost, ...posts]);
    setText("");
  }

  // =========================
  // SYSTEM STATE (FIRE LEVEL)
  // =========================
  const totalFire = posts.reduce((sum, p) => sum + p.fire, 0);

  let message = "❄️ Cold is creeping in...";
  let color = "#60a5fa";

  if (totalFire > 10) {
    message = "🔥 The fire burns strong";
    color = "#ff7a00";
  } else if (totalFire > 5) {
    message = "🪨 The tribe is steady";
    color = "#9ca3af";
  }

  return (
    <div style={{
      maxWidth: 500,
      margin: "auto",
      padding: 20,
      position: "relative"
    }}>

      {/* ========================= */}
      {/* TOP BAR */}
      {/* ========================= */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <h2>🪨 CaveNet</h2>
        <span>🔥 {totalFire}</span>
      </div>

      {/* ========================= */}
      {/* SYSTEM MESSAGE */}
      {/* ========================= */}
      <p style={{
        color,
        marginBottom: 20,
        fontSize: 14,
        opacity: 0.9
      }}>
        {message}
      </p>

      {/* ========================= */}
      {/* CREATE BOX */}
      {/* ========================= */}
      <div style={{
        background: "#1c1c1c",
        padding: 16,
        borderRadius: 16,
        marginBottom: 20,
        boxShadow: "0 10px 30px rgba(0,0,0,0.6)"
      }}>

        {/* INPUT FIELD */}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Carve your thought..."
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 10,
            border: "none",
            marginBottom: 10,
            background: "#2a2a2a",
            color: "white",
            fontSize: 14,
            boxSizing: "border-box"
          }}
        />

        {/* CARVE BUTTON */}
        <button
          onClick={carvePost}
          style={{
            background: "#ff7a00",
            color: "white",
            padding: "12px",
            borderRadius: 10,
            border: "none",
            fontWeight: "bold",
            width: "100%",
            cursor: "pointer"
          }}
        >
          🪨 Carve
        </button>

      </div>

      {/* ========================= */}
      {/* FEED */}
      {/* ========================= */}
      {posts.map((post, index) => (
        <PostCard
          key={index}
          post={post}
          index={index}
          posts={posts}
          setPosts={setPosts}
        />
      ))}

    </div>
  );
}

export default App;