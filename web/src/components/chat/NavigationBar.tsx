import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { 
  MessageCircle, 
  Briefcase, 
  Users, 
  Calendar, 
  Star, 
  Bookmark, 
  Settings,
  Wifi,
  WifiOff,
  UserPlus,
  LogOut,
  User as UserIcon
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FriendRequests } from '@/components/FriendRequests';
import { StatusSelector } from './StatusSelector';
import { useUserStatus } from '@/hooks/use-user-status';
import { useAuth } from '@/contexts/AuthContext';

// Helper function
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Get status badge color
function getStatusBadgeColor(status: string): string {
  switch (status) {
    case 'online':
      return 'bg-green-500';
    case 'busy':
      return 'bg-red-500';
    case 'away':
      return 'bg-yellow-500';
    case 'offline':
    default:
      return 'bg-gray-500';
  }
}

const navigationItems = [
  { id: "chats", icon: MessageCircle, label: "All chats", active: true },
  { id: "work", icon: Briefcase, label: "Work", active: false },
  { id: "meet", icon: Users, label: "Meet", active: false },
  { id: "calendar", icon: Calendar, label: "Calendar", active: false },
  { id: "rating", icon: Star, label: "Rating", active: false },
  { id: "saved", icon: Bookmark, label: "Saved", active: false }
];

interface NavigationBarProps {
  activeItem?: string;
  onItemSelect: (itemId: string) => void;
  isSocketConnected?: boolean;
}

export function NavigationBar({ activeItem = "chats", onItemSelect, isSocketConnected }: NavigationBarProps) {
  const [showFriendRequests, setShowFriendRequests] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const { currentStatus, updateStatus } = useUserStatus();
  
  console.log('🧭 NavigationBar: Rendering with', { isAuthenticated, currentStatus, user });
  
  const handleLogout = () => {
    logout();
  };
  
  return (
    <div className="w-16 bg-chat-sidebar border-r border-border flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="relative mb-3 cursor-pointer">
              {isAuthenticated && user ? (
                <Avatar className="w-8 h-8 mx-auto">
                  <AvatarImage src={user.avatar} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                    {getInitials(user.name || 'Usuario')}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mx-auto">
                  <span className="text-sm font-bold text-primary-foreground">WK</span>
                </div>
              )}
              {/* User status badge */}
              {isAuthenticated && (
                <div 
                  className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-chat-sidebar ${
                    getStatusBadgeColor(currentStatus)
                  }`}
                  title={`Status: ${currentStatus}`}
                />
              )}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {user && (
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
            )}
            <DropdownMenuSeparator />
            <div className="p-2">
              <StatusSelector 
                currentStatus={currentStatus} 
                onStatusChange={updateStatus}
                className="w-full justify-start"
              />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <UserIcon className="mr-2 h-4 w-4" />
              <span>Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Configurações</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 py-4">
        <div className="flex flex-col gap-2">
          {navigationItems.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              size="sm"
              onClick={() => onItemSelect(item.id)}
              className={`w-12 h-12 mx-auto flex flex-col items-center justify-center gap-1 p-1 ${
                activeItem === item.id 
                  ? "bg-chat-active text-foreground" 
                  : "text-muted-foreground hover:bg-chat-hover hover:text-foreground"
              }`}
              title={item.label}
            >
              <item.icon className="h-5 w-5" />
            </Button>
          ))}
        </div>
      </div>

      {/* Friend Requests & Settings at bottom */}
      <div className="p-3 border-t border-border space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFriendRequests(true)}
          className="w-12 h-12 mx-auto flex items-center justify-center text-muted-foreground hover:bg-chat-hover hover:text-foreground"
          title="Friend Requests"
        >
          <UserPlus className="h-5 w-5" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          className="w-12 h-12 mx-auto flex items-center justify-center text-muted-foreground hover:bg-chat-hover hover:text-foreground"
          title="Settings"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      {/* Friend Requests Modal */}
      <FriendRequests
        open={showFriendRequests}
        onOpenChange={setShowFriendRequests}
      />
    </div>
  );
}