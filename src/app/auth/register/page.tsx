import React from 'react';
import RegisterForm from '@/components/auth/RegisterForm';
import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';

// Metadata for the page
export const metadata: Metadata = {
  title: 'Register | Life Navigator',
  description: 'Create a new Life Navigator account',
};

export default async function RegisterPage() {
  // Check if user is already authenticated
  const session = await getServerSession(authOptions);
  
  // If user is authenticated, redirect them appropriately
  if (session) {
    if (!session.user.setupCompleted) {
      redirect(`/onboarding/questionnaire?userId=${session.user.id}`);
    } else {
      redirect('/dashboard');
    }
  }
  
  return (
    <div>
      <RegisterForm />
    </div>
  );
}