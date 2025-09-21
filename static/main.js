/* global drawConnectors, drawLandmarks */

// Load MediaPipe Hands via JS module CDN
// Using @mediapipe/tasks-vision Web API (preferred), but fallback to classic Hands if needed.

let leftScore = 0;
let rightScore = 0;
let isSwapped = false; // false: Left=Red, Right=Blue; true: Left=Blue, Right=Red
let totalPoints = 0; // total points scored in the current game

const startButton = document.getElementById('startCamera');
const closeButton = document.getElementById('closeCamera');
const webcamEl = document.getElementById('webcam');
const canvasEl = document.getElementById('overlay');
const ctx = canvasEl.getContext('2d');

const scoreLeftEl = document.getElementById('scoreLeft');
const scoreRightEl = document.getElementById('scoreRight');

const leftUp = document.getElementById('leftUp');
const leftDown = document.getElementById('leftDown');
const rightUp = document.getElementById('rightUp');
const rightDown = document.getElementById('rightDown');
const swapBtn = document.getElementById('swapSides');
const courtEl = document.querySelector('.court');
const labelLeft = document.getElementById('labelLeft');
const labelRight = document.getElementById('labelRight');
const nameLT = document.getElementById('nameLT');
const nameLB = document.getElementById('nameLB');
const nameRT = document.getElementById('nameRT');
const nameRB = document.getElementById('nameRB');
const serveLT = document.getElementById('serveLT');
const serveLB = document.getElementById('serveLB');
const serveRT = document.getElementById('serveRT');
const serveRB = document.getElementById('serveRB');

function updateScores() {
  scoreLeftEl.textContent = String(leftScore);
  scoreRightEl.textContent = String(rightScore);
}

function setServeIndicator(side, pos) {
  // Hide all first
  [serveLT, serveLB, serveRT, serveRB].forEach(el => { if (el) { el.classList.remove('on'); el.style.opacity = '0.25'; el.style.display = 'none'; } });
  if (side === 'left') {
    if (pos === 'top') { serveLT.classList.add('on'); serveLT.style.display = 'inline-block'; serveLT.style.opacity = '1'; }
    else { serveLB.classList.add('on'); serveLB.style.display = 'inline-block'; serveLB.style.opacity = '1'; }
  } else {
    if (pos === 'top') { serveRT.classList.add('on'); serveRT.style.display = 'inline-block'; serveRT.style.opacity = '1'; }
    else { serveRB.classList.add('on'); serveRB.style.display = 'inline-block'; serveRB.style.opacity = '1'; }
  }
}

function updateServerOnPoint(winningSide) {
  // Winner serves next.
  // Side-based rule:
  // - Left court: even score -> bottom serves; odd -> top
  // - Right court: even score -> top serves; odd -> bottom
  const score = winningSide === 'left' ? leftScore : rightScore;
  const isEven = (score % 2 === 0);
  const pos = winningSide === 'left' ? (isEven ? 'bottom' : 'top') : (isEven ? 'top' : 'bottom');
  setServeIndicator(winningSide, pos);
}

function resetGestureCooldown() {
  lastGestureTimeBySide = { left: 0, right: 0 };
}

leftUp.addEventListener('click', () => { leftScore += 1; totalPoints += 1; updateScores(); updateServerOnPoint('left'); handleFirstPointSwap('left'); consecutiveRotate('left'); });
leftDown.addEventListener('click', () => { leftScore = Math.max(0, leftScore - 1); updateScores(); });
rightUp.addEventListener('click', () => { rightScore += 1; totalPoints += 1; updateScores(); updateServerOnPoint('right'); handleFirstPointSwap('right'); consecutiveRotate('right'); });
rightDown.addEventListener('click', () => { rightScore = Math.max(0, rightScore - 1); updateScores(); });
swapBtn.addEventListener('click', () => {
  isSwapped = !isSwapped;
  courtEl.classList.toggle('swapped', isSwapped);
  resetGestureCooldown();

  // Swap scores left<->right
  [leftScore, rightScore] = [rightScore, leftScore];
  updateScores();

  // Swap players: LT -> RB, LB -> RT, RT -> LB, RB -> LT
  const lt = nameLT.value, lb = nameLB.value, rt = nameRT.value, rb = nameRB.value;
  nameLT.value = rb;
  nameLB.value = rt;
  nameRT.value = lb;
  nameRB.value = lt;

  // Swap serve indicators with the same mapping
  const ltOn = serveLT.style.opacity === '1';
  const lbOn = serveLB.style.opacity === '1';
  const rtOn = serveRT.style.opacity === '1';
  const rbOn = serveRB.style.opacity === '1';
  [serveLT, serveLB, serveRT, serveRB].forEach(el => { el.classList.remove('on'); el.style.opacity = '0.25'; el.style.display = 'none'; });
  if (ltOn) { serveRB.classList.add('on'); serveRB.style.display = 'inline-block'; serveRB.style.opacity = '1'; }
  if (lbOn) { serveRT.classList.add('on'); serveRT.style.display = 'inline-block'; serveRT.style.opacity = '1'; }
  if (rtOn) { serveLB.classList.add('on'); serveLB.style.display = 'inline-block'; serveLB.style.opacity = '1'; }
  if (rbOn) { serveLT.classList.add('on'); serveLT.style.display = 'inline-block'; serveLT.style.opacity = '1'; }

  // After swapping sides, recompute serve indicator position to adopt new side rule
  // Detect which side currently has serve after mapping
  const leftServing = serveLT.style.opacity === '1' || serveLB.style.opacity === '1';
  const sideNowServing = leftServing ? 'left' : 'right';
  updateServerOnPoint(sideNowServing);
});

