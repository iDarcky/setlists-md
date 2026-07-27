import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        data-theme-variant="modes"
        className="min-h-screen flex items-center justify-center px-6"
      >
        <div className="modes-card max-w-md p-8 text-center flex flex-col gap-4">
          <h2 className="text-heading-24 text-[var(--modes-text)] m-0">
            Something went wrong
          </h2>
          <p className="text-copy-14 text-[var(--modes-text-muted)] m-0">
            The app hit an unexpected error. Your data is safe — nothing was lost.
            Reloading usually fixes it.
          </p>
          {this.state.error?.message && (
            <pre className="text-copy-12 text-[var(--modes-text-dim)] bg-[var(--modes-surface-strong)] rounded-lg p-3 text-left overflow-auto max-h-40 m-0">
              {String(this.state.error.message)}
            </pre>
          )}
          <div className="flex gap-2 justify-center">
            <button
              onClick={this.handleReset}
              className="h-10 px-4 rounded-md bg-transparent border border-[var(--modes-border)] text-[var(--modes-text)] cursor-pointer hover:bg-[var(--modes-surface)]"
            >
              Try again
            </button>
            <button
              onClick={this.handleReload}
              className="h-10 px-4 rounded-md bg-[var(--color-brand)] text-white border-none cursor-pointer hover:opacity-90"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
