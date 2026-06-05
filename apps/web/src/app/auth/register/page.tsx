import React from 'react';
import Link from 'next/link';
import RegisterForm from '@/components/auth/RegisterForm';
import AuthShell from '@/components/auth/AuthShell';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create your account | LifeNavigator',
  description: 'Create a new LifeNavigator account',
};

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Start making decisions grounded in your own data."
      footer={
        <p>
          Already have an account?{' '}
          <Link href="/auth/login" className="font-medium text-[#5eead4] hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
