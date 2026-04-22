export default function Home() {
  return (
    <main className="flow-page">
      <section className="flow-card">
        <p className="flow-eyebrow">Chicken Monad</p>
        <h1 className="flow-title">Web3 Flow Starter</h1>
        <p className="flow-copy">
          Tahap 1 siap: kita sudah pisahkan route untuk connect wallet, deposit USDC, dan play.
          Next step tinggal wiring transaksi contract.
        </p>
        <div className="flow-actions">
          <a href="/connect" className="flow-btn">
            Connect Wallet
          </a>
          <a href="/deposit" className="flow-btn secondary">
            Deposit USDC
          </a>
          <a href="/play" className="flow-btn secondary">
            Play Game
          </a>
        </div>
      </section>
    </main>
  );
}
