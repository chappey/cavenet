import { useState } from "react";
import PostCard from "./components/PostCard";
import GamePage from "./GamePage";

function App() {

  // =========================
  // STATE
  // =========================
  const [posts, setPosts] = useState([]);
  const [text, setText] = useState("");
  const [showGame, setShowGame] = useState(false);
  const [meat, setMeat] = useState(0); // 🍖 NEW

  // =========================
  // CREATE POST (COSTS MEAT)
  // =========================
  function carvePost() {
    if (!text || meat <= 0) return;

    const newPost = {
      text,
      fire: 0,
      food: 0,
      user: "Hunter-" + Math.floor(Math.random() * 100)
    };

    setPosts([newPost, ...posts]);
    setText("");

    setMeat(prev => prev - 1); // 🔥 COST
  }

  // =========================
  // GAME VIEW (FULL SCREEN SWITCH)
  // =========================
  if (showGame) {
    return (
      <div style={{ textAlign: "center", padding: 20 }}>
        <h2>🎮 Hunt for Meat</h2>

        <GamePage
          onGameEnd={(score) => {
            setShowGame(false);
            setMeat(prev => prev + score); // 🍖 REWARD
            alert("You collected " + score + " meat!");
          }}
        />

        <button
          onClick={() => setShowGame(false)}
          style={{
            marginTop: 20,
            padding: 10,
            borderRadius: 10,
            border: "none",
            background: "#ff7a00",
            color: "white",
            cursor: "pointer"
          }}
        >
          Exit Hunt
        </button>
      </div>
    );
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

  // =========================
  // MAIN UI
  // =========================
  return (
    <div style={{
      maxWidth: 500,
      margin: "auto",
      padding: 20
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

        <div style={{ display: "flex", gap: 10 }}>
          <span>🔥 {totalFire}</span>
          <span>🍖 {meat}</span>
        </div>
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
      {/* GAME BUTTON */}
      {/* ========================= */}
      <button
        onClick={() => setShowGame(true)}
        style={{
          marginBottom: 20,
          padding: 10,
          borderRadius: 10,
          border: "none",
          background: "#2a2a2a",
          color: "white",
          cursor: "pointer"
        }}
      >
        🎮 Hunt for Meat
      </button>

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
            boxSizing: "border-box"
          }}
        />

        <button
          onClick={carvePost}
          disabled={meat <= 0}
          style={{
            background: meat > 0 ? "#ff7a00" : "#555",
            color: "white",
            padding: "12px",
            borderRadius: 10,
            border: "none",
            fontWeight: "bold",
            width: "100%",
            cursor: meat > 0 ? "pointer" : "not-allowed",
            opacity: meat > 0 ? 1 : 0.5
          }}
        >
          🪨 Carve (costs 1 🍖)
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