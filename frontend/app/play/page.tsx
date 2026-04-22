import { GameCanvas } from "../../components/game/GameCanvas";

type PlayPageProps = {
  searchParams?: {
    bg?: string | string[];
  };
};

export default function PlayPage({ searchParams }: PlayPageProps) {
  const bgParam = searchParams?.bg;
  const isBackgroundMode = Array.isArray(bgParam) ? bgParam.includes("1") : bgParam === "1";

  return (
    <div className={isBackgroundMode ? "play-bg-mode" : undefined}>
      {!isBackgroundMode && (
        <nav className="play-nav">
          <a href="/">Home</a>
          <a href="/connect">Connect</a>
          <a href="/deposit">Deposit</a>
        </nav>
      )}
      <GameCanvas backgroundMode={isBackgroundMode} />
    </div>
  );
}
