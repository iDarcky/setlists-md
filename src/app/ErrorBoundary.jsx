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
    const message = String(this.state.error?.message || '');
    // After a deploy, an old tab asks for code files that no longer exist.
    // That is not a bug to report: a reload fetches the new version.
    const stale = /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(message);

    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-6 font-sans text-foreground">
        <div className="flex w-full max-w-[400px] flex-col gap-4">
          <h1 className="m-0 text-[24px] font-semibold leading-8">
            {stale ? 'There’s a new version' : 'Something went wrong'}
          </h1>
          <p className="m-0 text-[15px] leading-6 text-muted-foreground">
            {stale
              ? 'The app was updated while it was open. Reload to carry on; nothing was lost.'
              : 'The app hit an error it didn’t expect. Your songs and setlists are safe. Reloading usually fixes it.'}
          </p>
          {!stale && message && (
            <details className="text-[13px] text-muted-foreground">
              <summary className="cursor-pointer">What happened</summary>
              <pre className="m-0 mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-control bg-raised p-3 font-mono text-[12px]">{message}</pre>
            </details>
          )}
          <div className="flex flex-col gap-2 pt-1">
            <button type="button" onClick={this.handleReload}
              className="h-12 cursor-pointer rounded-control border-0 bg-primary px-5 font-sans text-[16px] font-semibold text-primary-foreground hover:opacity-90">
              Reload
            </button>
            {!stale && (
              <button type="button" onClick={this.handleReset}
                className="h-12 cursor-pointer rounded-control border-0 bg-transparent px-5 font-sans text-[16px] font-semibold text-muted-foreground hover:bg-raised">
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
