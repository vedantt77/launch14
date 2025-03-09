import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { SubmittedStartup } from '@/lib/types';

interface StartupCardProps {
  startup: SubmittedStartup;
  onApprove: (id: string) => void;
  onReapprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function StartupCard({ startup, onApprove, onReapprove, onReject }: StartupCardProps) {
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'pending':
        return 'secondary';
      case 'rejected':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <img 
              src={startup.logoUrl} 
              alt={startup.name} 
              className="w-12 h-12 rounded-lg object-cover"
            />
            <div>
              <h3 className="text-xl font-semibold">{startup.name}</h3>
              <p className="text-sm text-muted-foreground">
                Submitted on {startup.submittedAt.toLocaleDateString()}
              </p>
            </div>
          </div>
          <Badge variant={getStatusBadgeVariant(startup.status)}>
            {startup.status.charAt(0).toUpperCase() + startup.status.slice(1)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-muted-foreground">{startup.description}</p>
        <div className="flex flex-col gap-1">
          <a 
            href={startup.url}
            target="_blank"
            rel="noopener noreferrer" 
            className="text-primary hover:underline"
          >
            {startup.url}
          </a>
          <p className="text-sm text-muted-foreground">
            Social: {startup.socialHandle}
          </p>
          {startup.scheduledLaunchDate && (
            <p className="text-sm text-primary">
              {startup.scheduledLaunchDate > new Date() 
                ? `Scheduled for launch on: ${formatDate(startup.scheduledLaunchDate)}`
                : `Launched on: ${formatDate(startup.scheduledLaunchDate)}`
              }
            </p>
          )}
          {startup.status === 'approved' && (
            <div className="flex items-center space-x-2 mt-2">
              <Badge variant={startup.doFollowBacklink ? "success" : "secondary"}>
                {startup.doFollowBacklink ? "doFollow" : "noFollow"} backlink
              </Badge>
              {startup.listingType && (
                <Badge variant="outline">
                  {startup.listingType} listing
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
      {startup.status === 'pending' && (
        <CardFooter className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onReject(startup.id)}
          >
            Reject
          </Button>
          <Button
            onClick={() => onApprove(startup.id)}
          >
            Approve
          </Button>
        </CardFooter>
      )}
      {startup.status === 'rejected' && (
        <CardFooter className="flex justify-end">
          <Button
            onClick={() => onReapprove(startup.id)}
          >
            Re-approve
          </Button>
        </CardFooter>
      )}
      {startup.status === 'approved' && (
        <CardFooter className="flex justify-end">
          <Button
            variant="destructive"
            onClick={() => onReject(startup.id)}
          >
            Reject
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
