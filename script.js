const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreElement = document.getElementById("score");
const highscoreElement = document.getElementById("highscore");
const scoreTwoElement = document.getElementById("scoreTwo");
const scoreTwoLabelElement = document.getElementById("scoreTwoLabel");
const scoreTwoCardElement = document.getElementById("scoreTwoCard");
const missionTitleElement = document.getElementById("missionTitle");
const missionProgressElement = document.getElementById("missionProgress");
const overlay = document.getElementById("overlay");
const overlayKicker = document.getElementById("overlayKicker");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const overlayDifficulty = document.getElementById("overlayDifficulty");
const overlayScore = document.getElementById("overlayScore");
const overlayHighscore = document.getElementById("overlayHighscore");
const overlayStartButton = document.getElementById("overlayStartButton");
const startButton = document.getElementById("startButton");
const themeToggle = document.getElementById("themeToggle");
const soundToggle = document.getElementById("soundToggle");
const difficultyOptions = document.getElementById("difficultyOptions");
const skinOptions = document.getElementById("skinOptions");
const modeOptions = document.getElementById("modeOptions");
const panelTabs = document.getElementById("panelTabs");
const gameShell = document.querySelector(".game-shell");

const tileCount = 20;
const tileSize = canvas.width / tileCount;
const savedTheme = localStorage.getItem("snake-theme") || "light";
const savedDifficulty = localStorage.getItem("snake-difficulty") || "easy";
const savedSoundEnabled = localStorage.getItem("snake-sound") !== "off";
const savedSkin = localStorage.getItem("snake-skin") || "classic";
const savedMode = localStorage.getItem("snake-mode") || "solo";
const legacyHighscore = Number(localStorage.getItem("snake-highscore")) || 0;
const difficulties = {
  easy: { label: "Leicht", startSpeed: 170, minSpeed: 105, speedStep: 4, points: 10 },
  medium: { label: "Mittel", startSpeed: 130, minSpeed: 80, speedStep: 6, points: 15 },
  hard: { label: "Schwer", startSpeed: 95, minSpeed: 58, speedStep: 8, points: 25 },
};
const powerupChances = {
  gold: 0.12,
  ice: 0.1,
};
const obstacleProgression = [
  { score: 40, count: 2 },
  { score: 90, count: 4 },
  { score: 150, count: 6 },
  { score: 230, count: 8 },
];
const missionTemplates = [
  {
    id: "apples",
    create: () => ({ target: 6 + Math.floor(Math.random() * 3) }),
    title: (state) => `${state.target} Aepfel sammeln`,
    progress: (state) => `${state.value}/${state.target} gesammelt`,
    reward: 20,
  },
  {
    id: "survival",
    create: () => ({ target: 20 + Math.floor(Math.random() * 11) }),
    title: (state) => `${state.target}s ueberleben`,
    progress: (state) => `${Math.min(state.value, state.target)}/${state.target}s geschafft`,
    reward: 30,
  },
  {
    id: "gold",
    create: () => ({ target: 1 }),
    title: () => "1 Gold-Apfel finden",
    progress: (state) => `${state.value}/${state.target} gefunden`,
    reward: 35,
  },
  {
    id: "score",
    create: () => ({ target: 80 + Math.floor(Math.random() * 41) }),
    title: (state) => `${state.target} Punkte erreichen`,
    progress: (state) => `${Math.min(state.value, state.target)}/${state.target} Punkte`,
    reward: 25,
  },
];

let snake;
let snakeTwo;
let previousSnake;
let previousSnakeTwo;
let direction;
let nextDirection;
let directionTwo;
let nextDirectionTwo;
let food;
let obstacles;
let score;
let scoreTwo = 0;
let highscore = 0;
let loopId = null;
let speed = difficulties[savedDifficulty]?.startSpeed || difficulties.easy.startSpeed;
let isRunning = false;
let gameState = "ready";
let difficulty = difficulties[savedDifficulty] ? savedDifficulty : "easy";
let skin = ["classic", "neon", "retro", "sunset", "jungle", "frost"].includes(savedSkin) ? savedSkin : "classic";
let mode = ["solo", "duel"].includes(savedMode) ? savedMode : "solo";
let slowEffectTimeoutId = null;
let slowModifier = 0;
let soundEnabled = savedSoundEnabled;
let audioContext = null;
let currentMission = null;
let roundStartTime = 0;
let animationFrameId = null;
let animationStartTime = 0;
let currentFrameDuration = difficulties[savedDifficulty]?.startSpeed || difficulties.easy.startSpeed;
let touchStartX = 0;
let touchStartY = 0;

setSoundEnabled(soundEnabled);
setTheme(savedTheme);
setMode(mode);
setDifficulty(difficulty);
setSkin(skin);
setActivePanel("gameplay");

