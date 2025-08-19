import { X, Bell, Calendar, Paperclip, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ChatDetailsProps {
  isOpen: boolean;
  onClose: () => void;
}

const mockPhotos = [
  { id: "1", url: "🍕", description: "Pizza photo" },
  { id: "2", url: "👥", description: "Team meeting" },
  { id: "3", url: "📊", description: "Charts" },
  { id: "4", url: "🎥", description: "Video call", duration: "01:56" }
];

const mockFiles = [
  {
    id: "1",
    name: "Contract for the provision of printing services",
    type: "PDF",
    icon: "📄"
  },
  {
    id: "2", 
    name: "Changes in the schedule of the department of material...",
    type: "DOC",
    icon: "📝"
  },
  {
    id: "3",
    name: "Contract for the provision of printing services",
    type: "PDF", 
    icon: "📄"
  }
];

const mockLinks = [
  {
    id: "1",
    title: "Economic Policy",
    url: "https://wm.liveeconomic-policy",
    icon: "🌐"
  },
  {
    id: "2",
    title: "Microsoft",
    url: "https://www.microsoft.com/",
    icon: "🖥️"
  },
  {
    id: "3",
    title: "Contact information", 
    url: "https://wm.liveeconomic-policy",
    icon: "📞"
  },
  {
    id: "4",
    title: "Official Guide to Government...",
    url: "https://www.usa.gov/",
    icon: "🏛️"
  }
];

export function ChatDetails({ isOpen, onClose }: ChatDetailsProps) {
  if (!isOpen) return null;

  return (
    <div className="w-80 bg-card border-l border-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Chat Details</h3>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-b border-border">
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="flex-1 flex flex-col items-center gap-1 h-12">
            <Bell className="h-4 w-4" />
            <span className="text-xs">Mute</span>
          </Button>
          <Button size="sm" variant="ghost" className="flex-1 flex flex-col items-center gap-1 h-12">
            <Calendar className="h-4 w-4" />
            <span className="text-xs">Schedule</span>
          </Button>
          <Button size="sm" variant="ghost" className="flex-1 flex flex-col items-center gap-1 h-12">
            <span className="text-lg">👥</span>
            <span className="text-xs">Members</span>
          </Button>
          <Button size="sm" variant="ghost" className="flex-1 flex flex-col items-center gap-1 h-12">
            <span className="text-lg">🔇</span>
            <span className="text-xs">Disable</span>
          </Button>
        </div>
      </div>

      {/* Content Sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Photos and Videos */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-foreground">Photos and Videos</h4>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">104</span>
              <Button size="sm" variant="ghost" className="text-xs text-primary">
                See all
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {mockPhotos.map((photo) => (
              <div key={photo.id} className="relative aspect-square bg-muted rounded-lg flex items-center justify-center">
                <span className="text-2xl">{photo.url}</span>
                {photo.duration && (
                  <div className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1 rounded">
                    {photo.duration}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Shared Files */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-foreground">Shared Files</h4>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">1 384</span>
              <Button size="sm" variant="ghost" className="text-xs text-primary">
                See all
              </Button>
            </div>
          </div>
          
          <div className="space-y-3">
            {mockFiles.map((file) => (
              <div key={file.id} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                  <span className="text-sm">{file.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{file.type}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Shared Links */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-foreground">Shared Links</h4>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">32</span>
              <Button size="sm" variant="ghost" className="text-xs text-primary">
                See all
              </Button>
            </div>
          </div>
          
          <div className="space-y-3">
            {mockLinks.map((link) => (
              <div key={link.id} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                  <span className="text-sm">{link.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{link.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                </div>
                <Button size="sm" variant="ghost" className="p-1">
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}