import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  override render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="error-boundary">
          <p>Something went wrong</p>
          <button className="btn btn-secondary" onClick={this.handleRetry}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