// Determine which side a person belongs to (left/right) using x-position of wrist
function whichSideOfFrame(handLandmarks, videoWidth) {
  if (!handLandmarks || handLandmarks.length === 0) return 'left';
  // Wrist is landmark 0 in MediaPipe Hands
  const wrist = handLandmarks[0];
  // Front camera: left/right is mirrored, so flip the logic
  return (wrist.x * videoWidth) < (videoWidth / 2) ? 'right' : 'left';
}

// Simple thumbs-up detector using landmark positions
// Conditions:
// - Thumb up: thumb tip above wrist (y smaller)
// - Other fingertips curled or below MCPs
// Coordinates are normalized [0,1] with origin top-left.
function angleFormula(v1, v2) {
  const dot = v1[0] * v2[0] + v1[1] * v2[1];
  const length = Math.sqrt(v1[0] ** 2 + v1[1] ** 2) * Math.sqrt(v2[0] ** 2 + v2[1] ** 2);
  if (length === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / length)); // Clamp to avoid NaN
  return Math.acos(cosAngle);
}

function isThumbsUp(landmarks) {
  if (!landmarks || landmarks.length < 21) return false;
  const WRIST = 0;
  const THUMB_TIP = 4;
  const INDEX_TIP = 8;
  const MIDDLE_TIP = 12;
  const RING_TIP = 16;
  const PINKY_TIP = 20;
  const THUMB_MCP = 2;
  const INDEX_MCP = 5;
  const MIDDLE_MCP = 9;
  const RING_MCP = 13;
  const PINKY_MCP = 17;

  const wristX = landmarks[WRIST].x;
  const thumbTipX = landmarks[THUMB_TIP].x;
  const indexTipX = landmarks[INDEX_TIP].x;
  const middleTipX = landmarks[MIDDLE_TIP].x;
  const ringTipX = landmarks[RING_TIP].x;
  const pinkyTipX = landmarks[PINKY_TIP].x;
  
  const wristY = landmarks[WRIST].y;
  const thumbTipY = landmarks[THUMB_TIP].y;
  const indexTipY = landmarks[INDEX_TIP].y;
  const middleTipY = landmarks[MIDDLE_TIP].y;
  const ringTipY = landmarks[RING_TIP].y;
  const pinkyTipY = landmarks[PINKY_TIP].y;

  const thumbMcpX = landmarks[THUMB_MCP].x;
  const indexMcpX = landmarks[INDEX_MCP].x;
  const middleMcpX = landmarks[MIDDLE_MCP].x;
  const ringMcpX = landmarks[RING_MCP].x;
  const pinkyMcpX = landmarks[PINKY_MCP].x;

  const thumbMcpY = landmarks[THUMB_MCP].y;
  const indexMcpY = landmarks[INDEX_MCP].y;
  const middleMcpY = landmarks[MIDDLE_MCP].y;
  const ringMcpY = landmarks[RING_MCP].y;
  const pinkyMcpY = landmarks[PINKY_MCP].y;


  const thumbUp = angleFormula(
    [thumbTipX - wristX, thumbTipY - wristY],
    [thumbMcpX - thumbTipX, thumbMcpY - thumbTipY]
  ) > Math.PI / 2;
  
  const othersCurled =
    angleFormula([indexTipX - wristX, indexTipY - wristY], [indexMcpX - indexTipX, indexMcpY - indexTipY]) < Math.PI / 2 &&
    angleFormula([middleTipX - wristX, middleTipY - wristY], [middleMcpX - middleTipX, middleMcpY - middleTipY]) < Math.PI / 2 &&
    angleFormula([ringTipX - wristX, ringTipY - wristY], [ringMcpX - ringTipX, ringMcpY - ringTipY]) < Math.PI / 2 &&
    angleFormula([pinkyTipX - wristX, pinkyTipY - wristY], [pinkyMcpX - pinkyTipX, pinkyMcpY - pinkyTipY]) < Math.PI / 2;

  return thumbUp && othersCurled;
}

