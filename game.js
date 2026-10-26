(() => {
  "use strict";

  const canvas = document.querySelector("#gameCanvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const FLOOR = 610;
  const TAU = Math.PI * 2;

  const $ = (selector) => document.querySelector(selector);
  const ui = {
    start: $("#startScreen"),
    pause: $("#pauseScreen"),
    result: $("#resultScreen"),
    toast: $("#toast"),
    lives: $("#lives"),
    energy: $("#energyMeter"),
    zone: $("#zoneLabel"),
    score: $("#score"),
    resultKicker: $("#resultKicker"),
    resultTitle: $("#resultTitle"),
    resultMessage: $("#resultMessage"),
    resultScore: $("#resultScore"),
    resultCombo: $("#resultCombo"),
    sound: $("#soundButton"),
    cheat: $("#cheatScreen"),
    cheatButton: $("#cheatButton"),
    applyCheats: $("#applyCheats"),
    closeCheats: $("#closeCheats"),
    cheatInvincible: $("#cheatInvincible"),
    cheatInfiniteEnergy: $("#cheatInfiniteEnergy"),
    cheatMegaGun: $("#cheatMegaGun"),
    cheatTwentyLives: $("#cheatTwentyLives"),
    weapon: $("#weaponLabel"),
    pauseButton: $("#pauseButton")
  };

  const levels = [
    {
      name: "黑潮工业区",
      code: "BLACK COAST",
      length: 4700,
      sky: ["#0a202b", "#182d35"],
      glow: "#50d7d0",
      bossName: "潮汐守卫",
      bossType: "sentinel"
    },
    {
      name: "赤锈高架",
      code: "RUST HIGHWAY",
      length: 5100,
      sky: ["#291b22", "#302c34"],
      glow: "#ff9866",
      bossName: "轨道巨像",
      bossType: "colossus"
    },
    {
      name: "零点核心",
      code: "ZERO CORE",
      length: 5400,
      sky: ["#10152e", "#1b2743"],
      glow: "#b6a0ff",
      bossName: "零点主机",
      bossType: "core"
    }
  ];

  const input = {
    left: false,
    right: false,
    fire: false,
    jump: false,
    down: false,
    jumpPressed: false
  };

  const game = {
    mode: "menu",
    levelIndex: 0,
    level: null,
    player: null,
    cameraX: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    comboTimer: 0,
    lives: 3,
    maxLives: 3,
    energy: 100,
    cheats: {
      invincible: false,
      infiniteEnergy: false,
      megaGun: false,
      twentyLives: false
    },
    cheatReturnMode: "menu",
    bullets: [],
    enemyBullets: [],
    enemies: [],
    particles: [],
    pickups: [],
    platforms: [],
    decorations: [],
    boss: null,
    bossTriggered: false,
    bossDefeated: false,
    fireCooldown: 0,
    shake: 0,
    lastTime: 0,
    toastTimer: 0,
    sound: true,
    audio: null
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function rand(seed) {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
      a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function formatScore(value) {
    return String(Math.max(0, Math.floor(value))).padStart(6, "0");
  }

  function makePlayer() {
    return {
      x: 120, y: FLOOR - 62, w: 38, h: 62,
      standingHeight: 62, crouchHeight: 40, crouching: false,
      vx: 0, vy: 0, facing: 1,
      onGround: true, coyote: 0, invulnerable: 0,
      step: 0, muzzle: 0
    };
  }

  function loadLevel(index) {
    game.levelIndex = index;
    game.level = levels[index];
    game.cameraX = 0;
    game.player = makePlayer();
    game.bullets = [];
    game.enemyBullets = [];
    game.enemies = [];
    game.particles = [];
    game.pickups = [];
    game.platforms = [];
    game.decorations = [];
    game.boss = null;
    game.bossTriggered = false;
    game.bossDefeated = false;
    buildLevel();
    if (game.mode === "playing") showToast(`${String(index + 1).padStart(2, "0")} / 03  ${game.level.name}`);
    updateHud();
  }

  function buildLevel() {
    const length = game.level.length;
    const platformSets = [
      [
        [560, 480, 280], [1030, 420, 220], [1430, 500, 300],
        [1870, 400, 250], [2310, 480, 310], [2780, 365, 260],
        [3210, 455, 320], [3690, 390, 240], [4110, 475, 270]
      ],
      [
        [510, 445, 250], [930, 350, 260], [1370, 490, 290],
        [1810, 400, 220], [2200, 325, 270], [2620, 460, 340],
        [3090, 380, 230], [3470, 300, 300], [3970, 450, 320],
        [4480, 350, 250]
      ],
      [
        [520, 470, 280], [950, 375, 220], [1330, 295, 260],
        [1780, 445, 300], [2250, 350, 220], [2680, 470, 340],
        [3150, 330, 250], [3540, 430, 280], [3970, 300, 260],
        [4430, 450, 300], [4850, 360, 260]
      ]
    ];
    const set = platformSets[game.levelIndex];
    set.forEach(([x, y, w]) => game.platforms.push({ x, y, w, h: 18 }));

    const typeSets = [
      ["runner", "turret", "runner", "drone", "heavy", "runner", "turret", "drone", "heavy", "runner", "turret"],
      ["runner", "drone", "turret", "heavy", "runner", "drone", "turret", "runner", "heavy", "drone", "runner", "turret"],
      ["drone", "turret", "runner", "heavy", "drone", "runner", "turret", "heavy", "drone", "runner", "turret", "heavy"]
    ];
    const types = typeSets[game.levelIndex];
    for (let i = 0; i < types.length; i += 1) {
      const x = 420 + i * ((length - 890) / types.length) + rand(i + game.levelIndex * 13) * 100;
      const platform = game.platforms[i % game.platforms.length];
      const type = types[i];
      const y = type === "drone" ? 290 + rand(i * 5) * 90 : (platform ? platform.y - 44 : FLOOR - 48);
      game.enemies.push({
        x, y, w: type === "heavy" ? 50 : 40, h: type === "drone" ? 30 : 44,
        type, hp: type === "heavy" ? 3 : 1,
        maxHp: type === "heavy" ? 3 : 1, alive: true,
        dir: -1, shootTimer: 1 + rand(i + 3) * 1.5,
        phase: rand(i + 4) * TAU, homeY: y, hitFlash: 0
      });
    }
    for (let i = 0; i < 12; i += 1) {
      const x = 380 + i * ((length - 700) / 12);
      game.pickups.push({
        x, y: i % 3 === 1 ? 380 + rand(i + 8) * 100 : FLOOR - 35,
        w: 22, h: 22, kind: i % 4 === 0 ? "health" : "energy",
        phase: rand(i + 22) * TAU, collected: false
      });
    }
    for (let i = 0; i < 50; i += 1) {
      game.decorations.push({
        x: rand(i + game.levelIndex * 40) * length,
        type: i % 4,
        height: 30 + rand(i + 60) * 130,
        width: 22 + rand(i + 90) * 56
      });
    }
  }

  function startGame() {
    game.mode = "playing";
    game.score = 0;
    game.combo = 0;
    game.bestCombo = 0;
    game.comboTimer = 0;
    game.lives = game.maxLives;
    game.energy = 100;
    loadLevel(0);
    ui.start.classList.add("is-hidden");
    ui.pause.classList.add("is-hidden");
    ui.result.classList.add("is-hidden");
    ui.cheat.classList.add("is-hidden");
    ui.pauseButton.textContent = "Ⅱ";
    ui.pauseButton.setAttribute("aria-label", "暂停游戏");
    ensureAudio();
    beep(220, .08, "square", .04);
    beep(440, .13, "square", .035, .05);
  }

  function openCheatPanel() {
    if (game.mode === "cheat") return;
    game.cheatReturnMode = game.mode;
    ui.cheatInvincible.checked = game.cheats.invincible;
    ui.cheatInfiniteEnergy.checked = game.cheats.infiniteEnergy;
    ui.cheatMegaGun.checked = game.cheats.megaGun;
    ui.cheatTwentyLives.checked = game.cheats.twentyLives;
    ui.pause.classList.add("is-hidden");
    ui.cheat.classList.remove("is-hidden");
    game.mode = "cheat";
  }

  function closeCheatPanel() {
    ui.cheat.classList.add("is-hidden");
    game.mode = game.cheatReturnMode;
    ui.pause.classList.toggle("is-hidden", game.mode !== "paused");
  }

  function applyCheatConfig() {
    game.cheats.invincible = ui.cheatInvincible.checked;
    game.cheats.infiniteEnergy = ui.cheatInfiniteEnergy.checked;
    game.cheats.megaGun = ui.cheatMegaGun.checked;
    game.cheats.twentyLives = ui.cheatTwentyLives.checked;
    game.maxLives = game.cheats.twentyLives ? 20 : 3;
    game.lives = game.cheats.twentyLives ? 20 : clamp(game.lives, 1, game.maxLives);
    updateHud();
    if (game.cheatReturnMode === "playing" || game.cheatReturnMode === "paused") {
      showToast(game.cheats.megaGun ? "大火力机枪已装配" : "作弊配置已应用");
    }
    closeCheatPanel();
  }

  function togglePause() {
    if (game.mode === "playing") {
      game.mode = "paused";
      ui.pause.classList.remove("is-hidden");
      ui.pauseButton.textContent = "▶";
      ui.pauseButton.setAttribute("aria-label", "继续游戏");
    } else if (game.mode === "paused") {
      game.mode = "playing";
      ui.pause.classList.add("is-hidden");
      ui.pauseButton.textContent = "Ⅱ";
      ui.pauseButton.setAttribute("aria-label", "暂停游戏");
    }
  }

  function endGame(won) {
    game.mode = "result";
    ui.result.classList.remove("is-hidden");
    ui.resultKicker.textContent = won ? "MISSION COMPLETE" : "SIGNAL LOST";
    ui.resultTitle.textContent = won ? "任务完成" : "战线失守";
    ui.resultMessage.textContent = won
      ? "你关闭了零点核心，黑潮工业区重新恢复供电。"
      : "别停在这里。调整节奏，再把这条战线打穿。";
    ui.resultScore.textContent = formatScore(game.score);
    ui.resultCombo.textContent = `x${String(game.bestCombo).padStart(2, "0")}`;
    ui.pauseButton.textContent = "Ⅱ";
    if (won) {
      beep(330, .1, "triangle", .05);
      beep(495, .16, "triangle", .05, .09);
      beep(660, .22, "triangle", .05, .18);
    } else {
      beep(120, .22, "sawtooth", .05);
    }
  }

  function updateHud() {
    ui.lives.textContent = `${game.lives} / ${game.maxLives}`;
    ui.energy.style.width = `${clamp(game.energy, 0, 100)}%`;
    ui.zone.textContent = `${String(game.levelIndex + 1).padStart(2, "0")} / 03`;
    ui.score.textContent = formatScore(game.score);
    ui.weapon.textContent = game.cheats.megaGun ? "机枪" : "标准";
    ui.weapon.style.color = game.cheats.megaGun ? "#ffd56d" : "";
  }

  function showToast(text) {
    ui.toast.textContent = text;
    ui.toast.classList.remove("is-hidden");
    game.toastTimer = 2.2;
  }

  function award(points) {
    game.combo += 1;
    game.bestCombo = Math.max(game.bestCombo, game.combo);
    game.comboTimer = 2.8;
    game.score += points + Math.floor(points * Math.min(1.5, game.combo * .08));
    updateHud();
  }

  function ensureAudio() {
    if (!game.audio) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) game.audio = new AudioContext();
    }
    if (game.audio?.state === "suspended") game.audio.resume();
  }

  function beep(frequency, duration, type = "square", volume = .03, delay = 0) {
    if (!game.sound || !game.audio) return;
    const oscillator = game.audio.createOscillator();
    const gain = game.audio.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, game.audio.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(volume, game.audio.currentTime + delay + .01);
    gain.gain.exponentialRampToValueAtTime(0.0001, game.audio.currentTime + delay + duration);
    oscillator.connect(gain).connect(game.audio.destination);
    oscillator.start(game.audio.currentTime + delay);
    oscillator.stop(game.audio.currentTime + delay + duration + .02);
  }

  function spawnParticle(x, y, color, count = 8, speed = 130) {
    for (let i = 0; i < count; i += 1) {
      const angle = rand(game.score + i * 4 + x) * TAU;
      const power = speed * (.35 + rand(i + x) * .65);
      game.particles.push({
        x, y, vx: Math.cos(angle) * power, vy: Math.sin(angle) * power,
        life: .35 + rand(i + 2) * .45, maxLife: .8, size: 2 + rand(i + 8) * 4, color
      });
    }
  }

  function fire() {
    const megaGun = game.cheats.megaGun;
    if (game.fireCooldown > 0 || (!game.cheats.infiniteEnergy && game.energy <= 0)) return;
    const p = game.player;
    const direction = p.facing || 1;
    game.fireCooldown = megaGun ? .055 : .16;
    if (!game.cheats.infiniteEnergy) game.energy = clamp(game.energy - (megaGun ? 1 : 3), 0, 100);
    p.muzzle = .08;
    const bulletY = p.y + (p.crouching ? 19 : 25);
    const angles = megaGun ? [-.1, 0, .1] : [0];
    for (const angle of angles) {
      game.bullets.push({
        x: p.x + (direction > 0 ? p.w + 2 : -10),
        y: bulletY,
        w: megaGun ? 30 : 18,
        h: megaGun ? 5 : 4,
        vx: direction * (megaGun ? 900 : 720) * Math.cos(angle),
        vy: (megaGun ? 900 : 720) * Math.sin(angle),
        life: 1.8, damage: megaGun ? 2 : 1
      });
    }
    spawnParticle(p.x + (direction > 0 ? p.w + 7 : -4), bulletY + 2, "#ffd56d", megaGun ? 7 : 3, megaGun ? 110 : 70);
    beep(megaGun ? 250 : 180, megaGun ? .025 : .04, "square", megaGun ? .04 : .025);
  }

  function enemyFire(enemy, angle = null) {
    const p = game.player;
    const startX = enemy.x + enemy.w / 2;
    const startY = enemy.y + enemy.h / 2;
    const targetX = p.x + p.w / 2;
    const targetY = p.y + p.h / 2;
    const rawAngle = angle ?? Math.atan2(targetY - startY, targetX - startX);
    game.enemyBullets.push({
      x: startX, y: startY, w: 9, h: 5,
      vx: Math.cos(rawAngle) * 270, vy: Math.sin(rawAngle) * 270,
      life: 3, color: enemy.type === "drone" ? "#ffcf6d" : "#ff6c73"
    });
  }

  function hitPlayer() {
    const p = game.player;
    if (game.cheats.invincible || p.invulnerable > 0) return;
    game.lives -= 1;
    p.invulnerable = 1.6;
    game.shake = 15;
    spawnParticle(p.x + p.w / 2, p.y + p.h / 2, "#ff5e67", 22, 220);
    beep(85, .16, "sawtooth", .05);
    if (game.lives <= 0) {
      endGame(false);
      return;
    }
    p.x = clamp(p.x - 180, 100, game.level.length - 500);
    p.y = FLOOR - p.h;
    p.vx = 0;
    p.vy = -340;
    game.energy = Math.max(game.energy, 45);
    showToast("战术生命 -1 · 保持移动");
    updateHud();
  }

  function destroyEnemy(enemy) {
    enemy.alive = false;
    const color = enemy.type === "drone" ? "#ffcf6d" : "#ff6c73";
    spawnParticle(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, color, enemy.type === "heavy" ? 22 : 12, 190);
    award(enemy.type === "heavy" ? 280 : enemy.type === "turret" ? 160 : 120);
    beep(enemy.type === "heavy" ? 90 : 140, .08, "sawtooth", .035);
    game.shake = Math.max(game.shake, enemy.type === "heavy" ? 8 : 3);
  }

  function damageBoss(amount) {
    if (!game.boss || game.boss.defeated) return;
    game.boss.hp -= amount;
    game.boss.hitFlash = .12;
    game.shake = 5;
    spawnParticle(game.boss.x + game.boss.w / 2, game.boss.y + game.boss.h / 2, game.level.glow, 7, 110);
    if (game.boss.hp <= 0) {
      game.boss.defeated = true;
      game.bossDefeated = true;
      award(1800);
      spawnParticle(game.boss.x + game.boss.w / 2, game.boss.y + game.boss.h / 2, "#ffd56d", 55, 280);
      beep(110, .12, "sawtooth", .045);
      beep(220, .18, "triangle", .05, .08);
      beep(440, .24, "triangle", .05, .2);
      showToast("首领已击破 · 向前推进");
    }
  }

  function triggerBoss() {
    if (game.bossTriggered) return;
    game.bossTriggered = true;
    const x = game.level.length - 355;
    const type = game.level.bossType;
    const stats = type === "core" ? { w: 174, h: 184, hp: 40 } : type === "colossus" ? { w: 164, h: 170, hp: 34 } : { w: 150, h: 155, hp: 30 };
    game.boss = {
      x, y: FLOOR - stats.h, w: stats.w, h: stats.h,
      hp: stats.hp, maxHp: stats.hp, type, hitFlash: 0,
      shootTimer: .7, phase: 0, defeated: false
    };
    showToast(`${game.level.bossName} 已接入战场`);
    beep(70, .35, "sawtooth", .055);
  }

  function updatePlayer(dt) {
    const p = game.player;
    const wantsCrouch = input.down && p.onGround;
    const targetHeight = wantsCrouch ? p.crouchHeight : p.standingHeight;
    if (p.h !== targetHeight) {
      p.y += p.h - targetHeight;
      p.h = targetHeight;
    }
    p.crouching = wantsCrouch;
    const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (direction !== 0) {
      p.facing = direction;
      const speed = p.crouching ? 170 : 260;
      p.vx += (direction * speed - p.vx) * Math.min(1, dt * 12);
      p.step += dt * 13;
    } else {
      p.vx *= Math.pow(.0006, dt);
      p.step += dt * 4;
    }
    if (input.jumpPressed && !p.crouching && (p.onGround || p.coyote > 0)) {
      p.vy = -590;
      p.onGround = false;
      p.coyote = 0;
      spawnParticle(p.x + p.w / 2, p.y + p.h, game.level.glow, 7, 80);
      beep(340, .08, "triangle", .03);
    }
    input.jumpPressed = false;
    p.coyote = p.onGround ? .1 : Math.max(0, p.coyote - dt);
    p.vy += 1450 * dt;
    const oldBottom = p.y + p.h;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = clamp(p.x, 24, game.level.length - 110);
    p.onGround = false;

    if (p.y + p.h >= FLOOR && p.vy >= 0) {
      p.y = FLOOR - p.h;
      p.vy = 0;
      p.onGround = true;
    }
    for (const platform of game.platforms) {
      const overlapsX = p.x + p.w > platform.x && p.x < platform.x + platform.w;
      if (overlapsX && oldBottom <= platform.y && p.y + p.h >= platform.y && p.vy >= 0) {
        p.y = platform.y - p.h;
        p.vy = 0;
        p.onGround = true;
      }
    }
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    p.muzzle = Math.max(0, p.muzzle - dt);
    if (input.fire) fire();
    if (game.bossTriggered && !game.bossDefeated) {
      p.x = Math.min(p.x, game.level.length - 210);
    }
  }

  function updateBullets(dt) {
    for (const bullet of game.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.life <= 0) continue;
      for (const enemy of game.enemies) {
        if (enemy.alive && rectsOverlap(bullet, enemy)) {
          enemy.hp -= bullet.damage;
          bullet.life = 0;
          enemy.hitFlash = .1;
          spawnParticle(bullet.x, bullet.y, "#ffd56d", 4, 70);
          if (enemy.hp <= 0) destroyEnemy(enemy);
          break;
        }
      }
      if (game.boss && !game.boss.defeated && bullet.life > 0 && rectsOverlap(bullet, game.boss)) {
        bullet.life = 0;
        damageBoss(bullet.damage);
      }
    }
    game.bullets = game.bullets.filter((bullet) => bullet.life > 0 && bullet.x > game.cameraX - 80 && bullet.x < game.cameraX + W + 120);

    for (const bullet of game.enemyBullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.life > 0 && rectsOverlap(bullet, game.player)) {
        bullet.life = 0;
        hitPlayer();
      }
    }
    game.enemyBullets = game.enemyBullets.filter((bullet) => bullet.life > 0);
  }

  function updateEnemies(dt) {
    const p = game.player;
    for (const enemy of game.enemies) {
      if (!enemy.alive) continue;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      enemy.shootTimer -= dt;
      if (enemy.type === "runner") {
        enemy.x += enemy.x > p.x + 160 ? -35 * dt : enemy.x < p.x - 220 ? 18 * dt : 0;
        enemy.y = FLOOR - enemy.h;
      } else if (enemy.type === "drone") {
        enemy.x += Math.sin(enemy.phase + performance.now() / 1100) * 18 * dt;
        enemy.y = enemy.homeY + Math.sin(enemy.phase + performance.now() / 650) * 22;
      }
      if (enemy.shootTimer <= 0 && Math.abs(enemy.x - p.x) < 900) {
        enemy.shootTimer = enemy.type === "turret" ? 1.45 : enemy.type === "heavy" ? 1.8 : 1.2;
        if (enemy.type === "drone") {
          enemyFire(enemy, Math.atan2(p.y - enemy.y, p.x - enemy.x));
          enemyFire(enemy, Math.atan2(p.y - enemy.y, p.x - enemy.x) + .18);
        } else {
          enemyFire(enemy);
        }
      }
      if (rectsOverlap(p, enemy)) hitPlayer();
    }

    if (game.boss && !game.boss.defeated) {
      const boss = game.boss;
      boss.hitFlash = Math.max(0, boss.hitFlash - dt);
      boss.phase += dt;
      boss.shootTimer -= dt;
      if (boss.shootTimer <= 0) {
        boss.shootTimer = boss.type === "core" ? .78 : 1.08;
        const center = { x: boss.x + boss.w / 2, y: boss.y + 50 };
        const angle = Math.atan2(p.y + p.h / 2 - center.y, p.x + p.w / 2 - center.x);
        enemyBulletsBurst(center.x, center.y, angle, boss.type === "core" ? 3 : 1);
      }
      if (rectsOverlap(p, boss)) hitPlayer();
    }
  }

  function enemyBulletsBurst(x, y, angle, count) {
    for (let i = 0; i < count; i += 1) {
      const spread = count === 1 ? 0 : (i - 1) * .25;
      game.enemyBullets.push({
        x, y, w: 10, h: 6, vx: Math.cos(angle + spread) * 260,
        vy: Math.sin(angle + spread) * 260, life: 3.2, color: "#ff8c69"
      });
    }
    beep(92, .04, "square", .018);
  }

  function updatePickups(dt) {
    for (const pickup of game.pickups) {
      if (pickup.collected) continue;
      pickup.phase += dt * 3;
      const box = { x: pickup.x, y: pickup.y + Math.sin(pickup.phase) * 5, w: pickup.w, h: pickup.h };
      if (rectsOverlap(game.player, box)) {
        pickup.collected = true;
        if (pickup.kind === "health") {
          game.lives = clamp(game.lives + 1, 1, game.maxLives);
          showToast("战术生命 +1");
          beep(520, .09, "triangle", .04);
        } else {
          game.energy = clamp(game.energy + 32, 0, 100);
          showToast("火力能量补充");
          beep(620, .08, "triangle", .04);
        }
        award(40);
        updateHud();
      }
    }
  }

  function updateParticles(dt) {
    for (const particle of game.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 260 * dt;
      particle.life -= dt;
    }
    game.particles = game.particles.filter((particle) => particle.life > 0);
  }

  function drawBackground() {
    const [top, bottom] = game.level.sky;
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(-game.cameraX * .16, 0);
    ctx.fillStyle = "rgba(117, 238, 229, .08)";
    ctx.beginPath();
    ctx.arc(920, 145, 135, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 176, 106, .11)";
    ctx.beginPath();
    ctx.arc(1460, 245, 66, 0, TAU);
    ctx.fill();
    ctx.restore();

    drawMountains();
    drawCity();
    drawGrid();
  }

  function drawMountains() {
    ctx.save();
    ctx.translate(-game.cameraX * .28, 0);
    ctx.fillStyle = "rgba(4, 13, 21, .5)";
    ctx.beginPath();
    ctx.moveTo(-300, FLOOR);
    for (let x = -300; x < game.level.length + W; x += 240) {
      const height = 90 + rand(Math.floor(x / 240) + game.levelIndex * 7) * 160;
      ctx.lineTo(x, FLOOR - height);
      ctx.lineTo(x + 120, FLOOR - height * .28);
      ctx.lineTo(x + 240, FLOOR);
    }
    ctx.lineTo(game.level.length + W, H);
    ctx.lineTo(-300, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawCity() {
    ctx.save();
    ctx.translate(-game.cameraX * .48, 0);
    for (const decoration of game.decorations) {
      const x = decoration.x;
      const y = FLOOR - decoration.height;
      ctx.fillStyle = decoration.type % 2 ? "rgba(5, 18, 26, .72)" : "rgba(9, 25, 32, .72)";
      ctx.fillRect(x, y, decoration.width, decoration.height);
      ctx.fillStyle = decoration.type % 2 ? "rgba(109, 229, 220, .24)" : "rgba(255, 157, 82, .24)";
      for (let wy = y + 14; wy < FLOOR - 14; wy += 20) {
        if (rand(Math.floor(wy + x)) > .45) ctx.fillRect(x + 8, wy, 5, 4);
        if (rand(Math.floor(wy + x) + 9) > .5) ctx.fillRect(x + decoration.width - 13, wy, 5, 4);
      }
    }
    ctx.restore();
  }

  function drawGrid() {
    ctx.save();
    ctx.globalAlpha = .22;
    ctx.strokeStyle = game.level.glow;
    ctx.lineWidth = 1;
    const horizon = 475;
    ctx.beginPath();
    for (let x = -W; x < W * 2; x += 64) {
      ctx.moveTo(W / 2 + (x - W / 2) * .1, horizon);
      ctx.lineTo(x, FLOOR);
    }
    for (let y = horizon; y < FLOOR; y += 28) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawWorld() {
    ctx.save();
    const offset = game.shake > 0 ? (Math.random() - .5) * game.shake : 0;
    ctx.translate(-game.cameraX + offset, offset * .3);
    drawGround();
    drawPlatforms();
    drawPickups();
    drawEnemies();
    drawBoss();
    drawBullets();
    drawPlayer();
    drawParticles();
    ctx.restore();
  }

  function drawGround() {
    ctx.fillStyle = "#07131b";
    ctx.fillRect(0, FLOOR, game.level.length + 600, H - FLOOR);
    ctx.fillStyle = "rgba(109, 229, 220, .3)";
    ctx.fillRect(0, FLOOR, game.level.length + 600, 2);
    for (let x = 0; x < game.level.length + 500; x += 64) {
      ctx.fillStyle = x % 128 === 0 ? "rgba(109, 229, 220, .12)" : "rgba(255, 157, 82, .09)";
      ctx.fillRect(x + 10, FLOOR + 20, 30, 3);
      ctx.fillRect(x + 18, FLOOR + 44, 12, 3);
    }
  }

  function drawPlatforms() {
    for (const platform of game.platforms) {
      ctx.fillStyle = "#0b202a";
      ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
      ctx.fillStyle = game.level.glow;
      ctx.fillRect(platform.x, platform.y, platform.w, 3);
      ctx.fillStyle = "rgba(255, 255, 255, .08)";
      for (let x = platform.x + 18; x < platform.x + platform.w - 8; x += 34) ctx.fillRect(x, platform.y + 9, 12, 3);
    }
  }

  function drawPickups() {
    for (const pickup of game.pickups) {
      if (pickup.collected) continue;
      const y = pickup.y + Math.sin(pickup.phase) * 5;
      const color = pickup.kind === "health" ? "#ff6c73" : "#6de5dc";
      ctx.save();
      ctx.translate(pickup.x + 11, y + 11);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 15;
      ctx.fillRect(-8, -8, 16, 16);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#07131b";
      ctx.fillRect(-3, -3, 6, 6);
      ctx.restore();
    }
  }

  function drawPlayer() {
    const p = game.player;
    if (p.invulnerable > 0 && Math.floor(p.invulnerable * 14) % 2 === 0) return;
    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y);
    ctx.scale(p.facing, 1);
    const walking = p.onGround ? Math.sin(p.step) * 3 : 0;
    if (p.crouching) {
      ctx.fillStyle = "#07131b";
      ctx.fillRect(-17, 17, 34, 18);
      ctx.fillStyle = "#e9f1f4";
      ctx.fillRect(-13, 9, 21, 17);
      ctx.fillStyle = "#ff9d52";
      ctx.fillRect(-15, 4, 25, 9);
      ctx.fillStyle = "#243e4b";
      ctx.fillRect(-8, 14, 16, 9);
      ctx.fillStyle = "#6de5dc";
      ctx.fillRect(5, 13, 7, 3);
      ctx.fillStyle = "#d2e8e9";
      ctx.fillRect(-13, 32, 15, 7);
      ctx.fillRect(4, 31, 14, 8);
      ctx.fillStyle = "#ff9d52";
      ctx.fillRect(7, 21, 27, 6);
      ctx.fillStyle = "#ffd56d";
      ctx.fillRect(32, 22, 8 + p.muzzle * 100, 4);
    } else {
      ctx.fillStyle = "#07131b";
      ctx.fillRect(-15, 19, 30, 29);
      ctx.fillStyle = "#e9f1f4";
      ctx.fillRect(-11, 10, 20, 22);
      ctx.fillStyle = "#ff9d52";
      ctx.fillRect(-13, 4, 24, 10);
      ctx.fillStyle = "#243e4b";
      ctx.fillRect(-8, 16, 15, 10);
      ctx.fillStyle = "#6de5dc";
      ctx.fillRect(5, 15, 7, 3);
      ctx.fillStyle = "#d2e8e9";
      ctx.fillRect(-11, 42, 9, 17 + walking);
      ctx.fillRect(4, 42, 9, 17 - walking);
      ctx.fillStyle = "#ff9d52";
      ctx.fillRect(9, 25, 24, 7);
      ctx.fillStyle = "#ffd56d";
      ctx.fillRect(31, 26, 8 + p.muzzle * 100, 4);
    }
    ctx.restore();
  }

  function drawEnemies() {
    for (const enemy of game.enemies) {
      if (!enemy.alive) continue;
      const flash = enemy.hitFlash > 0;
      ctx.save();
      ctx.translate(enemy.x + enemy.w / 2, enemy.y);
      if (enemy.type === "drone") drawDrone(enemy, flash);
      else if (enemy.type === "turret") drawTurret(enemy, flash);
      else if (enemy.type === "heavy") drawHeavy(enemy, flash);
      else drawRunner(enemy, flash);
      ctx.restore();
    }
  }

  function drawRunner(enemy, flash) {
    ctx.fillStyle = flash ? "#fff2cf" : "#d5535f";
    ctx.fillRect(-15, 11, 28, 29);
    ctx.fillStyle = "#3b202b";
    ctx.fillRect(-12, 2, 24, 13);
    ctx.fillStyle = "#ffcf6d";
    ctx.fillRect(-7, 7, 5, 3);
    ctx.fillStyle = "#111923";
    ctx.fillRect(-13, 39, 9, 7);
    ctx.fillRect(5, 39, 9, 7);
    ctx.fillStyle = "#ff7c6f";
    ctx.fillRect(-22, 20, 9, 5);
  }

  function drawTurret(enemy, flash) {
    ctx.fillStyle = flash ? "#fff2cf" : "#a86e5e";
    ctx.fillRect(-20, 14, 40, 27);
    ctx.fillStyle = "#172833";
    ctx.fillRect(-15, 5, 30, 15);
    ctx.fillStyle = "#ff9d52";
    ctx.fillRect(5, 8, 27, 6);
    ctx.fillStyle = "#6de5dc";
    ctx.fillRect(-9, 21, 8, 5);
  }

  function drawHeavy(enemy, flash) {
    ctx.fillStyle = flash ? "#fff2cf" : "#b34c5b";
    ctx.fillRect(-23, 8, 46, 38);
    ctx.fillStyle = "#1c2933";
    ctx.fillRect(-19, 0, 38, 15);
    ctx.fillStyle = "#ffcf6d";
    ctx.fillRect(-12, 5, 8, 4);
    ctx.fillRect(7, 5, 8, 4);
    ctx.fillStyle = "#6d2539";
    ctx.fillRect(-29, 19, 6, 18);
    ctx.fillRect(23, 19, 6, 18);
  }

  function drawDrone(enemy, flash) {
    ctx.fillStyle = flash ? "#fff2cf" : "#d37a54";
    ctx.beginPath();
    ctx.moveTo(-24, 13); ctx.lineTo(0, 0); ctx.lineTo(24, 13); ctx.lineTo(0, 28); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#172833";
    ctx.fillRect(-9, 10, 18, 8);
    ctx.fillStyle = "#ffd56d";
    ctx.fillRect(-4, 12, 8, 4);
    ctx.fillStyle = "#6de5dc";
    ctx.fillRect(-31, 7, 10, 3);
    ctx.fillRect(21, 7, 10, 3);
  }

  function drawBoss() {
    const boss = game.boss;
    if (!boss) return;
    if (boss.defeated) return;
    ctx.save();
    ctx.translate(boss.x + boss.w / 2, boss.y);
    const color = game.level.glow;
    if (boss.type === "core") {
      ctx.fillStyle = boss.hitFlash > 0 ? "#fff2cf" : "#6560b1";
      ctx.fillRect(-boss.w / 2, 14, boss.w, boss.h - 20);
      ctx.fillStyle = "#131b3b";
      ctx.fillRect(-boss.w / 2 + 22, 34, boss.w - 44, boss.h - 56);
      ctx.strokeStyle = color;
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(0, 91, 36 + Math.sin(boss.phase * 5) * 4, 0, TAU); ctx.stroke();
      ctx.fillStyle = "#ffd56d";
      ctx.beginPath(); ctx.arc(0, 91, 11, 0, TAU); ctx.fill();
    } else if (boss.type === "colossus") {
      ctx.fillStyle = boss.hitFlash > 0 ? "#fff2cf" : "#9a564d";
      ctx.fillRect(-boss.w / 2, 16, boss.w, boss.h - 18);
      ctx.fillStyle = "#182731";
      ctx.fillRect(-boss.w / 2 + 18, 35, boss.w - 36, 26);
      ctx.fillStyle = color;
      ctx.fillRect(-43, 43, 86, 7);
      ctx.fillRect(-boss.w / 2 - 19, 55, 16, 51);
      ctx.fillRect(boss.w / 2 + 3, 55, 16, 51);
    } else {
      ctx.fillStyle = boss.hitFlash > 0 ? "#fff2cf" : "#54727c";
      ctx.fillRect(-boss.w / 2, 20, boss.w, boss.h - 20);
      ctx.fillStyle = "#12212c";
      ctx.fillRect(-boss.w / 2 + 15, 43, boss.w - 30, 40);
      ctx.fillStyle = color;
      ctx.fillRect(-60, 52, 120, 9);
      ctx.fillStyle = "#ffcf6d";
      ctx.fillRect(-12, 70, 24, 24);
      ctx.fillStyle = "#2c4652";
      ctx.fillRect(-boss.w / 2 - 12, 39, 12, 75);
      ctx.fillRect(boss.w / 2, 39, 12, 75);
    }
    ctx.restore();

    const barW = boss.w + 32;
    const barX = boss.x - 16;
    const barY = boss.y - 21;
    ctx.fillStyle = "rgba(3, 10, 16, .85)";
    ctx.fillRect(barX, barY, barW, 8);
    ctx.fillStyle = "#ff5e67";
    ctx.fillRect(barX, barY, barW * clamp(boss.hp / boss.maxHp, 0, 1), 8);
    ctx.fillStyle = "#e9f1f4";
    ctx.font = "700 10px Inter, sans-serif";
    ctx.fillText(game.level.bossName.toUpperCase(), barX, barY - 7);
  }

  function drawBullets() {
    for (const bullet of game.bullets) {
      ctx.fillStyle = "#ffd56d";
      ctx.shadowColor = "#ffd56d";
      ctx.shadowBlur = 12;
      ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
      ctx.shadowBlur = 0;
    }
    for (const bullet of game.enemyBullets) {
      ctx.fillStyle = bullet.color;
      ctx.shadowColor = bullet.color;
      ctx.shadowBlur = 10;
      ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
      ctx.shadowBlur = 0;
    }
  }

  function drawParticles() {
    for (const particle of game.particles) {
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
  }

  function update(dt) {
    if (game.mode !== "playing") return;
    game.fireCooldown = Math.max(0, game.fireCooldown - dt);
    game.energy = clamp(game.energy + dt * 2.8, 0, 100);
    if (game.comboTimer > 0) {
      game.comboTimer -= dt;
      if (game.comboTimer <= 0) game.combo = 0;
    }
    updatePlayer(dt);
    if (!game.bossTriggered && game.player.x > game.level.length - 760) triggerBoss();
    updateBullets(dt);
    updateEnemies(dt);
    updatePickups(dt);
    updateParticles(dt);
    game.cameraX += (clamp(game.player.x - 330, 0, game.level.length - W) - game.cameraX) * Math.min(1, dt * 7);
    game.shake = Math.max(0, game.shake - dt * 20);
    if (game.toastTimer > 0) {
      game.toastTimer -= dt;
      if (game.toastTimer <= 0) ui.toast.classList.add("is-hidden");
    }
    if (game.bossDefeated && game.player.x > game.level.length - 145) {
      if (game.levelIndex < levels.length - 1) {
        loadLevel(game.levelIndex + 1);
      } else {
        endGame(true);
      }
    }
    updateHud();
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawWorld();
    if (game.mode === "playing" && game.combo > 1) {
      ctx.save();
      ctx.textAlign = "right";
      ctx.fillStyle = "#ffd56d";
      ctx.font = "900 18px Inter, sans-serif";
      ctx.fillText(`COMBO x${game.combo}`, W - 28, H - 34);
      ctx.restore();
    }
  }

  function frame(now) {
    const dt = Math.min(.033, (now - game.lastTime) / 1000 || .016);
    game.lastTime = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  function setControl(name, value) {
    if (name === "jump" && value) input.jumpPressed = true;
    input[name] = value;
  }

  function keyToControl(event) {
    const key = event.key.toLowerCase();
    if (key === "a" || key === "arrowleft") return "left";
    if (key === "d" || key === "arrowright") return "right";
    if (key === "w" || key === "arrowup" || key === " ") return "jump";
    if (key === "s" || key === "arrowdown") return "down";
    if (key === "j" || key === "k" || key === "enter") return "fire";
    return null;
  }

  window.addEventListener("keydown", (event) => {
    const control = keyToControl(event);
    if (control) {
      event.preventDefault();
      setControl(control, true);
    }
    if (event.key === "Escape" && game.mode === "cheat") {
      event.preventDefault();
      closeCheatPanel();
      return;
    }
    if (event.key.toLowerCase() === "p" || event.key === "Escape") {
      event.preventDefault();
      togglePause();
    }
  });
  window.addEventListener("keyup", (event) => {
    const control = keyToControl(event);
    if (control) {
      event.preventDefault();
      setControl(control, false);
    }
  });

  document.querySelectorAll("[data-control]").forEach((button) => {
    const control = button.dataset.control;
    const press = (event) => {
      event.preventDefault();
      ensureAudio();
      setControl(control, true);
    };
    const release = (event) => {
      event.preventDefault();
      setControl(control, false);
    };
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  });

  $("#startButton").addEventListener("click", startGame);
  $("#restartButton").addEventListener("click", startGame);
  $("#resumeButton").addEventListener("click", togglePause);
  $("#howButton").addEventListener("click", () => {
    showToast("A / D 移动 · W / ↑ 跳跃 · S / ↓ 蹲下 · J 射击 · P 暂停");
  });
  ui.cheatButton.addEventListener("click", openCheatPanel);
  ui.applyCheats.addEventListener("click", applyCheatConfig);
  ui.closeCheats.addEventListener("click", closeCheatPanel);
  ui.pauseButton.addEventListener("click", togglePause);
  ui.sound.addEventListener("click", () => {
    game.sound = !game.sound;
    ui.sound.textContent = game.sound ? "♫" : "×";
    ui.sound.setAttribute("aria-label", game.sound ? "关闭声音" : "打开声音");
    if (game.sound) {
      ensureAudio();
      beep(440, .08, "triangle", .04);
    }
  });

  loadLevel(0);
  render();
  requestAnimationFrame(frame);
})();