function resetGame() {
  clearInterval(loopId);
  loopId = null;
  clearTimeout(slowEffectTimeoutId);
  slowEffectTimeoutId = null;
  snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
  previousSnake = snake.map((segment) => ({ ...segment }));
  snakeTwo = mode === "duel"
    ? [
        { x: 10, y: 14 },
        { x: 11, y: 14 },
        { x: 12, y: 14 },
      ]
    : [];
  previousSnakeTwo = snakeTwo.map((segment) => ({ ...segment }));
  obstacles = [];
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  directionTwo = { x: -1, y: 0 };
  nextDirectionTwo = { x: -1, y: 0 };
  score = 0;
  scoreTwo = 0;
  speed = difficulties[difficulty].startSpeed;
  currentFrameDuration = speed;
  slowModifier = 0;
  roundStartTime = 0;
  isRunning = false;
  gameState = "ready";
  animationStartTime = performance.now();
  scoreElement.textContent = score;
  scoreTwoElement.textContent = scoreTwo;
  if (mode === "solo") {
    assignMission();
  } else {
    missionTitleElement.textContent = "Duell aktiv";
    missionProgressElement.textContent = "Missionen sind im Zwei-Spieler-Modus pausiert.";
    currentMission = null;
  }
  spawnFood();
  startRenderLoop();
  draw(1);
  showOverlay({
    kicker: "Snake Arena",
    title: "Bereit?",
    text: "Waehle deinen Modus und starte per Richtungstaste, Touch oder Button in die naechste Runde.",
    buttonLabel: "Spielen",
  });
}

function spawnFood() {
  let candidate;

  do {
    candidate = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount),
      type: getRandomFoodType(),
    };
  } while (isCellBlocked(candidate, { ignoreFood: true }));

  food = candidate;
}

function startGame() {
  if (gameState === "gameover") {
    resetGame();
  }
  if (loopId) {
    clearInterval(loopId);
  }
  isRunning = true;
  gameState = "running";
  if (!roundStartTime) {
    roundStartTime = Date.now();
  }
  animationStartTime = performance.now();
  currentFrameDuration = getEffectiveSpeed();
  hideOverlay();
  ensureAudioContext();
  startRenderLoop();
  loopId = setInterval(gameLoop, getEffectiveSpeed());
}

function pauseGame() {
  if (gameState !== "running") {
    return;
  }

  clearInterval(loopId);
  loopId = null;
  isRunning = false;
  gameState = "paused";
  playSound("pause");
  showOverlay({
    kicker: "Kurze Pause",
    title: "Pause",
    text: "Druecke Leertaste oder tippe auf Spielen, um direkt weiterzumachen.",
    buttonLabel: "Weiter",
  });
}

function resumeGame() {
  if (gameState !== "paused") {
    return;
  }

  if (loopId) {
    clearInterval(loopId);
  }

  isRunning = true;
  gameState = "running";
  animationStartTime = performance.now();
  currentFrameDuration = getEffectiveSpeed();
  hideOverlay();
  playSound("resume");
  loopId = setInterval(gameLoop, getEffectiveSpeed());
}

function restartGame() {
  resetGame();
  startGame();
}

function updateLoopSpeed() {
  clearInterval(loopId);
  currentFrameDuration = getEffectiveSpeed();
  loopId = setInterval(gameLoop, currentFrameDuration);
}

function gameLoop() {
  previousSnake = snake.map((segment) => ({ ...segment }));
  previousSnakeTwo = snakeTwo.map((segment) => ({ ...segment }));
  direction = nextDirection;
  directionTwo = nextDirectionTwo;

  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y,
  };
  const headTwo = mode === "duel"
    ? {
        x: snakeTwo[0].x + directionTwo.x,
        y: snakeTwo[0].y + directionTwo.y,
      }
    : null;

  const hitsWall =
    head.x < 0 ||
    head.x >= tileCount ||
    head.y < 0 ||
    head.y >= tileCount;

  const hitsSelf = snake.some((segment) => segment.x === head.x && segment.y === head.y);
  const hitsObstacle = obstacles.some((obstacle) => obstacle.x === head.x && obstacle.y === head.y);
  const hitsOther = mode === "duel" && snakeTwo.some((segment) => segment.x === head.x && segment.y === head.y);

  const hitsWallTwo = mode === "duel" && (
    headTwo.x < 0 ||
    headTwo.x >= tileCount ||
    headTwo.y < 0 ||
    headTwo.y >= tileCount
  );
  const hitsSelfTwo = mode === "duel" && snakeTwo.some((segment) => segment.x === headTwo.x && segment.y === headTwo.y);
  const hitsObstacleTwo = mode === "duel" && obstacles.some((obstacle) => obstacle.x === headTwo.x && obstacle.y === headTwo.y);
  const hitsOtherTwo = mode === "duel" && snake.some((segment) => segment.x === headTwo.x && segment.y === headTwo.y);
  const headOnCollision = mode === "duel" && head.x === headTwo.x && head.y === headTwo.y;

  if (mode === "solo" && (hitsWall || hitsSelf || hitsObstacle)) {
    gameOver();
    return;
  }

  if (mode === "duel" && (hitsWall || hitsSelf || hitsObstacle || hitsOther || hitsWallTwo || hitsSelfTwo || hitsObstacleTwo || hitsOtherTwo || headOnCollision)) {
    gameOverDuel({
      playerOneDead: hitsWall || hitsSelf || hitsObstacle || hitsOther || headOnCollision,
      playerTwoDead: hitsWallTwo || hitsSelfTwo || hitsObstacleTwo || hitsOtherTwo || headOnCollision,
    });
    return;
  }

  snake.unshift(head);
  if (mode === "duel") {
    snakeTwo.unshift(headTwo);
  }

  const playerOneAte = head.x === food.x && head.y === food.y;
  const playerTwoAte = mode === "duel" && headTwo.x === food.x && headTwo.y === food.y;

  if (playerOneAte) {
    handleFoodPickup(food.type);
    spawnFood();

    if (speed > difficulties[difficulty].minSpeed) {
      speed -= difficulties[difficulty].speedStep;
      updateLoopSpeed();
    }
  } else {
    snake.pop();
  }

  if (mode === "duel") {
    if (playerTwoAte) {
      handleFoodPickupForPlayerTwo(food.type);
      spawnFood();

      if (speed > difficulties[difficulty].minSpeed) {
        speed -= Math.max(1, difficulties[difficulty].speedStep - 1);
        updateLoopSpeed();
      }
    } else {
      snakeTwo.pop();
    }
  }

  if (mode === "solo") {
    updateMissionProgress();
  }
  animationStartTime = performance.now();
  currentFrameDuration = getEffectiveSpeed();
  draw(0);
}

