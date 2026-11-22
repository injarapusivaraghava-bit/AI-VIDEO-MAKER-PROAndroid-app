import React, { useEffect, useRef, useState } from 'react';
import {
  Gamepad2,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Download,
  Save,
  Upload,
  Check,
  Loader2,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Info,
} from 'lucide-react';
import { GameGenre, GameProject, LanguageMode } from '../types/studio';

interface GameMakerViewProps {
  lang: LanguageMode;
  initialGame?: GameProject | null;
  onClearInitialGame?: () => void;
  onSaveGame: (game: GameProject) => Promise<void>;
}

const STARTER_GAME: GameProject = {
  id: 'game-starter-village',
  title: 'తెలుగు రైతు జంప్ అడ్వెంచర్ · Harvest Jump',
  genre: 'platformer',
  prompt: 'A village kid jumping over rocks and collecting golden stars',
  storyTe: 'పచ్చని పొలాల్లో బంగారు నక్షత్రాలు సేకరిస్తూ ముందుకు సాగే సాహస ఆట.',
  storyEn: 'Jump across village fields, dodge boulders, and collect golden harvest stars.',
  instructions: 'Press Space / Up Arrow or tap Jump to leap over obstacles and collect stars!',
  heroEmoji: '🧑‍🌾',
  enemyEmoji: '🪨',
  collectibleEmoji: '⭐',
  heroColor: '#F59E0B',
  enemyColor: '#EF4444',
  bgTop: '#0F172A',
  bgBottom: '#1E3A8A',
  speed: 4,
  winScore: 100,
  questions: [
    {
      question: 'తెలుగులో ఆకాశం రంగు ఏమిటి? (What color is a clear sky?)',
      options: ['నీలం (Blue)', 'నలుపు (Black)', 'పసుపు (Yellow)', 'ఎరుపు (Red)'],
      correctIndex: 0,
    },
    {
      question: '5 + 7 ఎంత? (What is 5 + 7?)',
      options: ['10', '11', '12', '14'],
      correctIndex: 2,
    },
    {
      question: 'భారతదేశ జాతీయ పక్షి? (National bird of India?)',
      options: ['కాకి (Crow)', 'నెమలి (Peacock)', 'పావురం (Pigeon)', 'చిలుక (Parrot)'],
      correctIndex: 1,
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

type GamePhase = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'WON';

function playTone(freq: number, duration = 0.12, type: OscillatorType = 'triangle') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
    setTimeout(() => ctx.close().catch(() => {}), (duration + 0.1) * 1000);
  } catch {}
}

export const GameMakerView: React.FC<GameMakerViewProps> = ({
  lang,
  initialGame,
  onClearInitialGame,
  onSaveGame,
}) => {
  const [genre, setGenre] = useState<GameGenre>('platformer');
  const [prompt, setPrompt] = useState('');
  const [game, setGame] = useState<GameProject>(STARTER_GAME);
  const [phase, setPhase] = useState<GamePhase>('MENU');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [error, setError] = useState('');

  // Quiz / Educational interactive state
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState<string>('');

  // Puzzle 4x4 state
  const [puzzleTiles, setPuzzleTiles] = useState<
    { id: number; emoji: string; revealed: boolean; matched: boolean }[]
  >([]);
  const [selectedTileIdx, setSelectedTileIdx] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const heroImageRef = useRef<HTMLImageElement | null>(null);
  const heroInputRef = useRef<HTMLInputElement | null>(null);

  // Mutable live game state for 60fps loop
  const stateRef = useRef({
    lane: 1,
    heroY: 230,
    heroVy: 0,
    onGround: true,
    items: [] as { x: number; y: number; lane: number; kind: 'enemy' | 'coin'; speedMul: number }[],
    frame: 0,
    score: 0,
    lives: 3,
  });

  useEffect(() => {
    if (!initialGame) return;
    setGame(initialGame);
    setGenre(initialGame.genre);
    setPhase('MENU');
    onClearInitialGame?.();
  }, [initialGame]);

  useEffect(() => {
    if (!game.heroImageUrl) {
      heroImageRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      heroImageRef.current = img;
    };
    img.src = game.heroImageUrl;
  }, [game.heroImageUrl]);

  const initPuzzleBoard = (currentGame: GameProject) => {
    const symbols = [
      currentGame.heroEmoji || '🦊',
      currentGame.collectibleEmoji || '⭐',
      currentGame.enemyEmoji || '💎',
      '🌿',
      '🔥',
      '🎵',
      '🏆',
      '🚀',
    ];
    const deck = [...symbols, ...symbols]
      .sort(() => Math.random() - 0.5)
      .map((emoji, id) => ({ id, emoji, revealed: false, matched: false }));
    setPuzzleTiles(deck);
    setSelectedTileIdx(null);
  };

  const startGame = () => {
    stateRef.current = {
      lane: 1,
      heroY: 230,
      heroVy: 0,
      onGround: true,
      items: [],
      frame: 0,
      score: 0,
      lives: 3,
    };
    setScore(0);
    setLives(3);
    setQuizIndex(0);
    setQuizFeedback('');
    if (game.genre === 'puzzle') {
      initPuzzleBoard(game);
    }
    setPhase('PLAYING');
    playTone(520, 0.14);
  };

  const triggerJumpOrMove = (action: 'left' | 'right' | 'jump') => {
    if (phase !== 'PLAYING') return;
    const st = stateRef.current;
    if (game.genre === 'racing') {
      if (action === 'left') st.lane = Math.max(0, st.lane - 1);
      if (action === 'right') st.lane = Math.min(2, st.lane + 1);
      playTone(400, 0.06);
    } else if (game.genre === 'platformer') {
      if (action === 'jump' && st.onGround) {
        st.heroVy = -11.5;
        st.onGround = false;
        playTone(580, 0.1);
      }
      if (action === 'left') st.lane = Math.max(0, st.lane - 1);
      if (action === 'right') st.lane = Math.min(2, st.lane + 1);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (phase !== 'PLAYING') return;
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        e.preventDefault();
        triggerJumpOrMove('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        e.preventDefault();
        triggerJumpOrMove('right');
      } else if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w') {
        if (game.genre === 'platformer' || game.genre === 'racing') {
          e.preventDefault();
          triggerJumpOrMove('jump');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, game.genre]);

  // 2D Canvas Engine for Platformer & Racing
  useEffect(() => {
    if (game.genre !== 'platformer' && game.genre !== 'racing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;

    const renderFrame = () => {
      const W = canvas.width;
      const H = canvas.height;
      const st = stateRef.current;

      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, game.bgTop || '#0F172A');
      grad.addColorStop(1, game.bgBottom || '#1E293B');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      if (game.genre === 'racing') {
        // 3-lane highway
        const roadLeft = W * 0.2;
        const roadW = W * 0.6;
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(roadLeft, 0, roadW, H);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 3;
        ctx.setLineDash([18, 16]);
        ctx.lineDashOffset = -(st.frame * (game.speed || 4) * 1.4);
        ctx.beginPath();
        ctx.moveTo(roadLeft + roadW / 3, 0);
        ctx.lineTo(roadLeft + roadW / 3, H);
        ctx.moveTo(roadLeft + (roadW * 2) / 3, 0);
        ctx.lineTo(roadLeft + (roadW * 2) / 3, H);
        ctx.stroke();
        ctx.setLineDash([]);

        if (phase === 'PLAYING') {
          st.frame += 1;
          if (st.frame % Math.max(20, 44 - game.speed * 3) === 0) {
            st.items.push({
              lane: Math.floor(Math.random() * 3),
              x: 0,
              y: -30,
              kind: Math.random() < 0.45 ? 'coin' : 'enemy',
              speedMul: 0.9 + Math.random() * 0.4,
            });
          }
          const heroX = roadLeft + (st.lane + 0.5) * (roadW / 3);
          const heroY = H - 56;

          const remaining: typeof st.items = [];
          for (const item of st.items) {
            item.y += (game.speed || 4) * 1.35 * item.speedMul;
            const ix = roadLeft + (item.lane + 0.5) * (roadW / 3);
            if (Math.abs(ix - heroX) < 34 && Math.abs(item.y - heroY) < 34) {
              if (item.kind === 'coin') {
                st.score += 10;
                setScore(st.score);
                playTone(760, 0.09);
                if (st.score >= game.winScore) {
                  setPhase('WON');
                  playTone(960, 0.25);
                }
              } else {
                st.lives -= 1;
                setLives(st.lives);
                playTone(180, 0.2, 'sawtooth');
                if (st.lives <= 0) setPhase('GAME_OVER');
              }
              continue;
            }
            if (item.y < H + 40) remaining.push(item);
          }
          st.items = remaining;
        }

        // Draw items & hero
        for (const item of st.items) {
          const ix = roadLeft + (item.lane + 0.5) * (roadW / 3);
          ctx.font = '30px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(item.kind === 'coin' ? game.collectibleEmoji : game.enemyEmoji, ix, item.y);
        }

        const hx = roadLeft + (st.lane + 0.5) * (roadW / 3);
        const hy = H - 56;
        if (heroImageRef.current) {
          ctx.drawImage(heroImageRef.current, hx - 22, hy - 22, 44, 44);
        } else {
          ctx.fillStyle = game.heroColor;
          ctx.beginPath();
          ctx.roundRect(hx - 22, hy - 22, 44, 44, 12);
          ctx.fill();
          ctx.font = '28px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(game.heroEmoji, hx, hy + 2);
        }
      } else {
        // Platformer ground
        const groundY = H - 56;
        ctx.fillStyle = '#065F46';
        ctx.fillRect(0, groundY, W, 56);
        ctx.fillStyle = '#10B981';
        ctx.fillRect(0, groundY, W, 6);

        const heroX = 110 + st.lane * 70;

        if (phase === 'PLAYING') {
          st.frame += 1;
          st.heroVy += 0.62;
          st.heroY += st.heroVy;
          if (st.heroY >= groundY - 24) {
            st.heroY = groundY - 24;
            st.heroVy = 0;
            st.onGround = true;
          }

          if (st.frame % Math.max(28, 65 - game.speed * 5) === 0) {
            const isCoin = Math.random() < 0.5;
            st.items.push({
              x: W + 30,
              y: isCoin ? groundY - 85 - Math.random() * 55 : groundY - 22,
              lane: 0,
              kind: isCoin ? 'coin' : 'enemy',
              speedMul: 1,
            });
          }

          const remaining: typeof st.items = [];
          for (const item of st.items) {
            item.x -= (game.speed || 4) * 1.3;
            if (Math.abs(item.x - heroX) < 32 && Math.abs(item.y - st.heroY) < 34) {
              if (item.kind === 'coin') {
                st.score += 10;
                setScore(st.score);
                playTone(720, 0.09);
                if (st.score >= game.winScore) {
                  setPhase('WON');
                  playTone(940, 0.25);
                }
              } else {
                st.lives -= 1;
                setLives(st.lives);
                playTone(170, 0.2, 'sawtooth');
                if (st.lives <= 0) setPhase('GAME_OVER');
              }
              continue;
            }
            if (item.x > -40) remaining.push(item);
          }
          st.items = remaining;
        }

        for (const item of st.items) {
          ctx.font = '30px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(item.kind === 'coin' ? game.collectibleEmoji : game.enemyEmoji, item.x, item.y);
        }

        if (heroImageRef.current) {
          ctx.drawImage(heroImageRef.current, heroX - 24, st.heroY - 24, 48, 48);
        } else {
          ctx.fillStyle = game.heroColor;
          ctx.beginPath();
          ctx.roundRect(heroX - 22, st.heroY - 22, 44, 44, 12);
          ctx.fill();
          ctx.font = '28px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(game.heroEmoji, heroX, st.heroY + 2);
        }
      }

      if (phase === 'PLAYING') {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    renderFrame();
    return () => cancelAnimationFrame(rafId);
  }, [phase, game]);

  const handleTileTap = (idx: number) => {
    if (phase !== 'PLAYING') return;
    const tile = puzzleTiles[idx];
    if (!tile || tile.revealed || tile.matched) return;

    const next = puzzleTiles.map((t, i) => (i === idx ? { ...t, revealed: true } : t));
    setPuzzleTiles(next);

    if (selectedTileIdx === null) {
      setSelectedTileIdx(idx);
      playTone(440, 0.06);
    } else {
      const first = next[selectedTileIdx];
      const second = next[idx];
      if (first.emoji === second.emoji) {
        const matchedNext = next.map((t, i) =>
          i === selectedTileIdx || i === idx ? { ...t, matched: true, revealed: true } : t
        );
        setPuzzleTiles(matchedNext);
        setSelectedTileIdx(null);
        const nextScore = score + 20;
        setScore(nextScore);
        playTone(760, 0.12);
        if (matchedNext.every((t) => t.matched)) {
          setPhase('WON');
          playTone(960, 0.25);
        }
      } else {
        playTone(210, 0.12);
        const prevIdx = selectedTileIdx;
        setSelectedTileIdx(null);
        setTimeout(() => {
          setPuzzleTiles((curr) =>
            curr.map((t, i) => (i === prevIdx || i === idx ? { ...t, revealed: false } : t))
          );
        }, 550);
      }
    }
  };

  const handleAnswerQuiz = (optIndex: number) => {
    const questions = game.questions?.length ? game.questions : STARTER_GAME.questions!;
    const current = questions[quizIndex];
    if (!current) return;

    if (optIndex === current.correctIndex) {
      const nextScore = score + 25;
      setScore(nextScore);
      setQuizFeedback(lang === 'te' ? 'సరైన సమాధానం! (+25 పాయింట్లు)' : 'Correct Answer! (+25 pts)');
      playTone(780, 0.12);
    } else {
      setLives((l) => {
        const nl = l - 1;
        if (nl <= 0) setPhase('GAME_OVER');
        return nl;
      });
      setQuizFeedback(
        lang === 'te'
          ? `తప్పు! సరైనది: ${current.options[current.correctIndex]}`
          : `Incorrect! Correct: ${current.options[current.correctIndex]}`
      );
      playTone(200, 0.16, 'sawtooth');
    }

    setTimeout(() => {
      setQuizFeedback('');
      if (quizIndex + 1 >= questions.length) {
        setPhase((prev) => (prev === 'GAME_OVER' ? 'GAME_OVER' : 'WON'));
      } else {
        setQuizIndex((q) => q + 1);
      }
    }, 900);
  };

  const handleGenerateGame = async () => {
    if (!prompt.trim()) {
      setError(lang === 'te' ? 'దయచేసి గేమ్ ఆలోచన రాయండి.' : 'Please enter a game prompt first.');
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/studio/generate-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, genre, language: lang === 'te' ? 'bilingual' : 'en' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate game');
      const created: GameProject = {
        ...data.game,
        heroImageUrl: game.heroImageUrl,
      };
      setGame(created);
      setPhase('MENU');
    } catch (err: any) {
      setError(err.message || 'Game generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveGame(game);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleUploadHeroImage = (files: FileList | null) => {
    if (!files || !files[0]) return;
    const reader = new FileReader();
    reader.onload = () => {
      setGame((g) => ({ ...g, heroImageUrl: reader.result as string }));
    };
    reader.readAsDataURL(files[0]);
  };

  const handleDownloadHtmlGame = () => {
    const safeTitle = game.title.replace(/[<>&"]/g, '');
    const configJson = JSON.stringify(game).replace(/</g, '\\u003c');
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>${safeTitle}</title>
<style>
  body { margin:0; font-family:system-ui,sans-serif; background:#0B0D12; color:#F8FAFC; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; padding:16px; }
  canvas { border-radius:16px; border:1px solid rgba(255,255,255,0.15); max-width:100%; background:#0F172A; }
  .bar { display:flex; gap:12px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
  button { background:#F59E0B; color:#0B0D12; border:none; padding:10px 18px; border-radius:10px; font-weight:700; cursor:pointer; }
</style>
</head>
<body>
  <div class="bar">
    <strong>${safeTitle}</strong>
    <span id="hud">Score: 0</span>
    <button onclick="restart()">Play / Restart</button>
  </div>
  <canvas id="c" width="640" height="360"></canvas>
  <p style="font-size:13px;color:#94A3B8;max-width:640px;text-align:center;">${game.instructions}</p>
  <script>
    const GAME = ${configJson};
    const c = document.getElementById('c');
    const ctx = c.getContext('2d');
    const hud = document.getElementById('hud');
    let heroX = 120, heroY = 270, vy = 0, lane = 1, items = [], score = 0, frame = 0, alive = true;
    function restart(){ heroY=270; vy=0; lane=1; items=[]; score=0; frame=0; alive=true; loop(); }
    window.addEventListener('keydown', e => {
      if(e.key==='ArrowLeft') lane = Math.max(0,lane-1);
      if(e.key==='ArrowRight') lane = Math.min(2,lane+1);
      if((e.key===' '||e.key==='ArrowUp') && heroY>=268) vy = -11;
    });
    c.addEventListener('pointerdown', () => { if(heroY>=268) vy=-11; });
    function loop(){
      if(!alive) return;
      frame++;
      ctx.fillStyle = GAME.bgTop || '#0F172A';
      ctx.fillRect(0,0,640,360);
      ctx.fillStyle = '#065F46'; ctx.fillRect(0,300,640,60);
      vy += 0.6; heroY = Math.min(272, heroY + vy);
      if(frame % 45 === 0) items.push({ x:660, y: Math.random()<0.5?190:274, coin: Math.random()<0.55 });
      items = items.filter(it => {
        it.x -= (GAME.speed || 4) * 1.3;
        ctx.font='28px sans-serif'; ctx.textAlign='center';
        ctx.fillText(it.coin ? GAME.collectibleEmoji : GAME.enemyEmoji, it.x, it.y);
        if(Math.abs(it.x - (110 + lane*60)) < 30 && Math.abs(it.y - heroY) < 30){
          if(it.coin){ score+=10; hud.textContent='Score: '+score; return false; }
          else { alive=false; alert('Game Over! Score: '+score); return false; }
        }
        return it.x > -30;
      });
      ctx.font='34px sans-serif'; ctx.textAlign='center';
      ctx.fillText(GAME.heroEmoji, 110 + lane*60, heroY);
      if(alive) requestAnimationFrame(loop);
    }
    loop();
  </script>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${game.title.replace(/\s+/g, '_').slice(0, 40)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const genres: { id: GameGenre; te: string; en: string }[] = [
    { id: 'platformer', te: 'ప్లాట్‌ఫారమ్ జంప్', en: 'Platformer' },
    { id: 'racing', te: 'రేసింగ్ గేమ్', en: 'Racing' },
    { id: 'puzzle', te: 'పజిల్ మ్యాచ్', en: 'Puzzle' },
    { id: 'quiz', te: 'క్విజ్ గేమ్', en: 'Quiz Game' },
    { id: 'educational', te: 'విద్యా గేమ్', en: 'Educational' },
  ];

  const activeQuestions = game.questions?.length ? game.questions : STARTER_GAME.questions!;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {lang === 'te' ? 'AI గేమ్ మేకర్ స్టూడియో' : 'AI Game Maker Studio'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {lang === 'te'
              ? 'టెక్స్ట్ ప్రాంప్ట్ & మీ పాత్ర చిత్రంతో ఆడగల 2D గేమ్‌లు (రేసింగ్, ప్లాట్‌ఫారమ్, పజిల్, క్విజ్) తయారు చేసి HTML గా డౌన్లోడ్ చేయండి.'
              : 'Create playable 2D Racing, Platformer, Puzzle, Quiz & Educational games from text prompts and custom hero images.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            {savedNotice ? <Check className="w-4 h-4 text-emerald-500" /> : <Save className="w-4 h-4" />}
            <span>{savedNotice ? (lang === 'te' ? 'సేవ్ అయింది' : 'Saved') : lang === 'te' ? 'గేమ్ సేవ్' : 'Save Game'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadHtmlGame}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{lang === 'te' ? 'HTML గేమ్ డౌన్లోడ్' : 'Export Game (.html)'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: AI Prompt + Genre + Hero Image Upload */}
        <div className="lg:col-span-5 bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {lang === 'te' ? 'గేమ్ రకం (Genre)' : 'Game Genre'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {genres.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setGenre(g.id);
                    setGame((prev) => ({ ...prev, genre: g.id }));
                    setPhase('MENU');
                  }}
                  className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    genre === g.id
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'bg-slate-100 dark:bg-[#0B0D12] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10'
                  }`}
                >
                  {lang === 'te' ? g.te : g.en}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {lang === 'te' ? 'గేమ్ కథ & ఆలోచన' : 'Game Concept Prompt'}
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                lang === 'te'
                  ? 'ఉదా: తెలుగు గ్రామంలో సైకిల్ రేసింగ్ గేమ్ లేదా పిల్లల తెలుగు క్విజ్ గేమ్...'
                  : 'Example: Village bicycle race dodging cows and collecting mangoes...'
              }
              className="w-full bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <input
            ref={heroInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleUploadHeroImage(e.target.files)}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => heroInputRef.current?.click()}
              className="min-h-[42px] flex-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-amber-500" />
              <span>{lang === 'te' ? 'హీరో చిత్రం అప్లోడ్' : 'Upload Hero Sprite'}</span>
            </button>
            {game.heroImageUrl && (
              <button
                type="button"
                onClick={() => setGame((g) => ({ ...g, heroImageUrl: undefined }))}
                className="min-h-[42px] px-3 py-2 rounded-xl bg-rose-500/10 text-rose-500 text-xs font-medium cursor-pointer"
              >
                {lang === 'te' ? 'తొలగించు' : 'Clear'}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleGenerateGame}
            disabled={generating}
            className="min-h-[48px] w-full px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>
              {generating
                ? lang === 'te'
                  ? 'AI గేమ్ తయారవుతోంది...'
                  : 'Generating Playable Game...'
                : lang === 'te'
                  ? 'AI తో కొత్త గేమ్ సృష్టించండి'
                  : 'Generate Playable 2D Game'}
            </span>
          </button>

          {/* Honest 3D Prototype Capability Notice */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {lang === 'te' ? '2D ప్లేయబుల్ ఇంజన్ vs 3D గేమ్ ప్రోటోటైప్' : '2D Playable Engine & 3D Prototype Status'}
              </p>
              <p className="mt-1 leading-relaxed">
                {lang === 'te'
                  ? '2D రేసింగ్, జంప్, పజిల్, క్విజ్ గేమ్‌లు పూర్తిగా ఇక్కడే ఆడవచ్చు మరియు HTML ఫైల్‌గా ఎగుమతి చేయవచ్చు. పూర్తి 3D మెష్ / Unity APK ఎగుమతికి బాహ్య 3D గేమ్ ఇంజన్ అవసరం.'
                  : '2D Racing, Platformer, Puzzle & Quiz games are 100% playable live and exportable as standalone HTML. Full 3D mesh physics requires an external 3D engine (Unity/Godot).'}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Playable Stage & Controls */}
        <div className="lg:col-span-7 bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{game.title}</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {lang === 'te' ? game.storyTe || game.instructions : game.storyEn || game.instructions}
              </p>
            </div>
            <div className="flex items-center gap-3 font-mono-tabular text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 text-amber-500 font-bold">
                Score: {score}/{game.winScore}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 text-rose-500 font-bold">
                {'❤️'.repeat(Math.max(0, lives))}
              </span>
            </div>
          </div>

          {/* Interactive Stage */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 bg-[#0F172A]">
            {game.genre === 'puzzle' ? (
              <div className="p-6 min-h-[340px] flex flex-col items-center justify-center gap-4">
                {phase === 'PLAYING' ? (
                  <div className="grid grid-cols-4 gap-2.5 w-full max-w-sm">
                    {puzzleTiles.map((tile, idx) => (
                      <button
                        key={tile.id}
                        type="button"
                        onClick={() => handleTileTap(idx)}
                        className={`aspect-square rounded-xl text-2xl font-bold flex items-center justify-center transition-all cursor-pointer ${
                          tile.matched
                            ? 'bg-emerald-500/20 border-2 border-emerald-500'
                            : tile.revealed
                              ? 'bg-amber-500/20 border-2 border-amber-400'
                              : 'bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-400'
                        }`}
                      >
                        {tile.revealed || tile.matched ? tile.emoji : '?'}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-slate-300 text-sm">
                    {lang === 'te' ? '4×4 మెమరీ మ్యాచ్ పజిల్ సిద్ధంగా ఉంది' : '4×4 Memory Match Puzzle Ready'}
                  </div>
                )}
              </div>
            ) : game.genre === 'quiz' || game.genre === 'educational' ? (
              <div className="p-6 min-h-[340px] flex flex-col justify-center gap-4">
                {phase === 'PLAYING' ? (
                  <div className="flex flex-col gap-4 max-w-xl mx-auto w-full">
                    <div className="text-xs font-mono-tabular text-amber-400">
                      Question {quizIndex + 1} / {activeQuestions.length}
                    </div>
                    <h3 className="text-lg font-bold text-white leading-snug">
                      {activeQuestions[quizIndex]?.question}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {activeQuestions[quizIndex]?.options.map((opt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleAnswerQuiz(idx)}
                          className="min-h-[46px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-left text-sm font-medium text-slate-100 border border-white/10 transition-colors cursor-pointer"
                        >
                          {idx + 1}. {opt}
                        </button>
                      ))}
                    </div>
                    {quizFeedback && (
                      <p className="text-sm font-semibold text-amber-300 text-center">{quizFeedback}</p>
                    )}
                  </div>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-slate-300 text-sm">
                    {lang === 'te' ? 'తెలుగు & ఇంగ్లీష్ క్విజ్ సిద్ధంగా ఉంది' : 'Bilingual Quiz Stage Ready'}
                  </div>
                )}
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                width={640}
                height={340}
                className="w-full aspect-[16/9] block touch-none"
              />
            )}

            {/* Overlay Menu / Pause / Game Over / Won */}
            {phase !== 'PLAYING' && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center gap-4">
                <Gamepad2 className="w-10 h-10 text-amber-400" />
                <h3 className="text-xl font-bold text-white">
                  {phase === 'WON'
                    ? lang === 'te'
                      ? 'విజయం! మీరు గెలిచారు!'
                      : 'Victory! You Won!'
                    : phase === 'GAME_OVER'
                      ? lang === 'te'
                        ? 'గేమ్ ముగిసింది'
                        : 'Game Over'
                      : phase === 'PAUSED'
                        ? lang === 'te'
                          ? 'తాత్కాలిక విరామం'
                          : 'Paused'
                        : game.title}
                </h3>
                <p className="text-xs text-slate-300 max-w-md">{game.instructions}</p>
                <div className="flex items-center gap-3">
                  {phase === 'PAUSED' && (
                    <button
                      type="button"
                      onClick={() => setPhase('PLAYING')}
                      className="min-h-[44px] px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm flex items-center gap-2 cursor-pointer"
                    >
                      <Play className="w-4 h-4" />
                      <span>{lang === 'te' ? 'కొనసాగించు' : 'Resume'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={startGame}
                    className="min-h-[44px] px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm flex items-center gap-2 cursor-pointer"
                  >
                    {phase === 'MENU' ? <Play className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                    <span>
                      {phase === 'MENU'
                        ? lang === 'te'
                          ? 'గేమ్ ఆడండి'
                          : 'Play Game'
                        : lang === 'te'
                          ? 'మళ్లీ ఆడండి'
                          : 'Play Again'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Touch Controls & HUD Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {(game.genre === 'racing' || game.genre === 'platformer') && (
                <>
                  <button
                    type="button"
                    onClick={() => triggerJumpOrMove('left')}
                    className="min-h-[46px] min-w-[52px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0B0D12] dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 flex items-center justify-center cursor-pointer"
                    aria-label="Move left"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  {game.genre === 'platformer' && (
                    <button
                      type="button"
                      onClick={() => triggerJumpOrMove('jump')}
                      className="min-h-[46px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowUp className="w-4 h-4" />
                      <span>{lang === 'te' ? 'జంప్' : 'Jump'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => triggerJumpOrMove('right')}
                    className="min-h-[46px] min-w-[52px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0B0D12] dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 flex items-center justify-center cursor-pointer"
                    aria-label="Move right"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {phase === 'PLAYING' && (
                <button
                  type="button"
                  onClick={() => setPhase('PAUSED')}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>{lang === 'te' ? 'పాజ్' : 'Pause'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={startGame}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{lang === 'te' ? 'రీస్టార్ట్' : 'Restart'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
