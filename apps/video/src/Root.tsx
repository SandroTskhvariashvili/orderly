import { Composition } from "remotion";
import { Cover } from "./Cover.tsx";
import { DURATION, FPS, OrderlyVideo } from "./Video.tsx";

export function Root() {
  return (
    <>
      <Composition id="Orderly" component={OrderlyVideo} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} />
      <Composition id="Cover" component={Cover} durationInFrames={1} fps={FPS} width={2000} height={1500} />
      <Composition id="CoverWide" component={Cover} durationInFrames={1} fps={FPS} width={2560} height={1538} />
    </>
  );
}
