import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
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
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        // Mapear email demo al ID real en Supabase, sin importar el token
        if (session.user.email === '2005.ivan@gmail.com') {
          (session.user as any).id = 'cmodqsemt000104lbmwixnsed';
        } else {
          (session.user as any).id = token.sub;
        }
      }
      return session;
    },
  },
};

