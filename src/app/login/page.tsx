'use client';

import React, { Suspense } from 'react';
import { SplitAuthLayout } from '../../components/auth/SplitAuthLayout';
import { AuthExperience } from '../../components/auth/AuthExperience';

export default function LoginPage() {
  return (
    <SplitAuthLayout>
      <Suspense fallback={<div className="py-12 text-center text-xs text-[#64748B]">Loading sign in...</div>}>
        <AuthExperience defaultIntent="login" defaultMethod="mobile" />
      </Suspense>
    </SplitAuthLayout>
  );
}
