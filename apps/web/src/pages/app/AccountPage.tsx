import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  User,
  Mail,
  Phone,
  CreditCard,
  Crown,
  Calendar,
  Trash2,
  Save,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth-store';
import { authApi, ApiError } from '@/lib/api';
import { updateProfileSchema, type UpdateProfileInput } from '@mirrorx/shared';
import { formatDate } from '@/lib/utils';

export default function AccountPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, logout, setUser } = useAuthStore();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: user?.name || '',
      phone: user?.phone || '',
    },
  });

  const onSubmit = async (data: UpdateProfileInput) => {
    setIsUpdating(true);
    try {
      const updatedUser = await authApi.updateProfile(data);
      setUser(updatedUser);
      toast({
        title: 'Profile updated',
        description: 'Your changes have been saved.',
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to update profile';
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: message,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await authApi.deleteAccount();
      logout();
      toast({
        title: 'Account deleted',
        description: 'Your account and data have been removed.',
      });
      navigate('/');
    } catch {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: 'Could not delete your account. Please try again.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const tierConfig = {
    FREE: { label: 'Free', color: 'text-muted-foreground', icon: User },
    PRO: { label: 'Pro', color: 'text-gold', icon: Crown },
    ELITE: { label: 'Elite', color: 'text-gold', icon: Crown },
  };

  const tier = tierConfig[user?.subscription_tier || 'FREE'];
  const TierIcon = tier.icon;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-orbitron font-bold">Account Settings</h1>
        <p className="text-muted-foreground">
          Manage your profile and preferences
        </p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-gold" />
            Profile Information
          </CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <Avatar className="w-20 h-20">
                <AvatarImage src={user?.avatar_url || undefined} />
                <AvatarFallback className="text-2xl">
                  {user?.name?.[0] || user?.email?.[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{user?.name || 'User'}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <Separator />

            {/* Form Fields */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    value={user?.email || ''}
                    disabled
                    className="pl-10 opacity-60"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="Your name"
                    className="pl-10"
                    {...register('name')}
                  />
                </div>
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    placeholder="9876543210"
                    maxLength={10}
                    className="pl-10"
                    {...register('phone')}
                  />
                </div>
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone.message}</p>
                )}
              </div>
            </div>

            <Button type="submit" disabled={!isDirty || isUpdating}>
              {isUpdating ? (
                'Saving...'
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Subscription & Credits */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-gold" />
              Subscription
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-xl bg-gold/10 ${tier.color}`}>
                <TierIcon className="w-6 h-6" />
              </div>
              <div>
                <p className={`font-semibold text-lg ${tier.color}`}>{tier.label} Plan</p>
                <p className="text-sm text-muted-foreground">
                  {user?.subscription_tier === 'FREE'
                    ? '5 try-ons per day'
                    : 'Unlimited try-ons'}
                </p>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => navigate('/pricing')}>
              {user?.subscription_tier === 'FREE' ? 'Upgrade Plan' : 'Manage Plan'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-gold" />
              Credits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <p className="text-4xl font-orbitron font-bold text-gold">
                {user?.credits_balance || 0}
              </p>
              <p className="text-sm text-muted-foreground">available credits</p>
            </div>
            <Button className="w-full" onClick={() => navigate('/pricing')}>
              Buy More Credits
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gold" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between py-2 border-b border-gold/10">
            <span className="text-muted-foreground">Member since</span>
            <span>{user?.created_at ? formatDate(user.created_at) : 'N/A'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gold/10">
            <span className="text-muted-foreground">Account type</span>
            <span>{user?.google_id ? 'Google Account' : 'Email Account'}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Email verified</span>
            <span className="text-success">Verified</span>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions that affect your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-destructive/10 rounded-lg">
            <div>
              <p className="font-semibold">Delete Account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all data
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete your account
              and remove all your data including:
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 my-4">
            <li>Your profile information</li>
            <li>All saved wardrobe items</li>
            <li>Try-on history</li>
            <li>Remaining credits (non-refundable)</li>
            <li>Subscription (will be cancelled)</li>
          </ul>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Yes, Delete My Account'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
