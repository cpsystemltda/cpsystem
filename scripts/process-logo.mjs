import sharp from "sharp";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "../Logo/logotipo2.png");
const PUBLIC_DIR = resolve(__dirname, "../public");

const FULL_TRANSPARENT = `${PUBLIC_DIR}/cp-consultoria-logo.png`;
const FULL_WHITE = `${PUBLIC_DIR}/cp-consultoria-logo-white.png`;

async function processLogo() {
  const src = sharp(SRC).ensureAlpha();
  const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const transparent = Buffer.alloc(width * height * 4);
  const whiteVersion = Buffer.alloc(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    let r = data[o];
    let g = data[o + 1];
    let b = data[o + 2];
    const a = channels === 4 ? data[o + 3] : 255;

    // Trim threshold: pixels nearly white become transparent
    const isNearWhite = r > 245 && g > 245 && b > 245;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    // Smooth alpha = 1 - lum (with steep cutoff for white anti-alias halos)
    let alpha;
    if (isNearWhite) alpha = 0;
    else if (lum > 0.92) alpha = Math.round((1 - lum) * 255 * 6);
    else alpha = Math.round(a * (1 - Math.max(0, (lum - 0.85) / 0.15) * 0.6));

    alpha = Math.max(0, Math.min(255, alpha));

    // Boost gold saturation: detect goldish pixels (R > G > B and warm) and intensify
    if (!isNearWhite && r > b + 15 && r >= g) {
      // pull toward a richer premium gold #D4AF37 -> (212, 175, 55)
      const targetR = 212, targetG = 175, targetB = 55;
      const goldStrength = Math.min(1, (r - b) / 120);
      r = Math.round(r * (1 - goldStrength * 0.45) + targetR * (goldStrength * 0.45));
      g = Math.round(g * (1 - goldStrength * 0.45) + targetG * (goldStrength * 0.45));
      b = Math.round(b * (1 - goldStrength * 0.45) + targetB * (goldStrength * 0.45));
      // Add brightness/saturation kick
      r = Math.min(255, Math.round(r * 1.05));
      g = Math.min(255, Math.round(g * 1.02));
    }

    transparent[i * 4] = r;
    transparent[i * 4 + 1] = g;
    transparent[i * 4 + 2] = b;
    transparent[i * 4 + 3] = alpha;

    // White version: same alpha but RGB forced to white, dark text becomes opaque white
    whiteVersion[i * 4] = 255;
    whiteVersion[i * 4 + 1] = 255;
    whiteVersion[i * 4 + 2] = 255;
    whiteVersion[i * 4 + 3] = alpha;
  }

  await sharp(transparent, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(FULL_TRANSPARENT);
  await sharp(whiteVersion, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(FULL_WHITE);

  console.log("Generated:");
  console.log(" -", FULL_TRANSPARENT);
  console.log(" -", FULL_WHITE);
}

processLogo().catch((e) => {
  console.error(e);
  process.exit(1);
});
