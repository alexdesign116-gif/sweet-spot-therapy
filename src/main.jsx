import React from 'react';
import { createRoot } from 'react-dom/client';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import './styles.css';

const CONTACT = { x: 50, y: 50 };
const CONTACT_PROGRESS = 0.68;
const ACTIVE_ZONE_TOP = 56;
const RACKET_HOME = { x: 78, y: 84 };
const SWING_MIN_SPEED = 0.32;
const RELEASE_MIN_SPEED = 0.1;
const PREP_MS = 3000;
const RESULT_PAUSE_MS = 980;
const SHOTS_PER_TEST = 8;

const targets = [
  '放短球的同事',
  '不回消息的人',
  '周一早会',
  '乱飘的二发',
  '临时改期',
  '拍面不明物'
];

const feedback = {
  Perfect: ['好球。', '对！就是这一下！', '这拍面，正。', '今天甜区开光了。', '这一下，有点舒服。', '不许抽人。', '今天这巴掌……啊不是，这拍，有点正。'],
  Good: ['吃住了。', '可以。', '这球有了。', '拍面不错。', '这一下挺干净。'],
  OK: ['蹭到了。', '拍面歪了点。', '擦边过。', '这球算你打上了。'],
  Early: ['急什么！', '球还没来。', '别抢点。', '情绪到了，球还没到。'],
  Late: ['引拍！！', '晚半拍。', '抽空气了。', '你是不是又在思考人生？'],
  Miss: ['拍面呢？', '眼睛看球！', '人没抽到。', '球也没抽到。', '空气今天受伤最重。']
};

const coachShouts = ['引拍！！', '拍面！！', '看球！！', '脚步！！', '吃球！！', '别发死力！！', '随挥！！', '重心！！', '不要抡！！'];

const resultLabels = {
  Perfect: '上甜区！',
  Good: '吃住了。',
  OK: '蹭到了。',
  Early: '抢点了。',
  Late: '晚半拍。',
  Miss: '框了。',
  Prep: '准备',
  Timing: '来球',
  Ready: '就绪'
};

const statLabels = {
  Perfect: '上甜区',
  Good: '吃住',
  OK: '蹭到',
  Early: '抢点',
  Late: '晚点',
  Miss: '框了'
};

let sharedAudioContext;

function getAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioContext();
  }
  return sharedAudioContext;
}

function unlockAudio() {
  const context = getAudioContext();
  if (!context) return;

  if (context.state === 'suspended') {
    context.resume().catch(() => {});
  }

  try {
    const gain = context.createGain();
    const osc = context.createOscillator();
    const now = context.currentTime;
    gain.gain.setValueAtTime(0.00001, now);
    osc.frequency.setValueAtTime(1, now);
    osc.connect(gain).connect(context.destination);
    osc.start(now);
    osc.stop(now + 0.01);
  } catch {
    // Best-effort mobile audio unlock.
  }
}

