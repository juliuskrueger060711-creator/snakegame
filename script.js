const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreElement = document.getElementById("score");
const highscoreElement = document.getElementById("highscore");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startButton = document.getElementById("startButton");
const themeToggle = document.getElementById("themeToggle");
const difficultyOptions = document.getElementById("difficultyOptions");

const tileCount = 20;
const tileSize = canvas.width / tileCount;
const savedTheme = localStorage.getItem("snake-theme") || "light";
const savedDifficulty = localStorage.getItem("snake-difficulty") || "easy";
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

let snake;
let direction;
let nextDirection;
let food;
let obstacles;
let score;
let highscore = 0;
let loopId = null;
let speed = difficulties[savedDifficulty]?.startSpeed || difficulties.easy.startSpeed;
let isRunning = false;
let gameState = "ready";
let difficulty = difficulties[savedDifficulty] ? savedDifficulty : "easy";
let slowEffectTimeoutId = null;
let slowModifier = 0;

setTheme(savedTheme);
setDifficulty(difficulty);

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
  obstacles = [];
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  score = 0;
  speed = difficulties[difficulty].startSpeed;
  slowModifier = 0;
  isRunning = false;
  gameState = "ready";
  scoreElement.textContent = score;
  spawnFood();
  draw();
  showOverlay("Bereit?", "Druecke eine Richtungstaste oder den Button fuer eine neue Runde.");
}

function spawnFood() {
  do {
    food = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount),
      type: getRandomFoodType(),
    };
  } while (isCellBlocked(food));
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
  hideOverlay();
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
  showOverlay("Pause", "Druecke Leertaste, um weiterzuspielen.");
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
  hideOverlay();
  loopId = setInterval(gameLoop, getEffectiveSpeed());
}

function restartGame() {
  resetGame();
  startGame();
}

function updateLoopSpeed() {
  clearInterval(loopId);
  loopId = setInterval(gameLoop, getEffectiveSpeed());
}

function gameLoop() {
  direction = nextDirection;

  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y,
  };

  const hitsWall =
    head.x < 0 ||
    head.x >= tileCount ||
    head.y < 0 ||
    head.y >= tileCount;

  const hitsSelf = snake.some((segment) => segment.x === head.x && segment.y === head.y);
  const hitsObstacle = obstacles.some((obstacle) => obstacle.x === head.x && obstacle.y === head.y);

  if (hitsWall || hitsSelf || hitsObstacle) {
    gameOver();
    return;
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    handleFoodPickup(food.type);
    spawnFood();

    if (speed > difficulties[difficulty].minSpeed) {
      speed -= difficulties[difficulty].speedStep;
      updateLoopSpeed();
    }
  } else {
    snake.pop();
  }

  draw();
}

function gameOver() {
  clearInterval(loopId);
  loopId = null;
  clearTimeout(slowEffectTimeoutId);
  slowEffectTimeoutId = null;
  slowModifier = 0;
  isRunning = false;
  gameState = "gameover";
  showOverlay("Game Over", "Klicke auf Neu starten oder druecke eine Richtungstaste fuer eine komplett neue Runde.");
}

function showOverlay(title, text) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const theme = document.body.classList.contains("dark") ? "dark" : "light";
  const headColor = theme === "dark" ? "#d6ff72" : "#c3ff62";
  const bodyColor = theme === "dark" ? "#65d7b6" : "#5fd18f";
  const bodyShadow = theme === "dark" ? "#2b9d84" : "#2f8d64";
  const eyeColor = theme === "dark" ? "#08111b" : "#142319";
  const boardColor = theme === "dark" ? "#08151f" : "#1c3b2b";
  const gridColor = theme === "dark" ? "rgba(115, 164, 201, 0.18)" : "rgba(167, 214, 186, 0.18)";
  const obstacleColor = theme === "dark" ? "#8fa3b8" : "#90a08e";
  const obstacleShadow = theme === "dark" ? "#4f6276" : "#62715f";

  drawBoardBackground(boardColor, gridColor);
  drawObstacles(obstacleColor, obstacleShadow);

  drawApple(food, theme);

  snake.forEach((segment, index) => {
    if (index === 0) {
      drawSnakeHead(segment, headColor, bodyShadow, eyeColor);
      return;
    }

    drawSnakeBody(segment, index, bodyColor, bodyShadow);
  });
}

