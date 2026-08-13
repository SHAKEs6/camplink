import { AbsoluteFill, useCurrentFrame, spring, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";

const { fontFamily } = loadFont("normal", { weights: ["700", "500"], subsets: ["latin"] });

const items = [
  { emoji: "📚", label: "Textbooks" },
  { emoji: "💻", label: "Electronics" },
  { emoji: "🛋️", label: "Furniture" },
  { emoji: "👕", label: "Clothing" },
  { emoji: "🎟️", label: "Tickets" },
  { emoji: "🏠", label: "Housing" },
];

export const SceneMarketplace = () => {
  const frame = useCurrentFrame();

  const titleY = spring({ frame, fps: 30, config: { damping: 14, stiffness: 120 } });
  const subOp = interpolate(frame, [25, 50], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily, padding: 60 }}>
      <div style={{ transform: `translateY(${interpolate(titleY, [0, 1], [80, 0])}px)`, opacity: interpolate(titleY, [0, 1], [0, 1]), textAlign: "center" }}>
        <span style={{ fontSize: 38, fontWeight: 500, color: "#fbbf24", textTransform: "uppercase", letterSpacing: 4 }}>Marketplace</span>
        <h2 style={{ fontSize: 82, fontWeight: 700, color: "#ffffff", margin: "16px 0 0", lineHeight: 1.05 }}>
          Buy & Sell<br />on Campus
        </h2>
      </div>
      <p style={{ fontSize: 36, color: "rgba(255,255,255,0.75)", margin: "32px 0 48px", textAlign: "center", opacity: subOp }}>
        Everything students need, from students like you.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 20, maxWidth: 900 }}>
        {items.map((item, i) => {
          const s = spring({ frame: frame - 55 - i * 8, fps: 30, config: { damping: 14, stiffness: 150 } });
          return (
            <div
              key={item.label}
              style={{
                transform: `scale(${s}) translateY(${interpolate(s, [0, 1], [40, 0])}px)`,
                opacity: s,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 24,
                padding: "20px 28px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span style={{ fontSize: 40 }}>{item.emoji}</span>
              <span style={{ fontSize: 32, fontWeight: 500, color: "#ffffff" }}>{item.label}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
