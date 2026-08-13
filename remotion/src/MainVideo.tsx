import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { PersistentBackground } from "./components/PersistentBackground";
import { SceneIntro } from "./scenes/SceneIntro";
import { SceneMarketplace } from "./scenes/SceneMarketplace";
import { SceneConnect } from "./scenes/SceneConnect";
import { ScenePower } from "./scenes/ScenePower";
import { SceneOutro } from "./scenes/SceneOutro";

export const MainVideo = () => {
  return (
    <AbsoluteFill>
      <PersistentBackground />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={90}>
          <SceneIntro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: 15 })}
        />
        <TransitionSeries.Sequence durationInFrames={105}>
          <SceneMarketplace />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade({})}
          timing={linearTiming({ durationInFrames: 15 })}
        />
        <TransitionSeries.Sequence durationInFrames={105}>
          <SceneConnect />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-bottom" })}
          timing={linearTiming({ durationInFrames: 15 })}
        />
        <TransitionSeries.Sequence durationInFrames={105}>
          <ScenePower />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade({})}
          timing={linearTiming({ durationInFrames: 15 })}
        />
        <TransitionSeries.Sequence durationInFrames={90}>
          <SceneOutro />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
