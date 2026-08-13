import { AbsoluteFill, useCurrentFrame, spring, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";

const { fontFamily } = loadFont("normal", { weights: ["700", "500"], subsets: ["latin"] });

export const SceneConnect = () => {
  const frame = useCurrentFrame();

  const titleY = spring({ frame, fps: 30, config: { damping: 14, stiffness: 120 } });
  const card1 = spring({ frame: frame - 30, fps: 30, config: { damping: 14, stiffness: 120 } });
  const card2 = spring({ frame: frame - 50, fps: 30, config: { damping: 14, stiffness: 120 } });

  const Card = ({ emoji, title, desc, delaySpring, align }: { emoji: string; title: string; desc: string; delaySpring: number; align: "left" | "right" }) => (
    <div
      style={{
        transform: `translateX(${align === "left" ? -1 : 1 * interpolate(delaySpring, [0, 1], [120, 0])}px)`,
        opacity: delaySpring,
        alignSelf: align === "left" ? "flex-start" : "flex-end",
        background: "linear-gradient(135deg, rgba(99,102,241,0.25), rgba(79,70,229,0.15))",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 32,
        padding: 36,
        width: "78%",
        marginBottom: 28,
      }}
    >
      <div style={{ fontSize: 64, marginBottom: 12 }}>{emoji}</div>
      <h3 style={{ fontSize: 48, fontWeight: 700, color: "#ffffff", margin: "0 0 8px" }}>{title}</h3>
      <p style={{ fontSize: 32, color: "rgba(255,255,255,0.75)", margin: 0, lineHeight: 1.3 }}>{desc}</p>
    </div>
  );

  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column", justifyContent: "center", fontFamily, padding: 60 }}>
      <div style={{ transform: `translateY(${interpolate(titleY, [0, 1], [60, 0])}px)`, opacity: interpolate(titleY, [0, 1], [0, 1]), marginBottom: 48, textAlign: "center" }}>
        <span style={{ fontSize: 38, fontWeight: 500, color: "#fbbf24", textTransform: "uppercase", letterSpacing: 4 }}>Connect</span>
        <h2 style={{ fontSize: 82, fontWeight: 700, color: "#ffffff", margin: "16px 0 0", lineHeight: 1.05 }}>
          Meet. Chat.<br />Belong.
        </h2>
      </div>
      <Card emoji="❤️" title="Hookups & Dates" desc="Find your person on campus." delaySpring={card1} align="left" />
      <Card emoji="📢" title="Community" desc="Announcements, lost & found, events." delaySpring={card2} align="right" />
    </AbsoluteFill>
  );
};
