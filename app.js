const { useEffect, useMemo, useRef, useState } = React;

function formatLocalDateFromUtc(utcValue) {
  try {
    const d =
      typeof utcValue === "number"
        ? new Date(utcValue)
        : new Date(String(utcValue));
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "—";
  }
}

function useEurUsdFeed() {
  const [state, setState] = useState({
    connected: false,
    error: null,
    price: null,
    dt: null,
    rawTopic: "EURUSD:CUR",
  });

  const wsRef = useRef(null);
  const lastMessageAtRef = useRef(0);

  useEffect(() => {
    let alive = true;
    const WS_URL = "ws://stream.tradingeconomics.com/?client=guest:guest";

    function connect() {
      if (!alive) return;

      setState((s) => ({ ...s, error: null }));
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!alive) return;
        setState((s) => ({ ...s, connected: true, error: null }));

        // Subscribe
        ws.send(JSON.stringify({ topic: "subscribe", to: "EURUSD:CUR" }));
      };

      ws.onclose = () => {
        if (!alive) return;
        setState((s) => ({ ...s, connected: false }));
        setTimeout(() => connect(), 1200);
      };

      ws.onerror = () => {
        if (!alive) return;
        setState((s) => ({
          ...s,
          connected: false,
          error:
            "WebSocket error (some browsers block ws:// on local files). Try running via a local server.",
        }));
      };

      ws.onmessage = (evt) => {
        if (!alive) return;

        lastMessageAtRef.current = Date.now();
        try {
          const parsed = JSON.parse(evt.data);

          const candidate =
            Array.isArray(parsed)
              ? parsed[0]
              : parsed?.data && Array.isArray(parsed.data)
              ? parsed.data[0]
              : parsed;

          const price = candidate?.price ?? candidate?.Price ?? null;
          const dt = candidate?.dt ?? candidate?.DT ?? candidate?.date ?? null;

          if (price != null || dt != null) {
            setState((s) => ({
              ...s,
              price: price != null ? Number(price) : s.price,
              dt: dt != null ? dt : s.dt,
              error: null,
            }));
          }
        } catch {
        }
      };
    }

    connect();

    return () => {
      alive = false;
      try {
        wsRef.current?.close();
      } catch {}
    };
  }, []);

  const localTime = useMemo(() => {
    if (!state.dt) return "—";
    return formatLocalDateFromUtc(state.dt);
  }, [state.dt]);

  const priceText = useMemo(() => {
    if (state.price == null || Number.isNaN(state.price)) return "—"; 
    return state.price.toFixed(5);
  }, [state.price]);

  return {
    ...state,
    localTime,
    priceText,
  };
}

function Modal({ open, title, children, onClose }) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        // click outside to close modal
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="modal">
        <div className="modal-head">
          <h3 className="modal-title">{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function App() {
  const feed = useEurUsdFeed();
  const [showReset, setShowReset] = useState(false);
  const [toast, setToast] = useState("");

  // Reset password fields
  const [resetEmail, setResetEmail] = useState("");
  const [resetUsername, setResetUsername] = useState("");

  // Login fields 
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const dotClass = feed.error
    ? "status-dot err"
    : feed.connected
    ? "status-dot on"
    : "status-dot";

  function submitReset(e) {
    e.preventDefault();
    if (!resetEmail && !resetUsername) {
      setToast("Please enter your email or username to reset your password.");
      return;
    }
    setToast(
      "If an account exists for those details, a reset link will be sent shortly."
    );
    // simulate success then close
    setTimeout(() => {
      setShowReset(false);
      setResetEmail("");
      setResetUsername("");
    }, 900);
  }

  return (
    <div className="container">
      <div className="shell">
        <section className="card hero">
          <div className="hero-inner">
            <div className="brand">
              <div className="logo"></div>
              <div>
                <h1>ORTEX</h1>
                <p>Financial information and insights</p>
              </div>
            </div>

            <h2>Sign in to your ORTEX workspace</h2>
            <p className="sub">
              Prototype by Anita Aksentowicz
            </p>

            <div className="hr"></div>

            <div className="ticker" style={{ marginTop: 14 }}>
              <div className="ticker-top">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className={dotClass} aria-hidden="true"></span>
                  <div>
                    <div style={{ fontWeight: 700, letterSpacing: 0.2 }}>
                      EUR/USD (Live)
                    </div>
                    <div className="small">
                      Source: TradingEconomics WebSocket feed
                    </div>
                  </div>
                </div>

                <span className="badge">
                  {feed.error
                    ? "Error"
                    : feed.connected
                    ? "Connected"
                    : "Connecting"}
                </span>
              </div>

              <div className="row" style={{ alignItems: "baseline" }}>
                <div>
                  <div className="small">Latest price</div>
                  <div className="price">{feed.priceText}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="small">Latest timestamp (local)</div>
                  <div style={{ fontWeight: 650 }}>{feed.localTime}</div>
                </div>
              </div>

              {feed.error ? (
                <div className="toast">
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>
                    Heads-up
                  </div>
                  <div>
                    {feed.error}
                    <br />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
            <div>
            <h3 className="form-title">Login</h3>
            <p className="form-sub">
              Enter your credentials to continue.
            </p>
          </div>

          <form className="form" method="POST" action="/login">
            <div className="field">
              <div className="label-row">
                <label htmlFor="username">Username</label>
              </div>
              <input
                id="username"
                name="username"
                autoComplete="username"
                placeholder="e.g. anita"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <div className="label-row">
                <label htmlFor="password">Password</label>
                <button
                  type="button"
                  className="link"
                  onClick={() => setShowReset(true)}
                >
                  Reset password
                </button>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="row">
              <label className="checkbox">
                <input type="checkbox" name="rememberMe" />
                Remember me
              </label>

              <button className="btn btn-primary" type="submit">
                Log in
              </button>
            </div>
          </form>

          <div className="hr"></div>

          <div className="row">
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => {
                setToast("Demo: SSO button clicked.");
                setTimeout(() => setToast(""), 1600);
              }}
            >
              Continue with SSO
            </button>

            <span className="small">
              Need access?{" "}
              <a href="#" onClick={(e) => e.preventDefault()}>
                Contact support
              </a>
            </span>
          </div>
                  {toast ? <div className="toast">{toast}</div> : null}
        </section>
      </div>

      <Modal
        open={showReset}
        title="Reset password"
        onClose={() => setShowReset(false)}
      >
        <form onSubmit={submitReset}>
          <div className="modal-body">
            <div className="helper">
              Enter your <b>email</b> or <b>username</b>. If your account exists,
              you’ll receive a reset link.
            </div>

            <div className="field">
              <label htmlFor="resetEmail">Email</label>
              <input
                id="resetEmail"
                type="email"
                placeholder="name@company.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="resetUsername">Username</label>
              <input
                id="resetUsername"
                type="text"
                placeholder="e.g. anita"
                value={resetUsername}
                onChange={(e) => setResetUsername(e.target.value)}
              />
            </div>

            <div className="small">
              For a real app, you’d submit this to an endpoint like{" "}
              <code>/password-reset</code>.
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowReset(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Send reset link
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