function gameOver() {
  clearInterval(loopId);
  loopId = null;
  clearTimeout(slowEffectTimeoutId);
  slowEffectTimeoutId = null;
  slowModifier = 0;
  isRunning = false;
  gameState = "gameover";
  playSound("gameover");
  showOverlay({
    kicker: "Runde vorbei",
    title: "Game Over",
    text: "Starte sofort neu oder wechsle erst die Schwierigkeit fuer den naechsten Versuch.",
    buttonLabel: "Nochmal spielen",
  });
}

function gameOverDuel({ playerOneDead, playerTwoDead }) {
  clearInterval(loopId);
  loopId = null;
  clearTimeout(slowEffectTimeoutId);
  slowEffectTimeoutId = null;
  slowModifier = 0;
  isRunning = false;
  gameState = "gameover";
  playSound("gameover");

  let resultText = "Beide Schlangen sind ausgeschieden.";
  if (playerOneDead && !playerTwoDead) {
    resultText = "Spieler 2 gewinnt das Duell.";
  }
  if (!playerOneDead && playerTwoDead) {
    resultText = "Spieler 1 gewinnt das Duell.";
  }

  showOverlay({
    kicker: "Duell beendet",
    title: "Rundenende",
    text: `${resultText} Endstand ${score} : ${scoreTwo}.`,
    buttonLabel: "Revanche",
  });
}

function showOverlay({ kicker, title, text, buttonLabel }) {
  overlayKicker.textContent = kicker;
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlayDifficulty.textContent = difficulties[difficulty].label;
  overlayScore.textContent = score;
  overlayHighscore.textContent = highscore;
  overlayStartButton.textContent = buttonLabel;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function draw(progress = 1) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const theme = document.body.classList.contains("dark") ? "dark" : "light";
  const palette = getSkinPalette(theme);

  drawBoardBackground(palette.boardColor, palette.gridColor);
  drawObstacles(palette.obstacleColor, palette.obstacleShadow);

  drawApple(food, theme, palette);

  snake.forEach((segment, index) => {
    const animatedSegment = getAnimatedSegment(previousSnake, snake, index, progress);
    if (index === 0) {
      drawSnakeHead(animatedSegment, direction, palette.headColor, palette.bodyShadow, palette.eyeColor, palette);
      return;
    }

    drawSnakeBody(animatedSegment, index, palette.bodyColor, palette.bodyShadow, palette);
  });

  if (mode === "duel") {
    snakeTwo.forEach((segment, index) => {
      const animatedSegment = getAnimatedSegment(previousSnakeTwo, snakeTwo, index, progress);
      if (index === 0) {
        drawSnakeHead(animatedSegment, directionTwo, palette.headColorTwo, palette.bodyShadowTwo, palette.eyeColor, palette);
        return;
      }

      drawSnakeBody(animatedSegment, index, palette.bodyColorTwo, palette.bodyShadowTwo, palette);
    });
  }
}

function startRenderLoop() {
  if (animationFrameId) {
    return;
  }

  const renderFrame = (now) => {
    const duration = Math.max(currentFrameDuration, 1);
    const progress = gameState === "running"
      ? Math.min((now - animationStartTime) / duration, 1)
      : 1;

    draw(progress);
    animationFrameId = window.requestAnimationFrame(renderFrame);
  };

  animationFrameId = window.requestAnimationFrame(renderFrame);
}

function getAnimatedSegment(previousSegments, currentSegments, index, progress) {
  const current = currentSegments[index];
  const previous = previousSegments[index] || currentSegments[index + 1] || current;

  return {
    x: previous.x + (current.x - previous.x) * progress,
    y: previous.y + (current.y - previous.y) * progress,
  };
}

function drawApple(cell, theme, palette) {
  if (skin === "retro") {
    drawRetroApple(cell, theme, palette);
    return;
  }

  const tile = getTileBounds(cell);
  const centerX = tile.centerX;
  const centerY = tile.centerY + tile.innerSize * 0.04;
  const pulse = 1 + Math.sin(performance.now() / 180) * 0.035;
  const radius = tile.innerSize * 0.3 * pulse;
  const appleColor = getAppleColor(theme, cell.type, palette);

  ctx.fillStyle = appleColor;
  ctx.beginPath();
  ctx.arc(centerX - radius * 0.52, centerY - radius * 0.05, radius, 0, Math.PI * 2);
  ctx.arc(centerX + radius * 0.52, centerY - radius * 0.05, radius, 0, Math.PI * 2);
  ctx.arc(centerX, centerY + radius * 0.32, radius * 0.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = palette.leafColor;
  ctx.beginPath();
  ctx.ellipse(centerX + radius * 0.48, centerY - radius * 0.92, radius * 0.38, radius * 0.17, -0.55, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = theme === "dark" ? "#84582a" : "#6b4322";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - radius * 0.56);
  ctx.quadraticCurveTo(centerX + 0.8, centerY - radius * 0.84, centerX + radius * 0.06, centerY - radius * 1.02);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.ellipse(centerX - radius * 0.48, centerY - radius * 0.08, radius * 0.24, radius * 0.13, -0.5, 0, Math.PI * 2);
  ctx.fill();

  if (cell.type === "gold") {
    ctx.strokeStyle = palette.goldAccent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - radius * 0.3);
    ctx.lineTo(centerX, centerY + radius * 0.35);
    ctx.moveTo(centerX - radius * 0.32, centerY + radius * 0.02);
    ctx.lineTo(centerX + radius * 0.32, centerY + radius * 0.02);
    ctx.stroke();
  }

  if (cell.type === "ice") {
    ctx.strokeStyle = palette.iceAccent;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - radius * 0.42);
    ctx.lineTo(centerX, centerY + radius * 0.42);
    ctx.moveTo(centerX - radius * 0.36, centerY - radius * 0.08);
    ctx.lineTo(centerX + radius * 0.36, centerY + radius * 0.08);
    ctx.moveTo(centerX - radius * 0.36, centerY + radius * 0.08);
    ctx.lineTo(centerX + radius * 0.36, centerY - radius * 0.08);
    ctx.stroke();
  }
}

