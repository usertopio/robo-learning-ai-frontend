import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App Integration Test', () => {
  it('renders the initial workspace UI correctly', () => {
    render(<App />);
    // Check if the sidebar or title is rendered
    expect(screen.getByText(/Robo Learn AI/i)).toBeDefined();
    expect(screen.getByText(/Save State/i)).toBeDefined();
  });
});
