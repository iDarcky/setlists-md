import { describe, it, expect } from 'vitest';
import { workspaceStatusLabel, billingError } from '../billing/checkout';

describe('workspaceStatusLabel', () => {
  it('returns null for healthy states (active, trialing)', () => {
    expect(workspaceStatusLabel('active')).toBe(null);
    expect(workspaceStatusLabel('trialing')).toBe(null);
  });

  it('returns null when status is falsy (defaults to active)', () => {
    expect(workspaceStatusLabel(null)).toBe(null);
    expect(workspaceStatusLabel(undefined)).toBe(null);
    expect(workspaceStatusLabel('')).toBe(null);
  });

  it('returns "Past due" for past_due', () => {
    expect(workspaceStatusLabel('past_due')).toBe('Past due');
  });

  it('returns "Unpaid" for unpaid', () => {
    expect(workspaceStatusLabel('unpaid')).toBe('Unpaid');
  });

  it('returns "Canceled" for canceled', () => {
    expect(workspaceStatusLabel('canceled')).toBe('Canceled');
  });

  it('is case-insensitive', () => {
    expect(workspaceStatusLabel('PAST_DUE')).toBe('Past due');
    expect(workspaceStatusLabel('Unpaid')).toBe('Unpaid');
  });
});

describe('billingError', () => {
  it('returns the "not live" message for billing_not_configured error code', () => {
    const result = billingError({ code: 'billing_not_configured' });
    expect(result).toContain('live');
  });

  it('returns the "not live" message for a 503 status', () => {
    const result = billingError({ status: 503 });
    expect(result).toContain('live');
  });

  it('returns the "not available" message for price_not_configured', () => {
    const result = billingError({ code: 'price_not_configured' });
    expect(result).toContain('available');
  });

  it('returns the raw error message when no known code matches', () => {
    expect(billingError({ message: 'Something went wrong' })).toBe('Something went wrong');
  });

  it('returns a fallback message for null / undefined', () => {
    const fallback = billingError(null);
    expect(typeof fallback).toBe('string');
    expect(fallback.length).toBeGreaterThan(0);
  });

  it('status: 503 wins over price_not_configured code when both present', () => {
    // The billingError check for status 503 comes before price_not_configured
    const result = billingError({ code: 'price_not_configured', status: 503 });
    expect(result).toContain('live');
  });
});
