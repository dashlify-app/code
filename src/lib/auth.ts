import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { supabaseAdmin } from '@/lib/supabase';

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

        // Demo: usuario hardcodeado para testing
        if (credentials.email === '2005.ivan@gmail.com' && credentials.password === '123456') {
          return {
            id: 'cmodqsemt000104lbmwixnsed',
            email: '2005.ivan@gmail.com',
            name: 'Demo User',
          };
        }

        return null;
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
        // Mapear email demo al ID real en Supabase, sin importar el token
        if (session.user.email === '2005.ivan@gmail.com') {
          (session.user as any).id = 'cmodqsemt000104lbmwixnsed';
        } else {
          (session.user as any).id = token.sub;
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

