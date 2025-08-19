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
  WifiOff
} from "lucide-react";

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
  return (
    <div className="w-16 bg-chat-sidebar border-r border-border flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mx-auto">
            <span className="text-sm font-bold text-primary-foreground">WK</span>
          </div>
          {/* Connection status indicator */}
          <div 
            className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-chat-sidebar ${
              isSocketConnected 
                ? 'bg-green-500' 
                : 'bg-red-500'
            }`}
            title={isSocketConnected ? 'Online' : 'Offline'}
          />
        </div>
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

      {/* Settings at bottom */}
      <div className="p-3 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-12 h-12 mx-auto flex items-center justify-center text-muted-foreground hover:bg-chat-hover hover:text-foreground"
          title="Settings"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}