const patterns = [
  { name: 'left-to-center', start: { x: 12, y: -8 }, end: { x: 74, y: 92 }, bend: -12 },
  { name: 'right-to-center', start: { x: 88, y: -8 }, end: { x: 26, y: 92 }, bend: 12 },
  { name: 'center straight', start: { x: 50, y: -10 }, end: { x: 50, y: 92 }, bend: 0 },
  { name: 'high arc', start: { x: 22, y: -8 }, end: { x: 70, y: 92 }, bend: -22 },
  { name: 'low fast ball', start: { x: 62, y: -7 }, end: { x: 44, y: 92 }, bend: 5, fast: true },
  { name: 'slight curve left', start: { x: 58, y: -8 }, end: { x: 32, y: 92 }, bend: -16 },
  { name: 'slight curve right', start: { x: 42, y: -8 }, end: { x: 68, y: 92 }, bend: 16 }
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function pickCoachComment(result, recent) {
  const pool = Math.random() < 0.2 ? coachShouts : feedback[result];
  const fresh = pool.filter((line) => !recent.includes(line));
  return randomItem(fresh.length ? fresh : pool);
}

function emptyStats() {
  return {
    total: 0,
    counts: { Perfect: 0, Good: 0, OK: 0, Early: 0, Late: 0, Miss: 0 },
    speedTotal: 0,
    backswingTotal: 0,
    bestStreak: 0
  };
}

function personalityFromStats(stats) {
  const { counts } = stats;
  if (counts.Perfect >= 3) {
    return {
      name: '甜区猎人',
      lines: ['你不是来打球的。', '你是来追求那一下。'],
      coach: '这拍面，有点东西。'
    };
  }
  if (counts.Early >= 3) {
    return {
      name: '抢点狂魔',
      lines: ['球还没过网，', '你已经准备结束这一分。'],
      coach: '别抢！！'
    };
  }
  if (counts.Late >= 3) {
    return {
      name: '晚半拍大师',
      lines: ['你总觉得下一拍会更好。', '所以这一拍，总慢半拍。'],
      coach: '引拍！！'
    };
  }
  if (counts.Miss + counts.OK >= 5) {
    return {
      name: '拍框收藏家',
      lines: ['你的拍框，', '今天比线床更忙。'],
      coach: '拍面呢？？？'
    };
  }
  if (stats.speedTotal / Math.max(stats.total, 1) > 0.72 && counts.Perfect + counts.Good < 3) {
    return {
      name: '发力全靠缘分',
      lines: ['力量拉满。', '命中率随缘。'],
      coach: '力到了。球没到。'
    };
  }
  return {
    name: '冷静上分型',
    lines: ['没有花活。', '就是稳定。'],
    coach: '继续。不用演。'
  };
}

function rounded(value) {
  return Math.round(value * 10) / 10;
}

function controlForPath(start, contact, end, t, bend) {
  const inv = 1 - t;
  return {
    x: (contact.x - inv * inv * start.x - t * t * end.x) / (2 * inv * t) + bend,
    y: (contact.y - inv * inv * start.y - t * t * end.y) / (2 * inv * t)
  };
}

function pointOnPath(path, progress) {
  const t = clamp(progress, 0, 1);
  const inv = 1 - t;
  return {
    x: inv * inv * path.start.x + 2 * inv * t * path.control.x + t * t * path.end.x,
    y: inv * inv * path.start.y + 2 * inv * t * path.control.y + t * t * path.end.y
  };
}

function samplePath(path, count = 16) {
  return Array.from({ length: count }, (_, index) => pointOnPath(path, index / (count - 1)));
}

function makeRoundConfig() {
  const pattern = randomItem(patterns);
  const duration = Math.round((pattern.fast ? 1400 : 1600) + Math.random() * (pattern.fast ? 600 : 1200));
  const control = controlForPath(pattern.start, CONTACT, pattern.end, CONTACT_PROGRESS, pattern.bend);
  const path = { ...pattern, control, duration, samples: [] };
  path.samples = samplePath(path, 18);
  return {
    id: Date.now(),
    target: randomItem(targets),
    path
  };
}

function pathToSvg(samples) {
  return samples.map((point) => `${rounded(point.x)},${rounded(point.y)}`).join(' ');
}

function ballPosition(path, launchTime) {
  if (!launchTime) return path.start;
  return pointOnPath(path, clamp((performance.now() - launchTime) / path.duration, 0, 1));
}

function resultFromContact(ball, validSwing, crossesPath) {
  if (!validSwing) return 'Miss';
  const distance = Math.hypot(ball.x - CONTACT.x, ball.y - CONTACT.y);
  if (!crossesPath && distance > 30) return 'Miss';
  if (distance <= 12) return 'Perfect';
  if (distance <= 22) return 'Good';
  if (distance <= 34) return 'OK';
  if (ball.y < CONTACT.y - 30) return 'Early';
  if (ball.y > CONTACT.y + 34) return 'Late';
  if (distance <= 42) return 'OK';
  if (distance <= 52) return ball.y < CONTACT.y ? 'Good' : 'OK';
  if (ball.y < CONTACT.y - 38) return 'Early';
  if (ball.y > CONTACT.y + 42) return 'Late';
  return 'OK';
}

function racketPoseFromPoint(point, power = 0) {
  return {
    x: clamp(point.x, 12, 88),
    y: clamp(point.y, 48, 91),
    rotate: 20 + power * 25
  };
}

function playImpactSound(result = 'Good') {
  const context = getAudioContext();
  if (!context) return;

  try {
    if (context.state === 'suspended') {
      context.resume().catch(() => {});
    }
    const profile = {
      Perfect: { master: 0.82, slap: 1.35, snap: 1.18, string: 1.15, sub: 0.24, tail: 1.1, frame: 0 },
      Good: { master: 0.42, slap: 0.28, snap: 0.82, string: 0.88, sub: 0.09, tail: 0.42, frame: 0 },
      OK: { master: 0.34, slap: 0.08, snap: 0.34, string: 0.36, sub: 0.04, tail: 0.18, frame: 0.72 },
      Early: { master: 0.2, slap: 0, snap: 0.18, string: 0.18, sub: 0, tail: 0, frame: 0.45 },
      Late: { master: 0.2, slap: 0, snap: 0.16, string: 0.16, sub: 0, tail: 0, frame: 0.5 },
      Miss: { master: 0.18, slap: 0, snap: 0, string: 0, sub: 0, tail: 0, frame: 0 }
    }[result] || { master: 0.34, slap: 0.2, snap: 0.5, string: 0.55, sub: 0.04, tail: 0.2, frame: 0.2 };
    const now = context.currentTime;
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(profile.master, now + 0.004);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    master.connect(context.destination);

    if (result === 'Miss') {
      const whoosh = context.createBufferSource();
      const buffer = context.createBuffer(1, context.sampleRate * 0.18, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        const sweep = Math.sin((i / data.length) * Math.PI);
        data[i] = (Math.random() * 2 - 1) * sweep * 0.7;
      }
      const filter = context.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(760, now);
      whoosh.buffer = buffer;
      whoosh.playbackRate.setValueAtTime(0.95, now);
      whoosh.playbackRate.exponentialRampToValueAtTime(1.9, now + 0.16);
      whoosh.connect(filter).connect(master);
      whoosh.start(now);
      whoosh.stop(now + 0.18);
      return;
    }

    if (profile.sub > 0) {
      const sub = context.createOscillator();
      const subGain = context.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(92, now);
      sub.frequency.exponentialRampToValueAtTime(58, now + 0.055);
      subGain.gain.setValueAtTime(profile.sub, now);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
      sub.connect(subGain).connect(master);
      sub.start(now);
      sub.stop(now + 0.08);
    }

    if (profile.string > 0) {
      const stringPop = context.createOscillator();
      const stringGain = context.createGain();
      const stringFilter = context.createBiquadFilter();
      stringPop.type = result === 'OK' || result === 'Early' || result === 'Late' ? 'triangle' : 'square';
      stringPop.frequency.setValueAtTime(result === 'Perfect' ? 1160 : result === 'Good' ? 820 : 560, now + 0.006);
      stringPop.frequency.exponentialRampToValueAtTime(result === 'Perfect' ? 410 : 260, now + 0.07);
      stringFilter.type = 'bandpass';
      stringFilter.frequency.setValueAtTime(result === 'Perfect' ? 1850 : result === 'Good' ? 1350 : 760, now);
      stringFilter.Q.setValueAtTime(result === 'Perfect' ? 3.2 : 1.4, now);
      stringGain.gain.setValueAtTime(0.18 * profile.string, now + 0.006);
      stringGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      stringPop.connect(stringFilter).connect(stringGain).connect(master);
      stringPop.start(now + 0.006);
      stringPop.stop(now + 0.1);
    }

    if (profile.slap > 0) {
      const slap = context.createBufferSource();
      const buffer = context.createBuffer(1, context.sampleRate * 0.055, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        const decay = Math.pow(1 - i / data.length, result === 'Perfect' ? 3.8 : 2.8);
        const click = i < 24 ? 1 : 0.45;
        data[i] = (Math.random() * 2 - 1) * decay * click;
      }
      const slapFilter = context.createBiquadFilter();
      slapFilter.type = 'bandpass';
      slapFilter.frequency.setValueAtTime(result === 'Perfect' ? 2650 : 1850, now);
      slapFilter.Q.setValueAtTime(result === 'Perfect' ? 1.15 : 0.85, now);
      slap.buffer = buffer;
      slap.connect(slapFilter).connect(master);
      slap.start(now);
      slap.stop(now + 0.06);

      if (result === 'Perfect') {
        const slapWide = context.createBufferSource();
        const wideFilter = context.createBiquadFilter();
        const panner = context.createStereoPanner?.();
        slapWide.buffer = buffer;
        slapWide.playbackRate.setValueAtTime(1.08, now);
        wideFilter.type = 'highpass';
        wideFilter.frequency.setValueAtTime(2100, now);
        if (panner) {
          panner.pan.setValueAtTime(-0.72, now);
          slapWide.connect(wideFilter).connect(panner).connect(master);
        } else {
          slapWide.connect(wideFilter).connect(master);
        }
        slapWide.start(now + 0.004);
        slapWide.stop(now + 0.052);
      }
    }

    if (profile.frame > 0) {
      const frame = context.createOscillator();
      const frameGain = context.createGain();
      frame.type = 'sawtooth';
      frame.frequency.setValueAtTime(result === 'OK' ? 315 : 230, now + 0.008);
      frame.frequency.exponentialRampToValueAtTime(155, now + 0.09);
      frameGain.gain.setValueAtTime(0.1 * profile.frame, now + 0.008);
      frameGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.105);
      frame.connect(frameGain).connect(master);
      frame.start(now + 0.008);
      frame.stop(now + 0.11);
    }

    if (profile.snap > 0) {
      const crack = context.createOscillator();
      const crackGain = context.createGain();
      crack.type = 'triangle';
      crack.frequency.setValueAtTime(result === 'Perfect' ? 1480 : 920, now + 0.018);
      crack.frequency.exponentialRampToValueAtTime(result === 'Perfect' ? 620 : 430, now + 0.085);
      crackGain.gain.setValueAtTime(0.11 * profile.snap, now + 0.018);
      crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
      crack.connect(crackGain).connect(master);
      crack.start(now + 0.018);
      crack.stop(now + 0.11);
    }

    if (profile.tail > 0) {
      const tail = context.createOscillator();
      const tailGain = context.createGain();
      tail.type = 'sine';
      tail.frequency.setValueAtTime(result === 'Perfect' ? 1760 : 980, now + 0.048);
      tail.frequency.exponentialRampToValueAtTime(result === 'Perfect' ? 1180 : 680, now + 0.14);
      tailGain.gain.setValueAtTime(0.045 * profile.tail, now + 0.048);
      tailGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
      tail.connect(tailGain).connect(master);
      tail.start(now + 0.048);
      tail.stop(now + 0.16);
    }

  } catch {
    // Audio is best-effort; browsers may block it outside a trusted gesture.
  }
}

