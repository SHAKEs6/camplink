import { AbsoluteFill, useCurrentFrame, spring, interpolate, staticFile, Img } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";

const { fontFamily } = loadFont("normal", { weights: ["700", "500"], subsets: ["latin"] });

export const SceneOutro = () => {
  const frame = useCurrentFrame();

  const logoScale = spring({ frame, fps: 30, config: { damping: 12, stiffness: 100 } });
  const titleY = spring({ frame: frame - 25, fps: 30, config: { damping: 15, stiffness: 120 } });
  const tagOp = interpolate(frame, [55, 80], [0, 1], { extrapolateRight: "clamp" });
  const ctaScale = spring({ frame: frame - 85, fps: 30, config: { damping: 14, stiffness: 150 } });

  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily }}>
      <div style={{ transform: `scale(${logoScale})`, marginBottom: 36 }}>
        <Img src={staticFile("images/logo.png")} style={{ width: 180, height: 180, borderRadius: 40 }} />
      </div>
      <div style={{ transform: `translateY(${interpolate(titleY, [0, 1], [50, 0])}px)`, opacity: interpolate(titleY, [0, 1], [0, 1]), textAlign: "center" }}>
        <h2 style={{ fontSize: 88, fontWeight: 700, color: "#ffffff", margin: 0, lineHeight: 1.05 }}>
          Camplink
        </h2>
      </div>
      <p style={{ fontSize: 44, fontWeight: 500, color: "rgba(255,255,255,0.85)", margin: "20px 0 40px", opacity: tagOp, textAlign: "center" }}>
        Your campus, curated.
      </p>
      <div
        style={{
          transform: `scale(${ctaScale})`,
          opacity: ctaScale,
          background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
          borderRadius: 60,
          padding: "24px 56px",
        }}
      >
        <span style={{ fontSize: 38, fontWeight: 700, color: "#1e1b4b" }}>Join your campus today</span>
      </div>
    </AbsoluteFill>
  );
};
