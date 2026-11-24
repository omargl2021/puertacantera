import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Ocurrió un error inesperado.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh w-full items-center justify-center bg-sand p-6">
          <div className="flex w-full max-w-md flex-col gap-3 rounded-[22px] border border-gold/30 bg-white p-6 text-center shadow-lg">
            <h1 className="font-heading text-2xl font-semibold text-ink">
              Algo salió mal
            </h1>
            <p className="text-sm text-stone">
              No se pudo completar la operación en la base de datos. Intenta recargar la aplicación.
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.reload();
              }}
              className="mt-2 inline-flex h-11 items-center justify-center rounded-xl bg-cantera px-5 text-sm font-semibold text-white hover:bg-cantera-dark"
            >
              Recargar aplicación
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
