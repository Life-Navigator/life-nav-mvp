import React from 'react';
import RegisterForm from '@/components/auth/RegisterForm';
import { Metadata } from 'next';

// Metadata for the page
export const metadata: Metadata = {
  title: 'Register | Life Navigator',
  description: 'Create a new Life Navigator account',
};

export default function RegisterPage() {
  return (
    <div>
      <RegisterForm />
    </div>
  );
}