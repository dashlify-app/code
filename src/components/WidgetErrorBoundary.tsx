'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  widgetId: string;
  widgetTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error(`Widget ${this.props.widgetId} error:`, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="chart-card"
          style={{
            background: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 200,
          }}
        >
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Error al renderizar "{this.props.widgetTitle || 'widget'}"
            </div>
            <div style={{ fontSize: 11, opacity: 0.6, fontFamily: 'monospace' }}>
              {this.state.error?.message || 'Error desconocido'}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
