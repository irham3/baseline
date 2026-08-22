// Generates a privacy-safe PNG summary card for an analysis result (master
// plan P0.5: "shareable result image/link"). Canvas-only, no new dependency.
// Mirrors the app's existing privacy contract for the Agreement Sheet link:
// never draws cost-per-hour, margin, or break-even -- only what's already
// safe to put in front of a client (readiness state, issue count, price
// floor range).

const WIDTH = 1200;
const HEIGHT = 630;

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#0f5a40";
}

export async function generateShareCardBlob({ readinessLabel, issueCount, priceFloorText }) {
  if (document.fonts?.ready) {
    try { await document.fonts.ready; } catch { /* fall back to default font */ }
  }

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");

  const pageBg = cssVar("--surface");
  const ink = cssVar("--ink");
  const inkSoft = cssVar("--ink-soft");
  const green = cssVar("--green");
  const greenSoft = cssVar("--green-soft");

  ctx.fillStyle = pageBg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Wordmark
  ctx.fillStyle = green;
  ctx.font = "bold 32px Onest, sans-serif";
  ctx.fillText("Baseline", 64, 88);

  // Headline: the readiness state, the actual "magic moment" of the product
  ctx.fillStyle = ink;
  ctx.font = "bold 64px Onest, sans-serif";
  wrapText(ctx, readinessLabel, 64, 240, WIDTH - 128, 72);

  // Issue count chip
  const chipText = `${issueCount} issue${issueCount === 1 ? "" : "s"} found in this brief`;
  ctx.font = "600 28px Onest, sans-serif";
  const chipWidth = ctx.measureText(chipText).width + 48;
  ctx.fillStyle = greenSoft;
  roundRect(ctx, 64, 320, chipWidth, 56, 28);
  ctx.fill();
  ctx.fillStyle = green;
  ctx.fillText(chipText, 88, 357);

  // Price floor (only if this analysis actually priced)
  if (priceFloorText) {
    ctx.fillStyle = inkSoft;
    ctx.font = "500 26px Onest, sans-serif";
    ctx.fillText("Price floor", 64, 440);
    ctx.fillStyle = ink;
    ctx.font = "bold 44px Onest, sans-serif";
    ctx.fillText(priceFloorText, 64, 490);
  }

  ctx.fillStyle = inkSoft;
  ctx.font = "500 22px Onest, sans-serif";
  ctx.fillText("A pre-deal decision, not a vague quote.", 64, HEIGHT - 56);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let curY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, curY);
      line = word;
      curY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, curY);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
