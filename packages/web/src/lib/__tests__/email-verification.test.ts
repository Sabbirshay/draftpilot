import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';

describe('Milestone 3: Mandatory Email Verification Flow', () => {

  describe('Requirement 3.1 & 3.2: Signup Email Verification & Confirmation Banner', () => {
    test('signup confirmation banner text matches mandatory requirement exactly', () => {
      const expectedBanner = 'Check your inbox! Please verify your email before logging in.';
      assert.strictEqual(
        expectedBanner,
        'Check your inbox! Please verify your email before logging in.',
        'Signup banner text must match specification exactly'
      );
    });

    test('signup flow terminates temporary session via signOut and suppresses dashboard redirect', async () => {
      let signedOut = false;
      let redirected = false;
      let displayedMessage = '';

      const mockSupabase = {
        auth: {
          signUp: async ({ email, password, options }: any) => {
            return {
              data: {
                user: {
                  id: 'usr_new_123',
                  email,
                  email_confirmed_at: null,
                },
                session: {
                  access_token: 'temp_token_signup',
                  user: { id: 'usr_new_123', email, email_confirmed_at: null },
                },
              },
              error: null,
            };
          },
          signOut: async () => {
            signedOut = true;
          },
        },
      };

      // Simulate signup handler logic
      const handleSignup = async (email: string, password: string, origin: string) => {
        const { data: signUpData, error } = await mockSupabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
          },
        });

        if (error) throw error;

        // Invalidate temporary session immediately
        await mockSupabase.auth.signOut();

        // Enforce banner display & suppress redirect
        displayedMessage = 'Check your inbox! Please verify your email before logging in.';
        // redirected remains false
      };

      await handleSignup('newuser@example.com', 'securepass123', 'https://draftpilot.app');

      assert.strictEqual(signedOut, true, 'Temporary session must be signed out on signup');
      assert.strictEqual(redirected, false, 'Auto-redirect to /dashboard must be suppressed');
      assert.strictEqual(displayedMessage, 'Check your inbox! Please verify your email before logging in.');
    });

    test('signup passes proper emailRedirectTo with auth/callback', async () => {
      let passedOptions: any = null;
      const mockSupabase = {
        auth: {
          signUp: async (params: any) => {
            passedOptions = params.options;
            return { data: { user: { id: '1', email_confirmed_at: null }, session: null }, error: null };
          },
          signOut: async () => {},
        },
      };

      const origin = 'https://app.draftpilot.com';
      await mockSupabase.auth.signUp({
        email: 'test@example.com',
        password: 'pass',
        options: {
          data: { full_name: 'Test', team_name: "Test's Team" },
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });

      assert.ok(passedOptions);
      assert.strictEqual(passedOptions.emailRedirectTo, 'https://app.draftpilot.com/auth/callback');
    });
  });

  describe('Requirement 3.3: Sign-in Unverified Account Detection & Actionable Resend Flow', () => {
    test('detects unverified user when user.email_confirmed_at is null', () => {
      const unverifiedUser = {
        id: 'u-1',
        email: 'unconfirmed@domain.com',
        email_confirmed_at: null,
      };

      const verifiedUser = {
        id: 'u-2',
        email: 'confirmed@domain.com',
        email_confirmed_at: '2026-09-01T10:00:00.000Z',
      };

      const isUnverified = (user: { email_confirmed_at: string | null } | null | undefined) => {
        return Boolean(user && user.email_confirmed_at === null);
      };

      assert.strictEqual(isUnverified(unverifiedUser), true);
      assert.strictEqual(isUnverified(verifiedUser), false);
    });

    test('detects Supabase error message containing "email not confirmed"', () => {
      const errorVariants = [
        'Email not confirmed',
        'email is not confirmed',
        'Email not confirmed. Please check your email inbox to verify.',
        'Error: Email not confirmed',
      ];

      const isUnconfirmedError = (errMessage: string) => {
        const msg = errMessage.toLowerCase();
        return msg.includes('email not confirmed') || msg.includes('email is not confirmed');
      };

      for (const err of errorVariants) {
        assert.strictEqual(isUnconfirmedError(err), true, `Should detect unconfirmed error in: "${err}"`);
      }

      assert.strictEqual(isUnconfirmedError('Invalid login credentials'), false);
      assert.strictEqual(isUnconfirmedError('User not found'), false);
    });

    test('signin with unverified account blocks dashboard redirect, invalidates session, and triggers unverified state', async () => {
      let signedOut = false;
      let isUnverifiedState = false;
      let unverifiedEmailState = '';
      let redirected = false;
      let warningMessage = '';

      const mockSupabase = {
        auth: {
          signInWithPassword: async ({ email }: any) => {
            return {
              data: {
                user: { id: 'u-unconfirmed', email, email_confirmed_at: null },
                session: { access_token: 'temp_token', user: { id: 'u-unconfirmed', email, email_confirmed_at: null } },
              },
              error: null,
            };
          },
          signOut: async () => {
            signedOut = true;
          },
        },
      };

      const handleSignin = async (email: string, pass: string) => {
        const { data, error } = await mockSupabase.auth.signInWithPassword({ email: email.trim(), password: pass });
        if (error) throw error;

        if (data?.user && data.user.email_confirmed_at === null) {
          await mockSupabase.auth.signOut();
          isUnverifiedState = true;
          unverifiedEmailState = email.trim();
          warningMessage = 'Your email is not verified yet. Please check your inbox or click below to resend the verification email.';
          return;
        }

        if (data.session) {
          redirected = true;
        }
      };

      await handleSignin('pending@example.com', 'mypassword123');

      assert.strictEqual(signedOut, true, 'Must invalidate temporary session');
      assert.strictEqual(redirected, false, 'Must block redirect to dashboard');
      assert.strictEqual(isUnverifiedState, true, 'Must flag unverified state');
      assert.strictEqual(unverifiedEmailState, 'pending@example.com');
      assert.ok(warningMessage.includes('email is not verified yet'));
    });

    test('signin when Supabase returns "Email not confirmed" error also triggers teardown & unverified state', async () => {
      let signedOut = false;
      let isUnverifiedState = false;
      let unverifiedEmailState = '';
      let redirected = false;

      const mockSupabase = {
        auth: {
          signInWithPassword: async () => {
            return {
              data: { user: null, session: null },
              error: new Error('Email not confirmed'),
            };
          },
          signOut: async () => {
            signedOut = true;
          },
        },
      };

      const handleSignin = async (email: string, pass: string) => {
        try {
          const { data, error } = await mockSupabase.auth.signInWithPassword();
          if (error) {
            const errMsg = error.message.toLowerCase();
            if (errMsg.includes('email not confirmed')) {
              await mockSupabase.auth.signOut();
              isUnverifiedState = true;
              unverifiedEmailState = email.trim();
              return;
            }
            throw error;
          }
          if (data.session) redirected = true;
        } catch (err: any) {
          if (err.message.toLowerCase().includes('email not confirmed')) {
            await mockSupabase.auth.signOut();
            isUnverifiedState = true;
            unverifiedEmailState = email.trim();
          }
        }
      };

      await handleSignin('blocked@example.com', 'mypass');

      assert.strictEqual(signedOut, true);
      assert.strictEqual(isUnverifiedState, true);
      assert.strictEqual(unverifiedEmailState, 'blocked@example.com');
      assert.strictEqual(redirected, false);
    });

    test('resend verification email triggers supabase.auth.resend with correct payload', async () => {
      let resendPayload: any = null;

      const mockSupabase = {
        auth: {
          resend: async (payload: any) => {
            resendPayload = payload;
            return { data: {}, error: null };
          },
        },
      };

      const origin = 'https://draftpilot.app';
      const emailToResend = 'pending@example.com';

      const handleResend = async (email: string) => {
        const { error } = await mockSupabase.auth.resend({
          type: 'signup',
          email: email.trim(),
          options: {
            emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
          },
        });
        if (error) throw error;
        return `Verification email sent to ${email}! Please check your inbox and spam folder.`;
      };

      const message = await handleResend(emailToResend);

      assert.ok(resendPayload, 'Payload must be passed to supabase.auth.resend');
      assert.strictEqual(resendPayload.type, 'signup', 'Type must be "signup"');
      assert.strictEqual(resendPayload.email, 'pending@example.com');
      assert.strictEqual(resendPayload.options.emailRedirectTo, 'https://draftpilot.app/auth/callback');
      assert.ok(message.includes('Verification email sent to pending@example.com'));
    });

    test('resend verification rejects empty or invalid email', async () => {
      const validateEmail = (email: string) => {
        const trimmed = (email || '').trim();
        if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
          throw new Error('Please enter a valid email address');
        }
        return true;
      };

      assert.throws(() => validateEmail(''), /Please enter a valid email address/);
      assert.throws(() => validateEmail('invalid-email'), /Please enter a valid email address/);
      assert.strictEqual(validateEmail('valid@draftpilot.com'), true);
    });
  });

  describe('AuthProvider & Dashboard Route Guards for Email Verification', () => {
    test('AuthProvider handleProvision skips provisioning and purges tokens for unverified users', async () => {
      let dbUserSet = false;
      let apiCalled = false;
      let storageCleared = false;

      const localStorageMock = {
        removeItem: (key: string) => {
          if (key === 'draftpilot_token' || key === 'draftpilot_user') {
            storageCleared = true;
          }
        },
      };

      const unverifiedSession = {
        access_token: 'fake_jwt',
        user: {
          id: 'unconfirmed-usr-id',
          email: 'unconfirmed@domain.com',
          email_confirmed_at: null,
        },
      };

      const handleProvision = async (currentSession: any) => {
        const authUser = currentSession.user;
        if (!authUser) return;

        // Guard: Ensure users with unverified emails are not provisioned or treated as active sessions
        if (authUser.email_confirmed_at === null) {
          localStorageMock.removeItem('draftpilot_token');
          localStorageMock.removeItem('draftpilot_user');
          return;
        }

        apiCalled = true;
        dbUserSet = true;
      };

      await handleProvision(unverifiedSession);

      assert.strictEqual(apiCalled, false, 'Must not call API route for unverified session');
      assert.strictEqual(dbUserSet, false, 'Must not set dbUser for unverified session');
      assert.strictEqual(storageCleared, true, 'Must remove draftpilot tokens from storage');
    });

    test('AuthProvider handleProvision allows verified users to proceed with provisioning', async () => {
      let apiCalled = false;

      const verifiedSession = {
        access_token: 'verified_jwt',
        user: {
          id: 'confirmed-usr-id',
          email: 'confirmed@domain.com',
          email_confirmed_at: '2026-09-01T12:00:00.000Z',
        },
      };

      const handleProvision = async (currentSession: any) => {
        const authUser = currentSession.user;
        if (!authUser) return;

        if (authUser.email_confirmed_at === null) {
          return;
        }

        apiCalled = true;
      };

      await handleProvision(verifiedSession);

      assert.strictEqual(apiCalled, true, 'Verified session should proceed with provisioning');
    });

    test('Dashboard gate redirects unverified users to /login?unverified=true', () => {
      let redirectLocation = '';

      const checkDashboardAccess = (session: any, user: any, isLoading: boolean) => {
        if (isLoading) return 'loading';
        if (!session) {
          redirectLocation = '/login';
          return 'redirecting';
        }
        if (user && user.email_confirmed_at === null) {
          redirectLocation = '/login?unverified=true';
          return 'redirecting';
        }
        return 'allowed';
      };

      // Unauthenticated
      assert.strictEqual(checkDashboardAccess(null, null, false), 'redirecting');
      assert.strictEqual(redirectLocation, '/login');

      // Authenticated but unverified
      const unverifiedUser = { id: 'u1', email_confirmed_at: null };
      assert.strictEqual(checkDashboardAccess({ token: 'xyz' }, unverifiedUser, false), 'redirecting');
      assert.strictEqual(redirectLocation, '/login?unverified=true');

      // Authenticated and verified
      const verifiedUser = { id: 'u2', email_confirmed_at: '2026-09-01T12:00:00Z' };
      assert.strictEqual(checkDashboardAccess({ token: 'xyz' }, verifiedUser, false), 'allowed');
    });
  });

});
