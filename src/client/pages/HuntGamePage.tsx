import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';

interface HuntGamePageProps {
  userId: string | null;
  onRefreshUser: () => void;
}

type Point = { x: number; y: number; w: number; h: number };

type RunnerState = {
  caveman: { x: number; y: number; vy: number; jumping: boolean };
  obstacles: Point[];
  meat: Point[];
  score: number;
  gameOver: boolean;
};

const WIDTH = 420;
const HEIGHT = 220;
const GROUND_Y = 182;

const makeRunId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const HuntGamePage: React.FC<HuntGamePageProps> = ({ userId, onRefreshUser }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runIdRef = useRef(makeRunId());
  const claimedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [rewardFire, setRewardFire] = useState<number | null>(null);
  const [claimStatus, setClaimStatus] = useState<string>('');
  const [claiming, setClaiming] = useState(false);

  const title = useMemo(() => '🎮 Hunt for Fire', []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let alive = true;
    let spawnTick = 0;
    let state: RunnerState = {
      caveman: { x: 54, y: 150, vy: 0, jumping: false },
      obstacles: [],
      meat: [],
      score: 0,
      gameOver: false,
    };

    const endRun = async () => {
      if (!alive || state.gameOver) return;
      state.gameOver = true;
      setGameOver(true);
      setScore(state.score);

      if (claimedRef.current) return;
      claimedRef.current = true;
      setClaiming(true);
      try {
        const result = await apiFetch('/games/hunt/claim', {
          method: 'POST',
          body: JSON.stringify({
            runId: runIdRef.current,
            score: state.score,
          }),
        });

        if (result.status === 'claimed') {
          setRewardFire(result.fireReward ?? 0);
          setClaimStatus(result.fireReward > 0 ? `+${result.fireReward} fire gained` : 'No fire this time');
          onRefreshUser();
        } else {
          setRewardFire(result.fireReward ?? 0);
          setClaimStatus('Already claimed');
        }
      } catch (error) {
        console.error('[game:hunt] claim failed:', error);
        setClaimStatus('Reward claim failed');
      } finally {
        setClaiming(false);
      }
    };

    const jump = () => {
      if (state.gameOver || state.caveman.jumping) return;
      state.caveman.vy = -12.5;
      state.caveman.jumping = true;
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        jump();
      }
    };

    const handleCanvasClick = () => jump();

    window.addEventListener('keydown', handleKey);
    canvas.addEventListener('pointerdown', handleCanvasClick);

    const update = () => {
      if (state.gameOver) return;

      state.caveman.vy += 0.75;
      state.caveman.y += state.caveman.vy;

      if (state.caveman.y >= 150) {
        state.caveman.y = 150;
        state.caveman.vy = 0;
        state.caveman.jumping = false;
      }

      state.obstacles.forEach(obstacle => {
        obstacle.x -= 4.5;
      });
      state.meat.forEach(chunk => {
        chunk.x -= 4;
      });

      const cavemanBox = { x: state.caveman.x, y: state.caveman.y, w: 20, h: 20 };

      for (const obstacle of state.obstacles) {
        const hit =
          cavemanBox.x < obstacle.x + obstacle.w &&
          cavemanBox.x + cavemanBox.w > obstacle.x &&
          cavemanBox.y < obstacle.y + obstacle.h &&
          cavemanBox.y + cavemanBox.h > obstacle.y;

        if (hit) {
          void endRun();
          break;
        }
      }

      state.meat = state.meat.filter(chunk => {
        const collected =
          cavemanBox.x < chunk.x + chunk.w &&
          cavemanBox.x + cavemanBox.w > chunk.x &&
          cavemanBox.y < chunk.y + chunk.h &&
          cavemanBox.y + cavemanBox.h > chunk.y;

        if (collected) {
          state.score += 1;
          setScore(state.score);
          return false;
        }

        return chunk.x > -20;
      });

      state.obstacles = state.obstacles.filter(obstacle => obstacle.x > -30);

      spawnTick += 1;
      if (spawnTick % 34 === 0 && Math.random() < 0.6) {
        state.obstacles.push({ x: WIDTH + 20, y: 156, w: 18, h: 26 });
      }
      if (spawnTick % 22 === 0 && Math.random() < 0.55) {
        state.meat.push({ x: WIDTH + 20, y: 144, w: 14, h: 14 });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      gradient.addColorStop(0, '#130d08');
      gradient.addColorStop(1, '#080707');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = '#352114';
      ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);

      ctx.fillStyle = '#ff7a00';
      ctx.fillRect(state.caveman.x, state.caveman.y, 20, 20);

      ctx.fillStyle = '#8b4513';
      state.meat.forEach(chunk => {
        ctx.fillRect(chunk.x, chunk.y, chunk.w, chunk.h);
      });

      ctx.fillStyle = '#ef4444';
      state.obstacles.forEach(obstacle => {
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
      });

      ctx.fillStyle = 'white';
      ctx.font = '14px sans-serif';
      ctx.fillText(`Fire loot: ${state.score}`, 12, 22);
      ctx.fillText('Space or tap to jump', 12, 40);
    };

    const loop = () => {
      if (!alive) return;
      update();
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      alive = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('keydown', handleKey);
      canvas.removeEventListener('pointerdown', handleCanvasClick);
    };
  }, [sessionKey, onRefreshUser]);

  useEffect(() => {
    runIdRef.current = makeRunId();
    claimedRef.current = false;
    setScore(0);
    setGameOver(false);
    setRewardFire(null);
    setClaimStatus('');
    setClaiming(false);
  }, [sessionKey]);

  if (!userId) {
    return (
      <div className="content-view game-view">
        <Link to="/" className="back-link game-back-link">← Back to Cave Wall</Link>
        <div className="error-state">Select a caveman before hunting for fire.</div>
      </div>
    );
  }

  return (
    <div className="content-view game-view">
      <div className="content-header game-header">
        <Link to="/" className="back-link game-back-link">← Back to Cave Wall</Link>
        <h1>{title}</h1>
        <p className="content-subtitle">Jump the dangers, grab the meat, and bring fire back to the cave.</p>
      </div>

      <div className="game-shell">
        <div className="game-topbar">
          <div className="game-stat">🪵 Run: {sessionKey + 1}</div>
          <div className="game-stat">🔥 Score: {score}</div>
          <div className="game-stat">{gameOver ? '❌' : '✅'} {gameOver ? 'Run over' : 'Run live'}</div>
        </div>

        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="hunt-canvas"
        />

        <div className="game-status-row">
          <div className="game-status-text">
            {claiming ? 'Locking in your fire...' : claimStatus || 'Collect meat to turn it into fire.'}
          </div>
          <div className="game-controls-hint">Space or tap the cave floor to jump</div>
        </div>

        <div className="game-actions">
          <button className="btn-carve" onClick={() => setSessionKey(key => key + 1)} disabled={claiming}>
            🔄 Hunt Again
          </button>
          <button className="btn-cancel" onClick={() => setSessionKey(key => key + 1)} disabled={claiming}>
            New Run
          </button>
          <Link className="btn-cancel game-exit-link" to="/">
            Exit Hunt
          </Link>
        </div>

        {rewardFire !== null && gameOver && (
          <div className="game-reward-card">
            {rewardFire > 0 ? (
              <>
                <strong>Fire gained:</strong> +{rewardFire}
              </>
            ) : (
              <>
                <strong>No fire gained.</strong> Try a longer hunt.
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HuntGamePage;