function App() {
  const [score, setScore] = React.useState(0);
  const [streak, setStreak] = React.useState(0);
  const [phase, setPhase] = React.useState('prep');
  const [result, setResult] = React.useState('Prep');
  const [message, setMessage] = React.useState('看线路。');
  const [roundConfig, setRoundConfig] = React.useState(() => makeRoundConfig());
  const [countdown, setCountdown] = React.useState(3);
  const [nowOpen, setNowOpen] = React.useState(false);
  const [shotStats, setShotStats] = React.useState(() => emptyStats());
  const [diagnosis, setDiagnosis] = React.useState(null);
  const [perfectFlash, setPerfectFlash] = React.useState(null);
  const [spark, setSpark] = React.useState(null);
  const [trail, setTrail] = React.useState([]);
  const [swing, setSwing] = React.useState(null);
  const [racket, setRacket] = React.useState({ mode: 'idle', power: 0, x: RACKET_HOME.x, y: RACKET_HOME.y, rotate: 28 });
  const [impact, setImpact] = React.useState(null);
  const pointerStart = React.useRef(null);
  const lastPointer = React.useRef(null);
  const maxPower = React.useRef(0);
  const peakBackswing = React.useRef(null);
  const swingStartTime = React.useRef(0);
  const swingMetric = React.useRef({ speed: 0, backswing: 0 });
  const recentComments = React.useRef([]);
  const impactLocked = React.useRef(false);
  const courtRef = React.useRef(null);
  const launchTime = React.useRef(0);
  const timers = React.useRef([]);

  const clearTimers = React.useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }, []);

  const schedule = React.useCallback((callback, delay) => {
    const timer = window.setTimeout(callback, delay);
    timers.current.push(timer);
    return timer;
  }, []);

  const resetPointers = React.useCallback(() => {
    pointerStart.current = null;
    lastPointer.current = null;
    maxPower.current = 0;
    peakBackswing.current = null;
    impactLocked.current = false;
  }, []);

  const startPrep = React.useCallback(() => {
    clearTimers();
    const nextConfig = makeRoundConfig();
    launchTime.current = 0;
    resetPointers();
    setRoundConfig(nextConfig);
    setPhase('prep');
    setResult('Prep');
    setCountdown(3);
    setNowOpen(false);
    setSpark(null);
    setImpact(null);
    setPerfectFlash(null);
    setTrail([]);
    setSwing(null);
    setRacket({ mode: 'idle', power: 0, x: RACKET_HOME.x, y: RACKET_HOME.y, rotate: 28 });
    setMessage('看线路。');

    playCountdownCue(3);
    schedule(() => {
      setCountdown(2);
      playCountdownCue(2);
    }, 1000);
    schedule(() => {
      setCountdown(1);
      playCountdownCue(1);
    }, 2000);
    schedule(() => {
      setCountdown('来了！');
      playCountdownCue('go');
    }, PREP_MS - 180);
    schedule(() => {
      launchTime.current = performance.now();
      setPhase('incoming');
      setResult('Timing');
      setMessage('挥拍穿过球。');
      schedule(() => {
        setNowOpen(true);
        playSoftCue();
      }, Math.max(0, nextConfig.path.duration * CONTACT_PROGRESS - 80));
      schedule(() => setNowOpen(false), nextConfig.path.duration * CONTACT_PROGRESS + 120);
      schedule(() => {
        if (impactLocked.current) return;
        setPhase('missed');
        setResult('Late');
        setStreak(0);
        setMessage('晚半拍。');
        setSpark({ x: CONTACT.x, y: CONTACT.y + 18, id: Date.now(), miss: true });
        schedule(startPrep, RESULT_PAUSE_MS);
      }, nextConfig.path.duration + 260);
    }, PREP_MS);
  }, [clearTimers, resetPointers, schedule]);

  const finishRound = React.useCallback((nextResult, ball, validHit) => {
    clearTimers();
    const cleanHit = ['Perfect', 'Good', 'OK'].includes(nextResult);
    const coachComment = pickCoachComment(nextResult, recentComments.current);
    recentComments.current = [...recentComments.current.slice(-4), coachComment];
    let shouldShowDiagnosis = false;
    impactLocked.current = true;
    setResult(nextResult);
    setPhase(cleanHit ? 'hit' : 'missed');
    setNowOpen(false);
    setShotStats((current) => {
      const nextStats = {
        total: current.total + 1,
        counts: {
          ...current.counts,
          [nextResult]: current.counts[nextResult] + 1
        },
        speedTotal: current.speedTotal + swingMetric.current.speed,
        backswingTotal: current.backswingTotal + swingMetric.current.backswing,
        bestStreak: Math.max(current.bestStreak, streak + (nextResult === 'Perfect' ? 1 : 0))
      };
      if (nextStats.total >= SHOTS_PER_TEST) {
        shouldShowDiagnosis = true;
        setDiagnosis({ ...nextStats, personality: personalityFromStats(nextStats) });
      }
      return shouldShowDiagnosis ? emptyStats() : nextStats;
    });

    if (cleanHit) {
      const points = nextResult === 'Perfect' ? 4 : nextResult === 'Good' ? 2 : 1;
      setScore((value) => value + points);
      setStreak((value) => (nextResult === 'Perfect' ? value + 1 : 0));
      if (nextResult === 'Perfect') {
        setPerfectFlash({ id: Date.now() });
      }
      setImpact({ id: Date.now(), x: ball.x, y: ball.y });
      setSpark({ x: ball.x, y: ball.y, id: Date.now() });
      setRacket({ mode: 'impact', power: 0, x: ball.x, y: clamp(ball.y + 8, 24, 70), rotate: -34 });
      schedule(() => {
        setRacket({ mode: 'follow-through', power: 0, x: clamp(ball.x - 18, 16, 60), y: clamp(ball.y - 16, 14, 52), rotate: -64 });
      }, 140);
      if (navigator.vibrate) {
        const pattern = nextResult === 'Perfect' ? [24, 18, 42] : nextResult === 'Good' ? [18, 18, 30] : [12, 12, 22];
        navigator.vibrate(pattern);
      }
      playImpactSound(nextResult);
      setMessage(coachComment);
    } else {
      setStreak(0);
      setImpact(null);
      setSpark({ x: ball.x, y: ball.y, id: Date.now(), miss: true });
      setRacket(validHit ? { mode: 'follow-through', power: 0, x: clamp(ball.x - 12, 16, 62), y: clamp(ball.y - 12, 16, 62), rotate: -48 } : { mode: 'idle', power: 0, x: RACKET_HOME.x, y: RACKET_HOME.y, rotate: 28 });
      playImpactSound(validHit ? nextResult : 'Miss');
      setMessage(coachComment);
    }

    schedule(() => {
      if (!shouldShowDiagnosis) startPrep();
    }, RESULT_PAUSE_MS);
  }, [clearTimers, schedule, startPrep, streak]);

  React.useEffect(() => {
    startPrep();
    return () => {
      clearTimers();
    };
  }, [clearTimers, startPrep]);

  function playSoftCue() {
    const context = getAudioContext();
    if (!context) return;
    try {
      if (context.state === 'suspended') {
        context.resume().catch(() => {});
      }
      const osc = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.055, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
      osc.connect(gain).connect(context.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } catch {
      // Optional timing cue.
    }
  }

  function playCountdownCue(step) {
    const context = getAudioContext();
    if (!context) return;
    try {
      if (context.state === 'suspended') {
        context.resume().catch(() => {});
      }
      const now = context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(step === 'go' ? 880 : 440 + Number(step) * 90, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(step === 'go' ? 0.08 : 0.045, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(gain).connect(context.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } catch {
      // Countdown audio is best-effort.
    }
  }

  function saveRecord() {
    if (!diagnosis) return;
    const lines = [
      '今日网球人格诊断',
      diagnosis.personality.name,
      ...diagnosis.personality.lines,
      `教练：${diagnosis.personality.coach}`,
      '',
      ...Object.keys(statLabels).map((key) => `${statLabels[key]}：${diagnosis.counts[key]}`),
      `平均挥速：${(diagnosis.speedTotal / Math.max(diagnosis.total, 1)).toFixed(2)}`,
      `平均引拍：${(diagnosis.backswingTotal / Math.max(diagnosis.total, 1)).toFixed(2)}s`,
      `最长连击：${diagnosis.bestStreak}`,
      '',
      '今天，你上甜区了吗？'
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sweet-spot-therapy-result.txt';
    link.click();
    URL.revokeObjectURL(url);
  }

  function pointFromEvent(event) {
    const rect = courtRef.current.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100)
    };
  }

  function startSwing(event) {
    if (!courtRef.current || phase !== 'incoming') return;
    const point = pointFromEvent(event);
    if (point.y < ACTIVE_ZONE_TOP) return;
    unlockAudio();
    event.currentTarget.setPointerCapture(event.pointerId);
    const now = performance.now();
    pointerStart.current = point;
    lastPointer.current = { ...point, time: now };
    swingStartTime.current = now;
    swingMetric.current = { speed: 0, backswing: 0 };
    maxPower.current = 0;
    peakBackswing.current = { ...point, time: now };
    impactLocked.current = false;
    setRacket({ mode: 'ready', power: 0, ...racketPoseFromPoint(point, 0) });
    setTrail([point]);
    setMessage('引拍。');
  }

  function maybeFinishSwing(point, validMotion, swingSpeed = 0) {
    const ball = ballPosition(roundConfig.path, launchTime.current);
    const crossesPath = Math.hypot(point.x - ball.x, point.y - ball.y) < 44 || Math.hypot(point.x - CONTACT.x, point.y - CONTACT.y) < 46;
    const nextResult = resultFromContact(ball, validMotion, crossesPath);
    setSwing({
      start: racketPoseFromPoint(peakBackswing.current || point, Math.max(maxPower.current, 0.45)),
      end: { x: ball.x, y: ball.y },
      id: Date.now()
    });
    swingMetric.current = {
      speed: swingSpeed,
      backswing: Math.max(0, (performance.now() - swingStartTime.current) / 1000)
    };
    maxPower.current = 0;
    peakBackswing.current = null;
    finishRound(nextResult, ball, validMotion);
  }

  function handlePointerMove(event) {
    if (!pointerStart.current || phase !== 'incoming' || impactLocked.current) return;
    const next = pointFromEvent(event);
    const now = performance.now();
    const previous = lastPointer.current || { ...next, time: now };
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const dt = Math.max(now - previous.time, 16);
    const speed = Math.hypot(dx, dy) / dt;
    const start = pointerStart.current;
    const loadDistance = Math.max(0, next.x - start.x) + Math.max(0, next.y - start.y) * 1.15;
    const power = clamp(loadDistance / 28, 0, 1);
    const forwardSwipe = dx < -1.2 && dy < -1.2;

    if (power >= maxPower.current) {
      maxPower.current = power;
      peakBackswing.current = { ...next, time: now };
    }

    lastPointer.current = { ...next, time: now };
    setTrail((points) => [...points.slice(-12), next]);

    if (speed > SWING_MIN_SPEED && forwardSwipe && maxPower.current > 0.12) {
      maybeFinishSwing(next, true, speed);
      return;
    }

    setRacket({
      mode: power > 0.12 ? 'backswing' : 'ready',
      power,
      ...racketPoseFromPoint(next, power)
    });
    setMessage(power > 0.18 ? '挥拍穿过球。' : '引拍。');
  }

  function handlePointerUp(event) {
    if (!pointerStart.current || phase !== 'incoming' || impactLocked.current) {
      resetPointers();
      return;
    }

    const end = pointFromEvent(event);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setTrail((points) => [...points, end]);
    const peak = peakBackswing.current || pointerStart.current;
    const releaseDx = end.x - peak.x;
    const releaseDy = end.y - peak.y;
    const releaseDt = Math.max(performance.now() - (peak.time || performance.now()), 16);
    const releaseSpeed = Math.hypot(releaseDx, releaseDy) / releaseDt;
    const validMotion = maxPower.current > 0.12 && releaseDx < -10 && releaseDy < -10 && releaseSpeed > RELEASE_MIN_SPEED;

    pointerStart.current = null;
    lastPointer.current = null;
    maybeFinishSwing(end, validMotion, releaseSpeed);
  }

  function resetGame() {
    clearTimers();
    setScore(0);
    setStreak(0);
    setResult('Ready');
    setMessage('按住下半场。');
    setDiagnosis(null);
    setShotStats(emptyStats());
    startPrep();
  }

  const pathSamples = roundConfig.path.samples;
  const ballXs = pathSamples.map((point) => `${point.x}%`);
  const ballYs = pathSamples.map((point) => `${point.y}%`);
  const ballTimes = pathSamples.map((_, index) => index / (pathSamples.length - 1));

  return (
    <main className="shell">
      <section className="game-card" aria-label="Sweet Spot Therapy tennis game">
        <header className="topbar">
          <div>
            <p className="eyebrow">甜区疗法</p>
            <h1>Hit clean. Feel weird.</h1>
            <p className="subhead">网球人格测试</p>
          </div>
          <button className="icon-button" type="button" onClick={resetGame} aria-label="Reset game">
            <RotateCcw size={18} strokeWidth={2.25} />
          </button>
        </header>

        <div className="score-strip" aria-label="Score">
          <div>
            <span>甜区命中</span>
            <strong>{score}</strong>
          </div>
          <div>
            <span>连击</span>
            <strong>{streak}</strong>
          </div>
          <div>
            <span>时机</span>
            <strong>{resultLabels[result] || result}</strong>
          </div>
        </div>

        <div
          ref={courtRef}
          className={`court ${impact ? 'shake' : ''} ${nowOpen ? 'now-open' : ''}`}
          onPointerDown={startSwing}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            resetPointers();
            setTrail([]);
          }}
        >
          <div className="baseline top" />
          <div className="baseline bottom" />
          <div className="netline" />
          <div className="target-ring" />
          <div className="active-zone">
            <span>按住</span>
            <span>引拍</span>
            <span>挥拍穿过球</span>
          </div>

          <svg className="trajectory" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline className="preview-path" points={pathToSvg(pathSamples)} />
            {phase === 'incoming' && <polyline className="live-path" points={pathToSvg(pathSamples)} />}
          </svg>

          <div className="contact-oval" />
          <div className="timing-window good-window">
            <span>吃住</span>
          </div>
          <div className="timing-window perfect-window">
            <span>甜区</span>
          </div>
          <div className="sweet-zone">
            <span>甜区</span>
          </div>

          <AnimatePresence>
            {phase === 'prep' && (
              <motion.div className="prep-panel" initial={{ opacity: 0, x: '-50%', y: 8 }} animate={{ opacity: 1, x: '-50%', y: 0 }} exit={{ opacity: 0, x: '-50%', y: -8 }}>
                <span>下一球</span>
                <strong>{roundConfig.target}</strong>
                <motion.em
                  key={countdown}
                  className={typeof countdown === 'number' ? 'countdown-number' : 'countdown-go'}
                  initial={{ scale: 0.78, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                >
                  {countdown}
                </motion.em>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {nowOpen && (
              <motion.div className="now-pulse" initial={{ opacity: 0, scale: 0.72 }} animate={{ opacity: [0, 1, 0], scale: [0.72, 1.1, 1] }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
                现在
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {perfectFlash && (
              <motion.div
                key={perfectFlash.id}
                className="perfect-flash"
                initial={{ opacity: 0, scale: 0.68, y: 10 }}
                animate={{ opacity: [0, 1, 1, 0], scale: [0.68, 1.12, 1.04, 0.96], y: [10, -4, -8] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                上甜区！
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="popLayout">
            {phase === 'incoming' && (
              <motion.div
                key={roundConfig.id}
                className="ball"
                initial={{ left: ballXs[0], top: ballYs[0], scale: 0.45, opacity: 0.9, filter: 'blur(0.5px)' }}
                animate={{ left: ballXs, top: ballYs, scale: 1.08, opacity: 1, filter: 'blur(0px)' }}
                exit={{
                  left: phase === 'hit' ? '-18%' : `${ballPosition(roundConfig.path, launchTime.current).x}%`,
                  top: phase === 'hit' ? '-18%' : '92%',
                  rotate: phase === 'hit' ? -34 : 0,
                  scaleX: phase === 'hit' ? [1.9, 0.54, 0.82] : 0.9,
                  scaleY: phase === 'hit' ? [0.48, 1.58, 0.68] : 0.9,
                  opacity: phase === 'hit' ? [1, 1, 0] : 0,
                  transition: { duration: phase === 'hit' ? 0.26 : 0.24, ease: [0.08, 0.98, 0.18, 1] }
                }}
                transition={{ duration: roundConfig.path.duration / 1000, times: ballTimes, ease: 'linear' }}
              />
            )}
          </AnimatePresence>

          {trail.length > 1 && (
            <svg className="trail elastic-trail" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path d={`M ${trail[0].x} ${trail[0].y} Q ${racket.x} ${racket.y} ${trail[trail.length - 1].x} ${trail[trail.length - 1].y}`} />
            </svg>
          )}

          <AnimatePresence>
            {swing && (
              <motion.div
                key={swing.id}
                className="swing-arc"
                style={{
                  left: `${(swing.start.x + swing.end.x) / 2}%`,
                  top: `${(swing.start.y + swing.end.y) / 2}%`,
                  rotate: `${Math.atan2(swing.end.y - swing.start.y, swing.end.x - swing.start.x) * (180 / Math.PI)}deg`
                }}
                initial={{ scaleX: 0.2, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                exit={{ opacity: 0, scaleX: 1.2 }}
                transition={{ duration: 0.28 }}
              />
            )}
          </AnimatePresence>

          <div className="power-meter" aria-hidden="true">
            <motion.div animate={{ scaleY: Math.max(0.04, racket.power) }} transition={{ type: 'spring', stiffness: 240, damping: 24 }} />
          </div>

          <motion.div
            className={`racket ${racket.mode}`}
            style={{ left: `${racket.x}%`, top: `${racket.y}%` }}
            animate={{ rotate: racket.rotate }}
            transition={racket.mode === 'follow-through' ? { type: 'spring', stiffness: 260, damping: 18 } : { type: 'spring', stiffness: 420, damping: 28 }}
          >
            <div className="racket-head" />
            <div className="racket-throat" />
            <div className="racket-handle">
              <span />
            </div>
          </motion.div>

          <AnimatePresence>
            {spark && (
              <motion.div
                key={spark.id}
                className={spark.miss ? 'spark miss' : 'spark'}
                style={{ left: `${spark.x}%`, top: `${spark.y}%` }}
                initial={{ scale: 0.45, opacity: 0 }}
                animate={{ scale: [0.75, 1.35, 1], opacity: [0, 1, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.75, ease: 'easeOut' }}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {impact && (
              <motion.div
                key={impact.id}
                className="impact-text"
                style={{ left: `${impact.x}%`, top: `${impact.y}%` }}
                initial={{ opacity: 0, scale: 0.55, rotate: -7, y: 10 }}
                animate={{ opacity: [0, 1, 1, 0], scale: [0.55, 1.22, 1, 0.96], rotate: [-7, 3, -1], y: [10, -8, -18] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.46, ease: 'easeOut' }}
              >
                THWACK!
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {diagnosis && (
              <motion.div className="diagnosis-panel" initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }}>
                <span className="diagnosis-kicker">今日网球人格诊断</span>
                <h2>{diagnosis.personality.name}</h2>
                <div className="diagnosis-lines">
                  {diagnosis.personality.lines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
                <div className="diagnosis-coach">
                  <span>教练</span>
                  <strong>{diagnosis.personality.coach}</strong>
                </div>
                <div className="diagnosis-stats">
                  {Object.keys(statLabels).map((key) => (
                    <div key={key}>
                      <span>{statLabels[key]}</span>
                      <strong>{diagnosis.counts[key]}</strong>
                    </div>
                  ))}
                  <div>
                    <span>平均挥速</span>
                    <strong>{(diagnosis.speedTotal / Math.max(diagnosis.total, 1)).toFixed(2)}</strong>
                  </div>
                  <div>
                    <span>引拍时间</span>
                    <strong>{(diagnosis.backswingTotal / Math.max(diagnosis.total, 1)).toFixed(2)}s</strong>
                  </div>
                  <div>
                    <span>最长连击</span>
                    <strong>{diagnosis.bestStreak}</strong>
                  </div>
                </div>
                <p className="share-line">今天，你上甜区了吗？</p>
                <button className="play-again" type="button" onClick={resetGame}>
                  再打一局
                </button>
                <button className="save-record" type="button" onClick={saveRecord}>
                  保存战绩
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <footer className="status">
          <motion.p key={message} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            {message}
          </motion.p>
          <span>按住下半场任意位置，向右下引拍，再快速向左上挥拍，穿过发光击球区。</span>
        </footer>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
