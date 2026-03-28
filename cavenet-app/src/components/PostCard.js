export default function PostCard({ post, index, posts, setPosts }) {

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
  
    const heat = post.fire + post.food * 2;
  
    const isHot = heat > 8;
    const isWarm = heat > 3 && heat <= 8;
    const isCold = heat <= 3;
  
    // 🔥 ONE CONSISTENT GLOW SYSTEM
    let glow = "0 10px 30px rgba(0,0,0,0.6)";
  
    if (isHot) {
      glow = "0 0 25px rgba(255,122,0,0.9)";
    } else if (isWarm) {
      glow = "0 0 12px rgba(255,122,0,0.3)";
    } else if (isCold) {
      glow = "0 0 35px rgba(96,165,250,0.9)"; // 🔵 SAME STYLE AS ORANGE
    }
  
    return (
      <div
        style={{
          background: "#1c1c1c",
          padding: 16,
          marginBottom: 16,
          borderRadius: 16,
  
          color: "white",
  
          boxShadow: glow,

          border: isCold ? "1px solid rgba(96,165,250,0.5)" : "none",
  
          // 🔥 ONLY animate hot (optional)
          animation: isHot
            ? "fireGlow 2s infinite ease-in-out"
            : isCold
            ? "coldGlow 2.5s infinite ease-in-out"
            : "none",
  
          transform: isHot ? "scale(1.01)" : "scale(1)",
  
          transition: "0.3s"
        }}
      >
  
        <div style={{ opacity: 0.8, fontSize: 14 }}>
          {post.user}
        </div>
  
        <p style={{ marginTop: 10, fontSize: 16 }}>
          {post.text}
        </p>
  
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button onClick={addFire} style={btnStyle}>
            🔥 {post.fire}
          </button>
  
          <button onClick={addFood} style={btnStyle}>
            🍖 {post.food}
          </button>
        </div>
  
      </div>
    );
  }
  
  const btnStyle = {
    background: "#2a2a2a",
    border: "none",
    padding: "8px 12px",
    borderRadius: 8,
    color: "white",
    cursor: "pointer"
  };