import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import {
  Store, LayoutDashboard, Package, Users, QrCode, BarChart3,
  Settings, LogOut, ChevronDown, Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMerchantStore } from '@/store/merchant-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navItems = [
  { path: '/merchant/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/merchant/products', label: 'Products', icon: Package },
  { path: '/merchant/staff', label: 'Staff', icon: Users },
  { path: '/merchant/qr-codes', label: 'QR Codes', icon: QrCode },
  { path: '/merchant/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/merchant/coupons', label: 'Coupons', icon: Tag },
  { path: '/merchant/settings', label: 'Settings', icon: Settings },
];

export default function MerchantLayout() {
  const navigate = useNavigate();
  const {
    isAuthenticated,
    merchant,
    stores,
    selectedStore,
    selectedStoreId,
    selectStore,
    logout,
    initialize,
  } = useMerchantStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/merchant/login');
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) {
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate('/merchant/login');
  };

  return (
    <div className="min-h-screen bg-midnight flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white/5 border-r border-white/10 flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">MirrorX</h1>
              <p className="text-white/50 text-xs">Merchant Portal</p>
            </div>
          </div>
        </div>

        {/* Store Selector */}
        {stores.length > 0 && (
          <div className="p-4 border-b border-white/10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between border-white/10 text-white hover:bg-white/10"
                >
                  <span className="truncate">
                    {selectedStore?.name || 'Select Store'}
                  </span>
                  <ChevronDown className="w-4 h-4 ml-2 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-midnight border-white/10">
                {stores.map((store) => (
                  <DropdownMenuItem
                    key={store.id}
                    onClick={() => selectStore(store.id)}
                    className={cn(
                      'text-white hover:bg-white/10 cursor-pointer',
                      selectedStoreId === store.id && 'bg-white/10'
                    )}
                  >
                    <Store className="w-4 h-4 mr-2" />
                    <span className="truncate">{store.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold">
                {merchant?.name?.charAt(0) || 'M'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {merchant?.name}
              </p>
              <p className="text-white/50 text-xs truncate">
                {merchant?.company_name}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full border-white/10 text-white hover:bg-white/10"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