function drawApple(cell, theme) {
  const tile = getTileBounds(cell);
  const centerX = tile.centerX;
  const centerY = tile.centerY + tile.innerSize * 0.04;
  const radius = tile.innerSize * 0.3;
  const appleColor = getAppleColor(theme, cell.type);

  ctx.fillStyle = appleColor;
  ctx.beginPath();
  ctx.arc(centerX - radius * 0.52, centerY - radius * 0.05, radius, 0, Math.PI * 2);
  ctx.arc(centerX + radius * 0.52, centerY - radius * 0.05, radius, 0, Math.PI * 2);
  ctx.arc(centerX, centerY + radius * 0.32, radius * 0.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = theme === "dark" ? "#68d66e" : "#5da83b";
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
    ctx.strokeStyle = theme === "dark" ? "#fff3a1" : "#fff7c7";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - radius * 0.3);
    ctx.lineTo(centerX, centerY + radius * 0.35);
    ctx.moveTo(centerX - radius * 0.32, centerY + radius * 0.02);
    ctx.lineTo(centerX + radius * 0.32, centerY + radius * 0.02);
    ctx.stroke();
  }

  if (cell.type === "ice") {
    ctx.strokeStyle = theme === "dark" ? "#e5fbff" : "#c7f2ff";
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

function drawSnakeHead(segment, fillColor, shadowColor, eyeColor) {
  const tile = getTileBounds(segment);
  const centerX = tile.centerX;
  const centerY = tile.centerY;
  const radius = tile.innerSize * 0.49;

  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radius, radius * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = shadowColor;
  ctx.beginPath();
  ctx.ellipse(centerX - radius * 0.08, centerY + radius * 0.18, radius * 0.86, radius * 0.46, 0, 0, Math.PI);
  ctx.fill();

  const eyeOffsets = getEyeOffsets();
  ctx.fillStyle = eyeColor;
  eyeOffsets.forEach((eye) => {
    ctx.beginPath();
    ctx.arc(centerX + eye.x, centerY + eye.y, 2.8, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawSnakeBody(segment, index, fillColor, shadowColor) {
  const tile = getTileBounds(segment);
  const centerX = tile.centerX;
  const centerY = tile.centerY;
  const radiusX = Math.max(tile.innerSize * (0.45 - index * 0.0045), tile.innerSize * 0.31);
  const radiusY = Math.max(tile.innerSize * (0.4 - index * 0.0045), tile.innerSize * 0.27);

  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();

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

  if (type === "gold") {
    earnedPoints = basePoints * 2;
  }

  if (type === "ice") {
    earnedPoints = Math.round(basePoints * 1.5);
    applySlowEffect();
  }

  score += earnedPoints;
  scoreElement.textContent = score;
  updateHighscore();
  syncObstaclesWithScore();
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
  if (type === "gold") {
    return theme === "dark" ? "#f6c445" : "#f1b72c";
  }

  if (type === "ice") {
    return theme === "dark" ? "#79dcff" : "#61c9f5";
  }

  return theme === "dark" ? "#ff8e5a" : "#ff6f59";
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

function isCellBlocked(cell) {
  const hitsSnake = snake.some((segment) => segment.x === cell.x && segment.y === cell.y);
  const hitsObstacle = obstacles.some((obstacle) => obstacle.x === cell.x && obstacle.y === cell.y);
  const hitsFood = food && food.x === cell.x && food.y === cell.y;

  return hitsSnake || hitsObstacle || hitsFood;
}

function getEyeOffsets() {
  if (direction.x === 1) {
    return [{ x: 4, y: -5 }, { x: 4, y: 5 }];
  }

  if (direction.x === -1) {
    return [{ x: -4, y: -5 }, { x: -4, y: 5 }];
  }

  if (direction.y === -1) {
    return [{ x: -5, y: -4 }, { x: 5, y: -4 }];
  }

  return [{ x: -5, y: 4 }, { x: 5, y: 4 }];
}

function handleDirectionChange(key) {
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
  };

  const nextMove = controls[key];
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

  document.querySelectorAll(".difficulty-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.difficulty === difficulty);
  });

  if (gameState !== "running") {
    resetGame();
  }
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
});

startButton.addEventListener("click", restartGame);
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

resetGame();
