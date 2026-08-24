import { useEffect, useMemo, useState } from 'react';
import {
  formatCount,
  formatEuro,
  METRICS_ENDPOINT,
  metricFetchMessage,
  normalizePublicMetrics,
} from './publicMetrics.js';

const learnSteps = [
  {
    id: 'observe',
    number: '01',
    image: '/assets/observe-frame.png',
    title: 'Observe',
    text: 'Ein sichtbarer Frame und eine menschliche Handlung werden als zusammengehörige Beobachtung erfasst.',
  },
  {
    id: 'correct',
    number: '02',
    image: '/assets/human-correction.png',
    title: 'Human corrects',
    text: 'Eine Korrektur bleibt ein expliziter menschlicher Eingriff – nicht eine stillschweigende Agentenentscheidung.',
  },
  {
    id: 'readback',
    number: '03',
    image: '/assets/device-readback.png',
    title: 'Device readback',
    text: 'Zählbar ist nur eine hashgebundene Geräte-Rückmeldung mit Beobachtung, Aktion und unabhängiger Evidenz.',
  },
];

function usePublicMetrics() {
  const [state, setState] = useState({ status: 'loading', metrics: null, message: null });

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);

    fetch(METRICS_ENDPOINT, { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Metrics request returned ${response.status}`);
        return normalizePublicMetrics(await response.json());
      })
      .then((metrics) => setState({ status: 'ready', metrics, message: null }))
      .catch((error) => setState({ status: 'unavailable', metrics: null, message: metricFetchMessage(error) }))
      .finally(() => window.clearTimeout(timeout));

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, []);

  return state;
}

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function MetricCard({ label, value, detail, tone = 'cyan' }) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <span className="metric-detail">{detail}</span>
    </article>
  );
}

function ExternalLink({ href, children, className = '' }) {
  if (!href) return <span className={className}>{children}</span>;
  return <a className={className} href={href} target="_blank" rel="noreferrer">{children}</a>;
}

export function App() {
  const evidence = usePublicMetrics();
  const metrics = evidence.metrics;
  const priceText = metrics ? formatEuro(metrics.currentPriceCents) : '—';
  const advanceText = metrics
    ? `${formatCount(metrics.actionsUntilNextPriceStep)} bis +1 €`
    : 'Evidenz wird geladen';
  const checkoutTarget = metrics?.purchaseEnabled ? metrics.checkoutUrl : null;
  const checkoutText = metrics?.purchaseEnabled
    ? `Early access über ${metrics.checkoutProvider === 'paypal' ? 'PayPal' : 'Krypto'}`
    : 'Checkout noch nicht eingerichtet';

  const accessStatus = useMemo(() => {
    if (evidence.status === 'loading') return 'Evidenzstand wird geladen';
    if (evidence.status === 'unavailable') return evidence.message;
    return 'Öffentliche Zahlen stammen aus dem Live-Ledger-Snapshot.';
  }, [evidence]);

  return (
    <main className="site-shell">
      <header className="topbar" aria-label="ARE Agent Studio navigation">
        <button className="brand" onClick={() => scrollToSection('top')} aria-label="Back to top">
          <span className="brand-accent">ARE</span><span>AGENT STUDIO</span>
        </button>
        <nav className="nav-links" aria-label="Sections">
          <button onClick={() => scrollToSection('learn')}>Wie es lernt</button>
          <button onClick={() => scrollToSection('evidence')}>Evidenz</button>
          <button onClick={() => scrollToSection('access')}>Zugang</button>
        </nav>
        <span className="receipt-status">Receipt-bound</span>
      </header>

      <section className="hero" id="top" aria-labelledby="hero-title">
        <div className="hero-visual" aria-label="Signal Control Room visualisation">
          <img src="/assets/are-signal-hero.png" alt="Luminous cyan and emerald evidence trajectories in a dark glass control room" />
          <aside className="signal-key">
            <p>Signal control field</p>
            <span className="cyan">Beobachtete Trajektorie</span>
            <span className="emerald">Evidenzgebundene Rückmeldung</span>
            <span className="violet">Menschliche Korrektur</span>
          </aside>
        </div>

        <div className="hero-panel glass-panel">
          <p className="eyebrow">ARE AGENT STUDIO</p>
          <h1 id="hero-title">Teach the visual agent.<br /><span>Keep the proof.</span></h1>
          <p className="hero-copy">Aus menschlichen Demonstrationen werden nachvollziehbare visuelle Agenten. Öffentliche Zahlen kommen aus einem Ledger – nicht aus einem Versprechen.</p>

          {checkoutTarget ? (
            <a className="primary-action" href={checkoutTarget} target="_blank" rel="noreferrer">{checkoutText}</a>
          ) : (
            <button className="primary-action" onClick={() => scrollToSection('access')}>{checkoutText}</button>
          )}

          <section className="live-console" aria-labelledby="console-heading">
            <div className="console-heading">
              <p id="console-heading">Live signal console</p>
              <span className={`live-dot live-dot--${evidence.status}`} aria-label={accessStatus} />
            </div>
            <div className="metric-grid" aria-live="polite">
              <MetricCard label="Device-readback actions" value={metrics ? formatCount(metrics.verifiedDeviceReadbackActions) : '—'} detail="hashgebunden bestätigt" tone="cyan" />
              <MetricCard label="Accepted samples" value={metrics ? formatCount(metrics.acceptedSamples) : '—'} detail="vollständige Ledger-Zeilen" tone="emerald" />
              <MetricCard label="Current price" value={priceText} detail="deterministische Preisregel" tone="cyan" />
              <MetricCard label="Next price step" value={metrics ? formatCount(metrics.actionStepSize) : '—'} detail={advanceText} tone="violet" />
            </div>
          </section>

          <p className={`metrics-status metrics-status--${evidence.status}`}>{accessStatus}</p>
        </div>
      </section>

      <section className="access-grid" id="access" aria-label="Access and publication information">
        <article className="access-card glass-panel">
          <p className="eyebrow">Dataset access</p>
          <div className="access-row">
            <span>Hugging Face project</span>
            {metrics?.huggingFaceProjectUrl ? (
              <ExternalLink href={metrics.huggingFaceProjectUrl} className="access-link">Projekt öffnen</ExternalLink>
            ) : <strong>Veröffentlichung ausstehend</strong>}
          </div>
          <div className="access-row">
            <span>Rohdaten-Download</span><strong>deaktiviert</strong>
          </div>
          <p className="access-note">Die Website zeigt ausschließlich Aggregatwerte und Ledger-Hashes. Eine öffentliche Dataset-Freigabe bleibt ein eigener Consent-Schritt.</p>
        </article>

        <article className="access-card glass-panel">
          <p className="eyebrow">Client source</p>
          <div className="access-row">
            <span>GitHub repository</span>
            <ExternalLink href={metrics?.apkClientRepositoryUrl || metrics?.sourceRepositoryUrl || 'https://github.com/OuroborosCollective/ARE_AGENT_STUDIO'} className="access-link">Quellcode öffnen</ExternalLink>
          </div>
          <div className="access-row">
            <span>APK release</span>
            {metrics?.apkReleaseUrl ? <ExternalLink href={metrics.apkReleaseUrl} className="access-link">Release öffnen</ExternalLink> : <strong>Noch nicht veröffentlicht</strong>}
          </div>
          <p className="access-note">Ein Repository-Link ist kein APK-Download. Erst ein verifizierter Release-Link wird als Client-Release angezeigt.</p>
        </article>

        <article className="access-card glass-panel">
          <p className="eyebrow">Early adopter</p>
          <div className="price-line"><strong>{metrics ? formatEuro(metrics.currentPriceCents) : '—'}</strong><span>aktuelle Regelpreis-Anzeige</span></div>
          <p className="access-note">Startpreis 4,25 €. Danach +1 € pro vollständig belegten 15 Device-Readback-Aktionen – keine Tests, Demos oder Vorhersagen.</p>
          {checkoutTarget ? <a className="secondary-action" href={checkoutTarget} target="_blank" rel="noreferrer">Early access anfragen</a> : <span className="secondary-action secondary-action--disabled">Zahlung noch nicht aktiviert</span>}
        </article>
      </section>

      <section className="learn-section" id="learn" aria-labelledby="learn-heading">
        <div className="section-heading">
          <p className="eyebrow">How ARE learns</p>
          <h2 id="learn-heading">Evidence-bound in three steps.</h2>
          <p>Beobachtung, Korrektur und Geräte-Rückmeldung bleiben getrennte, überprüfbare Zustände.</p>
        </div>
        <div className="learn-grid">
          {learnSteps.map((step) => (
            <article className="learn-card glass-panel" key={step.id}>
              <img src={step.image} alt="" />
              <span className="step-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
        <div className="truth-band">Eine Evidenzlinie verbindet Beobachtung, Korrektur und Geräte-Rückmeldung. Sie ist unveränderlich protokolliert und unabhängig prüfbar.</div>
      </section>

      <section className="evidence-section glass-panel" id="evidence" aria-labelledby="evidence-heading">
        <div>
          <p className="eyebrow">Public evidence boundary</p>
          <h2 id="evidence-heading">Keine Dashboard-Zahl ohne überprüfbaren Ursprung.</h2>
          <p>Die Seite liest nur den öffentlichen Metrics-Snapshot. Frames, Rohaktionen, Korrekturtexte und operative Kandidaten werden nicht ausgeliefert.</p>
        </div>
        <dl className="evidence-list">
          <div><dt>Snapshot hash</dt><dd>{metrics?.snapshotHash ? `${metrics.snapshotHash.slice(0, 16)}…` : '—'}</dd></div>
          <div><dt>Dataset ledger</dt><dd>{metrics?.datasetLedgerHash ? `${metrics.datasetLedgerHash.slice(0, 16)}…` : '—'}</dd></div>
          <div><dt>Verified ledger</dt><dd>{metrics?.verifiedLedgerHash ? `${metrics.verifiedLedgerHash.slice(0, 16)}…` : '—'}</dd></div>
          <div><dt>Owner-confirmed corrections</dt><dd>{metrics ? formatCount(metrics.ownerConfirmedCorrections) : '—'}</dd></div>
        </dl>
      </section>

      <footer className="footer">
        <span>ARE Agent Studio</span>
        <span>Visual agent learning with consent, receipts, and visible limits.</span>
      </footer>
    </main>
  );
}
