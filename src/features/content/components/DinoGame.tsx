import { useCallback, useEffect, useRef } from 'react';

// Pixel art sprites encoded as 1/0 grids
const DINO_SPRITE = [
  [0,0,0,0,0,1,1,1,1,1],
  [0,0,0,0,1,1,1,1,1,1],
  [0,0,0,0,1,1,0,1,1,1],
  [0,0,0,0,1,1,1,1,1,1],
  [0,0,0,0,1,1,1,1,0,0],
  [1,0,0,1,1,1,1,1,1,0],
  [1,0,0,1,1,1,1,1,0,0],
  [1,1,1,1,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,0,0,0],
  [0,0,0,1,1,1,0,0,0,0],
  [0,0,0,1,0,0,1,0,0,0],
  [0,0,0,1,0,0,0,1,0,0],
  [0,0,1,1,0,0,1,1,0,0],
];

const DINO_RUN1 = [
  [0,0,0,0,0,1,1,1,1,1],
  [0,0,0,0,1,1,1,1,1,1],
  [0,0,0,0,1,1,0,1,1,1],
  [0,0,0,0,1,1,1,1,1,1],
  [0,0,0,0,1,1,1,1,0,0],
  [1,0,0,1,1,1,1,1,1,0],
  [1,0,0,1,1,1,1,1,0,0],
  [1,1,1,1,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,0,0,0],
  [0,0,0,1,1,1,0,0,0,0],
  [0,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,0,0,1,0,0,0],
  [0,0,0,0,0,0,1,1,0,0],
];

const DINO_RUN2 = [
  [0,0,0,0,0,1,1,1,1,1],
  [0,0,0,0,1,1,1,1,1,1],
  [0,0,0,0,1,1,0,1,1,1],
  [0,0,0,0,1,1,1,1,1,1],
  [0,0,0,0,1,1,1,1,0,0],
  [1,0,0,1,1,1,1,1,1,0],
  [1,0,0,1,1,1,1,1,0,0],
  [1,1,1,1,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,0,0,0],
  [0,0,0,1,1,1,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,0],
  [0,0,0,1,0,0,0,0,0,0],
  [0,0,1,1,0,0,0,0,0,0],
];

const CACTUS_SMALL = [
  [0,0,1,0,0],
  [0,0,1,0,0],
  [1,0,1,0,0],
  [1,0,1,0,1],
  [1,0,1,0,1],
  [1,1,1,1,1],
  [0,0,1,0,0],
  [0,0,1,0,0],
  [0,0,1,0,0],
  [0,0,1,0,0],
];

const CACTUS_TALL = [
  [0,0,1,0,0,0],
  [0,0,1,0,0,0],
  [0,0,1,0,1,0],
  [1,0,1,0,1,0],
  [1,0,1,0,1,0],
  [1,0,1,1,1,0],
  [1,1,1,0,0,0],
  [0,0,1,0,0,0],
  [0,0,1,0,0,0],
  [0,0,1,0,0,0],
  [0,0,1,0,0,0],
  [0,0,1,0,0,0],
];

const BIRD_1 = [
  [0,0,0,1,0],
  [1,0,0,1,0],
  [1,1,1,1,1],
  [0,0,1,1,0],
  [0,0,0,0,0],
];

const BIRD_2 = [
  [0,0,0,0,0],
  [1,0,0,1,0],
  [1,1,1,1,1],
  [0,0,1,1,0],
  [0,0,0,1,0],
];

const CLOUD = [
  [0,0,1,1,1,0,0,0],
  [0,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1],
  [0,0,1,1,1,1,0,0],
];

const PIXEL = 2;

