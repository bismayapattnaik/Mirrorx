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
  Wand2,
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
import { Logo } from '@/components/Logo';

const navItems = [
  { path: '/app/tryon', label: 'Try On', icon: Sparkles },
  { path: '/app/tailor', label: 'AI Tailor', icon: Wand2 },
  { path: '/app/wardrobe', label: 'Wardrobe', icon: Shirt },
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
    <div className="min-h-screen bg-midnight">
      {/* Desktop Header */}
      <header className="hidden md:flex glass sticky top-0 z-50 h-16">
        <div className="container max-w-container mx-auto px-6 flex items-center justify-between">
          <NavLink to="/">
            <Logo size="md" />
          </NavLink>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg transition-all',
                    isActive
                      ? 'bg-gold/10 text-gold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-charcoal'
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
              <span className="text-muted-foreground">Credits: </span>
              <span className="text-gold font-semibold">{user?.credits_balance || 0}</span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user?.avatar_url || undefined} />
                    <AvatarFallback>{user?.name?.[0] || user?.email?.[0]}</AvatarFallback>
                  </Avatar>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.name || 'User'}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/pricing')}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Buy Credits
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden glass sticky top-0 z-50 h-14">
        <div className="px-4 h-full flex items-center justify-between">
          <NavLink to="/">
            <Logo size="sm" />
          </NavLink>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
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
              className="absolute top-14 left-0 right-0 bg-charcoal border-b border-gold/20 p-4"
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
                          ? 'bg-gold/10 text-gold'
                          : 'text-muted-foreground hover:text-foreground'
                      )
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </NavLink>
                ))}
                <div className="border-t border-gold/20 pt-2 mt-2">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-3 text-destructive w-full"
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
      <main className="container max-w-container mx-auto px-4 md:px-6 py-6 md:py-8">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-gold/20 h-16 z-40">
        <div className="flex items-center justify-around h-full">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-1 py-2 px-4 transition-all',
                  isActive ? 'text-gold' : 'text-muted-foreground'
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
