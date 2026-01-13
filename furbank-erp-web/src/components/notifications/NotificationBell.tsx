import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/contexts/NotificationContext';
import { NotificationList } from './NotificationList';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const { unreadCount } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className={cn(
              'absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-medium text-white',
              unreadCount > 99 ? 'px-1 text-[10px]' : ''
            )}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-96">
          <NotificationList onClose={() => setIsOpen(false)} />
        </div>
      )}
    </div>
  );
}
