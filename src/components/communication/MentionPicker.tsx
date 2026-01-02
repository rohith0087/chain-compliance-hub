import React, { useEffect, useRef } from 'react';
import { MentionableUser } from '@/hooks/useMentions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface MentionPickerProps {
  users: MentionableUser[];
  search: string;
  onSelect: (user: MentionableUser) => void;
  onClose: () => void;
}

export function MentionPicker({
  users,
  search,
  onSelect,
  onClose
}: MentionPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div 
      ref={containerRef}
      className="absolute bottom-full left-0 mb-2 w-72 bg-popover border border-border rounded-lg shadow-lg z-50"
    >
      <div className="p-3 border-b border-border">
        <p className="text-sm font-medium">Mention Someone</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {search ? `Searching for "${search}"...` : 'Type to search people'}
        </p>
      </div>

      <ScrollArea className="max-h-60">
        {users.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {search ? 'No users found' : 'Start typing to search users'}
          </div>
        ) : (
          <div className="p-2">
            {users.map(user => (
              <button
                key={user.profileId}
                onClick={() => onSelect(user)}
                className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted text-left transition-colors"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatarUrl || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <span className="text-xs text-muted-foreground capitalize">{user.role}</span>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