function drawSnakeHead(segment, activeDirection, fillColor, shadowColor, eyeColor, palette) {
  if (skin === "retro") {
    drawRetroSnakeHead(segment, activeDirection, fillColor, eyeColor, palette);
    return;
  }

  const tile = getTileBounds(segment);
  const centerX = tile.centerX;
  const centerY = tile.centerY;
  const radius = tile.innerSize * 0.49;

  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radius, radius * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();

  if (skin !== "neon") {
    ctx.fillStyle = shadowColor;
    ctx.beginPath();
    ctx.ellipse(centerX - radius * 0.08, centerY + radius * 0.18, radius * 0.86, radius * 0.46, 0, 0, Math.PI);
    ctx.fill();
  }

  if (skin === "neon") {
    ctx.shadowColor = fillColor;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = "#f4fff1";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  const eyeOffsets = getEyeOffsets(activeDirection);
  ctx.fillStyle = eyeColor;
  eyeOffsets.forEach((eye) => {
    ctx.beginPath();
    ctx.arc(centerX + eye.x, centerY + eye.y, 2.8, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawSnakeBody(segment, index, fillColor, shadowColor, palette) {
  if (skin === "retro") {
    drawRetroSnakeBody(segment, index, fillColor, shadowColor);
    return;
  }

  const tile = getTileBounds(segment);
  const centerX = tile.centerX;
  const centerY = tile.centerY;
  const radiusX = Math.max(tile.innerSize * (0.45 - index * 0.0045), tile.innerSize * 0.31);
  const radiusY = Math.max(tile.innerSize * (0.4 - index * 0.0045), tile.innerSize * 0.27);

  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();

  if (skin === "neon") {
    ctx.shadowColor = fillColor;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = palette.glowStroke;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.shadowBlur = 0;
    return;
  }

  ctx.strokeStyle = shadowColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(centerX - 1.5, centerY + 1.5, radiusY * 0.6, 0.3, Math.PI - 0.3);
  ctx.stroke();
}

function drawObstacles(fillColor, shadowColor) {
  obstacles.forEach((obstacle) => {
    const tile = getTileBounds(obstacle);

    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.roundRect(tile.x + 3, tile.y + 3, tileSize - 6, tileSize - 6, 6);
    ctx.fill();

    ctx.strokeStyle = shadowColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tile.x + 6, tile.y + 8);
    ctx.lineTo(tile.x + tileSize - 8, tile.y + 10);
    ctx.moveTo(tile.x + 8, tile.y + tileSize - 9);
    ctx.lineTo(tile.x + tileSize - 10, tile.y + tileSize - 7);
    ctx.stroke();
  });
}

function drawBoardBackground(boardColor, gridColor) {
  ctx.fillStyle = boardColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;

  for (let index = 1; index < tileCount; index += 1) {
    const position = index * tileSize + 0.5;

    ctx.beginPath();
    ctx.moveTo(position, 0);
    ctx.lineTo(position, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, position);
    ctx.lineTo(canvas.width, position);
    ctx.stroke();
  }
}

function getTileBounds(cell) {
  const x = cell.x * tileSize;
  const y = cell.y * tileSize;
  const padding = 2;

  return {
    x,
    y,
    padding,
    innerSize: tileSize - padding * 2,
    centerX: x + tileSize / 2,
    centerY: y + tileSize / 2,
  };
}

function getEffectiveSpeed() {
  return speed + slowModifier;
}

function handleFoodPickup(type) {
  const basePoints = difficulties[difficulty].points;
  let earnedPoints = basePoints;
  let soundName = "apple";

  if (type === "gold") {
    earnedPoints = basePoints * 2;
    soundName = "gold";
  }

  if (type === "ice") {
    earnedPoints = Math.round(basePoints * 1.5);
    applySlowEffect();
    soundName = "ice";
  }

  score += earnedPoints;
  scoreElement.textContent = score;
  updateHighscore();
  syncObstaclesWithScore();
  updateMissionFromPickup(type);
  playSound(soundName);
}

function handleFoodPickupForPlayerTwo(type) {
  const basePoints = difficulties[difficulty].points;
  let earnedPoints = basePoints;
  let soundName = "apple";

  if (type === "gold") {
    earnedPoints = basePoints * 2;
    soundName = "gold";
  }

  if (type === "ice") {
    earnedPoints = Math.round(basePoints * 1.5);
    applySlowEffect();
    soundName = "ice";
  }

  scoreTwo += earnedPoints;
  scoreTwoElement.textContent = scoreTwo;
  playSound(soundName);
}

function updateHighscore() {
  if (score <= highscore) {
    return;
  }

  highscore = score;
  highscoreElement.textContent = highscore;
  localStorage.setItem(getHighscoreKey(difficulty), String(highscore));
}

function applySlowEffect() {
  slowModifier = 55;
  clearTimeout(slowEffectTimeoutId);
  slowEffectTimeoutId = setTimeout(() => {
    slowModifier = 0;
    slowEffectTimeoutId = null;

    if (gameState === "running") {
      updateLoopSpeed();
    }
  }, 4000);

  if (gameState === "running") {
    updateLoopSpeed();
  }
}

function getAppleColor(theme, type) {
  if (skin === "neon") {
    if (type === "gold") {
      return "#ffd84d";
    }
    if (type === "ice") {
      return "#71e3ff";
    }
    return "#ff5f87";
  }

  if (skin === "sunset") {
    if (type === "gold") {
      return "#ffd36b";
    }
    if (type === "ice") {
      return "#7ce7ff";
    }
    return "#ff6b6b";
  }

  if (skin === "jungle") {
    if (type === "gold") {
      return "#f4d35e";
    }
    if (type === "ice") {
      return "#8fe3ff";
    }
    return "#ff7f50";
  }

  if (skin === "frost") {
    if (type === "gold") {
      return "#ffe28a";
    }
    if (type === "ice") {
      return "#8ddfff";
    }
    return "#ff8a7a";
  }

  if (type === "gold") {
    return theme === "dark" ? "#f6c445" : "#f1b72c";
  }

  if (type === "ice") {
    return theme === "dark" ? "#79dcff" : "#61c9f5";
  }

  return theme === "dark" ? "#ff8e5a" : "#ff6f59";
}

function getSkinPalette(theme) {
  const palettes = {
    classic: {
      headColor: theme === "dark" ? "#d6ff72" : "#c3ff62",
      bodyColor: theme === "dark" ? "#65d7b6" : "#5fd18f",
      bodyShadow: theme === "dark" ? "#2b9d84" : "#2f8d64",
      eyeColor: theme === "dark" ? "#08111b" : "#142319",
      boardColor: theme === "dark" ? "#08151f" : "#1c3b2b",
      gridColor: theme === "dark" ? "rgba(115, 164, 201, 0.18)" : "rgba(167, 214, 186, 0.18)",
      obstacleColor: theme === "dark" ? "#8fa3b8" : "#90a08e",
      obstacleShadow: theme === "dark" ? "#4f6276" : "#62715f",
      leafColor: theme === "dark" ? "#68d66e" : "#5da83b",
      goldAccent: theme === "dark" ? "#fff3a1" : "#fff7c7",
      iceAccent: theme === "dark" ? "#e5fbff" : "#c7f2ff",
      glowStroke: "#f4fff1",
      headColorTwo: theme === "dark" ? "#ff9d72" : "#ff8855",
      bodyColorTwo: theme === "dark" ? "#ff6a8c" : "#ff6b6b",
      bodyShadowTwo: theme === "dark" ? "#b84161" : "#c54a4a",
    },
    neon: {
      headColor: "#d9ff66",
      bodyColor: "#29f0b4",
      bodyShadow: "#11a37f",
      eyeColor: "#03110d",
      boardColor: "#071018",
      gridColor: "rgba(75, 255, 219, 0.16)",
      obstacleColor: "#6f6af8",
      obstacleShadow: "#403ca5",
      leafColor: "#73ff9a",
      goldAccent: "#fff1a8",
      iceAccent: "#d8fbff",
      glowStroke: "#ffffff",
      headColorTwo: "#ff8d5c",
      bodyColorTwo: "#ff4f9a",
      bodyShadowTwo: "#a92d66",
    },
    retro: {
      headColor: "#b8f25f",
      bodyColor: "#62c74f",
      bodyShadow: "#3f7f32",
      eyeColor: "#15240f",
      boardColor: "#172815",
      gridColor: "rgba(219, 242, 165, 0.08)",
      obstacleColor: "#8a7a5a",
      obstacleShadow: "#53452f",
      leafColor: "#79b54a",
      goldAccent: "#f5ed9b",
      iceAccent: "#d5f1ff",
      glowStroke: "#f4fff1",
      headColorTwo: "#f4a259",
      bodyColorTwo: "#dd6b4d",
      bodyShadowTwo: "#8f402f",
    },
    sunset: {
      headColor: "#ffe082",
      bodyColor: "#ff8a5b",
      bodyShadow: "#cc5f3d",
      eyeColor: "#3f1f16",
      boardColor: theme === "dark" ? "#241229" : "#402344",
      gridColor: theme === "dark" ? "rgba(255, 170, 120, 0.14)" : "rgba(255, 205, 150, 0.18)",
      obstacleColor: theme === "dark" ? "#8c5b73" : "#b96b6b",
      obstacleShadow: theme === "dark" ? "#563449" : "#81494a",
      leafColor: "#8be28b",
      goldAccent: "#fff4ba",
      iceAccent: "#dbfbff",
      glowStroke: "#fff4e8",
      headColorTwo: "#7de2d1",
      bodyColorTwo: "#3fbac2",
      bodyShadowTwo: "#287b83",
    },
    jungle: {
      headColor: "#d7f171",
      bodyColor: "#47b76a",
      bodyShadow: "#2b7c47",
      eyeColor: "#102215",
      boardColor: theme === "dark" ? "#102417" : "#1c3a24",
      gridColor: theme === "dark" ? "rgba(149, 219, 125, 0.12)" : "rgba(170, 223, 145, 0.16)",
      obstacleColor: theme === "dark" ? "#7f6f45" : "#8f7d4e",
      obstacleShadow: theme === "dark" ? "#4e4328" : "#5f5230",
      leafColor: "#89d94a",
      goldAccent: "#fff0a6",
      iceAccent: "#d4f7ff",
      glowStroke: "#f3fff1",
      headColorTwo: "#ffd166",
      bodyColorTwo: "#f28f3b",
      bodyShadowTwo: "#ad6221",
    },
    frost: {
      headColor: "#dffaff",
      bodyColor: "#8fd9f5",
      bodyShadow: "#5da7c4",
      eyeColor: "#17303a",
      boardColor: theme === "dark" ? "#0a1a28" : "#dff4fb",
      gridColor: theme === "dark" ? "rgba(169, 228, 255, 0.16)" : "rgba(96, 158, 186, 0.16)",
      obstacleColor: theme === "dark" ? "#93a8bd" : "#a9b9c9",
      obstacleShadow: theme === "dark" ? "#5d7186" : "#74889d",
      leafColor: "#9be280",
      goldAccent: "#fff6c7",
      iceAccent: "#ffffff",
      glowStroke: "#f6fdff",
      headColorTwo: "#ffb3c7",
      bodyColorTwo: "#ff8fab",
      bodyShadowTwo: "#b35e75",
    },
  };

  return palettes[skin] || palettes.classic;
}

function drawRetroApple(cell, theme, palette) {
  const tile = getTileBounds(cell);
  const baseX = tile.x + 4;
  const baseY = tile.y + 4;
  const size = tileSize - 8;
  const appleColor = getAppleColor(theme, cell.type, palette);

  ctx.fillStyle = appleColor;
  ctx.fillRect(baseX + 5, baseY, size - 10, 3);
  ctx.fillRect(baseX + 2, baseY + 3, size - 4, 3);
  ctx.fillRect(baseX, baseY + 6, size, size - 12);
  ctx.fillRect(baseX + 2, baseY + size - 6, size - 4, 4);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(baseX + 4, baseY + 5, 3, 3);

  ctx.fillStyle = palette.leafColor;
  ctx.fillRect(baseX + size - 8, baseY + 1, 5, 2);
  ctx.fillRect(baseX + size - 6, baseY - 1, 4, 2);
  ctx.fillStyle = "#70421e";
  ctx.fillRect(baseX + Math.floor(size / 2) - 1, baseY - 2, 2, 6);
}

function drawRetroSnakeHead(segment, activeDirection, fillColor, eyeColor) {
  const tile = getTileBounds(segment);
  ctx.fillStyle = fillColor;
  ctx.fillRect(tile.x + 3, tile.y + 3, tileSize - 6, tileSize - 6);
  ctx.fillStyle = eyeColor;
  const leftX = activeDirection.x === -1 ? tile.x + 5 : tile.x + 6;
  const rightX = activeDirection.x === 1 ? tile.x + tileSize - 8 : tile.x + tileSize - 9;
  const eyeY = activeDirection.y === 1 ? tile.y + tileSize - 9 : tile.y + 7;
  ctx.fillRect(leftX, eyeY, 3, 3);
  ctx.fillRect(rightX, eyeY, 3, 3);
}

function drawRetroSnakeBody(segment, index, fillColor, shadowColor) {
  const tile = getTileBounds(segment);
  const inset = Math.min(4 + Math.floor(index / 5), 7);
  ctx.fillStyle = fillColor;
  ctx.fillRect(tile.x + inset, tile.y + inset, tileSize - inset * 2, tileSize - inset * 2);
  ctx.strokeStyle = shadowColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(tile.x + inset + 0.5, tile.y + inset + 0.5, tileSize - inset * 2 - 1, tileSize - inset * 2 - 1);
}

function getRandomFoodType() {
  const randomValue = Math.random();

  if (randomValue < powerupChances.gold) {
    return "gold";
  }

  if (randomValue < powerupChances.gold + powerupChances.ice) {
    return "ice";
  }

  return "normal";
}

function syncObstaclesWithScore() {
  const targetObstacleCount = obstacleProgression.reduce((count, level) => {
    if (score >= level.score) {
      return level.count;
    }

    return count;
  }, 0);

  while (obstacles.length < targetObstacleCount) {
    const obstacle = createObstacle();

    if (!obstacle) {
      break;
    }

    obstacles.push(obstacle);
  }
}

function createObstacle() {
  const blockedSpawnCells = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
    { x: 11, y: 10 },
    { x: 12, y: 10 },
    { x: 10, y: 14 },
    { x: 11, y: 14 },
    { x: 12, y: 14 },
    { x: 9, y: 14 },
    { x: 8, y: 14 },
  ];

  for (let attempts = 0; attempts < 200; attempts += 1) {
    const candidate = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount),
    };

    const isNearSpawn = blockedSpawnCells.some((cell) => cell.x === candidate.x && cell.y === candidate.y);
    if (isNearSpawn || isCellBlocked(candidate)) {
      continue;
    }

    return candidate;
  }

  return null;
}

function isCellBlocked(cell, options = {}) {
  const { ignoreFood = false } = options;
  const hitsSnake = snake.some((segment) => segment.x === cell.x && segment.y === cell.y);
  const hitsSnakeTwo = mode === "duel" && snakeTwo.some((segment) => segment.x === cell.x && segment.y === cell.y);
  const hitsObstacle = obstacles.some((obstacle) => obstacle.x === cell.x && obstacle.y === cell.y);
  const hitsFood = !ignoreFood && food && food.x === cell.x && food.y === cell.y;

  return hitsSnake || hitsSnakeTwo || hitsObstacle || hitsFood;
}

function getEyeOffsets(activeDirection) {
  if (activeDirection.x === 1) {
    return [{ x: 4, y: -5 }, { x: 4, y: 5 }];
  }

  if (activeDirection.x === -1) {
    return [{ x: -4, y: -5 }, { x: -4, y: 5 }];
  }

  if (activeDirection.y === -1) {
    return [{ x: -5, y: -4 }, { x: 5, y: -4 }];
  }

  return [{ x: -5, y: 4 }, { x: 5, y: 4 }];
}

function handleDirectionChange(input) {
  if (gameState === "paused") {
    return;
  }

  const controls = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    w: { x: 0, y: -1 },
    s: { x: 0, y: 1 },
    a: { x: -1, y: 0 },
    d: { x: 1, y: 0 },
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  const nextMove = controls[input];
  if (!nextMove) {
    return;
  }

  const isReverse =
    nextMove.x === direction.x * -1 &&
    nextMove.y === direction.y * -1;

  if (isReverse) {
    return;
  }

  if (gameState === "gameover") {
    resetGame();
  }

  nextDirection = nextMove;

  if (!isRunning) {
    startGame();
  }
}

function handleDirectionChangePlayerTwo(input) {
  if (gameState === "paused" || mode !== "duel") {
    return;
  }

  const controls = {
    i: { x: 0, y: -1 },
    k: { x: 0, y: 1 },
    j: { x: -1, y: 0 },
    l: { x: 1, y: 0 },
  };

  const nextMove = controls[input];
  if (!nextMove) {
    return;
  }

  const isReverse =
    nextMove.x === directionTwo.x * -1 &&
    nextMove.y === directionTwo.y * -1;

  if (isReverse) {
    return;
  }

  if (gameState === "gameover") {
    resetGame();
  }

  nextDirectionTwo = nextMove;

  if (!isRunning) {
    startGame();
  }
}

function handleSwipe(startX, startY, endX, endY) {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const threshold = 24;

  if (Math.abs(deltaX) < threshold && Math.abs(deltaY) < threshold) {
    return;
  }

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    handleDirectionChange(deltaX > 0 ? "right" : "left");
    return;
  }

  handleDirectionChange(deltaY > 0 ? "down" : "up");
}

function setTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark", isDark);
  themeToggle.textContent = isDark ? "Lightmode" : "Darkmode";
  themeToggle.setAttribute("aria-pressed", String(isDark));
  localStorage.setItem("snake-theme", theme);
  if (food && Array.isArray(snake) && Array.isArray(obstacles)) {
    draw();
  }
}

function setDifficulty(nextDifficulty) {
  if (!difficulties[nextDifficulty]) {
    return;
  }

  difficulty = nextDifficulty;
  localStorage.setItem("snake-difficulty", difficulty);
  speed = difficulties[difficulty].startSpeed;
  highscore = getStoredHighscore(difficulty);
  highscoreElement.textContent = highscore;

  document.querySelectorAll("#difficultyOptions .difficulty-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.difficulty === difficulty);
  });

  if (overlay && !overlay.classList.contains("hidden")) {
    overlayDifficulty.textContent = difficulties[difficulty].label;
    overlayHighscore.textContent = highscore;
  }

  if (gameState !== "running") {
    resetGame();
  }
}

function setMode(nextMode) {
  if (!["solo", "duel"].includes(nextMode)) {
    return;
  }

  mode = nextMode;
  localStorage.setItem("snake-mode", mode);
  scoreTwoLabelElement.textContent = "Spieler 2";
  scoreTwoCardElement.classList.toggle("is-hidden", mode !== "duel");

  document.querySelectorAll("#modeOptions .difficulty-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });

  resetGame();
}

function setSkin(nextSkin) {
  if (!["classic", "neon", "retro", "sunset", "jungle", "frost"].includes(nextSkin)) {
    return;
  }

  skin = nextSkin;
  localStorage.setItem("snake-skin", skin);

  document.querySelectorAll("#skinOptions .difficulty-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.skin === skin);
  });

  if (food && Array.isArray(snake) && Array.isArray(obstacles)) {
    draw();
  }
}

