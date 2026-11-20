import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const updateUser = vi.fn(async () => ({}));
const session = { user: { user_metadata: { full_name: 'Ana Pop' } } };
vi.mock('@/auth/supabase', () => ({ supabase: { auth: {
  exchangeCodeForSession: vi.fn(async () => ({})),
  getSession: vi.fn(async () => ({ data: { session } })),
  updateUser: (...a) => updateUser(...a),
} } }));

import AuthCallback from '@/features/auth/AuthCallback';

describe('AuthCallback', () => {
  // "Continue with Apple / Google" says "By continuing you agree to our Terms".
  it('records the terms for an Apple or Google account that has none', async () => {
    const onDone = vi.fn();
    render(<AuthCallback onDone={onDone} />);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(updateUser).toHaveBeenCalledWith({ data: expect.objectContaining({ terms_version: expect.any(String) }) });
  });
});
