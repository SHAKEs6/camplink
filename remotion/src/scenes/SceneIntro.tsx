import { AbsoluteFill, useCurrentFrame, spring, interpolate, staticFile, Img } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";

const { fontFamily } = loadFont("normal", { weights: ["700", "500"], subsets: ["latin"] });

export const SceneIntro = () => {
  const frame = useCurrentFrame();

  const logoScale = spring({ frame, fps: 30, config: { damping: 12, stiffness: 100 } });
  const titleY = spring({ frame: frame - 20, fps: 30, config: { damping: 15, stiffness: 120 } });
  const subtitleOp = interpolate(frame, [45, 70], [0, 1], { extrapolateRight: "clamp" });
  const lineWidth = spring({ frame: frame - 55, fps: 30, config: { damping: 20, stiffness: 150 } });

  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily }}>
      <div style={{ transform: `scale(${logoScale})`, marginBottom: 40 }}>
        <Img src={staticFile("images/logo.png")} style={{ width: 220, height: 220, borderRadius: 48 }} />
      </div>
      <div style={{ transform: `translateY(${interpolate(titleY, [0, 1], [60, 0])}px)`, opacity: interpolate(titleY, [0, 1], [0, 1]) }}>
        <h1 style={{ fontSize: 96, fontWeight: 700, color: "#ffffff", margin: 0, letterSpacing: -2, textAlign: "center" }}>
          Camplink
        </h1>
      </div>
      <div style={{ width: interpolate(lineWidth, [0, 1], [0, 240]), height: 4, background: "#fbbf24", borderRadius: 2, margin: "24px 0" }} />
      <p style={{ fontSize: 42, fontWeight: 500, color: "rgba(255,255,255,0.85)", margin: 0, opacity: subtitleOp, textAlign: "center", maxWidth: 800 }}>
        Your campus, curated.
      </p>
    </AbsoluteFill>
  );
};
