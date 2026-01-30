import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, Edit2, Trash2, Shield, ShieldCheck, User,
  Mail, Phone, Check, X, AlertCircle, Eye, EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useMerchantStore } from '@/store/merchant-store';
import type { StoreStaffMember } from '@/lib/api';

const ROLES = [
  { value: 'ADMIN', label: 'Admin', description: 'Full access to all features', color: 'text-red-400' },
  { value: 'MANAGER', label: 'Manager', description: 'Manage products, staff, and orders', color: 'text-orange-400' },
  { value: 'ASSOCIATE', label: 'Associate', description: 'Process orders and pickups', color: 'text-blue-400' },
  { value: 'CASHIER', label: 'Cashier', description: 'Process pickups only', color: 'text-green-400' },
];

export default function MerchantStaffPage() {
  const {
    selectedStore,
    staff,
    isLoading,
    error,
    fetchStaff,
    addStaff,
    updateStaff,
    removeStaff,
    clearError,
  } = useMerchantStore();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StoreStaffMember | null>(null);

  useEffect(() => {
    if (selectedStore) {
      fetchStaff();
    }
  }, [selectedStore, fetchStaff]);

  const handleAddStaff = async (data: {
    name: string;
    email: string;
    phone?: string;
    role: 'ADMIN' | 'MANAGER' | 'ASSOCIATE' | 'CASHIER';
    pin: string;
  }) => {
    await addStaff(data);
    setShowAddDialog(false);
  };

  const handleUpdateStaff = async (data: Partial<StoreStaffMember> & { pin?: string }) => {
    if (!editingStaff) return;
    await updateStaff(editingStaff.id, data);
    setEditingStaff(null);
  };

  const handleRemoveStaff = async (staffId: string) => {
    if (window.confirm('Are you sure you want to remove this staff member?')) {
      await removeStaff(staffId);
    }
  };

  const toggleStaffStatus = async (staffMember: StoreStaffMember) => {
    await updateStaff(staffMember.id, { is_active: !staffMember.is_active });
  };

  const getRoleInfo = (role: string) => {
    return ROLES.find(r => r.value === role) || ROLES[2];
  };

  if (!selectedStore) {
    return (
      <div className="p-8 text-center">
        <Users className="w-16 h-16 text-white/20 mx-auto mb-4" />
        <h2 className="text-white text-xl font-semibold mb-2">No Store Selected</h2>
        <p className="text-white/60">Select a store from the sidebar to manage staff</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Staff Management</h1>
          <p className="text-white/60">{staff.length} staff members in {selectedStore.name}</p>
        </div>

        <Button
          className="bg-indigo-500 hover:bg-indigo-600 text-white"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Staff Member
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-400">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-red-400 hover:text-red-300"
            onClick={clearError}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Staff List */}
      {isLoading && staff.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 border-2 border-white/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60">Loading staff...</p>
        </div>
      ) : staff.length === 0 ? (
        <div className="text-center py-20">
          <Users className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <h2 className="text-white text-xl font-semibold mb-2">No Staff Members</h2>
          <p className="text-white/60 mb-6">Add staff members to manage your store</p>
          <Button
            className="bg-indigo-500 hover:bg-indigo-600 text-white"
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add First Staff Member
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {staff.map((member, index) => {
              const roleInfo = getRoleInfo(member.role);
              return (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    'bg-white/5 rounded-xl p-4 border border-white/5',
                    !member.is_active && 'opacity-60'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">
                          {member.name.charAt(0).toUpperCase()}
                        </span>
                      </div>

                      {/* Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-semibold">{member.name}</h3>
                          {!member.is_active && (
                            <span className="px-2 py-0.5 rounded text-xs bg-red-500/10 text-red-400">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-white/50 text-sm flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {member.email}
                          </span>
                          {member.phone && (
                            <span className="text-white/50 text-sm flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {member.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Role & Actions */}
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className={cn('flex items-center gap-1', roleInfo.color)}>
                          {member.role === 'ADMIN' ? (
                            <ShieldCheck className="w-4 h-4" />
                          ) : (
                            <Shield className="w-4 h-4" />
                          )}
                          <span className="font-medium">{roleInfo.label}</span>
                        </div>
                        {member.last_login_at && (
                          <p className="text-white/40 text-xs mt-1">
                            Last login: {new Date(member.last_login_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className={cn(
                            'border-white/10',
                            member.is_active
                              ? 'text-green-400 hover:bg-green-500/10'
                              : 'text-red-400 hover:bg-red-500/10'
                          )}
                          onClick={() => toggleStaffStatus(member)}
                        >
                          {member.is_active ? 'Active' : 'Inactive'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-white/10 text-white hover:bg-white/10"
                          onClick={() => setEditingStaff(member)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                          onClick={() => handleRemoveStaff(member.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add/Edit Staff Dialog */}
      <StaffFormDialog
        open={showAddDialog || !!editingStaff}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setEditingStaff(null);
          }
        }}
        staff={editingStaff}
        onSave={editingStaff ? handleUpdateStaff : handleAddStaff}
        isLoading={isLoading}
      />
    </div>
  );
}

// Staff Form Dialog Component
interface StaffFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: StoreStaffMember | null;
  onSave: (data: any) => Promise<void>;
  isLoading: boolean;
}

function StaffFormDialog({
  open,
  onOpenChange,
  staff,
  onSave,
  isLoading,
}: StaffFormDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'ASSOCIATE' as 'ADMIN' | 'MANAGER' | 'ASSOCIATE' | 'CASHIER',
    pin: '',
  });
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    if (staff) {
      setFormData({
        name: staff.name || '',
        email: staff.email || '',
        phone: staff.phone || '',
        role: staff.role as 'ADMIN' | 'MANAGER' | 'ASSOCIATE' | 'CASHIER',
        pin: '',
      });
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        role: 'ASSOCIATE',
        pin: '',
      });
    }
    setShowPin(false);
  }, [staff]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone || undefined,
      role: formData.role,
    };
    if (formData.pin) {
      data.pin = formData.pin;
    }
    await onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-midnight border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>{staff ? 'Edit Staff Member' : 'Add Staff Member'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <Label className="text-white/70">Full Name *</Label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="pl-10 bg-white/5 border-white/10 text-white"
                placeholder="John Doe"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <Label className="text-white/70">Email *</Label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="pl-10 bg-white/5 border-white/10 text-white"
                placeholder="john@store.com"
                required
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <Label className="text-white/70">Phone</Label>
            <div className="relative mt-1">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="pl-10 bg-white/5 border-white/10 text-white"
                placeholder="9876543210"
              />
            </div>
          </div>

          {/* Role */}
          <div>
            <Label className="text-white/70">Role *</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => setFormData({ ...formData, role: value as any })}
            >
              <SelectTrigger className="mt-1 bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-midnight border-white/10">
                {ROLES.map((role) => (
                  <SelectItem
                    key={role.value}
                    value={role.value}
                    className="text-white hover:bg-white/10"
                  >
                    <div className="flex items-center gap-2">
                      <span className={role.color}>{role.label}</span>
                      <span className="text-white/40 text-xs">- {role.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* PIN */}
          <div>
            <Label className="text-white/70">
              {staff ? 'New PIN (leave empty to keep current)' : 'PIN *'}
            </Label>
            <div className="relative mt-1">
              <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
              <Input
                type={showPin ? 'text' : 'password'}
                value={formData.pin}
                onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                className="pl-10 pr-10 bg-white/5 border-white/10 text-white"
                placeholder="4-6 digit PIN"
                minLength={4}
                maxLength={6}
                required={!staff}
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/40 hover:text-white"
              >
                {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-white/40 text-xs mt-1">
              Staff will use this PIN to login to the fulfillment portal
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="border-white/10 text-white hover:bg-white/10"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-indigo-500 hover:bg-indigo-600 text-white"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {staff ? 'Update' : 'Add Staff'}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
