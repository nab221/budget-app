import { Component } from 'react';

/**
 * Small error boundary for tab content. A render error anywhere below it is
 * caught and shown as an inline message with a Reload button, instead of React
 * unmounting the whole tree and leaving a white page (the BUG-1 failure mode).
 *
 * `resetKey` lets the parent clear the error when the user navigates: when the
 * key changes (e.g. the active tab) the boundary drops its captured error and
 * re-renders its children, so a broken tab doesn't stay broken forever once the
 * user moves away and back.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="error-boundary" role="alert">
          <h3>Something went wrong on this screen.</h3>
          <p className="muted">{error.message || String(error)}</p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
