import { AbsoluteFill, useCurrentFrame, spring, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";

const { fontFamily } = loadFont("normal", { weights: ["700", "500"], subsets: ["latin"] });

const features = [
  { emoji: "💰", title: "Wallet", desc: "Earn, send & spend points" },
  { emoji: "🎬", title: "Reels", desc: "Scroll campus moments" },
  { emoji: "🔔", title: "Realtime", desc: "Notifications & music" },
  { emoji: "🛡️", title: "Admin", desc: "Full control panel" },
];

export const ScenePower = () => {
  const frame = useCurrentFrame();

  const titleY = spring({ frame, fps: 30, config: { damping: 14, stiffness: 120 } });

  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily, padding: 60 }}>
      <div style={{ transform: `translateY(${interpolate(titleY, [0, 1], [60, 0])}px)`, opacity: interpolate(titleY, [0, 1], [0, 1]), textAlign: "center", marginBottom: 48 }}>
        <span style={{ fontSize: 38, fontWeight: 500, color: "#fbbf24", textTransform: "uppercase", letterSpacing: 4 }}>Powered Up</span>
        <h2 style={{ fontSize: 78, fontWeight: 700, color: "#ffffff", margin: "16px 0 0", lineHeight: 1.05 }}>
          More Than<br />a Marketplace
        </h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, width: "100%", maxWidth: 960 }}>
        {features.map((f, i) => {
          const s = spring({ frame: frame - 40 - i * 10, fps: 30, config: { damping: 14, stiffness: 150 } });
          return (
            <div
              key={f.title}
              style={{
                transform: `scale(${s})`,
                opacity: s,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 28,
                padding: 32,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 56, marginBottom: 12 }}>{f.emoji}</div>
              <h3 style={{ fontSize: 38, fontWeight: 700, color: "#ffffff", margin: "0 0 6px" }}>{f.title}</h3>
              <p style={{ fontSize: 28, color: "rgba(255,255,255,0.7)", margin: 0 }}>{f.desc}</p>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
