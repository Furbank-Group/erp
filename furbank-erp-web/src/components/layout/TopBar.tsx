import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';

export function TopBar() {
  const { appUser, signOut } = useAuth();

  return (
    <header className="hidden md:flex sticky top-0 z-50 h-16 border-b bg-card items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">Dashboard</h1>
      </div>
      <div className="flex items-center gap-4">
        <NotificationBell />
        <div className="text-right">
          <p className="text-sm font-medium">{appUser?.full_name ?? 'User'}</p>
          <p className="text-xs text-muted-foreground">{appUser?.email}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </header>
  );
}
