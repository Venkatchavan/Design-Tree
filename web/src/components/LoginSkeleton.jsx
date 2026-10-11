export default function LoginSkeleton() {
  return (
    <div className="login-screen">
      <main
        className="login-wrap"
        role="status"
        aria-busy="true"
        aria-label="Signing you in"
      >
        <section className="login-main">
          <div className="login-form-panel" aria-hidden="true">
            <div className="skel skel-kicker" />
            <div className="skel skel-title" />
            <div className="skel skel-sub" />
            <div className="skel skel-label" />
            <div className="skel skel-input" />
            <div className="skel skel-label" />
            <div className="skel skel-input" />
            <div className="skel skel-btn" />
          </div>
        </section>

        <aside className="login-side" aria-hidden="true">
          <div className="skel skel--on-dark skel-brand" />
          <div className="skel skel--on-dark skel-h2" />
          <div className="skel skel--on-dark skel-h2 short" />
          <div className="skel skel--on-dark skel-tagline" />
          <div className="skel skel--on-dark skel-scene" />
          <div className="login-skel-cards">
            {[0, 1, 2].map((i) => (
              <div className="skel skel--on-dark skel-card" key={i} />
            ))}
          </div>
        </aside>

        <span className="login-skel-sr">Signing you in…</span>
      </main>
    </div>
  );
}
