/**
 * PWA アイコン生成スクリプト
 * 実行: node scripts/generate-pwa-icons.mjs
 *
 * 依存: なし（ブラウザの Canvas API を使用する HTML ファイルを生成します）
 * → generated-icons.html をブラウザで開いてダウンロード
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, "../public/icons/pwa");

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// SVG テンプレート（通常アイコン）
function createIconSVG(size) {
  const padding = Math.round(size * 0.1);
  const letterSize = Math.round(size * 0.52);
  const cx = size / 2;
  const cy = size / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#001845"/>
      <stop offset="100%" stop-color="#002366"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3B5FD9"/>
      <stop offset="100%" stop-color="#2040B0"/>
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="url(#bg)"/>
  <!-- Accent circle -->
  <circle cx="${cx}" cy="${cy}" r="${Math.round(size * 0.32)}" fill="none" stroke="url(#accent)" stroke-width="${Math.round(size * 0.04)}" opacity="0.6"/>
  <!-- Letter O -->
  <text
    x="${cx}" y="${cy}"
    font-family="'Inter', 'Noto Sans JP', sans-serif"
    font-weight="800"
    font-size="${letterSize}"
    fill="white"
    text-anchor="middle"
    dominant-baseline="central"
    letter-spacing="-${Math.round(size * 0.01)}"
  >O</text>
</svg>`;
}

// SVG テンプレート（maskable: セーフゾーンを考慮して余白大きめ）
function createMaskableIconSVG(size) {
  const letterSize = Math.round(size * 0.45);
  const cx = size / 2;
  const cy = size / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#001845"/>
      <stop offset="100%" stop-color="#002366"/>
    </linearGradient>
  </defs>
  <!-- Full bleed background (maskable requires no corner radius) -->
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <!-- Letter O (centered, smaller for safe zone) -->
  <text
    x="${cx}" y="${cy}"
    font-family="'Inter', 'Noto Sans JP', sans-serif"
    font-weight="800"
    font-size="${letterSize}"
    fill="white"
    text-anchor="middle"
    dominant-baseline="central"
  >O</text>
</svg>`;
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// SVG ファイルを出力（PNG 変換は HTML ページで行う）
for (const size of sizes) {
  const svg = createIconSVG(size);
  fs.writeFileSync(path.join(outputDir, `icon-${size}.svg`), svg, "utf8");
}

for (const size of [192, 512]) {
  const svg = createMaskableIconSVG(size);
  fs.writeFileSync(path.join(outputDir, `icon-maskable-${size}.svg`), svg, "utf8");
}

// ブラウザで PNG 変換するための HTML を生成
const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>OPINIO PWA アイコン生成</title>
<style>
  body { font-family: sans-serif; padding: 20px; background: #f8fafc; }
  h1 { color: #002366; }
  .icons { display: flex; flex-wrap: wrap; gap: 16px; margin: 20px 0; }
  .icon-item { text-align: center; }
  canvas { display: block; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
  button {
    margin: 20px 0; padding: 12px 24px; background: #002366; color: white;
    border: none; border-radius: 8px; cursor: pointer; font-size: 16px;
  }
  button:hover { background: #003399; }
  p { color: #475569; }
</style>
</head>
<body>
<h1>OPINIO PWA アイコン生成ツール</h1>
<p>下の「すべてダウンロード」ボタンをクリックすると、<code>public/icons/pwa/</code> に配置する PNG ファイルをダウンロードします。</p>
<button onclick="downloadAll()">📥 すべてダウンロード</button>
<div class="icons" id="icons"></div>

<script>
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const MASKABLE_SIZES = [192, 512];

function drawIcon(canvas, size, maskable = false) {
  const ctx = canvas.getContext('2d');
  canvas.width = size;
  canvas.height = size;

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, '#001845');
  bg.addColorStop(1, '#002366');

  if (maskable) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
  } else {
    const radius = Math.round(size * 0.22);
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(size - radius, 0);
    ctx.quadraticCurveTo(size, 0, size, radius);
    ctx.lineTo(size, size - radius);
    ctx.quadraticCurveTo(size, size, size - radius, size);
    ctx.lineTo(radius, size);
    ctx.quadraticCurveTo(0, size, 0, size - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.fillStyle = bg;
    ctx.fill();

    // Accent ring
    const accent = ctx.createLinearGradient(0, 0, size, size);
    accent.addColorStop(0, '#3B5FD9');
    accent.addColorStop(1, '#2040B0');
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.32, 0, Math.PI * 2);
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(1, Math.round(size * 0.04));
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Letter O
  const fontSize = maskable ? Math.round(size * 0.45) : Math.round(size * 0.52);
  ctx.fillStyle = 'white';
  ctx.font = \`800 \${fontSize}px 'Inter', sans-serif\`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('O', size / 2, size / 2 + size * 0.02);
}

function renderAll() {
  const container = document.getElementById('icons');

  SIZES.forEach(size => {
    const canvas = document.createElement('canvas');
    drawIcon(canvas, size);
    const label = document.createElement('div');
    label.style.fontSize = '12px';
    label.style.color = '#64748b';
    label.style.marginTop = '4px';
    label.textContent = size + 'x' + size;
    const wrap = document.createElement('div');
    wrap.className = 'icon-item';
    wrap.appendChild(canvas);
    wrap.appendChild(label);
    container.appendChild(wrap);
  });

  MASKABLE_SIZES.forEach(size => {
    const canvas = document.createElement('canvas');
    drawIcon(canvas, size, true);
    const label = document.createElement('div');
    label.style.fontSize = '12px';
    label.style.color = '#64748b';
    label.style.marginTop = '4px';
    label.textContent = 'maskable ' + size;
    const wrap = document.createElement('div');
    wrap.className = 'icon-item';
    wrap.appendChild(canvas);
    wrap.appendChild(label);
    container.appendChild(wrap);
  });
}

function downloadCanvas(canvas, filename) {
  return new Promise(resolve => {
    canvas.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(resolve, 200);
    }, 'image/png');
  });
}

async function downloadAll() {
  const canvases = document.querySelectorAll('canvas');
  const items = [
    ...SIZES.map((size, i) => ({ canvas: canvases[i], name: \`icon-\${size}.png\` })),
    ...MASKABLE_SIZES.map((size, i) => ({ canvas: canvases[SIZES.length + i], name: \`icon-maskable-\${size}.png\` }))
  ];
  for (const { canvas, name } of items) {
    await downloadCanvas(canvas, name);
  }
  alert('ダウンロード完了！\\npublic/icons/pwa/ フォルダに移動してください。');
}

renderAll();
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, "../public/icons/pwa/generate-icons.html"), html, "utf8");

console.log("✅ SVG アイコンを生成しました:");
for (const size of sizes) {
  console.log(`   public/icons/pwa/icon-${size}.svg`);
}
console.log("\n📌 次のステップ:");
console.log("   1. ブラウザで public/icons/pwa/generate-icons.html を開く");
console.log("   2. 「すべてダウンロード」をクリックして PNG をダウンロード");
console.log("   3. ダウンロードした PNG を public/icons/pwa/ に移動");
