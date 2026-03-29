import { useEffect, useRef } from "react";

export default function GamePage({ onGameEnd }) {
  const canvasRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let caveman = { x: 50, y: 150, vy: 0, jumping: false };
    let gravity = 0.8;

    let obstacles = [];
    let meat = [];
    let score = 0;
    let gameOver = false;

    function spawnObstacle() {
      obstacles.push({ x: 400, y: 170, w: 20, h: 30 });
    }

    function spawnMeat() {
      meat.push({ x: 400, y: 140, w: 15, h: 15 });
    }

    function jump() {
      if (!caveman.jumping) {
        caveman.vy = -12;
        caveman.jumping = true;
      }
    }

    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") jump();
    });

    function update() {
      if (gameOver) return;

      caveman.vy += gravity;
      caveman.y += caveman.vy;

      if (caveman.y >= 150) {
        caveman.y = 150;
        caveman.jumping = false;
      }

      obstacles.forEach((o) => (o.x -= 4));
      meat.forEach((m) => (m.x -= 4));

      // Collision
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

      // Meat collection
      meat.forEach((m, i) => {
        if (
          caveman.x < m.x + m.w &&
          caveman.x + 20 > m.x &&
          caveman.y < m.y + m.h &&
          caveman.y + 20 > m.y
        ) {
          score++;
          meat.splice(i, 1);
        }
      });

      obstacles = obstacles.filter((o) => o.x > -20);
      meat = meat.filter((m) => m.x > -20);

      if (Math.random() < 0.02) spawnObstacle();
      if (Math.random() < 0.03) spawnMeat();
    }

    function draw() {
      ctx.clearRect(0, 0, 400, 200);

      // ground
      ctx.fillStyle = "#333";
      ctx.fillRect(0, 180, 400, 20);

      // caveman
      ctx.fillStyle = "orange";
      ctx.fillRect(caveman.x, caveman.y, 20, 20);

      // obstacles
      ctx.fillStyle = "red";
      obstacles.forEach((o) => ctx.fillRect(o.x, o.y, o.w, o.h));

      // meat
      ctx.fillStyle = "brown";
      meat.forEach((m) => ctx.fillRect(m.x, m.y, m.w, m.h));

      ctx.fillStyle = "white";
      ctx.fillText("Meat: " + score, 10, 20);
    }

    function loop() {
      update();
      draw();
      if (!gameOver) requestAnimationFrame(loop);
    }

    loop();
  }, [onGameEnd]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={200}
      style={{ border: "1px solid white", marginTop: 20 }}
    />
  );
}