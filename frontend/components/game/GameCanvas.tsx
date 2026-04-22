import Script from "next/script";

export function GameCanvas() {
  return (
    <>
      <canvas className="game" />

      <div id="top-bar">
        <div className="stat-card">
          <div className="stat-label">BALANCE</div>
          <div className="stat-value" id="balance">
            $0.00
          </div>
        </div>
        <div className="stat-card timer-card" id="timer-card">
          <div className="stat-label" id="timer-label">
            SEGMENT
          </div>
          <div className="stat-value" id="timer">
            1:00
          </div>
        </div>
        <button id="bet-btn">BET</button>
        <button id="deposit-btn">DEPOSIT</button>
      </div>

      <div id="score">0</div>

      <div id="bet-hud" style={{ display: "none" }}>
        <div className="hud-row">
          <span className="hud-label">STAKE</span>
          <span id="bet-stake">$0.00</span>
        </div>
        <div className="hud-row">
          <span className="hud-label">CP</span>
          <span id="bet-cp" className="cp-value">
            CP 0
          </span>
        </div>
        <div className="hud-row">
          <span className="hud-label">MULT</span>
          <span id="bet-multiplier" className="multiplier-value">
            0.00x
          </span>
        </div>
        <div className="hud-row">
          <span className="hud-label">CASH OUT</span>
          <span id="bet-payout" className="payout-value">
            $0.00
          </span>
        </div>
        <button id="cash-out-btn" className="disabled" disabled>
          RUN TO NEXT CP
        </button>
      </div>

      <div id="controls">
        <div>
          <button id="forward">{"\u25B2"}</button>
          <button id="left">{"\u25C0"}</button>
          <button id="backward">{"\u25BC"}</button>
          <button id="right">{"\u25B6"}</button>
        </div>
      </div>

      <div id="bet-panel" className="modal-bg">
        <div className="modal-box">
          <button className="close-btn" id="bet-panel-close" aria-label="Close">
            X
          </button>
          <h2>PLACE YOUR BET</h2>
          <p className="subtitle">Mock USD - No blockchain (demo)</p>

          <div className="field">
            <label>STAKE ($)</label>
            <input type="number" id="stake-input" defaultValue="10" min="1" step="1" />
          </div>

          <div className="quick-picks">
            <button data-amount="5">$5</button>
            <button data-amount="10">$10</button>
            <button data-amount="25">$25</button>
            <button data-amount="50">$50</button>
            <button data-amount="100">$100</button>
          </div>

          <div className="odds-info">
            <div className="odds-row">
              start mult: <strong>0.00x</strong>
            </div>
            <div className="odds-row">
              per step: <strong>+0.025x</strong>
            </div>
            <div className="odds-row">
              every 40 steps: <strong>CP (x1.2)</strong>
            </div>
            <div className="odds-row">
              speed per CP: <strong>x1.10</strong>
            </div>
            <div className="odds-note">
              60s between CPs - cash out only at CP
              <br />
              overtime = -0.1x/s decay
            </div>
          </div>

          <div className="modal-actions">
            <button id="start-bet-btn" className="primary">
              START BET
            </button>
            <button id="free-play-btn" className="ghost">
              Free Play (no bet)
            </button>
          </div>
        </div>
      </div>

      <div id="deposit-modal" className="modal-bg" style={{ display: "none" }}>
        <div className="modal-box">
          <button className="close-btn" id="deposit-close" aria-label="Close">
            X
          </button>
          <h2>DEPOSIT MOCK $</h2>
          <p className="subtitle">Add mock dollars to your balance</p>

          <div className="field">
            <label>AMOUNT</label>
            <input type="number" id="deposit-amount" defaultValue="100" min="1" step="1" />
          </div>

          <div className="quick-picks">
            <button data-deposit="50">+$50</button>
            <button data-deposit="100">+$100</button>
            <button data-deposit="500">+$500</button>
            <button data-deposit="1000">+$1000</button>
          </div>

          <div className="modal-actions">
            <button id="deposit-confirm" className="primary">
              CONFIRM
            </button>
            <button id="deposit-cancel" className="ghost">
              CANCEL
            </button>
          </div>
        </div>
      </div>

      <div id="result-container">
        <div id="result">
          <h1 id="result-title">Game Over</h1>
          <div id="result-body" />
          <div className="modal-actions">
            <button id="retry" className="primary">
              PLAY AGAIN
            </button>
          </div>
        </div>
      </div>

      <Script src="/script.js" strategy="afterInteractive" type="module" />
    </>
  );
}