function setActivePanel(panelName) {
  document.querySelectorAll(".panel-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === panelName);
  });

  document.querySelectorAll(".panel-section").forEach((section) => {
    section.classList.toggle("active", section.dataset.panel === panelName);
  });
}

function assignMission() {
  const template = missionTemplates[Math.floor(Math.random() * missionTemplates.length)];
  currentMission = {
    id: template.id,
    reward: template.reward,
    title: template.title,
    progress: template.progress,
    ...template.create(),
    value: 0,
    completed: false,
  };
  updateMissionUI();
}

function updateMissionProgress() {
  if (!currentMission || currentMission.completed) {
    return;
  }

  if (currentMission.id === "survival" && roundStartTime) {
    currentMission.value = Math.floor((Date.now() - roundStartTime) / 1000);
  }

  if (currentMission.id === "score") {
    currentMission.value = score;
  }

  updateMissionUI();
  maybeCompleteMission();
}

function updateMissionFromPickup(type) {
  if (!currentMission || currentMission.completed) {
    return;
  }

  if (currentMission.id === "apples") {
    currentMission.value += 1;
  }

  if (currentMission.id === "gold" && type === "gold") {
    currentMission.value += 1;
  }

  if (currentMission.id === "score") {
    currentMission.value = score;
  }

  updateMissionUI();
  maybeCompleteMission();
}