// Debounce scoring to prevent rapid multi-increments when holding gesture
let lastGestureTimeBySide = { left: 0, right: 0 };
const GESTURE_COOLDOWN_MS = 1200;

function tryScore(side) {
  const now = Date.now();
  if (now - lastGestureTimeBySide[side] < GESTURE_COOLDOWN_MS) return;
  lastGestureTimeBySide[side] = now;
  // Apply swap mapping to teams: Red vs Blue visual swap
  const logical = (isSwapped
    ? (side === 'left' ? 'blue' : 'red')
    : (side === 'left' ? 'red' : 'blue'));
  if (logical === 'red') {
    leftScore += 1;
    totalPoints += 1;
    updateScores();
    updateServerOnPoint('left');
    handleFirstPointSwap('left');
    consecutiveRotate('left');
  } else {
    rightScore += 1;
    totalPoints += 1;
    updateScores();
    updateServerOnPoint('right');
    handleFirstPointSwap('right');
    consecutiveRotate('right');
  }
}

// Resize canvas to match video
function syncCanvasToVideo() {
  const width = webcamEl.videoWidth;
  const height = webcamEl.videoHeight;
  if (!width || !height) return;
  canvasEl.width = width;
  canvasEl.height = height;
}

// MediaPipe Hands using globally-loaded scripts
async function loadMediaPipeHands() {
  const HandsCtor = window.Hands;
  const CameraCtor = window.Camera;
  const hands = new HandsCtor({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`,
  });
  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6,
  });

  hands.onResults((results) => {
    syncCanvasToVideo();
    ctx.save();
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    // Draw video frame mirrored for a selfie view
    ctx.translate(canvasEl.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(results.image, 0, 0, canvasEl.width, canvasEl.height);

    // Unmirror drawing of landmarks so coordinates align visually
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (results.multiHandLandmarks) {
      for (const landmarks of results.multiHandLandmarks) {
        // Gesture detection
        if (isThumbsUp(landmarks)) {
          const side = whichSideOfFrame(landmarks, canvasEl.width);
          tryScore(side);
        }

        // Render landmarks
        window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, { color: '#22d3ee', lineWidth: 3 });
        window.drawLandmarks(ctx, landmarks, { color: '#f59e0b', lineWidth: 1, radius: 2.5 });
      }
    }
    ctx.restore();
  });

  const camera = new CameraCtor(webcamEl, {
    onFrame: async () => {
      await hands.send({ image: webcamEl });
    },
    width: 640,
    height: 480,
  });

  return { start: () => camera.start() };
}

async function start() {
  startButton.disabled = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    webcamEl.srcObject = stream;
    await new Promise((res) => (webcamEl.onloadedmetadata = res));
    syncCanvasToVideo();

    const runner = await loadMediaPipeHands();
    await runner.start();
  } catch (err) {
    console.error('Failed to start camera or MediaPipe Hands', err);
    alert('Failed to access camera or load MediaPipe. Check permissions and internet connection.');
  } finally {
    startButton.disabled = false;
  }
}

startButton.addEventListener('click', start);

// Close camera button
function closeCamera() {
  const stream = webcamEl.srcObject;
  if (stream) {
    for (const track of stream.getTracks()) track.stop();
    webcamEl.srcObject = null;
  }
}
if (closeButton) closeButton.addEventListener('click', closeCamera);

// Initialize scores
updateScores();

// Serving: default at game start -> right top (Blue top)
setServeIndicator('right', 'top');

// Track consecutive wins per side; when side wins consecutive point, swap top/bottom names
let lastPointWinner = null;
function consecutiveRotate(side) {
  if (lastPointWinner === side) {
    // swap the names for that side
    if (side === 'left') {
      const t = nameLT.value; nameLT.value = nameLB.value; nameLB.value = t;
    } else {
      const t = nameRT.value; nameRT.value = nameRB.value; nameRB.value = t;
    }
  }
  lastPointWinner = side;
}

// First point special-case: if default server (right-top) wins the very first point, swap that team's positions
function handleFirstPointSwap(winningSide) {
  if (totalPoints === 1 && winningSide === 'right') {
    const t = nameRT.value; nameRT.value = nameRB.value; nameRB.value = t;
  }
}


