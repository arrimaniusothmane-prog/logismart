import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Dernier rempart : affiche une erreur lisible au lieu d'un écran blanc. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="card max-w-md p-6 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-500">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
          </div>
          <h1 className="text-base font-semibold text-slate-900">Une erreur inattendue est survenue</h1>
          <p className="mt-2 text-sm text-slate-500">
            L'interface a rencontré un problème. Rechargez la page ; si l'erreur persiste, contactez le support.
          </p>
          <div className="mt-4 overflow-auto rounded-md bg-slate-900 p-3 text-left" role="alert">
            <p className="font-mono text-xs text-slate-200">{this.state.error.message}</p>
            {this.state.error.stack && (
              <pre className="mt-2 max-h-56 overflow-auto font-mono text-[11px] leading-relaxed text-slate-400">
                {this.state.error.stack}
              </pre>
            )}
          </div>

          {this.state.error && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-left">
              <p className="font-mono text-xs font-semibold text-red-700 break-words">
                {this.state.error.name}: {this.state.error.message}
              </p>
              {this.state.error.stack && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-red-600 hover:underline">
                    Détails techniques
                  </summary>
                  <pre className="mt-2 max-h-40 overflow-auto font-mono text-[11px] text-slate-700 bg-white p-2 rounded border border-red-100">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            Recharger la page
          </button>
        </div>
      </div>
    );
  }
}
