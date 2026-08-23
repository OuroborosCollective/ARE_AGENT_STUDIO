import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

type StartupBoundaryProps = { children: React.ReactNode };
type StartupBoundaryState = { error: Error | null };

class StudioStartupBoundary extends React.Component<StartupBoundaryProps, StartupBoundaryState> {
  state: StartupBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): StartupBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('ARE Studio client startup failed', error);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="studio-boot-fallback" role="alert">
          <section className="studio-boot-card">
            <p className="studio-boot-kicker">ARE Agent Studio · Client recovery</p>
            <h1 className="studio-boot-title">The studio client <strong>did not start.</strong></h1>
            <p className="studio-boot-copy">No agent action, dataset write, or execution claim was made. Reload the page; if the issue remains, use the source repository to report the runtime error.</p>
            <p className="studio-boot-status"><a className="studio-boot-link" href="/">Reload the Studio</a></p>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
rootElement.dataset.areMounted = 'true';
root.render(
  <React.StrictMode>
    <StudioStartupBoundary>
      <App />
    </StudioStartupBoundary>
  </React.StrictMode>
);