export default function DinoGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({
    dinoY: 0,
    velocityY: 0,
    isJumping: false,
    obstacles: [] as { x: number; type: 'cactus_small' | 'cactus_tall' | 'bird'; frame: number }[],
    clouds: [] as { x: number; y: number }[],
    ground: [] as { x: number }[],
    frame: 0,
    score: 0,
    speed: 3,
    gameOver: false,
    animFrame: 0,
    canvasW: 400,
    canvasH: 150,
  });

  const GROUND_OFFSET = 30; // from bottom
  const DINO_X = 40;

  const drawSprite = useCallback((ctx: CanvasRenderingContext2D, sprite: number[][], x: number, y: number, color: string) => {
    ctx.fillStyle = color;
    for (let row = 0; row < sprite.length; row++) {
      for (let col = 0; col < sprite[row].length; col++) {
        if (sprite[row][col]) {
          ctx.fillRect(Math.round(x + col * PIXEL), Math.round(y + row * PIXEL), PIXEL, PIXEL);
        }
      }
    }
  }, []);

  const jump = useCallback(() => {
    const s = stateRef.current;
    if (s.gameOver) {
      s.dinoY = 0;
      s.velocityY = 0;
      s.isJumping = false;
      s.obstacles = [];
      s.frame = 0;
      s.score = 0;
      s.speed = 3;
      s.gameOver = false;
      return;
    }
    if (!s.isJumping) {
      s.velocityY = -8;
      s.isJumping = true;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const s = stateRef.current;

    // Size canvas to container
    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.floor(rect.width);
      const h = Math.min(Math.floor(rect.height), 160);
      s.canvasW = w;
      s.canvasH = h;
      canvas.width = w;
      canvas.height = h;
    };
    resizeCanvas();
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(container);

    // Init clouds
    s.clouds = [
      { x: 80, y: 12 },
      { x: 220, y: 30 },
      { x: 360, y: 8 },
    ];

    // Init ground bumps
    s.ground = [];
    for (let i = 0; i < 40; i++) {
      s.ground.push({ x: i * 20 + Math.random() * 8 });
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };

    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
      jump();
    };

    window.addEventListener('keydown', handleKey);
    canvas.addEventListener('touchstart', handleTouch, { passive: false });

    let animId: number;

    const loop = () => {
      const GROUND_Y = s.canvasH - GROUND_OFFSET;

      ctx.clearRect(0, 0, s.canvasW, s.canvasH);

      // Background
      ctx.fillStyle = '#fafaf9';
      ctx.fillRect(0, 0, s.canvasW, s.canvasH);

      // Clouds
      ctx.globalAlpha = 0.25;
      for (const cloud of s.clouds) {
        drawSprite(ctx, CLOUD, cloud.x, cloud.y, '#a8a29e');
        if (!s.gameOver) cloud.x -= s.speed * 0.25;
        if (cloud.x < -30) cloud.x = s.canvasW + Math.random() * 80;
      }
      ctx.globalAlpha = 1;

      // Ground line
      ctx.fillStyle = '#d6d3d1';
      ctx.fillRect(0, GROUND_Y + 2, s.canvasW, 1);

      // Ground texture
      ctx.fillStyle = '#d6d3d1';
      for (const g of s.ground) {
        ctx.fillRect(g.x, GROUND_Y + 5, 2 + Math.random(), 1);
        ctx.fillRect(g.x + 6, GROUND_Y + 8, 1.5, 1);
        if (!s.gameOver) g.x -= s.speed;
        if (g.x < -10) g.x = s.canvasW + Math.random() * 15;
      }

      if (!s.gameOver) {
        // Physics
        s.dinoY += s.velocityY;
        s.velocityY += 0.5;
        if (s.dinoY >= 0) {
          s.dinoY = 0;
          s.velocityY = 0;
          s.isJumping = false;
        }

        // Spawn obstacles
        s.frame++;
        if (s.frame % Math.max(50, 90 - s.score) === 0) {
          const rand = Math.random();
          if (rand < 0.4) {
            s.obstacles.push({ x: s.canvasW, type: 'cactus_small', frame: 0 });
          } else if (rand < 0.75) {
            s.obstacles.push({ x: s.canvasW, type: 'cactus_tall', frame: 0 });
          } else {
            s.obstacles.push({ x: s.canvasW, type: 'bird', frame: 0 });
          }
        }

        // Move obstacles
        for (const obs of s.obstacles) {
          obs.x -= s.speed;
          obs.frame++;
        }
        s.obstacles = s.obstacles.filter(o => o.x > -40);

        // Score
        if (s.frame % 6 === 0) s.score++;

        // Speed up
        s.speed = 3 + Math.floor(s.score / 50) * 0.4;

        // Leg animation
        s.animFrame = Math.floor(s.frame / 6) % 2;
      }

      // Draw dino
      const dinoDrawY = GROUND_Y - 14 * PIXEL + s.dinoY;
      const dinoSprite = s.isJumping ? DINO_SPRITE : (s.animFrame === 0 ? DINO_RUN1 : DINO_RUN2);
      drawSprite(ctx, dinoSprite, DINO_X, dinoDrawY, '#78716c');

      // Draw obstacles & collision
      for (const obs of s.obstacles) {
        let sprite: number[][];
        let obsY: number;
        let color: string;

        if (obs.type === 'cactus_small') {
          sprite = CACTUS_SMALL;
          obsY = GROUND_Y - sprite.length * PIXEL;
          color = '#a8a29e';
        } else if (obs.type === 'cactus_tall') {
          sprite = CACTUS_TALL;
          obsY = GROUND_Y - sprite.length * PIXEL;
          color = '#a8a29e';
        } else {
          sprite = obs.frame % 20 < 10 ? BIRD_1 : BIRD_2;
          obsY = GROUND_Y - 50 - Math.sin(obs.frame * 0.05) * 8;
          color = '#a8a29e';
        }

        drawSprite(ctx, sprite, obs.x, obsY, color);

        if (!s.gameOver) {
          const dinoLeft = DINO_X + 2 * PIXEL;
          const dinoRight = DINO_X + 8 * PIXEL;
          const dinoTop = dinoDrawY + 2 * PIXEL;
          const dinoBottom = dinoDrawY + 14 * PIXEL;
          const obsLeft = obs.x + PIXEL;
          const obsRight = obs.x + sprite[0].length * PIXEL - PIXEL;
          const obsTop = obsY + PIXEL;
          const obsBottom = obsY + sprite.length * PIXEL;

          if (dinoRight > obsLeft && dinoLeft < obsRight && dinoBottom > obsTop && dinoTop < obsBottom) {
            s.gameOver = true;
          }
        }
      }

      // Score
      ctx.fillStyle = '#a8a29e';
      ctx.font = '500 11px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(String(s.score).padStart(5, '0'), s.canvasW - 8, 16);

      // Game over
      if (s.gameOver) {
        ctx.fillStyle = '#78716c';
        ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', s.canvasW / 2, GROUND_Y / 2 - 4);
        ctx.font = '400 10px ui-sans-serif, system-ui, sans-serif';
        ctx.fillStyle = '#a8a29e';
        ctx.fillText('Tap or press Space to retry', s.canvasW / 2, GROUND_Y / 2 + 12);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', handleKey);
      canvas.removeEventListener('touchstart', handleTouch);
    };
  }, [drawSprite, jump]);

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center w-full h-full min-h-[160px]">
      <canvas
        ref={canvasRef}
        onClick={jump}
        className="cursor-pointer w-full"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}
