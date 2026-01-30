import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingBag, Home, Search, User } from 'lucide-react';
import { useStoreModeStore } from '@/store/store-mode-store';
import { cn } from '@/lib/utils';

export default function StoreLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { store, cart } = useStoreModeStore();

  const cartItemCount = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  const navItems = [
    { icon: Home, label: 'Home', path: '/store' },
    { icon: Search, label: 'Browse', path: '/store/browse' },
    { icon: ShoppingBag, label: 'Cart', path: '/store/cart', badge: cartItemCount },
    { icon: User, label: 'Pass', path: '/store/pickup' },
  ];

  return (
    <div className="min-h-screen bg-midnight flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-midnight/95 backdrop-blur-lg border-b border-white/10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {store?.logo_url ? (
              <img src={store.logo_url} alt={store.name} className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">{store?.name?.[0] || 'M'}</span>
              </div>
            )}
            <div>
              <h1 className="text-white font-semibold text-sm">{store?.name || 'MirrorX Store'}</h1>
              <p className="text-white/50 text-xs">Virtual Try-On</p>
            </div>
          </div>

          {/* Cart button in header */}
          <button
            onClick={() => navigate('/store/cart')}
            className="relative p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          >
            <ShoppingBag className="w-5 h-5 text-white" />
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-gold text-midnight text-xs font-bold rounded-full flex items-center justify-center">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-midnight/95 backdrop-blur-lg border-t border-white/10 safe-area-bottom">
        <div className="flex justify-around items-center py-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path === '/store/browse' && location.pathname.startsWith('/store/product'));

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all relative',
                  isActive
                    ? 'text-gold'
                    : 'text-white/50 hover:text-white/80'
                )}
              >
                <div className="relative">
                  <item.icon className="w-5 h-5" />
                  {item.badge ? (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-2 -right-2 w-4 h-4 bg-gold text-midnight text-[10px] font-bold rounded-full flex items-center justify-center"
                    >
                      {item.badge}
                    </motion.span>
                  ) : null}
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="store-nav-indicator"
                    className="absolute -bottom-1 w-1 h-1 rounded-full bg-gold"
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
