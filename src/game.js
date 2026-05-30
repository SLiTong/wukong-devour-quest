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
    best: document.getElementById("best"),
    powerups: document.getElementById("powerups"),
    overlay: document.getElementById("overlay"),
    overlayTitle: document.getElementById("overlay-title"),
    overlayCopy: document.getElementById("overlay-copy"),
    primary: document.getElementById("primary-action"),
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
      this.effects = {};
      this.pointerTarget = null;
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

      window.WukongGame = {
        getState: () => this.getDebugState(),
        start: () => this.startGame(),
        pause: () => this.togglePause(),
        restart: () => this.startGame(),
        spawnEnemy: (power = 1, x, y) => this.spawnEnemy(power, x, y),
        spawnPowerup: (id, x, y) => this.spawnPowerup(id, x, y),
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
      this.cleanupEffects(time);
      this.handlePlayerMovement(dt);
      this.updateEnemies(dt, time);
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
      this.makeOrbTexture(g);
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

    makeOrbTexture(g) {
      g.clear();
      g.fillStyle(0xfff0a5, 1);
      g.fillCircle(16, 16, 12);
      g.fillStyle(0xffffff, 0.7);
      g.fillCircle(11, 10, 4);
      g.generateTexture("orb", 32, 32);
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
      this.keys = this.input.keyboard.addKeys("W,A,S,D,SPACE,P,ESC");
      this.input.on("pointerdown", (pointer) => {
        if (this.state !== "running") return;
        this.pointerTarget = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
      });
      this.input.on("pointermove", (pointer) => {
        if (!pointer.isDown || this.state !== "running") return;
        this.pointerTarget = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
      });
      this.input.keyboard.on("keydown-P", () => this.togglePause());
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
      this.enemies = [];
      this.orbs = [];
      this.powerups = [];
      this.effects = {};
      this.score = 0;
      this.lives = 3;
      this.elapsed = 0;
      this.spawnClock = 0;
      this.orbClock = 0;
      this.powerupClock = 0;
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
      }
    }

    startGame() {
      this.debugStable = false;
      this.resetGame(true);
      this.state = "running";
      this.invulnerableUntil = this.time.now + 900;
      this.hideOverlay();
      this.updateHud();
      this.flashMessage("大圣启程");
    }

    startDebugGame() {
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

    handlePlayerMovement(dt) {
      const speedBoost = this.isEffectActive("cloud") ? 1.48 : 1;
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

      this.player.sprite.setVelocity(velocity.x, velocity.y);
      this.player.label.setPosition(this.player.sprite.x, this.player.sprite.y - this.player.radius - 21);
      if (velocity.lengthSq() > 0) this.player.sprite.setFlipX(velocity.x < -2);
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
      this.collideEnemies(time);
    }

    collectOrbs() {
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
          this.gainGrowth(5, 6);
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
          powerup.sprite.destroy();
          powerup.label.destroy();
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
          this.score += enemy.value * this.player.level;
          this.gainGrowth(enemy.value * 0.55, enemy.value);
          this.flashAt(enemy.sprite.x, enemy.sprite.y, `+${enemy.value}`);
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
        this.invulnerableUntil = time + 1300;
        this.cameras.main.shake(160, 0.008);
        this.flashMessage(`${enemy.name} 太强，先避其锋芒`);
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
      return enemy.power <= this.player.power + staffBonus || enemy.radius < this.player.radius * 0.72;
    }

    knockEnemy(enemy) {
      const angle = Phaser.Math.Angle.Between(this.player.sprite.x, this.player.sprite.y, enemy.sprite.x, enemy.sprite.y);
      enemy.sprite.x = Phaser.Math.Clamp(enemy.sprite.x + Math.cos(angle) * 70, 40, WORLD_WIDTH - 40);
      enemy.sprite.y = Phaser.Math.Clamp(enemy.sprite.y + Math.sin(angle) * 70, 40, WORLD_HEIGHT - 40);
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
    }

    spawnOrb(x, y) {
      const pos = this.safeSpawnPoint(x, y);
      const orb = this.add.image(pos.x, pos.y, "orb").setDepth(1);
      orb.setScale(this.rng.between(0.82, 1.22));
      this.orbs.push(orb);
      return orb;
    }

    spawnEnemy(power = 1, x, y) {
      const type = enemyTypes[Phaser.Math.Clamp(power, 1, 6) - 1];
      const pos = this.safeSpawnPoint(x, y);
      const scale = type.radius / 43;
      const sprite = this.physics.add.image(pos.x, pos.y, `enemy-${type.id}`).setScale(scale).setDepth(5);
      sprite.setCircle(43, 21, 21);
      sprite.body.setCollideWorldBounds(true);
      sprite.body.setBounce(0.9, 0.9);
      const label = this.add.text(pos.x, pos.y - type.radius - 18, type.name, {
        fontFamily: "Microsoft YaHei, sans-serif",
        fontSize: "14px",
        fontStyle: "bold",
        color: "#fff8ea",
        stroke: "#303436",
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(10);
      const enemy = {
        ...type,
        sprite,
        label,
        speed: type.speed + this.rng.between(-10, 16),
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
      this.player.sprite.setAlpha(time < this.invulnerableUntil && Math.floor(time / 110) % 2 === 0 ? 0.55 : 1);
      this.player.sprite.setTint(this.isEffectActive("staff") ? 0xfff2a0 : 0xffffff);
    }

    isEffectActive(key) {
      return this.effects[key] && this.effects[key] > this.time.now;
    }

    updateHud(time = this.time.now) {
      hud.score.textContent = String(this.score);
      hud.level.textContent = String(this.player.level);
      hud.lives.textContent = String(this.lives);
      hud.best.textContent = String(this.getBest());
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
        <button type="button" data-debug-action="staff">生成金箍棒</button>
        <button type="button" data-debug-action="peach">生成蟠桃</button>
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
        if (action === "staff") this.spawnPowerup("staff", x, y);
        if (action === "peach") this.spawnPowerup("peach", x, y);
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
        enemies: this.enemies.length,
        orbs: this.orbs.length,
        powerups: this.powerups.length,
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
