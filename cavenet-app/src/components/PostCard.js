export default function PostCard({ post, index, posts, setPosts }) {

    // =========================
    // INTERACTIONS
    // =========================
    function addFire() {
      const updated = [...posts];
      updated[index].fire += 1;
      setPosts(updated);
    }
  
    function addFood() {
      const updated = [...posts];
      updated[index].food += 1;
      setPosts(updated);
    }
  
    // =========================
    // HEAT SYSTEM
    // =========================
    const heat = post.fire + post.food * 2;
  
    const isHot = heat > 8;
    const isWarm = heat > 3;
  
    // Always dark base (KEY CHANGE)
    let bg = "#1c1c1c";
  
    // Glow strength
    let glow = "0 10px 30px rgba(0,0,0,0.6)";
  
    if (isHot) {
      glow = "0 0 25px rgba(255,122,0,0.9)";
    } else if (isWarm) {
      glow = "0 0 15px rgba(255,122,0,0.4)";
    }
  
    return (
      <div
        style={{
          background: bg,
          padding: 16,
          marginBottom: 16,
          borderRadius: 16,
          color: "white",
  
          // 🔥 THIS IS THE MAGIC
          boxShadow: glow,
  
          // 🔥 Flicker ONLY when hot
          animation: isHot ? "fireGlow 2s infinite ease-in-out" : "none",
  
          transition: "0.3s"
        }}
      >
  
        {/* USER */}
        <div style={{ opacity: 0.8, fontSize: 14 }}>
          {post.user}
        </div>
  
        {/* TEXT */}
        <p style={{ marginTop: 10, fontSize: 16 }}>
          {post.text}
        </p>
  
        {/* ACTIONS */}
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button
            onClick={addFire}
            style={{
              background: "#2a2a2a",
              border: "none",
              padding: "8px 12px",
              borderRadius: 8,
              color: "white",
              cursor: "pointer"
            }}
          >
            🔥 {post.fire}
          </button>
  
          <button
            onClick={addFood}
            style={{
              background: "#2a2a2a",
              border: "none",
              padding: "8px 12px",
              borderRadius: 8,
              color: "white",
              cursor: "pointer"
            }}
          >
            🍖 {post.food}
          </button>
        </div>
  
      </div>
    );
  }