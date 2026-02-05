import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Shirt,
  User,
  Menu,
  X,
  LogOut,
  CreditCard,
  ChevronDown,
  Users,
  Store,
  Camera,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/app/tryon', label: 'Try On', icon: Sparkles },
  { path: '/app/live-tryon', label: 'Live', icon: Camera },
  { path: '/app/wardrobe', label: 'Wardrobe', icon: Shirt },
  { path: '/app/feed', label: 'Shop Together', icon: Users },
  { path: '/store', label: 'Store', icon: Store },
  { path: '/app/account', label: 'Account', icon: User },
];

export default function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Background Grid Lines */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 max-w-7xl mx-auto flex justify-between opacity-[0.03] px-4 md:px-8">
          <div className="w-px h-full bg-white"></div>
          <div className="w-px h-full bg-white hidden md:block"></div>
          <div className="w-px h-full bg-white hidden lg:block"></div>
          <div className="w-px h-full bg-white hidden md:block"></div>
          <div className="w-px h-full bg-white"></div>
        </div>
      </div>

      {/* Desktop Header */}
      <header className="hidden md:flex sticky top-0 z-50 h-16 border-b border-white/5 bg-[#050505]/50 backdrop-blur-md">
        <div className="container max-w-container mx-auto px-6 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="MirrorX" className="w-8 h-8 object-contain" />
            <span className="font-medium tracking-tight text-white">Mirror<span className="text-emerald-500">X</span></span>
          </NavLink>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-4 py-2 rounded-full transition-all text-sm',
                    isActive
                      ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  )
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="text-gray-500">Credits: </span>
              <span className="text-green-400 font-medium">{user?.credits_balance || 0}</span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 text-gray-300 hover:text-white hover:bg-white/5">
                  <Avatar className="w-8 h-8 border border-white/10">
                    <AvatarImage src={user?.avatar_url || undefined} />
                    <AvatarFallback className="bg-green-500/20 text-green-400">{user?.name?.[0] || user?.email?.[0]}</AvatarFallback>
                  </Avatar>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-[#0a0a0a] border border-white/10">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium text-white">{user?.name || 'User'}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onClick={() => navigate('/pricing')} className="text-gray-300 hover:text-white hover:bg-white/5 cursor-pointer">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Buy Credits
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onClick={handleLogout} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer">
                  <LogOut className="w-4 h-4 mr-2" />
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-50 h-14 border-b border-white/5 bg-[#050505]/50 backdrop-blur-md">
        <div className="px-4 h-full flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="MirrorX" className="w-7 h-7 object-contain" />
            <span className="font-medium text-sm text-white">Mirror<span className="text-emerald-500">X</span></span>
          </NavLink>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-gray-300 hover:text-white hover:bg-white/5"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-14 left-0 right-0 bg-[#0a0a0a] border-b border-white/10 p-4"
            >
              <nav className="flex flex-col gap-2">
                {navItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-4 py-3 rounded-lg transition-all',
                        isActive
                          ? 'bg-green-500/10 text-green-400'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      )
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </NavLink>
                ))}
                <div className="border-t border-white/10 pt-2 mt-2">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-3 text-red-400 w-full hover:bg-red-500/10 rounded-lg transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                    Log Out
                  </button>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main className="relative z-10 container max-w-container mx-auto px-4 md:px-6 py-6 md:py-8">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-white/5 h-16 z-40 bg-[#050505]/90 backdrop-blur-md">
        <div className="flex items-center justify-around h-full">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-1 py-2 px-4 transition-all',
                  isActive ? 'text-green-400' : 'text-gray-500'
                )
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
