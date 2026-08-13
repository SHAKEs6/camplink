import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const PersistentBackground = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 450], [0, 120], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#1e1b4b", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          width: 1400,
          height: 1400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.35) 0%, rgba(30,27,75,0) 70%)",
          transform: `translate(${-200 + drift * 0.3}px, ${-300 + drift * 0.2}px)`,
          filter: "blur(60px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1200,
          height: 1200,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(79,70,229,0.4) 0%, rgba(30,27,75,0) 70%)",
          transform: `translate(${100 - drift * 0.4}px, ${600 - drift * 0.3}px)`,
          filter: "blur(80px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(251,191,36,0.12) 0%, rgba(30,27,75,0) 70%)",
          transform: `translate(${400 + drift * 0.2}px, ${200 + drift * 0.4}px)`,
          filter: "blur(70px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
    </AbsoluteFill>
  );
};