function maybeCompleteMission() {
  if (!currentMission || currentMission.completed) {
    return;
  }

  if (currentMission.value < currentMission.target) {
    return;
  }

  currentMission.completed = true;
  score += currentMission.reward;
  scoreElement.textContent = score;
  updateHighscore();
  missionTitleElement.textContent = "Mission geschafft!";
  missionProgressElement.textContent = `+${currentMission.reward} Bonuspunkte erhalten`;
  playSound("gold");

  setTimeout(() => {
    if (gameState === "running" || gameState === "ready" || gameState === "paused") {
      assignMission();
    }
  }, 1200);
}

function updateMissionUI() {
  if (!currentMission) {
    missionTitleElement.textContent = "Noch keine Mission";
    missionProgressElement.textContent = "Starte eine Runde, um eine Mission zu bekommen.";
    return;
  }

  missionTitleElement.textContent = currentMission.title(currentMission);
  missionProgressElement.textContent = currentMission.progress(currentMission);
}

function getHighscoreKey(level) {
  return `snake-highscore-${level}`;
}

function getStoredHighscore(level) {
  const storedValue = Number(localStorage.getItem(getHighscoreKey(level)));

  if (Number.isFinite(storedValue) && storedValue > 0) {
    return storedValue;
  }

  if (level === "easy" && legacyHighscore > 0) {
    return legacyHighscore;
  }

  return 0;
}

