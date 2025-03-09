import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, Timestamp, getCountFromServer, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthContext } from '@/providers/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { SubmittedStartup } from '@/lib/types';
import { Users, FileText, ThumbsUp } from 'lucide-react';
import { StartupCard } from '@/components/admin/StartupCard';

interface DashboardStats {
  totalUsers: number;
  totalSubmissions: number;
  totalUpvotes: number;
}

type ListingType = 'regular' | 'boosted' | 'premium';

export function AdminDashboard() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [selectedStartupId, setSelectedStartupId] = useState<string | null>(null);
  const [selectedListingType, setSelectedListingType] = useState<ListingType>('regular');
  const [isReapproveDialogOpen, setIsReapproveDialogOpen] = useState(false);
  const [doFollowBacklink, setDoFollowBacklink] = useState(true);
  const [isImmediateLaunch, setIsImmediateLaunch] = useState(false);
  const [pendingStartups, setPendingStartups] = useState<SubmittedStartup[]>([]);
  const [approvedStartups, setApprovedStartups] = useState<SubmittedStartup[]>([]);
  const [rejectedStartups, setRejectedStartups] = useState<SubmittedStartup[]>([]);
  const [isLoadingStartups, setIsLoadingStartups] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalSubmissions: 0,
    totalUpvotes: 0
  });

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        navigate('/login');
        return;
      }

      try {
        const adminDoc = await getDocs(query(
          collection(db, 'admins'),
          where('userId', '==', user.uid)
        ));

        if (adminDoc.empty) {
          navigate('/');
          return;
        }

        setIsAdmin(true);
        setIsLoading(false);
      } catch (error) {
        console.error('Error checking admin status:', error);
        navigate('/');
      }
    };

    checkAdminStatus();
  }, [user, navigate]);

  const fetchStats = async () => {
    try {
      const usersSnapshot = await getCountFromServer(collection(db, 'users'));
      const totalUsers = usersSnapshot.data().count;

      const startupsSnapshot = await getCountFromServer(collection(db, 'startups'));
      const totalSubmissions = startupsSnapshot.data().count;

      const launchesRef = collection(db, 'launches');
      const launchesSnapshot = await getDocs(launchesRef);
      const totalUpvotes = launchesSnapshot.docs.reduce((sum, doc) => sum + (doc.data().upvotes || 0), 0);

      setStats({
        totalUsers,
        totalSubmissions,
        totalUpvotes
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchStartups = async () => {
    setIsLoadingStartups(true);
    try {
      const startupsRef = collection(db, 'startups');
      
      const pendingQuery = query(startupsRef, where('status', '==', 'pending'));
      const pendingSnapshot = await getDocs(pendingQuery);
      const pendingData = pendingSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().createdAt.toDate(),
        scheduledLaunchDate: doc.data().scheduledLaunchDate?.toDate()
      })) as SubmittedStartup[];
      setPendingStartups(pendingData);

      const approvedQuery = query(
        startupsRef, 
        where('status', '==', 'approved'),
        orderBy('scheduledLaunchDate', 'desc')
      );
      const approvedSnapshot = await getDocs(approvedQuery);
      const approvedData = approvedSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().createdAt.toDate(),
        scheduledLaunchDate: doc.data().scheduledLaunchDate?.toDate()
      })) as SubmittedStartup[];
      setApprovedStartups(approvedData);

      const rejectedQuery = query(startupsRef, where('status', '==', 'rejected'));
      const rejectedSnapshot = await getDocs(rejectedQuery);
      const rejectedData = rejectedSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().createdAt.toDate(),
        scheduledLaunchDate: doc.data().scheduledLaunchDate?.toDate()
      })) as SubmittedStartup[];
      setRejectedStartups(rejectedData);
    } catch (error) {
      console.error('Error fetching startups:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch startups',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingStartups(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchStartups();
      fetchStats();
    }
  }, [isAdmin]);

  const calculateNextLaunchDate = () => {
    const now = new Date();
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + (7 - now.getDay()));
    nextSunday.setHours(0, 0, 0, 0);
    return nextSunday;
  };

  const handleApproveClick = (startupId: string) => {
    setSelectedStartupId(startupId);
    setIsApproveDialogOpen(true);
  };

  const handleReapproveClick = (startupId: string) => {
    setSelectedStartupId(startupId);
    setIsReapproveDialogOpen(true);
  };

  const handleApproveConfirm = async () => {
    if (!selectedStartupId) return;

    try {
      const startupRef = doc(db, 'startups', selectedStartupId);
      const scheduledLaunchDate = selectedListingType === 'regular' && !isImmediateLaunch
        ? calculateNextLaunchDate() 
        : new Date();

      await updateDoc(startupRef, {
        status: 'approved',
        listingType: selectedListingType,
        doFollowBacklink: doFollowBacklink,
        scheduledLaunchDate: Timestamp.fromDate(scheduledLaunchDate),
        updatedAt: Timestamp.now()
      });

      await Promise.all([fetchStartups(), fetchStats()]);

      toast({
        title: 'Success!',
        description: `Startup approved as ${selectedListingType} listing${
          selectedListingType === 'regular' && !isImmediateLaunch 
            ? ' and scheduled for next week' 
            : ' and launched immediately'
        }`,
      });

      setIsApproveDialogOpen(false);
      setIsReapproveDialogOpen(false);
      setSelectedStartupId(null);
      setSelectedListingType('regular');
      setIsImmediateLaunch(false);
    } catch (error) {
      console.error('Error updating startup status:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve startup',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async (startupId: string) => {
    try {
      const startupRef = doc(db, 'startups', startupId);
      await updateDoc(startupRef, {
        status: 'rejected',
        updatedAt: Timestamp.now()
      });

      await Promise.all([fetchStartups(), fetchStats()]);

      toast({
        title: 'Success',
        description: 'Startup rejected successfully',
      });
    } catch (error) {
      console.error('Error updating startup status:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject startup',
        variant: 'destructive',
      });
    }
  };

  if (!isAdmin || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background py-12 px-4">
        <div className="container max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                    <h2 className="text-2xl font-bold">{stats.totalUsers}</h2>
                  </div>
                  <div className="p-2 bg-primary/10 rounded-full">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Submissions</p>
                    <h2 className="text-2xl font-bold">{stats.totalSubmissions}</h2>
                  </div>
                  <div className="p-2 bg-primary/10 rounded-full">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Upvotes</p>
                    <h2 className="text-2xl font-bold">{stats.totalUpvotes}</h2>
                  </div>
                  <div className="p-2 bg-primary/10 rounded-full">
                    <ThumbsUp className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="pending">
                Pending ({pendingStartups.length})
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved ({approvedStartups.length})
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejected ({rejectedStartups.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              {isLoadingStartups ? (
                <div className="text-center py-8">
                  <div className="animate-pulse text-primary">Loading pending submissions...</div>
                </div>
              ) : pendingStartups.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No pending submissions
                </p>
              ) : (
                pendingStartups.map(startup => (
                  <StartupCard 
                    key={startup.id} 
                    startup={startup}
                    onApprove={handleApproveClick}
                    onReapprove={handleReapproveClick}
                    onReject={handleReject}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="approved">
              {isLoadingStartups ? (
                <div className="text-center py-8">
                  <div className="animate-pulse text-primary">Loading approved submissions...</div>
                </div>
              ) : approvedStartups.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No approved submissions
                </p>
              ) : (
                approvedStartups.map(startup => (
                  <StartupCard 
                    key={startup.id} 
                    startup={startup}
                    onApprove={handleApproveClick}
                    onReapprove={handleReapproveClick}
                    onReject={handleReject}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="rejected">
              {isLoadingStartups ? (
                <div className="text-center py-8">
                  <div className="animate-pulse text-primary">Loading rejected submissions...</div>
                </div>
              ) : rejectedStartups.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No rejected submissions
                </p>
              ) : (
                rejectedStartups.map(startup => (
                  <StartupCard 
                    key={startup.id} 
                    startup={startup}
                    onApprove={handleApproveClick}
                    onReapprove={handleReapproveClick}
                    onReject={handleReject}
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={isApproveDialogOpen || isReapproveDialogOpen} onOpenChange={(open) => {
        setIsApproveDialogOpen(open);
        setIsReapproveDialogOpen(open);
        if (!open) {
          setIsImmediateLaunch(false);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Listing Type</DialogTitle>
            <DialogDescription>
              Choose how this startup should be listed on the platform
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6 space-y-6">
            <RadioGroup
              value={selectedListingType}
              onValueChange={(value) => setSelectedListingType(value as ListingType)}
              className="space-y-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="regular" id="regular" />
                <Label htmlFor="regular">Regular Listing</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="boosted" id="boosted" />
                <Label htmlFor="boosted">Boosted Listing (Immediate)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="premium" id="premium" />
                <Label htmlFor="premium">Premium Listing (Immediate)</Label>
              </div>
            </RadioGroup>

            {selectedListingType === 'regular' && (
              <div className="flex items-center space-x-2">
                <Switch
                  id="immediate-launch"
                  checked={isImmediateLaunch}
                  onCheckedChange={setIsImmediateLaunch}
                />
                <Label htmlFor="immediate-launch">
                  Launch immediately (instead of next week)
                </Label>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Switch
                id="dofollow"
                checked={doFollowBacklink}
                onCheckedChange={setDoFollowBacklink}
              />
              <Label htmlFor="dofollow">
                Enable doFollow backlink
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsApproveDialogOpen(false);
                setIsReapproveDialogOpen(false);
                setSelectedStartupId(null);
                setSelectedListingType('regular');
                setIsImmediateLaunch(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleApproveConfirm}>
              Confirm Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
