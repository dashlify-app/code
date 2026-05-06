import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';

function isDemoLoginConfigured(): boolean {
  return (
    process.env.AUTH_DEMO_LOGIN_ENABLED === 'true' &&
    Boolean(process.env.AUTH_DEMO_USER_EMAIL?.trim()) &&
    Boolean(process.env.AUTH_DEMO_USER_PASSWORD) &&
    Boolean(process.env.AUTH_DEMO_USER_ID?.trim())
  );
}

function tryDemoAuthorize(email: string, password: string) {
  if (!isDemoLoginConfigured()) return null;
  const demoEmail = process.env.AUTH_DEMO_USER_EMAIL!.trim().toLowerCase();
  const demoId = process.env.AUTH_DEMO_USER_ID!.trim();
  if (email.trim().toLowerCase() !== demoEmail) return null;
  if (password !== process.env.AUTH_DEMO_USER_PASSWORD) return null;
  return {
    id: demoId,
    email: process.env.AUTH_DEMO_USER_EMAIL!.trim(),
    name: 'Demo User',
  };
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email.trim();
        const password = credentials.password;

        const demo = tryDemoAuthorize(email, password);
        if (demo) return demo;

        const { data: user, error } = await supabaseAdmin
          .from('User')
          .select('id, email, password')
          .eq('email', email)
          .maybeSingle();

        if (error || !user?.password) {
          return null;
        }

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: email.split('@')[0] || 'Usuario',
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/spreadsheets.readonly',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, account }) {
      // Almacenar tokens de Google en JWT (solo si existe el account)
      if (account?.provider === 'google' && account.access_token) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const demoEmail =
          isDemoLoginConfigured() &&
          session.user.email?.trim().toLowerCase() ===
            process.env.AUTH_DEMO_USER_EMAIL!.trim().toLowerCase();

        if (demoEmail) {
          (session.user as { id?: string }).id = process.env.AUTH_DEMO_USER_ID!.trim();
        } else {
          (session.user as { id?: string }).id = token.sub;
        }

        // Agregar tokens de Google a la sesión (solo si existen)
        if (token.accessToken) {
          (session as any).accessToken = token.accessToken;
          (session as any).refreshToken = token.refreshToken;
          (session as any).expiresAt = token.expiresAt;
        }
      }
      return session;
    },
  },
};

