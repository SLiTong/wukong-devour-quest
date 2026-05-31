(() => {
  const params = new URLSearchParams(window.location.search);
  const DEBUG = params.get("debug") === "1";
  const seedParam = Number.parseInt(params.get("seed") || "0", 10);

  const STORAGE_KEY = "wukong-devour-quest-best";
  const WORLD_WIDTH = 2400;
  const WORLD_HEIGHT = 1600;
  const PLAYER_BASE_RADIUS = 31;
  const MAX_ENEMIES = 30;
  const MAX_ORBS = 46;
  const MAX_POWERUPS = 7;
  const MAX_HAZARDS = 6;
  const COMBO_WINDOW = 1900;
  const DASH_COOLDOWN = 4200;
  const DASH_DURATION = 260;

  const enemyTypes = [
    { id: "imp", name: "小妖", power: 1, radius: 22, speed: 78, value: 18, color: 0x7cb342 },
    { id: "soldier", name: "天兵", power: 2, radius: 29, speed: 84, value: 34, color: 0x42a5f5 },
    { id: "juling", name: "巨灵神", power: 3, radius: 38, speed: 70, value: 58, color: 0xffa726 },
    { id: "nezha", name: "哪吒", power: 4, radius: 46, speed: 94, value: 88, color: 0xef5350 },
    { id: "erlang", name: "二郎神", power: 5, radius: 56, speed: 88, value: 132, color: 0x5c6bc0 },
    { id: "niumo", name: "牛魔王", power: 6, radius: 69, speed: 64, value: 210, color: 0x8d6e63 },
  ];

  const powerupTypes = [
    {
      id: "peach",
      name: "蟠桃",
      mark: "桃",
      color: 0xf58aa6,
      duration: 0,
      apply(scene) {
        scene.gainGrowth(30, 60);
        scene.lives = Math.min(5, scene.lives + 1);
        scene.flashMessage("蟠桃补元，生命恢复");
      },
    },
    {
      id: "cloud",
      name: "筋斗云",
      mark: "云",
      color: 0x5bc0eb,
      duration: 7000,
      apply(scene, until) {
        scene.effects.cloud = until;
        scene.flashMessage("筋斗云加速");
      },
    },
    {
      id: "staff",
      name: "金箍棒",
      mark: "棒",
      color: 0xf2b84b,
      duration: 7200,
      apply(scene, until) {
        scene.effects.staff = until;
        scene.flashMessage("金箍棒开路");
      },
    },
    {
      id: "freeze",
      name: "定身符",
      mark: "定",
      color: 0x88d8c0,
      duration: 5200,
      apply(scene, until) {
        scene.effects.freeze = until;
        scene.flashMessage("定身符镇住群妖");
      },
    },
    {
      id: "shield",
      name: "护身毫毛",
      mark: "护",
      color: 0x9b7ede,
      duration: 8200,
      apply(scene, until) {
        scene.effects.shield = until;
        scene.flashMessage("护身毫毛护体");
      },
    },
    {
      id: "gourd",
      name: "紫金葫芦",
      mark: "葫",
      color: 0xb260c9,
      duration: 7600,
      apply(scene, until) {
        scene.effects.gourd = until;
        scene.flashMessage("紫金葫芦牵引灵气");
      },
    },
    {
      id: "elixir",
      name: "九转金丹",
      mark: "丹",
      color: 0xffd166,
      duration: 9000,
      apply(scene, until) {
        scene.effects.elixir = until;
        scene.flashMessage("九转金丹，成长翻倍");
      },
    },
    {
      id: "fan",
      name: "芭蕉扇",
      mark: "扇",
      color: 0x5dd39e,
      duration: 0,
      apply(scene) {
        scene.clearNearbyHazards(520);
        scene.blowBackEnemies(420);
        scene.flashMessage("芭蕉扇扫开雷云");
      },
    },
    {
      id: "clone",
      name: "毫毛分身",
      mark: "身",
      color: 0xf28f3b,
      duration: 8200,
      apply(scene, until) {
        scene.effects.clone = until;
        scene.flashMessage("毫毛分身助战");
      },
    },
  ];

  const hazardTypes = [
    { id: "thunder", name: "天雷云", radius: 34, color: 0x536dfe, accent: 0xffd54f, damage: 1 },
    { id: "furnace", name: "炼丹炉", radius: 39, color: 0xd64b35, accent: 0xffb347, damage: 1 },
  ];

  const missionTemplates = [
    { id: "devour", mark: "妖", text: "连斩妖怪", target: 6, kind: "devour" },
    { id: "orbs", mark: "灵", text: "收集灵气", target: 12, kind: "orb" },
    { id: "combo", mark: "连", text: "打出连吞", target: 4, kind: "combo" },
    { id: "elite", mark: "将", text: "击破精英", target: 1, kind: "elite" },
    { id: "hazard", mark: "雷", text: "化解雷云", target: 2, kind: "hazard" },
  ];

  class Lcg {
    constructor(seed) {
      this.seed = seed || Math.floor(Math.random() * 2147483646) + 1;
      this.seed %= 2147483647;
      if (this.seed <= 0) this.seed += 2147483646;
    }

    next() {
      this.seed = (this.seed * 16807) % 2147483647;
      return (this.seed - 1) / 2147483646;
    }

    between(min, max) {
      return min + (max - min) * this.next();
    }

    int(min, max) {
      return Math.floor(this.between(min, max + 1));
    }

    pick(items) {
      return items[this.int(0, items.length - 1)];
    }
  }

  const gameRoot = document.getElementById("game-root");

  const hud = {
    score: document.getElementById("score"),
    level: document.getElementById("level"),
    lives: document.getElementById("lives"),
    combo: document.getElementById("combo"),
    dash: document.getElementById("dash"),
    best: document.getElementById("best"),
    mission: document.getElementById("mission"),
    powerups: document.getElementById("powerups"),
    overlay: document.getElementById("overlay"),
    overlayTitle: document.getElementById("overlay-title"),
    overlayCopy: document.getElementById("overlay-copy"),
    primary: document.getElementById("primary-action"),
    audio: document.getElementById("audio-button"),
    pause: document.getElementById("pause-button"),
    restart: document.getElementById("restart-button"),
  };

  class MainScene extends Phaser.Scene {
    constructor() {
      super("MainScene");
      this.rng = new Lcg(seedParam || 0);
      this.state = "title";
      this.enemies = [];
      this.orbs = [];
      this.powerups = [];
      this.hazards = [];
      this.effects = {};
      this.pointerTarget = null;
      this.audioEnabled = true;
      this.audioReady = false;
    }

    preload() {}

    create() {
      this.rng = new Lcg(seedParam || 0);
      this.createTextures();
      this.createWorld();
      this.createPlayer();
      this.createInput();
      this.messageText = this.add
        .text(0, 0, "", {
          fontFamily: "Microsoft YaHei, sans-serif",
          fontSize: "26px",
          fontStyle: "bold",
          color: "#fff8ea",
          stroke: "#303436",
          strokeThickness: 5,
        })
        .setDepth(20)
        .setOrigin(0.5)
        .setScrollFactor(0);
      this.cameras.main.startFollow(this.player.sprite, true, 0.09, 0.09);
      this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      if (DEBUG) this.createDebugPanel();
      this.resetGame(false);
      this.setOverlay("悟空出山", "从花果山小猴开始，吞噬更弱的妖怪与灵气成长。别硬碰比你强的对手，法宝会帮你逆转局势。", "开始游戏");
      this.updateHud();
      this.updateAudioButton();

      window.WukongGame = {
        getState: () => this.getDebugState(),
        start: () => this.startGame(),
        pause: () => this.togglePause(),
        restart: () => this.startGame(),
        spawnEnemy: (power = 1, x, y) => this.spawnEnemy(power, x, y),
        spawnElite: (power = this.player.power + 1, x, y) => this.spawnEnemy(power, x, y, true),
        spawnPowerup: (id, x, y) => this.spawnPowerup(id, x, y),
        spawnHazard: (id, x, y) => this.spawnHazard(id, x, y),
        dash: () => this.tryDash(this.time.now),
        toggleAudio: () => this.toggleAudio(),
        movePlayerTo: (x, y) => {
          this.pointerTarget = new Phaser.Math.Vector2(x, y);
        },
      };
    }

    update(time, delta) {
      if (this.state !== "running") return;

      const dt = Math.min(delta, 34) / 1000;
      this.elapsed += delta;
      this.spawnClock += delta;
      this.orbClock += delta;
      this.powerupClock += delta;
      this.hazardClock += delta;
      this.eliteClock += delta;
      this.cleanupEffects(time);
      this.handleSkillInput(time);
      this.handlePlayerMovement(dt, time);
      this.updateEnemies(dt, time);
      this.updateHazards(time);
      this.updateLabels();
      this.handleCollections(time);
      this.keepPopulation(time);
      this.updateHud(time);
    }

    createTextures() {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      this.makePlayerTexture(g);
      enemyTypes.forEach((type) => this.makeEnemyTexture(g, type));
      powerupTypes.forEach((type) => this.makePowerupTexture(g, type));
      hazardTypes.forEach((type) => this.makeHazardTexture(g, type));
      this.makeOrbTexture(g);
      this.makeTrailTexture(g);
      g.destroy();
    }

    makePlayerTexture(g) {
      g.clear();
      g.fillStyle(0xf7c44d, 1);
      g.fillCircle(56, 56, 37);
      g.fillStyle(0xfbe2a0, 1);
      g.fillCircle(47, 48, 13);
      g.fillCircle(65, 48, 13);
      g.fillStyle(0x2a2e33, 1);
      g.fillCircle(48, 49, 4);
      g.fillCircle(64, 49, 4);
      g.fillStyle(0xd74b35, 1);
      g.fillRoundedRect(31, 26, 50, 14, 6);
      g.fillStyle(0xf2b84b, 1);
      g.fillRoundedRect(83, 48, 30, 8, 4);
      g.fillStyle(0x7c3f1d, 1);
      g.fillCircle(56, 70, 5);
      g.lineStyle(6, 0x9b2d22, 1);
      g.strokeCircle(56, 56, 37);
      g.generateTexture("player", 120, 120);
    }

    makeEnemyTexture(g, type) {
      g.clear();
      g.fillStyle(type.color, 1);
      g.fillCircle(64, 64, 43);
      g.fillStyle(0xffffff, 0.74);
      g.fillCircle(50, 54, 12);
      g.fillCircle(77, 54, 12);
      g.fillStyle(0x263238, 1);
      g.fillCircle(52, 56, 5);
      g.fillCircle(75, 56, 5);
      g.fillStyle(0x263238, 1);
      g.fillRoundedRect(49, 76, 30, 8, 4);
      if (type.power >= 3) {
        g.fillStyle(0xf5dd6b, 1);
        g.fillTriangle(28, 31, 42, 6, 51, 35);
        g.fillTriangle(77, 35, 88, 6, 100, 31);
      }
      if (type.id === "nezha") {
        g.lineStyle(6, 0xffd54f, 0.78);
        g.strokeCircle(32, 86, 13);
        g.strokeCircle(96, 86, 13);
      }
      if (type.id === "erlang") {
        g.fillStyle(0xffffff, 0.88);
        g.fillCircle(64, 37, 8);
        g.fillStyle(0x263238, 1);
        g.fillCircle(64, 37, 3);
      }
      if (type.id === "niumo") {
        g.fillStyle(0xfff1a8, 1);
        g.fillTriangle(19, 42, 5, 18, 38, 32);
        g.fillTriangle(89, 32, 123, 18, 109, 42);
      }
      g.lineStyle(6, 0x303436, 0.36);
      g.strokeCircle(64, 64, 43);
      g.generateTexture(`enemy-${type.id}`, 128, 128);
    }

    makePowerupTexture(g, type) {
      g.clear();
      g.fillStyle(type.color, 1);
      g.fillCircle(42, 42, 29);
      g.fillStyle(0xfffbdf, 0.86);
      g.fillCircle(32, 32, 8);
      g.lineStyle(5, 0x303436, 0.28);
      g.strokeCircle(42, 42, 29);
      g.generateTexture(`powerup-${type.id}`, 84, 84);
    }

    makeHazardTexture(g, type) {
      g.clear();
      if (type.id === "thunder") {
        g.fillStyle(type.color, 0.78);
        g.fillCircle(35, 42, 24);
        g.fillCircle(55, 34, 27);
        g.fillCircle(74, 45, 23);
        g.fillStyle(0x2f365f, 0.9);
        g.fillCircle(54, 50, 24);
        g.fillStyle(type.accent, 1);
        g.fillTriangle(56, 38, 42, 66, 55, 62);
        g.fillTriangle(52, 61, 69, 57, 49, 86);
        g.lineStyle(4, 0xffffff, 0.42);
        g.strokeCircle(55, 47, 34);
      } else {
        g.fillStyle(0x6d2d1f, 1);
        g.fillRoundedRect(28, 31, 58, 53, 12);
        g.fillStyle(type.color, 1);
        g.fillRoundedRect(22, 23, 70, 45, 16);
        g.fillStyle(type.accent, 1);
        g.fillCircle(43, 46, 9);
        g.fillCircle(64, 45, 7);
        g.fillStyle(0xfff1a8, 0.82);
        g.fillTriangle(53, 15, 43, 40, 62, 34);
        g.lineStyle(5, 0x2a2e33, 0.4);
        g.strokeRoundedRect(22, 23, 70, 45, 16);
      }
      g.generateTexture(`hazard-${type.id}`, 112, 112);
    }

    makeOrbTexture(g) {
      g.clear();
      g.fillStyle(0xfff0a5, 1);
      g.fillCircle(16, 16, 12);
      g.fillStyle(0xffffff, 0.7);
      g.fillCircle(11, 10, 4);
      g.generateTexture("orb", 32, 32);
    }

    makeTrailTexture(g) {
      g.clear();
      g.fillStyle(0xfff2a0, 0.78);
      g.fillCircle(18, 18, 13);
      g.lineStyle(3, 0xffffff, 0.55);
      g.strokeCircle(18, 18, 13);
      g.generateTexture("trail", 36, 36);
    }

    createWorld() {
      const graphics = this.add.graphics();
      graphics.fillGradientStyle(0xb9e4d4, 0xb9e4d4, 0x88c8d8, 0xf0dc9e, 1);
      graphics.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      graphics.lineStyle(2, 0xffffff, 0.2);
      for (let x = 0; x < WORLD_WIDTH; x += 120) graphics.lineBetween(x, 0, x + 220, WORLD_HEIGHT);
      for (let y = 0; y < WORLD_HEIGHT; y += 120) graphics.lineBetween(0, y, WORLD_WIDTH, y - 160);
      graphics.setDepth(-20);

      for (let i = 0; i < 32; i += 1) {
        const color = this.rng.next() > 0.5 ? 0x6fb17f : 0xd4b064;
        this.add
          .circle(this.rng.between(80, WORLD_WIDTH - 80), this.rng.between(80, WORLD_HEIGHT - 80), this.rng.between(9, 22), color, 0.22)
          .setDepth(-10);
      }

      for (let i = 0; i < 16; i += 1) {
        const x = this.rng.between(100, WORLD_WIDTH - 100);
        const y = this.rng.between(100, WORLD_HEIGHT - 100);
        const cloud = this.add.graphics({ x, y }).setDepth(-9);
        cloud.fillStyle(0xffffff, 0.18);
        cloud.fillCircle(0, 0, this.rng.between(18, 34));
        cloud.fillCircle(32, 3, this.rng.between(14, 26));
        cloud.fillCircle(-26, 8, this.rng.between(12, 24));
        cloud.lineStyle(3, 0xffffff, 0.15);
        cloud.lineBetween(-42, 19, 48, 20);
      }

      for (let i = 0; i < 9; i += 1) {
        const x = this.rng.between(140, WORLD_WIDTH - 140);
        const y = this.rng.between(140, WORLD_HEIGHT - 140);
        const lotus = this.add.graphics({ x, y }).setDepth(-8);
        lotus.fillStyle(0xf58aa6, 0.22);
        lotus.fillEllipse(0, -9, 20, 36);
        lotus.fillEllipse(-17, 4, 20, 34);
        lotus.fillEllipse(17, 4, 20, 34);
        lotus.fillStyle(0xfff0a5, 0.2);
        lotus.fillCircle(0, 6, 10);
      }
    }

    createPlayer() {
      this.player = {
        sprite: this.physics.add.image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, "player").setDepth(8),
        label: this.add.text(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, "美猴王", {
          fontFamily: "Microsoft YaHei, sans-serif",
          fontSize: "16px",
          fontStyle: "bold",
          color: "#fff8ea",
          stroke: "#303436",
          strokeThickness: 4,
        }).setOrigin(0.5).setDepth(11),
        radius: PLAYER_BASE_RADIUS,
        power: 1,
        level: 1,
        growth: 0,
      };
      this.player.sprite.setCircle(46, 14, 14);
      this.player.sprite.body.setCollideWorldBounds(true);
      this.resizePlayer();
    }

    createInput() {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keys = this.input.keyboard.addKeys({
        W: Phaser.Input.Keyboard.KeyCodes.W,
        A: Phaser.Input.Keyboard.KeyCodes.A,
        S: Phaser.Input.Keyboard.KeyCodes.S,
        D: Phaser.Input.Keyboard.KeyCodes.D,
        SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
        P: Phaser.Input.Keyboard.KeyCodes.P,
        ESC: Phaser.Input.Keyboard.KeyCodes.ESC,
        SHIFT: Phaser.Input.Keyboard.KeyCodes.SHIFT,
        J: Phaser.Input.Keyboard.KeyCodes.J,
        M: Phaser.Input.Keyboard.KeyCodes.M,
      });
      this.input.on("pointerdown", (pointer) => {
        if (this.state !== "running") return;
        this.pointerTarget = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
      });
      this.input.on("pointermove", (pointer) => {
        if (!pointer.isDown || this.state !== "running") return;
        this.pointerTarget = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
      });
      this.input.keyboard.on("keydown-P", () => this.togglePause());
      this.input.keyboard.on("keydown-M", () => this.toggleAudio());
      this.input.keyboard.on("keydown-SPACE", () => {
        if (this.state === "title" || this.state === "gameover") this.startGame();
        else this.togglePause();
      });
      this.input.keyboard.on("keydown-ESC", () => {
        if (this.state === "running" || this.state === "paused") this.togglePause();
      });
      hud.primary.addEventListener("click", () => {
        if (this.state === "paused") this.togglePause();
        else this.startGame();
      });
      hud.audio.addEventListener("click", () => this.toggleAudio());
      hud.pause.addEventListener("click", () => this.togglePause());
      hud.restart.addEventListener("click", () => this.startGame());
    }

    resetGame(spawn = true) {
      this.enemies.forEach((enemy) => {
        enemy.sprite.destroy();
        enemy.label.destroy();
      });
      this.orbs.forEach((orb) => orb.destroy());
      this.powerups.forEach((powerup) => {
        powerup.sprite.destroy();
        powerup.label.destroy();
      });
      this.hazards.forEach((hazard) => {
        hazard.sprite.destroy();
        hazard.label.destroy();
      });
      this.enemies = [];
      this.orbs = [];
      this.powerups = [];
      this.hazards = [];
      this.effects = {};
      this.score = 0;
      this.lives = 3;
      this.elapsed = 0;
      this.spawnClock = 0;
      this.orbClock = 0;
      this.powerupClock = 0;
      this.hazardClock = 0;
      this.eliteClock = 0;
      this.combo = 1;
      this.comboChain = 0;
      this.comboUntil = 0;
      this.lastTrailAt = 0;
      this.cloneStrikeAt = 0;
      this.dashReadyAt = 0;
      this.dashVector = new Phaser.Math.Vector2(1, 0);
      this.invulnerableUntil = 0;
      this.pointerTarget = null;
      this.player.radius = PLAYER_BASE_RADIUS;
      this.player.power = 1;
      this.player.level = 1;
      this.player.growth = 0;
      this.player.sprite.setPosition(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
      this.player.sprite.setVelocity(0, 0);
      this.resizePlayer();
      if (spawn) {
        for (let i = 0; i < 22; i += 1) this.spawnOrb();
        for (let i = 0; i < 13; i += 1) this.spawnEnemy(i < 7 ? 1 : 2);
        for (let i = 0; i < 2; i += 1) this.spawnHazard();
      }
      this.pickMission();
    }

    startGame() {
      this.resumeAudio();
      this.debugStable = false;
      this.resetGame(true);
      this.state = "running";
      this.invulnerableUntil = this.time.now + 900;
      this.hideOverlay();
      this.updateHud();
      this.flashMessage("大圣启程");
    }

    startDebugGame() {
      this.resumeAudio();
      this.resetGame(false);
      this.debugStable = true;
      for (let i = 0; i < 8; i += 1) this.spawnOrb();
      this.state = "running";
      this.invulnerableUntil = 0;
      this.hideOverlay();
      this.updateHud();
      this.flashMessage("调试净场");
    }

    togglePause() {
      if (this.state === "running") {
        this.state = "paused";
        this.player.sprite.setVelocity(0, 0);
        this.setOverlay("暂停", "调整一下方向，继续吞噬变强。", "继续游戏");
        hud.pause.textContent = "继续";
        this.updateHud();
      } else if (this.state === "paused") {
        this.state = "running";
        this.hideOverlay();
        hud.pause.textContent = "暂停";
        this.updateHud();
      }
    }

    gameOver() {
      this.state = "gameover";
      this.player.sprite.setVelocity(0, 0);
      const best = this.saveBest();
      this.setOverlay("再闯天庭", `本局分数 ${this.score}，最高分 ${best}。吞噬路线已经摸清，下一局可以更凶。`, "重新开始");
      hud.pause.textContent = "暂停";
      this.updateHud();
    }

    handleSkillInput(time) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.SHIFT) || Phaser.Input.Keyboard.JustDown(this.keys.J)) {
        this.tryDash(time);
      }
    }

    tryDash(time) {
      if (time < this.dashReadyAt) {
        this.flashMessage(`筋斗突进冷却 ${Math.ceil((this.dashReadyAt - time) / 1000)}s`);
        return;
      }
      const direction = new Phaser.Math.Vector2(0, 0);
      if (this.cursors.left.isDown || this.keys.A.isDown) direction.x -= 1;
      if (this.cursors.right.isDown || this.keys.D.isDown) direction.x += 1;
      if (this.cursors.up.isDown || this.keys.W.isDown) direction.y -= 1;
      if (this.cursors.down.isDown || this.keys.S.isDown) direction.y += 1;
      if (direction.lengthSq() === 0 && this.pointerTarget) {
        direction.copy(this.pointerTarget.clone().subtract(this.player.sprite.body.center));
      }
      if (direction.lengthSq() === 0) direction.set(this.player.sprite.flipX ? -1 : 1, 0);
      direction.normalize();
      this.dashVector = direction;
      this.effects.dash = time + DASH_DURATION;
      this.dashReadyAt = time + DASH_COOLDOWN;
      this.invulnerableUntil = Math.max(this.invulnerableUntil, time + DASH_DURATION + 180);
      this.cameras.main.shake(90, 0.004);
      this.flashMessage("筋斗突进");
      this.playSfx("dash");
      this.burst(this.player.sprite.x, this.player.sprite.y, 0xfff2a0, 14, 84);
    }

    handlePlayerMovement(dt, time) {
      const speedBoost = this.isEffectActive("cloud") ? 1.48 : 1;
      const dashBoost = this.isEffectActive("dash") ? 2.9 : 1;
      const baseSpeed = (205 + this.player.level * 8) * speedBoost;
      const velocity = new Phaser.Math.Vector2(0, 0);
      if (this.cursors.left.isDown || this.keys.A.isDown) velocity.x -= 1;
      if (this.cursors.right.isDown || this.keys.D.isDown) velocity.x += 1;
      if (this.cursors.up.isDown || this.keys.W.isDown) velocity.y -= 1;
      if (this.cursors.down.isDown || this.keys.S.isDown) velocity.y += 1;

      if (velocity.lengthSq() > 0) {
        velocity.normalize().scale(baseSpeed);
        this.pointerTarget = null;
      } else if (this.pointerTarget) {
        const toTarget = this.pointerTarget.clone().subtract(this.player.sprite.body.center);
        if (toTarget.length() < this.player.radius * 0.35) {
          this.pointerTarget = null;
        } else {
          toTarget.normalize().scale(baseSpeed);
          velocity.copy(toTarget);
        }
      }

      if (dashBoost > 1) {
        velocity.copy(this.dashVector.clone().scale(baseSpeed * dashBoost));
      }

      this.player.sprite.setVelocity(velocity.x, velocity.y);
      this.player.label.setPosition(this.player.sprite.x, this.player.sprite.y - this.player.radius - 21);
      if (velocity.lengthSq() > 0) this.player.sprite.setFlipX(velocity.x < -2);
      if ((dashBoost > 1 || this.isEffectActive("cloud")) && time - this.lastTrailAt > 48) {
        this.lastTrailAt = time;
        this.leaveTrail(velocity.lengthSq() > 0 ? velocity : this.dashVector);
      }
    }

    updateEnemies(dt, time) {
      const frozen = this.isEffectActive("freeze");
      this.enemies.forEach((enemy) => {
        if (frozen) {
          enemy.sprite.setVelocity(0, 0);
          enemy.label.setPosition(enemy.sprite.x, enemy.sprite.y - enemy.radius - 18);
          return;
        }
        const player = this.player.sprite;
        const distance = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, player.x, player.y);
        const awayFromPlayer = enemy.power <= this.player.power && distance < 230;
        const chasePlayer = enemy.power > this.player.power && distance < 380;
        const direction = new Phaser.Math.Vector2(enemy.vx, enemy.vy);

        if (awayFromPlayer || chasePlayer) {
          direction.set(enemy.sprite.x - player.x, enemy.sprite.y - player.y);
          if (chasePlayer) direction.negate();
        } else if (time > enemy.turnAt) {
          direction.set(this.rng.between(-1, 1), this.rng.between(-1, 1));
          enemy.vx = direction.x;
          enemy.vy = direction.y;
          enemy.turnAt = time + this.rng.between(900, 2600);
        }

        if (direction.lengthSq() === 0) direction.set(1, 0);
        direction.normalize().scale(enemy.speed);
        enemy.sprite.setVelocity(direction.x, direction.y);
        enemy.label.setPosition(enemy.sprite.x, enemy.sprite.y - enemy.radius - 18);
      });
    }

    updateLabels() {
      this.powerups.forEach((powerup) => {
        powerup.label.setPosition(powerup.sprite.x, powerup.sprite.y - 41);
      });
    }

    handleCollections(time) {
      this.collectOrbs(time);
      this.collectPowerups(time);
      this.collideHazards(time);
      this.collideEnemies(time);
    }

    collectOrbs(time) {
      const pullRadius = this.isEffectActive("gourd") ? 260 : 0;
      this.orbs = this.orbs.filter((orb) => {
        const distance = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, orb.x, orb.y);
        if (pullRadius && distance < pullRadius) {
          const angle = Phaser.Math.Angle.Between(orb.x, orb.y, this.player.sprite.x, this.player.sprite.y);
          orb.x += Math.cos(angle) * 8;
          orb.y += Math.sin(angle) * 8;
        }
        if (distance < this.player.radius + 13) {
          orb.destroy();
          this.gainGrowth(this.isEffectActive("elixir") ? 9 : 5, this.isEffectActive("elixir") ? 10 : 6);
          this.advanceMission("orb", 1);
          if (this.isEffectActive("gourd") && time - (this.lastOrbSfxAt || 0) > 90) {
            this.lastOrbSfxAt = time;
            this.playSfx("orb");
          }
          return false;
        }
        return true;
      });
    }

    collectPowerups(time) {
      this.powerups = this.powerups.filter((powerup) => {
        const distance = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, powerup.sprite.x, powerup.sprite.y);
        if (distance < this.player.radius + 28) {
          const until = time + powerup.type.duration;
          powerup.type.apply(this, until);
          this.playSfx("powerup");
          this.burst(powerup.sprite.x, powerup.sprite.y, powerup.type.color, 16, 76);
          powerup.sprite.destroy();
          powerup.label.destroy();
          return false;
        }
        return true;
      });
    }

    collideHazards(time) {
      this.hazards = this.hazards.filter((hazard) => {
        const distance = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, hazard.sprite.x, hazard.sprite.y);
        if (distance > this.player.radius + hazard.radius - 4) return true;

        if (this.isEffectActive("staff") || this.isEffectActive("dash")) {
          this.flashAt(hazard.sprite.x, hazard.sprite.y, "破阵");
          this.score += 42 * this.player.level;
          this.advanceMission("hazard", 1);
          this.burst(hazard.sprite.x, hazard.sprite.y, hazard.accent, 22, 96);
          this.playSfx("powerup");
          hazard.sprite.destroy();
          hazard.label.destroy();
          return false;
        }

        if (time < this.invulnerableUntil) return true;
        if (this.isEffectActive("shield")) {
          this.effects.shield = 0;
          this.invulnerableUntil = time + 900;
          this.flashMessage("护身毫毛挡住天劫");
          this.advanceMission("hazard", 1);
          hazard.sprite.destroy();
          hazard.label.destroy();
          this.playSfx("powerup");
          return false;
        }

        this.lives -= hazard.damage;
        this.player.growth = Math.max(0, this.player.growth - 22);
        this.comboChain = 0;
        this.combo = 1;
        this.invulnerableUntil = time + 1300;
        this.cameras.main.shake(210, 0.012);
        this.flashMessage(`${hazard.name} 打散灵气`);
        this.playSfx("hurt");
        this.knockPlayerFrom(hazard.sprite.x, hazard.sprite.y);
        if (this.lives <= 0) this.gameOver();
        if (this.debugStable) {
          hazard.sprite.destroy();
          hazard.label.destroy();
          return false;
        }
        return true;
      });
    }

    collideEnemies(time) {
      this.enemies = this.enemies.filter((enemy) => {
        const distance = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, enemy.sprite.x, enemy.sprite.y);
        if (distance > this.player.radius + enemy.radius - 8) return true;

        if (this.canDevour(enemy)) {
          const combo = this.registerCombo(time);
          const growthBoost = this.isEffectActive("elixir") ? 1.65 : 1;
          const scoreGain = Math.floor(enemy.value * this.player.level * combo * (enemy.elite ? 1.45 : 1));
          this.score += scoreGain;
          this.gainGrowth(enemy.value * 0.55 * growthBoost, 0);
          this.flashAt(enemy.sprite.x, enemy.sprite.y, `+${scoreGain}${combo > 1 ? ` x${combo}` : ""}`);
          this.advanceMission("devour", 1);
          if (enemy.elite) {
            this.advanceMission("elite", 1);
            this.spawnPowerup(undefined, enemy.sprite.x, enemy.sprite.y);
          }
          this.playSfx("eat");
          this.burst(enemy.sprite.x, enemy.sprite.y, enemy.color, enemy.elite ? 22 : 12, enemy.elite ? 104 : 70);
          enemy.sprite.destroy();
          enemy.label.destroy();
          return false;
        }

        if (time < this.invulnerableUntil) return true;
        if (this.isEffectActive("shield")) {
          this.effects.shield = 0;
          this.invulnerableUntil = time + 900;
          this.flashMessage("护身毫毛挡下一击");
          this.knockEnemy(enemy);
          return true;
        }

        this.lives -= 1;
        this.comboChain = 0;
        this.combo = 1;
        this.invulnerableUntil = time + 1300;
        this.cameras.main.shake(160, 0.008);
        this.flashMessage(`${enemy.name} 太强，先避其锋芒`);
        this.playSfx("hurt");
        this.knockEnemy(enemy);
        if (this.lives <= 0) this.gameOver();
        if (this.debugStable) {
          enemy.sprite.destroy();
          enemy.label.destroy();
          return false;
        }
        return true;
      });
    }

    canDevour(enemy) {
      const staffBonus = this.isEffectActive("staff") ? 1 : 0;
      const dashBonus = this.isEffectActive("dash") ? 1 : 0;
      return enemy.power <= this.player.power + staffBonus + dashBonus || enemy.radius < this.player.radius * 0.72;
    }

    knockEnemy(enemy) {
      const angle = Phaser.Math.Angle.Between(this.player.sprite.x, this.player.sprite.y, enemy.sprite.x, enemy.sprite.y);
      enemy.sprite.x = Phaser.Math.Clamp(enemy.sprite.x + Math.cos(angle) * 70, 40, WORLD_WIDTH - 40);
      enemy.sprite.y = Phaser.Math.Clamp(enemy.sprite.y + Math.sin(angle) * 70, 40, WORLD_HEIGHT - 40);
    }

    knockPlayerFrom(x, y) {
      const angle = Phaser.Math.Angle.Between(x, y, this.player.sprite.x, this.player.sprite.y);
      this.player.sprite.x = Phaser.Math.Clamp(this.player.sprite.x + Math.cos(angle) * 96, 45, WORLD_WIDTH - 45);
      this.player.sprite.y = Phaser.Math.Clamp(this.player.sprite.y + Math.sin(angle) * 96, 45, WORLD_HEIGHT - 45);
    }

    registerCombo(time) {
      if (time < this.comboUntil) this.comboChain += 1;
      else this.comboChain = 1;
      this.comboUntil = time + COMBO_WINDOW;
      this.combo = Math.min(8, 1 + Math.floor(this.comboChain / 3));
      if (this.combo >= 2) {
        this.advanceMission("combo", 1);
        if (this.comboChain % 3 === 0) this.burst(this.player.sprite.x, this.player.sprite.y, 0xfff2a0, 18, 92);
      }
      return this.combo;
    }

    gainGrowth(amount, score = 0) {
      this.player.growth += amount;
      if (score) this.score += Math.floor(score);
      let needed = this.growthNeeded();
      while (this.player.growth >= needed) {
        this.player.growth -= needed;
        this.player.level += 1;
        this.player.power = Math.min(6, 1 + Math.floor((this.player.level - 1) / 2));
        this.player.radius = Math.min(92, PLAYER_BASE_RADIUS + (this.player.level - 1) * 5.3);
        this.resizePlayer();
        this.flashMessage(`等级 ${this.player.level}，能吞更强妖怪`);
        this.playSfx("level");
        this.burst(this.player.sprite.x, this.player.sprite.y, 0xffd54f, 28, 132);
        needed = this.growthNeeded();
      }
    }

    growthNeeded() {
      return 64 + this.player.level * 24;
    }

    resizePlayer() {
      const scale = this.player.radius / PLAYER_BASE_RADIUS;
      this.player.sprite.setScale(scale);
      const bodyRadius = 46 * scale;
      this.player.sprite.body.setCircle(bodyRadius, 60 * scale - bodyRadius, 60 * scale - bodyRadius);
    }

    keepPopulation(time) {
      if (this.debugStable) return;
      const difficulty = Math.min(5, Math.floor(this.elapsed / 28000) + Math.floor(this.player.level / 3));
      if (this.orbClock > 450 && this.orbs.length < MAX_ORBS) {
        this.orbClock = 0;
        for (let i = 0; i < 3; i += 1) this.spawnOrb();
      }
      if (this.spawnClock > Math.max(420, 1150 - difficulty * 95) && this.enemies.length < MAX_ENEMIES) {
        this.spawnClock = 0;
        const maxPower = Phaser.Math.Clamp(this.player.power + this.rng.int(0, 2), 1, 6);
        const minPower = Math.max(1, maxPower - 2);
        this.spawnEnemy(this.rng.int(minPower, maxPower));
      }
      if (this.powerupClock > Math.max(6200, 11200 - difficulty * 600) && this.powerups.length < MAX_POWERUPS) {
        this.powerupClock = 0;
        this.spawnPowerup();
      }
      if (this.hazardClock > Math.max(4200, 7600 - difficulty * 520) && this.hazards.length < MAX_HAZARDS) {
        this.hazardClock = 0;
        this.spawnHazard();
      }
      if (this.eliteClock > Math.max(9600, 18000 - difficulty * 1300) && this.enemies.length < MAX_ENEMIES) {
        this.eliteClock = 0;
        this.spawnEnemy(Phaser.Math.Clamp(this.player.power + 1, 2, 6), undefined, undefined, true);
      }

      if (this.isEffectActive("gourd") && time % 200 < 34) {
        this.enemies.forEach((enemy) => {
          if (!this.canDevour(enemy)) return;
          const distance = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, this.player.sprite.x, this.player.sprite.y);
          if (distance > 210) return;
          const angle = Phaser.Math.Angle.Between(enemy.sprite.x, enemy.sprite.y, this.player.sprite.x, this.player.sprite.y);
          enemy.sprite.x += Math.cos(angle) * 5;
          enemy.sprite.y += Math.sin(angle) * 5;
        });
      }
      if (this.isEffectActive("clone") && time > this.cloneStrikeAt) {
        this.cloneStrikeAt = time + 850;
        const target = this.enemies
          .filter((enemy) => this.canDevour(enemy))
          .sort((a, b) => {
            const da = Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, this.player.sprite.x, this.player.sprite.y);
            const db = Phaser.Math.Distance.Between(b.sprite.x, b.sprite.y, this.player.sprite.x, this.player.sprite.y);
            return da - db;
          })[0];
        if (target) {
          const distance = Phaser.Math.Distance.Between(target.sprite.x, target.sprite.y, this.player.sprite.x, this.player.sprite.y);
          if (distance < 310) {
            this.burst(target.sprite.x, target.sprite.y, 0xf28f3b, 10, 62);
            target.sprite.x += (this.player.sprite.x - target.sprite.x) * 0.28;
            target.sprite.y += (this.player.sprite.y - target.sprite.y) * 0.28;
          }
        }
      }
    }

    spawnOrb(x, y) {
      const pos = this.safeSpawnPoint(x, y);
      const orb = this.add.image(pos.x, pos.y, "orb").setDepth(1);
      orb.setScale(this.rng.between(0.82, 1.22));
      this.orbs.push(orb);
      return orb;
    }

    spawnEnemy(power = 1, x, y, forceElite = false) {
      const type = enemyTypes[Phaser.Math.Clamp(power, 1, 6) - 1];
      const pos = this.safeSpawnPoint(x, y);
      const elite = forceElite || (!this.debugStable && type.power >= 2 && this.rng.next() < 0.11);
      const radius = elite ? type.radius * 1.22 : type.radius;
      const scale = radius / 43;
      const sprite = this.physics.add.image(pos.x, pos.y, `enemy-${type.id}`).setScale(scale).setDepth(5);
      sprite.setCircle(43, 21, 21);
      sprite.body.setCollideWorldBounds(true);
      sprite.body.setBounce(0.9, 0.9);
      if (elite) sprite.setTint(0xfff2a0);
      const label = this.add.text(pos.x, pos.y - radius - 18, elite ? `巡天${type.name}` : type.name, {
        fontFamily: "Microsoft YaHei, sans-serif",
        fontSize: "14px",
        fontStyle: "bold",
        color: "#fff8ea",
        stroke: "#303436",
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(10);
      const enemy = {
        ...type,
        name: elite ? `巡天${type.name}` : type.name,
        radius,
        value: elite ? Math.floor(type.value * 1.9) : type.value,
        elite,
        sprite,
        label,
        speed: (type.speed + this.rng.between(-10, 16)) * (elite ? 1.1 : 1),
        vx: this.rng.between(-1, 1),
        vy: this.rng.between(-1, 1),
        turnAt: 0,
      };
      this.enemies.push(enemy);
      return enemy;
    }

    spawnPowerup(id, x, y) {
      const type = id ? powerupTypes.find((item) => item.id === id) || this.rng.pick(powerupTypes) : this.rng.pick(powerupTypes);
      const pos = this.safeSpawnPoint(x, y);
      const sprite = this.physics.add.image(pos.x, pos.y, `powerup-${type.id}`).setDepth(4);
      sprite.setCircle(29, 13, 13);
      const label = this.add.text(pos.x, pos.y - 41, type.name, {
        fontFamily: "Microsoft YaHei, sans-serif",
        fontSize: "14px",
        fontStyle: "bold",
        color: "#fff8ea",
        stroke: "#303436",
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(10);
      const mark = this.add.text(pos.x, pos.y, type.mark, {
        fontFamily: "Microsoft YaHei, sans-serif",
        fontSize: "20px",
        fontStyle: "bold",
        color: "#fff8ea",
      }).setOrigin(0.5).setDepth(11);
      sprite.mark = mark;
      const powerup = { type, sprite, label };
      this.powerups.push(powerup);
      const originalDestroy = sprite.destroy.bind(sprite);
      sprite.destroy = (...args) => {
        mark.destroy();
        originalDestroy(...args);
      };
      return powerup;
    }

    spawnHazard(id, x, y) {
      const type = id ? hazardTypes.find((item) => item.id === id) || this.rng.pick(hazardTypes) : this.rng.pick(hazardTypes);
      const pos = this.safeSpawnPoint(x, y);
      const scale = type.radius / 34;
      const sprite = this.physics.add.image(pos.x, pos.y, `hazard-${type.id}`).setScale(scale).setDepth(3);
      sprite.setCircle(34, 22, 22);
      const label = this.add.text(pos.x, pos.y - type.radius - 18, type.name, {
        fontFamily: "Microsoft YaHei, sans-serif",
        fontSize: "14px",
        fontStyle: "bold",
        color: "#fff8ea",
        stroke: "#303436",
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(10);
      const hazard = { ...type, sprite, label, bornAt: this.time.now, pulse: this.rng.between(0, Math.PI * 2) };
      this.hazards.push(hazard);
      this.tweens.add({
        targets: sprite,
        angle: type.id === "thunder" ? 8 : -8,
        yoyo: true,
        repeat: -1,
        duration: 850 + this.rng.int(0, 280),
        ease: "Sine.easeInOut",
      });
      return hazard;
    }

    updateHazards(time) {
      this.hazards.forEach((hazard) => {
        const pulse = 1 + Math.sin(time / 220 + hazard.pulse) * 0.07;
        hazard.sprite.setScale((hazard.radius / 34) * pulse);
        hazard.label.setPosition(hazard.sprite.x, hazard.sprite.y - hazard.radius - 18);
      });
    }

    clearNearbyHazards(radius) {
      let cleared = 0;
      this.hazards = this.hazards.filter((hazard) => {
        const distance = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, hazard.sprite.x, hazard.sprite.y);
        if (distance > radius) return true;
        cleared += 1;
        this.score += 38 * this.player.level;
        this.advanceMission("hazard", 1);
        this.burst(hazard.sprite.x, hazard.sprite.y, hazard.accent, 20, 110);
        hazard.sprite.destroy();
        hazard.label.destroy();
        return false;
      });
      if (cleared === 0) this.burst(this.player.sprite.x, this.player.sprite.y, 0x5dd39e, 18, 120);
    }

    blowBackEnemies(radius) {
      this.enemies.forEach((enemy) => {
        const distance = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, enemy.sprite.x, enemy.sprite.y);
        if (distance > radius) return;
        this.knockEnemy(enemy);
        this.burst(enemy.sprite.x, enemy.sprite.y, 0x5dd39e, 7, 48);
      });
    }

    safeSpawnPoint(x, y) {
      if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
      for (let i = 0; i < 25; i += 1) {
        const pos = {
          x: this.rng.between(80, WORLD_WIDTH - 80),
          y: this.rng.between(80, WORLD_HEIGHT - 80),
        };
        if (!this.player || Phaser.Math.Distance.Between(pos.x, pos.y, this.player.sprite.x, this.player.sprite.y) > 280) return pos;
      }
      return { x: this.rng.between(80, WORLD_WIDTH - 80), y: this.rng.between(80, WORLD_HEIGHT - 80) };
    }

    cleanupEffects(time) {
      Object.keys(this.effects).forEach((key) => {
        if (this.effects[key] && this.effects[key] < time) this.effects[key] = 0;
      });
      if (time > this.comboUntil) {
        this.combo = 1;
        this.comboChain = 0;
      }
      this.player.sprite.setAlpha(time < this.invulnerableUntil && Math.floor(time / 110) % 2 === 0 ? 0.55 : 1);
      if (this.isEffectActive("staff")) this.player.sprite.setTint(0xfff2a0);
      else if (this.isEffectActive("elixir")) this.player.sprite.setTint(0xffd166);
      else if (this.isEffectActive("clone")) this.player.sprite.setTint(0xffd3a6);
      else this.player.sprite.setTint(0xffffff);
    }

    isEffectActive(key) {
      return this.effects[key] && this.effects[key] > this.time.now;
    }

    updateHud(time = this.time.now) {
      hud.score.textContent = String(this.score);
      hud.level.textContent = String(this.player.level);
      hud.lives.textContent = String(this.lives);
      hud.combo.textContent = `x${this.combo}`;
      hud.dash.textContent = time >= this.dashReadyAt ? "就绪" : `${Math.ceil((this.dashReadyAt - time) / 1000)}s`;
      hud.best.textContent = String(this.getBest());
      hud.mission.innerHTML = this.mission
        ? `<b>${this.mission.mark}</b>${this.mission.text} ${this.mission.progress}/${this.mission.target}`
        : "<b>命</b>等待天命";
      const active = powerupTypes
        .filter((type) => this.effects[type.id] && this.effects[type.id] > time)
        .map((type) => ({ type, remaining: Math.ceil((this.effects[type.id] - time) / 1000) }));
      hud.powerups.innerHTML = active.length
        ? active
            .map((entry) => `<span class="powerup"><b>${entry.type.mark}</b>${entry.type.name} ${entry.remaining}s</span>`)
            .join("")
        : '<span class="powerup"><b>法</b>等待法宝</span>';
      if (this.debugStateEl) {
        this.debugStateEl.textContent = JSON.stringify(this.getDebugState());
      }
    }

    createDebugPanel() {
      const panel = document.createElement("div");
      panel.className = "debug-panel";
      panel.setAttribute("data-debug-panel", "true");
      panel.innerHTML = `
        <button type="button" data-debug-action="start">调试开始</button>
        <button type="button" data-debug-action="weak">生成弱敌</button>
        <button type="button" data-debug-action="strong">生成强敌</button>
        <button type="button" data-debug-action="elite">生成精英</button>
        <button type="button" data-debug-action="staff">生成金箍棒</button>
        <button type="button" data-debug-action="peach">生成蟠桃</button>
        <button type="button" data-debug-action="hazard">生成雷云</button>
        <button type="button" data-debug-action="dash">触发冲刺</button>
        <pre id="debug-state">{}</pre>
      `;
      document.body.appendChild(panel);
      this.debugStateEl = panel.querySelector("#debug-state");
      panel.addEventListener("click", (event) => {
        const action = event.target && event.target.getAttribute("data-debug-action");
        if (!action) return;
        if (action === "start") {
          this.startDebugGame();
          return;
        }
        if (this.state !== "running") this.startDebugGame();
        const x = Phaser.Math.Clamp(this.player.sprite.x + this.player.radius * 0.55, 60, WORLD_WIDTH - 60);
        const y = this.player.sprite.y;
        if (action === "weak") this.spawnEnemy(Math.max(1, this.player.power), x, y);
        if (action === "strong") this.spawnEnemy(Math.min(6, this.player.power + 2), x, y);
        if (action === "elite") this.spawnEnemy(Math.min(6, this.player.power + 1), x, y, true);
        if (action === "staff") this.spawnPowerup("staff", x, y);
        if (action === "peach") this.spawnPowerup("peach", x, y);
        if (action === "hazard") this.spawnHazard("thunder", x, y);
        if (action === "dash") this.tryDash(this.time.now);
      });
    }

    flashMessage(text) {
      this.messageText.setText(text);
      this.messageText.setPosition(this.scale.width / 2, 82);
      this.messageText.setAlpha(1);
      this.tweens.killTweensOf(this.messageText);
      this.tweens.add({
        targets: this.messageText,
        alpha: 0,
        y: 52,
        delay: 800,
        duration: 450,
        ease: "Sine.easeOut",
      });
    }

    flashAt(x, y, text) {
      const label = this.add.text(x, y, text, {
        fontFamily: "Microsoft YaHei, sans-serif",
        fontSize: "22px",
        fontStyle: "bold",
        color: "#fff8ea",
        stroke: "#303436",
        strokeThickness: 5,
      }).setOrigin(0.5).setDepth(30);
      this.tweens.add({
        targets: label,
        y: y - 46,
        alpha: 0,
        duration: 620,
        ease: "Sine.easeOut",
        onComplete: () => label.destroy(),
      });
    }

    burst(x, y, color, count = 10, radius = 70) {
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + this.rng.between(-0.22, 0.22);
        const distance = this.rng.between(radius * 0.35, radius);
        const dot = this.add.circle(x, y, this.rng.between(3, 7), color, 0.85).setDepth(25);
        this.tweens.add({
          targets: dot,
          x: x + Math.cos(angle) * distance,
          y: y + Math.sin(angle) * distance,
          alpha: 0,
          scale: 0.2,
          duration: this.rng.between(360, 720),
          ease: "Cubic.easeOut",
          onComplete: () => dot.destroy(),
        });
      }
    }

    leaveTrail(direction) {
      if (!direction || direction.lengthSq() === 0) return;
      const angle = Phaser.Math.Angle.Between(0, 0, direction.x, direction.y);
      const x = this.player.sprite.x - Math.cos(angle) * this.player.radius * 0.55;
      const y = this.player.sprite.y - Math.sin(angle) * this.player.radius * 0.55;
      const trail = this.add.image(x, y, "trail").setDepth(2).setAlpha(0.58);
      trail.setScale(Math.max(0.7, this.player.radius / PLAYER_BASE_RADIUS));
      this.tweens.add({
        targets: trail,
        alpha: 0,
        scale: trail.scale * 0.35,
        duration: 340,
        ease: "Sine.easeOut",
        onComplete: () => trail.destroy(),
      });
    }

    pickMission() {
      const candidates = missionTemplates.filter((mission) => mission.id !== "elite" || this.player.level >= 2);
      const template = this.rng.pick(candidates);
      this.mission = {
        ...template,
        progress: 0,
        target: template.target + Math.floor(this.player.level / 3),
      };
    }

    advanceMission(kind, amount = 1) {
      if (!this.mission || this.mission.kind !== kind || this.state === "gameover") return;
      this.mission.progress = Math.min(this.mission.target, this.mission.progress + amount);
      if (this.mission.progress < this.mission.target) return;
      const rewardScore = 160 + this.player.level * 55;
      this.score += rewardScore;
      this.flashMessage(`天命完成 +${rewardScore}`);
      this.playSfx("level");
      this.spawnPowerup(undefined, this.player.sprite.x + this.rng.between(-90, 90), this.player.sprite.y + this.rng.between(-90, 90));
      this.burst(this.player.sprite.x, this.player.sprite.y, 0x4aa87a, 30, 150);
      this.pickMission();
    }

    initAudio() {
      if (this.audioReady) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        this.audioEnabled = false;
        return;
      }
      const ctx = new AudioContext();
      const master = ctx.createGain();
      const music = ctx.createGain();
      const sfx = ctx.createGain();
      master.gain.value = 0.5;
      music.gain.value = 0.24;
      sfx.gain.value = 0.46;
      music.connect(master);
      sfx.connect(master);
      master.connect(ctx.destination);
      this.audio = { ctx, master, music, sfx, step: 0, timer: null };
      this.audioReady = true;
      this.updateAudioButton();
    }

    resumeAudio() {
      this.initAudio();
      if (!this.audioReady || !this.audioEnabled) return;
      if (this.audio.ctx.state === "suspended") this.audio.ctx.resume();
      if (!this.audio.timer) {
        this.audio.timer = window.setInterval(() => this.playMusicStep(), 280);
      }
      this.updateAudioButton();
    }

    toggleAudio() {
      this.audioEnabled = !this.audioEnabled;
      this.initAudio();
      if (this.audioReady) {
        this.audio.master.gain.value = this.audioEnabled ? 0.5 : 0;
        if (this.audioEnabled) this.resumeAudio();
      }
      this.updateAudioButton();
    }

    updateAudioButton() {
      if (!hud.audio) return;
      hud.audio.textContent = this.audioEnabled ? "音乐开" : "音乐关";
    }

    playMusicStep() {
      if (!this.audioReady || !this.audioEnabled || this.state === "paused") return;
      const ctx = this.audio.ctx;
      const scale = [392, 440, 523.25, 587.33, 659.25, 783.99];
      const bass = [196, 220, 261.63, 293.66];
      const now = ctx.currentTime;
      const note = scale[(this.audio.step + Math.floor(this.player.level / 2)) % scale.length];
      const bassNote = bass[Math.floor(this.audio.step / 4) % bass.length];
      this.tone(note, now, 0.18, "triangle", this.audio.music, 0.08);
      if (this.audio.step % 4 === 0) this.tone(bassNote, now, 0.34, "sine", this.audio.music, 0.05);
      if (this.combo >= 3 && this.audio.step % 2 === 0) this.tone(note * 1.5, now + 0.05, 0.1, "sine", this.audio.music, 0.045);
      this.audio.step = (this.audio.step + 1) % 32;
    }

    playSfx(kind) {
      if (!this.audioReady || !this.audioEnabled) return;
      const now = this.audio.ctx.currentTime;
      if (kind === "eat") this.tone(640 + this.combo * 28, now, 0.11, "square", this.audio.sfx, 0.08);
      else if (kind === "hurt") this.tone(110, now, 0.22, "sawtooth", this.audio.sfx, 0.11);
      else if (kind === "powerup") this.tone(880, now, 0.16, "triangle", this.audio.sfx, 0.09);
      else if (kind === "level") {
        this.tone(523.25, now, 0.13, "triangle", this.audio.sfx, 0.09);
        this.tone(783.99, now + 0.08, 0.16, "triangle", this.audio.sfx, 0.08);
      } else if (kind === "dash") this.tone(420, now, 0.08, "sawtooth", this.audio.sfx, 0.07);
      else if (kind === "orb") this.tone(760, now, 0.05, "sine", this.audio.sfx, 0.04);
    }

    tone(frequency, start, duration, type, output, volume) {
      const ctx = this.audio.ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(output);
      osc.start(start);
      osc.stop(start + duration + 0.03);
    }

    setOverlay(title, copy, button) {
      hud.overlayTitle.textContent = title;
      hud.overlayCopy.textContent = copy;
      hud.primary.textContent = button;
      hud.overlay.classList.remove("is-hidden");
    }

    hideOverlay() {
      hud.overlay.classList.add("is-hidden");
      hud.pause.textContent = "暂停";
    }

    getBest() {
      return Number.parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10);
    }

    saveBest() {
      const best = Math.max(this.getBest(), this.score);
      localStorage.setItem(STORAGE_KEY, String(best));
      return best;
    }

    getDebugState() {
      return {
        state: this.state,
        score: this.score,
        lives: this.lives,
        level: this.player.level,
        power: this.player.power,
        radius: Math.round(this.player.radius),
        combo: this.combo,
        comboChain: this.comboChain,
        enemies: this.enemies.length,
        orbs: this.orbs.length,
        powerups: this.powerups.length,
        hazards: this.hazards.length,
        mission: this.mission ? { id: this.mission.id, progress: this.mission.progress, target: this.mission.target } : null,
        dashReady: this.time.now >= this.dashReadyAt,
        audioEnabled: this.audioEnabled,
        effects: { ...this.effects },
        player: { x: Math.round(this.player.sprite.x), y: Math.round(this.player.sprite.y) },
      };
    }
  }

  const config = {
    type: Phaser.AUTO,
    parent: "game-root",
    backgroundColor: "#9fd6c8",
    scale: {
      mode: Phaser.Scale.RESIZE,
      parent: "game-root",
      width: gameRoot.clientWidth || 960,
      height: gameRoot.clientHeight || 540,
    },
    physics: {
      default: "arcade",
      arcade: {
        debug: false,
      },
    },
    render: {
      pixelArt: false,
      antialias: true,
    },
    scene: MainScene,
  };

  if (DEBUG) {
    console.info("Debug mode enabled", { seed: seedParam || "random" });
  }

  new Phaser.Game(config);
})();
