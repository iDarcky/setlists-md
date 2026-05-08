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
        className="min-h-screen flex items-center justify-center px-6 bg-[var(--notion-bg)]"
      >
        <div className="border border-[var(--notion-border)] rounded-lg bg-[var(--notion-bg)] max-w-md p-8 text-center flex flex-col gap-4">
          <h2 className="text-heading-24 text-[var(--notion-text-main)] font-bold tracking-tight m-0">
            Something went wrong
          </h2>
          <p className="text-copy-14 text-[var(--notion-text-dim)] m-0 leading-relaxed">
            The app hit an unexpected error. Your data is safe — nothing was lost.
            Reloading usually fixes it.
          </p>
          {this.state.error?.message && (
            <pre className="text-copy-12 text-[var(--notion-text-dim)] bg-[var(--notion-bg-hover)] border border-[var(--notion-border)] rounded-lg p-3 text-left overflow-auto max-h-40 m-0 font-mono">
              {String(this.state.error.message)}
            </pre>
          )}
          <div className="flex gap-2 justify-center mt-2">
            <button
              onClick={this.handleReset}
              className="h-10 px-4 rounded-md bg-[var(--notion-bg)] border border-[var(--notion-border)] text-[var(--notion-text-main)] cursor-pointer hover:bg-[var(--notion-bg-hover)] transition-colors font-medium"
            >
              Try again
            </button>
            <button
              onClick={this.handleReload}
              className="h-10 px-4 rounded-md bg-[var(--color-brand)] text-white border-none cursor-pointer hover:opacity-90 transition-opacity font-medium"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
