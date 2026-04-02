import { useEffect, useRef } from "react";

export default function GamePage({ onGameEnd }) {
  const canvasRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let caveman = { x: 50, y: 150, vy: 0, jumping: false };
    let gravity = 0.8;

    let meat = [];
    let obstacles = [];
    let score = 0;
    let gameOver = false;

    function jump() {
      if (!caveman.jumping) {
        caveman.vy = -12;
        caveman.jumping = true;
      }
    }

    const handleKey = (e) => {
      if (e.code === "Space") jump();
    };

    window.addEventListener("keydown", handleKey);

    function update() {
      caveman.vy += gravity;
      caveman.y += caveman.vy;

      if (caveman.y >= 150) {
        caveman.y = 150;
        caveman.jumping = false;
      }

      // Move objects
      meat.forEach((m) => (m.x -= 4));
      obstacles.forEach((o) => (o.x -= 5));

      // Spawn
      if (Math.random() < 0.03) {
        meat.push({ x: 400, y: 140 });
      }

      if (Math.random() < 0.02) {
        obstacles.push({ x: 400, y: 160, w: 20, h: 20 });
      }

      // Collision (meat)
      meat.forEach((m, i) => {
        if (
          caveman.x < m.x + 15 &&
          caveman.x + 20 > m.x &&
          caveman.y < m.y + 15 &&
          caveman.y + 20 > m.y
        ) {
          score++;
          meat.splice(i, 1);
        }
      });

      // Collision (obstacle)
      obstacles.forEach((o) => {
        if (
          caveman.x < o.x + o.w &&
          caveman.x + 20 > o.x &&
          caveman.y < o.y + o.h &&
          caveman.y + 20 > o.y
        ) {
          gameOver = true;
          onGameEnd(score);
        }
      });

      // Cleanup
      meat = meat.filter((m) => m.x > -20);
      obstacles = obstacles.filter((o) => o.x > -20);
    }

    function draw() {
      ctx.clearRect(0, 0, 400, 200);

      // background
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, 400, 200);

      // ground
      ctx.fillStyle = "#222";
      ctx.fillRect(0, 180, 400, 20);

      // caveman
      ctx.fillStyle = "#ff7a00";
      ctx.fillRect(caveman.x, caveman.y, 20, 20);

      // meat
      ctx.fillStyle = "#8b4513";
      meat.forEach((m) => ctx.fillRect(m.x, m.y, 15, 15));

      // obstacles
      ctx.fillStyle = "red";
      obstacles.forEach((o) => ctx.fillRect(o.x, o.y, o.w, o.h));

      // score
      ctx.fillStyle = "white";
      ctx.font = "14px sans-serif";
      ctx.fillText("Meat: " + score, 10, 20);
    }

    function loop() {
      if (gameOver) return;
      update();
      draw();
      requestAnimationFrame(loop);
    }

    loop();

    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [onGameEnd]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={200}
      style={{
        borderRadius: 12,
        boxShadow: "0 0 20px rgba(0,0,0,0.6)"
      }}
    />
  );
}