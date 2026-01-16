import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Offline Indicator */}
      <OfflineIndicator />
      
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:ml-0">
        {/* Desktop Top Bar */}
        <TopBar />

        {/* Page Content */}
        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          <div className="container mx-auto px-4 py-6 md:py-8 max-w-7xl animate-in fade-in duration-300">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