function setSoundEnabled(nextValue) {
  soundEnabled = nextValue;
  soundToggle.textContent = soundEnabled ? "Sound an" : "Sound aus";
  soundToggle.setAttribute("aria-pressed", String(soundEnabled));
  localStorage.setItem("snake-sound", soundEnabled ? "on" : "off");
}

function ensureAudioContext() {
  if (!soundEnabled) {
    return null;
  }

  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  return audioContext;
}

function playSound(type) {
  if (!soundEnabled) {
    return;
  }

  const context = ensureAudioContext();
  if (!context) {
    return;
  }

  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  const soundMap = {
    apple: { frequency: 520, endFrequency: 760, duration: 0.09, gain: 0.05, wave: "triangle" },
    gold: { frequency: 640, endFrequency: 980, duration: 0.14, gain: 0.06, wave: "triangle" },
    ice: { frequency: 460, endFrequency: 300, duration: 0.16, gain: 0.05, wave: "sine" },
    pause: { frequency: 320, endFrequency: 250, duration: 0.08, gain: 0.05, wave: "square" },
    resume: { frequency: 280, endFrequency: 420, duration: 0.08, gain: 0.05, wave: "square" },
    gameover: { frequency: 280, endFrequency: 110, duration: 0.3, gain: 0.06, wave: "sawtooth" },
  };

  const config = soundMap[type] || soundMap.apple;

  oscillator.type = config.wave;
  oscillator.frequency.setValueAtTime(config.frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(config.endFrequency, now + config.duration);

  gainNode.gain.setValueAtTime(config.gain, now);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + config.duration);

  oscillator.start(now);
  oscillator.stop(now + config.duration);
}

document.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();

    if (gameState === "running") {
      pauseGame();
      return;
    }

    if (gameState === "paused") {
      resumeGame();
    }
    return;
  }

  handleDirectionChange(event.key);
  handleDirectionChangePlayerTwo(event.key);
});

startButton.addEventListener("click", restartGame);
overlayStartButton.addEventListener("click", () => {
  if (gameState === "paused") {
    resumeGame();
    return;
  }

  restartGame();
});
soundToggle.addEventListener("click", () => {
  setSoundEnabled(!soundEnabled);
  if (soundEnabled) {
    playSound("resume");
  }
});
themeToggle.addEventListener("click", () => {
  const nextTheme = document.body.classList.contains("dark") ? "light" : "dark";
  setTheme(nextTheme);
});
difficultyOptions.addEventListener("click", (event) => {
  const button = event.target.closest(".difficulty-button");
  if (!button) {
    return;
  }

  setDifficulty(button.dataset.difficulty);
});
modeOptions.addEventListener("click", (event) => {
  const button = event.target.closest(".difficulty-button");
  if (!button) {
    return;
  }

  setMode(button.dataset.mode);
});
skinOptions.addEventListener("click", (event) => {
  const button = event.target.closest(".difficulty-button");
  if (!button) {
    return;
  }

  setSkin(button.dataset.skin);
});
panelTabs.addEventListener("click", (event) => {
  const button = event.target.closest(".panel-tab");
  if (!button) {
    return;
  }

  setActivePanel(button.dataset.tab);
});
gameShell.addEventListener("touchstart", (event) => {
  if (!event.touches.length) {
    return;
  }

  touchStartX = event.touches[0].clientX;
  touchStartY = event.touches[0].clientY;
}, { passive: true });
gameShell.addEventListener("touchend", (event) => {
  if (!event.changedTouches.length) {
    return;
  }

  const endTouch = event.changedTouches[0];
  handleSwipe(touchStartX, touchStartY, endTouch.clientX, endTouch.clientY);
}, { passive: true });

resetGame();
