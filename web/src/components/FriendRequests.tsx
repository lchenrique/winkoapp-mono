import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckIcon, XIcon, UserPlusIcon, UsersIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FriendRequest {
  id: string;
  status: 'pending' | 'accepted' | 'rejected';
  message: string | null;
  createdAt: string;
  sender: {
    id: string;
    username: string;
    name: string;
    avatar: string | null;
  };
  receiver: {
    id: string;
    username: string;
    name: string;
    avatar: string | null;
  };
}

interface FriendRequestsResponse {
  sent: FriendRequest[];
  received: FriendRequest[];
}

interface FriendRequestsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FriendRequests({ open, onOpenChange }: FriendRequestsProps) {
  const { token } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<FriendRequestsResponse>({ sent: [], received: [] });
  const [loading, setLoading] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  
  // Form states
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState('');

  // Fetch friend requests
  const fetchRequests = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3000/api/friend-requests/list', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to fetch friend requests',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast({
        title: 'Error',
        description: 'Error fetching friend requests',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Send friend request
  const sendFriendRequest = async () => {
    if (!token || !searchQuery.trim()) return;

    try {
      setSendingRequest(true);
      
      // Determine if it's username or email
      const isEmail = searchQuery.includes('@');
      const body = isEmail 
        ? { email: searchQuery, message: message || null }
        : { username: searchQuery, message: message || null };

      const response = await fetch('http://localhost:3000/api/friend-requests/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Success!',
          description: `Friend request sent to ${data.receiver.name}!`,
        });
        setSearchQuery('');
        setMessage('');
        fetchRequests(); // Refresh the list
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to send friend request',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error sending request:', error);
      toast({
        title: 'Error',
        description: 'Error sending friend request',
        variant: 'destructive',
      });
    } finally {
      setSendingRequest(false);
    }
  };

  // Respond to friend request
  const respondToRequest = async (requestId: string, action: 'accept' | 'reject') => {
    if (!token) return;

    try {
      const response = await fetch('http://localhost:3000/api/friend-requests/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ requestId, action }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Success!',
          description: data.message,
        });
        fetchRequests(); // Refresh the list
      } else {
        toast({
          title: 'Error',
          description: data.message || `Failed to ${action} friend request`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error(`Error ${action}ing request:`, error);
      toast({
        title: 'Error',
        description: `Error ${action}ing friend request`,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [token]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'accepted': return 'bg-green-500';
      case 'rejected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UsersIcon className="h-6 w-6" />
            Friend Requests
          </DialogTitle>
        </DialogHeader>

      <Tabs defaultValue="send" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="send">Send Request</TabsTrigger>
          <TabsTrigger value="received">
            Received ({requests.received.filter(r => r.status === 'pending').length})
          </TabsTrigger>
          <TabsTrigger value="sent">
            Sent ({requests.sent.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlusIcon className="h-5 w-5" />
                Add Friend
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Username or Email
                </label>
                <Input
                  type="text"
                  placeholder="alice_6632 or alice@example.com"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Message (Optional)
                </label>
                <Textarea
                  placeholder="Hi, let's be friends!"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                />
              </div>

              <Button 
                onClick={sendFriendRequest}
                disabled={!searchQuery.trim() || sendingRequest}
                className="w-full"
              >
                {sendingRequest ? 'Sending...' : 'Send Friend Request'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="received" className="space-y-4">
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : requests.received.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No friend requests received
            </div>
          ) : (
            requests.received.map((request) => (
              <Card key={request.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                        {request.sender.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{request.sender.name}</p>
                        <p className="text-sm text-gray-500">@{request.sender.username}</p>
                        {request.message && (
                          <p className="text-sm text-gray-600 mt-1">{request.message}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          {new Date(request.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(request.status)}>
                        {request.status}
                      </Badge>
                      
                      {request.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => respondToRequest(request.id, 'accept')}
                          >
                            <CheckIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => respondToRequest(request.id, 'reject')}
                          >
                            <XIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="sent" className="space-y-4">
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : requests.sent.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No friend requests sent
            </div>
          ) : (
            requests.sent.map((request) => (
              <Card key={request.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-medium">
                        {request.receiver.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{request.receiver.name}</p>
                        <p className="text-sm text-gray-500">@{request.receiver.username}</p>
                        {request.message && (
                          <p className="text-sm text-gray-600 mt-1">{request.message}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          {new Date(request.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <Badge className={getStatusColor(request.status)}>
                      {request.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
      </DialogContent>
    </Dialog>
  );
}
