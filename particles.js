// パーティクルシステム + 時刻テーマ管理
const Particles = (() => {

  let canvas, ctx;
  let particles = [];
  let frameCount = 0;
  let currentTheme = 'night';

  // ===== 時刻テーマ定義 =====
  const THEMES = {
    morning: {
      bgDeep: '#150c1e', bgMid: '#2a1540',
      accent: '#FFB7C5', accent2: '#f5c6e0',
      particleType: 'sakura', count: 18,
      label: '🌸 朝'
    },
    afternoon: {
      bgDeep: '#0c1420', bgMid: '#152038',
      accent: '#90caf9', accent2: '#b0d4ff',
      particleType: 'sparkle', count: 22,
      label: '✨ 昼'
    },
    evening: {
      bgDeep: '#1a0a0c', bgMid: '#2a1018',
      accent: '#FF9A5C', accent2: '#FFB77A',
      particleType: 'firefly', count: 16,
      label: '🔥 夕'
    },
    night: {
      bgDeep: '#0f0c1a', bgMid: '#1a1630',
      accent: '#b48ef0', accent2: '#f0a8d0',
      particleType: 'star', count: 28,
      label: '🌙 夜'
    }
  };

  function getTimeTheme() {
    const h = new Date().getHours();
    if (h >= 5  && h < 11) return 'morning';
    if (h >= 11 && h < 17) return 'afternoon';
    if (h >= 17 && h < 20) return 'evening';
    return 'night';
  }

  function applyTheme(name) {
    const t = THEMES[name];
    const r = document.documentElement;
    r.style.setProperty('--bg-deep',  t.bgDeep);
    r.style.setProperty('--bg-mid',   t.bgMid);
    r.style.setProperty('--accent',   t.accent);
    r.style.setProperty('--accent2',  t.accent2);
    document.body.dataset.theme = name;

    // テーマラベル更新
    const lbl = document.getElementById('theme-label');
    if (lbl) lbl.textContent = t.label;
  }

  // ===== パーティクルクラス =====
  class Particle {
    constructor(type, x, y) {
      this.type = type;
      this._init(x, y);
    }

    _init(ox, oy) {
      const W = canvas.width, H = canvas.height;

      if (this.type === 'star') {
        this.x  = ox ?? Math.random() * W;
        this.y  = oy ?? Math.random() * H;
        this.r  = Math.random() * 1.5 + 0.4;
        this.drift = (Math.random() - 0.5) * 0.12;
        this.phi   = Math.random() * Math.PI * 2;
        this.phiSpd = Math.random() * 0.025 + 0.008;
        this.baseAlpha = Math.random() * 0.5 + 0.2;
        this.alpha = this.baseAlpha;

      } else if (this.type === 'sakura') {
        this.x   = ox ?? Math.random() * W;
        this.y   = oy ?? -15;
        this.r   = Math.random() * 5 + 3;
        this.vy  = Math.random() * 1.1 + 0.4;
        this.drift = (Math.random() - 0.5) * 0.5;
        this.wobble = Math.random() * Math.PI * 2;
        this.wobbleAmp = Math.random() * 0.55 + 0.2;
        this.rot   = Math.random() * Math.PI * 2;
        this.rotSpd = (Math.random() - 0.5) * 0.04;
        this.alpha = Math.random() * 0.5 + 0.3;

      } else if (this.type === 'sparkle') {
        this.x   = ox ?? Math.random() * W;
        this.y   = oy ?? -15;
        this.r   = Math.random() * 4 + 2;
        this.vy  = Math.random() * 0.9 + 0.3;
        this.drift = (Math.random() - 0.5) * 0.4;
        this.rot   = Math.random() * Math.PI * 2;
        this.rotSpd = (Math.random() - 0.5) * 0.08;
        this.alpha = 0;

      } else if (this.type === 'firefly') {
        this.x   = ox ?? Math.random() * W;
        this.y   = oy ?? Math.random() * H * 0.7;
        this.r   = Math.random() * 2 + 1.5;
        this.tx  = Math.random() * W;
        this.ty  = Math.random() * H * 0.75;
        this.spd = Math.random() * 0.008 + 0.003;
        this.phi = Math.random() * Math.PI * 2;
        this.phiSpd = Math.random() * 0.04 + 0.015;
        this.peakAlpha = Math.random() * 0.8 + 0.2;
        this.alpha = 0;

      } else if (this.type === 'heart') {
        this.x    = ox ?? W * 0.5;
        this.y    = oy ?? H * 0.4;
        this.r    = Math.random() * 9 + 5;
        this.vx   = (Math.random() - 0.5) * 3.5;
        this.vy   = -(Math.random() * 3 + 2.5);
        this.life = 1.0;
        this.decay = Math.random() * 0.014 + 0.007;
        this.alpha = 1;
      }
    }

    update() {
      switch (this.type) {
        case 'star':
          this.phi += this.phiSpd;
          this.alpha = this.baseAlpha + Math.sin(this.phi) * 0.25;
          this.x += this.drift;
          if (this.x < 0) this.x = canvas.width;
          if (this.x > canvas.width) this.x = 0;
          break;

        case 'sakura':
          this.wobble += 0.028;
          this.x += this.drift + Math.sin(this.wobble) * this.wobbleAmp;
          this.y += this.vy;
          this.rot += this.rotSpd;
          if (this.y > canvas.height + 20) this._init();
          break;

        case 'sparkle':
          this.y += this.vy;
          this.x += this.drift;
          this.rot += this.rotSpd;
          this.alpha = Math.sin((this.y / canvas.height) * Math.PI) * 0.65 + 0.05;
          if (this.y > canvas.height + 20) this._init();
          break;

        case 'firefly':
          this.x += (this.tx - this.x) * this.spd + (Math.random() - 0.5) * 0.4;
          this.y += (this.ty - this.y) * this.spd + (Math.random() - 0.5) * 0.3;
          if (Math.hypot(this.tx - this.x, this.ty - this.y) < 8) {
            this.tx = Math.random() * canvas.width;
            this.ty = Math.random() * canvas.height * 0.72;
          }
          this.phi += this.phiSpd;
          this.alpha = (0.35 + Math.sin(this.phi) * 0.42) * this.peakAlpha;
          break;

        case 'heart':
          this.x += this.vx;
          this.y += this.vy;
          this.vy += 0.07; // 重力
          this.life -= this.decay;
          this.alpha = Math.max(0, this.life * 0.95);
          break;
      }
    }

    isDead() { return this.type === 'heart' && this.life <= 0; }

    draw() {
      if (this.alpha <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.alpha);

      switch (this.type) {
        case 'star': {
          ctx.shadowColor = '#c8a0ff';
          ctx.shadowBlur  = this.r * 5;
          ctx.fillStyle   = '#ffffff';
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'sakura': {
          ctx.translate(this.x, this.y);
          ctx.rotate(this.rot);
          // 5枚の花びら（小さな円を72°ずつ配置）
          ctx.shadowColor = '#ffaabf';
          ctx.shadowBlur  = 5;
          for (let i = 0; i < 5; i++) {
            ctx.save();
            ctx.rotate((i * Math.PI * 2) / 5);
            ctx.fillStyle = i % 2 === 0 ? '#FFD0DC' : '#FFB7C5';
            ctx.beginPath();
            ctx.arc(0, -this.r * 0.62, this.r * 0.42, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          // 中心
          ctx.fillStyle = '#FFECF0';
          ctx.beginPath();
          ctx.arc(0, 0, this.r * 0.22, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'sparkle': {
          ctx.translate(this.x, this.y);
          ctx.rotate(this.rot);
          ctx.fillStyle   = '#d4b8ff';
          ctx.shadowColor = '#b48ef0';
          ctx.shadowBlur  = 8;
          // 4方向の菱形
          for (let i = 0; i < 4; i++) {
            ctx.save();
            ctx.rotate((i * Math.PI) / 2);
            ctx.beginPath();
            ctx.moveTo(0, -this.r);
            ctx.lineTo(this.r * 0.15, -this.r * 0.15);
            ctx.lineTo(0, 0);
            ctx.lineTo(-this.r * 0.15, -this.r * 0.15);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
          break;
        }
        case 'firefly': {
          ctx.shadowColor = '#FFE082';
          ctx.shadowBlur  = 18;
          ctx.fillStyle   = '#FFF9C4';
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
          ctx.fill();
          // 外輪
          ctx.shadowBlur  = 28;
          ctx.globalAlpha *= 0.4;
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.r * 2.5, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'heart': {
          ctx.translate(this.x, this.y);
          ctx.fillStyle   = '#ff85b3';
          ctx.shadowColor = '#ff69b4';
          ctx.shadowBlur  = 12;
          // ♥ テキスト描画（シンプルで確実）
          ctx.font        = `${this.r * 2}px serif`;
          ctx.textAlign   = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('♥', 0, 0);
          break;
        }
      }
      ctx.restore();
    }
  }

  // ===== 初期化・リサイズ =====
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function spawnAll(immediate = false) {
    const t = THEMES[currentTheme];
    // 既存の非ハートパーティクルを消す
    particles = particles.filter(p => p.type === 'heart');

    for (let i = 0; i < t.count; i++) {
      const p = new Particle(t.particleType);
      // 初回は画面全体にばらまく
      if (immediate && t.particleType !== 'firefly') {
        p.y = Math.random() * canvas.height;
      }
      particles.push(p);
    }
  }

  // ===== アニメーションループ =====
  function loop() {
    requestAnimationFrame(loop);
    frameCount++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 落下系パーティクルの補充
    const t = THEMES[currentTheme];
    const falling = ['sakura', 'sparkle'];
    if (falling.includes(t.particleType) && frameCount % 90 === 0) {
      const cnt = particles.filter(p => p.type === t.particleType).length;
      if (cnt < t.count) {
        particles.push(new Particle(t.particleType, Math.random() * canvas.width, -15));
      }
    }

    // 更新・描画・死亡削除
    particles = particles.filter(p => !p.isDead());
    for (const p of particles) { p.update(); p.draw(); }
  }

  // ===== 公開API =====

  /** DOMContentLoaded 後に呼ぶ */
  function setup() {
    canvas = document.createElement('canvas');
    canvas.id = 'particles-canvas';
    canvas.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';
    document.body.insertBefore(canvas, document.body.firstChild);
    ctx = canvas.getContext('2d');

    resize();
    window.addEventListener('resize', () => { resize(); spawnAll(true); });

    currentTheme = getTimeTheme();
    applyTheme(currentTheme);
    spawnAll(true);
    loop();

    // 1時間ごとにテーマ確認
    setInterval(() => {
      const next = getTimeTheme();
      if (next !== currentTheme) {
        currentTheme = next;
        applyTheme(next);
        spawnAll(false);
      }
    }, 60 * 1000);
  }

  /** キャラクター位置からハートをバースト */
  function burstHearts(x, y, count = 10) {
    for (let i = 0; i < count; i++) {
      particles.push(new Particle('heart', x, y));
    }
  }

  return { setup, burstHearts, getTimeTheme };
})();
