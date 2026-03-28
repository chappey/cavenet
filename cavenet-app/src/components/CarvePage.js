import { useState } from "react";

export default function CarvePage({ posts, setPosts }) {
  const [text, setText] = useState("");
  const [output, setOutput] = useState("");

  function cavemanify() {
    setOutput("Unga bunga: " + text);
  }

  function carvePost() {
    if (!text) return;

    const newPost = {
      text: output || text,
      fire: 0,
      food: 0
    };

    setPosts([newPost, ...posts]);
    setText("");
    setOutput("");
  }

  return (
    <div>
      <h2>🪨 Carve Your Thought</h2>

      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What is on your primitive mind?"
        style={{ width: "100%", padding: 10 }}
      />

      <button onClick={cavemanify}>Cavemanify</button>
      <button onClick={carvePost}>Carve</button>

      <p><strong>Preview:</strong> {output}</p>
    </div>
  );
}