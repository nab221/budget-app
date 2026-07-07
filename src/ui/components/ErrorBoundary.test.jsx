import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary.jsx';

afterEach(cleanup);

function Boom() {
  throw new Error('kaboom');
}

describe('<ErrorBoundary>', () => {
  it('renders children when they do not throw', () => {
    render(
      <ErrorBoundary resetKey="a">
        <p>hello</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('hello')).toBeTruthy();
  });

  it('shows a fallback with the message and a Reload button instead of crashing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary resetKey="a">
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('kaboom')).toBeTruthy();
    expect(screen.getByRole('button', { name: /reload/i })).toBeTruthy();
    spy.mockRestore();
  });
});
