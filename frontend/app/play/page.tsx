import { GameCanvas } from "../../components/game/GameCanvas";

export default function PlayPage() {
  return (
    <>
      <nav className="play-nav">
        <a href="/">Home</a>
        <a href="/connect">Connect</a>
        <a href="/deposit">Deposit</a>
      </nav>
      <GameCanvas />
    </>
  );
}
