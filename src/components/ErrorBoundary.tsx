import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component to catch and handle errors in child components.
 * Prevents the entire app from crashing when a component throws an error.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error in development
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI or default error message
      return this.props.fallback ?? (
        <div className="flex items-center justify-center w-full h-full bg-black/80 text-white p-4">
          <div className="text-center">
            <p className="text-lg font-medium mb-2">Something went wrong</p>
            <p className="text-sm text-gray-400">Please try again later</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Lightweight error boundary specifically for video player slides.
 * Shows a minimal error state that doesn't disrupt the swiper experience.
 */
export class PlayerErrorBoundary extends Component<
  { children: ReactNode; episodeId: string },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; episodeId: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error(`Player error for episode ${this.props.episodeId}:`, error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center w-full h-full bg-black text-white">
          <div className="text-center p-4">
            <p className="text-lg mb-2">Unable to load video</p>
            <p className="text-sm text-gray-400">Swipe to try another episode</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
