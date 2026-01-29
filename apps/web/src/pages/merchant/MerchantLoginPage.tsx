import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Store, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMerchantStore } from '@/store/merchant-store';

export default function MerchantLoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useMerchantStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    const success = await login(email, password);
    if (success) {
      navigate('/merchant/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-midnight flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 to-purple-700 p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
            <Store className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-2xl">MirrorX</h1>
            <p className="text-white/70 text-sm">Merchant Portal</p>
          </div>
        </div>

        <div>
          <h2 className="text-white text-4xl font-bold mb-6">
            Transform Your Retail<br />
            Experience
          </h2>
          <p className="text-white/80 text-lg mb-8">
            Enable virtual try-on in your stores. Increase conversions,
            reduce returns, and delight customers with AI-powered fashion tech.
          </p>

          <div className="grid grid-cols-2 gap-6">
            {[
              { label: 'Try-On Rate', value: '60%+' },
              { label: 'Conversion Uplift', value: '25%' },
              { label: 'Avg Decision Time', value: '<4 min' },
              { label: 'Customer Satisfaction', value: '4.8/5' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/10 rounded-xl p-4">
                <p className="text-white/60 text-sm">{stat.label}</p>
                <p className="text-white text-2xl font-bold">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/50 text-sm">
          mirrorx.co.in - Virtual Try-On for Modern Retail
        </p>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Store className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-2xl">MirrorX</h1>
              <p className="text-white/50 text-sm">Merchant Portal</p>
            </div>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-white text-2xl font-bold mb-2">Welcome Back</h2>
            <p className="text-white/60">Sign in to manage your stores</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/20 rounded-lg p-4"
              >
                <p className="text-red-400 text-sm">{error}</p>
              </motion.div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
                <Input
                  id="email"
                  type="email"
                  placeholder="merchant@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/40 hover:text-white"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white h-12"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-white/40 text-sm">
              New to MirrorX?{' '}
              <a href="mailto:partners@mirrorx.co.in" className="text-indigo-400 hover:text-indigo-300">
                Contact us for partnership
              </a>
            </p>
          </div>

          {/* Demo Credentials */}
          <div className="mt-8 p-4 bg-white/5 rounded-xl border border-white/10">
            <p className="text-white/60 text-sm text-center mb-2">Demo Credentials</p>
            <p className="text-white/80 text-sm font-mono text-center">
              demo@mirrorx.co.in / demo123
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
