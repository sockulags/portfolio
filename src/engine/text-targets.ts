const cache = new Map<string, Float32Array>();

/**
 * Rendera text till en offscreen-canvas och sampla pixlarna till ett punktmoln
 * i världskoordinater (z≈0-planet). Cachas per text+bredd.
 */
export async function textToPoints(text: string, count: number, worldWidth: number): Promise<Float32Array> {
  const key = `${text}|${count}|${Math.round(worldWidth * 10)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  try {
    await document.fonts.load("700 200px 'Space Grotesk'");
  } catch {
    // fontladdning misslyckades — systemfont duger
  }

  const canvas = document.createElement("canvas");
  const cw = 1200;
  const ch = 340;
  canvas.width = cw;
  canvas.height = ch;
  const c2d = canvas.getContext("2d")!;
  c2d.fillStyle = "#fff";
  c2d.textAlign = "center";
  c2d.textBaseline = "middle";
  let fontSize = 220;
  c2d.font = `700 ${fontSize}px 'Space Grotesk', system-ui, sans-serif`;
  const measured = c2d.measureText(text).width;
  if (measured > cw * 0.92) {
    fontSize = Math.floor((fontSize * cw * 0.92) / measured);
    c2d.font = `700 ${fontSize}px 'Space Grotesk', system-ui, sans-serif`;
  }
  c2d.fillText(text, cw / 2, ch / 2);

  const img = c2d.getImageData(0, 0, cw, ch).data;
  const candidates: number[] = [];
  // sampla varannan pixel för fart
  for (let y = 0; y < ch; y += 2) {
    for (let x = 0; x < cw; x += 2) {
      if (img[(y * cw + x) * 4 + 3] > 128) candidates.push(x, y);
    }
  }

  const points = new Float32Array(count * 3);
  if (candidates.length === 0) return points;

  const scale = worldWidth / cw;
  const n = candidates.length / 2;
  for (let i = 0; i < count; i++) {
    const pick = Math.floor(Math.random() * n) * 2;
    points[i * 3] = (candidates[pick] - cw / 2) * scale + (Math.random() - 0.5) * 0.03;
    points[i * 3 + 1] = -(candidates[pick + 1] - ch / 2) * scale + (Math.random() - 0.5) * 0.03;
    points[i * 3 + 2] = (Math.random() - 0.5) * 0.24;
  }
  cache.set(key, points);
  return points;
}
