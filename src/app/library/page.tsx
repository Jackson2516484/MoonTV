'use client';

import { Suspense } from 'react';
import WatchArtifact from '@/components/WatchArtifact';
import PageLayout from '@/components/PageLayout';

export default function LibraryPage() {
  return (
    <PageLayout activePath="/library">
      <Suspense fallback={<div>Loading...</div>}>
        <WatchArtifact />
      </Suspense>
    </PageLayout>
  );
}