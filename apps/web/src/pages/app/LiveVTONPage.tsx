/**
 * @fileoverview Live Virtual Try-On Page
 * 
 * Standalone page for accessing the Live VTON feature with WebRTC.
 * Can be accessed via /live-tryon or /app/live-tryon (protected)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Camera, Shirt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LiveVTON from '@/components/LiveVTON';
import { useAuthStore } from '@/store/auth-store';

// Clothing item type that matches LiveVTON component
interface ClothingItem {
    id: string;
    name: string;
    image: string;
    category: string;
    price: number;
    description?: string;
}

// Demo clothing items for testing
const DEMO_CLOTHING: ClothingItem[] = [
    {
        id: '1',
        name: 'Classic Navy Blazer',
        image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
        category: 'blazer',
        price: 4999,
        description: 'A tailored navy blue blazer with a modern slim fit, perfect for formal occasions',
    },
    {
        id: '2',
        name: 'Floral Summer Dress',
        image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400',
        category: 'dress',
        price: 2499,
        description: 'A flowing floral print summer dress with a V-neckline and knee-length hem',
    },
    {
        id: '3',
        name: 'Burgundy Polo Shirt',
        image: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=400',
        category: 'shirt',
        price: 1299,
        description: 'A premium cotton polo shirt in deep burgundy with a classic collar',
    },
    {
        id: '4',
        name: 'Denim Jacket',
        image: 'https://images.unsplash.com/photo-1551537482-f2075a1d41f2?w=400',
        category: 'jacket',
        price: 3499,
        description: 'A vintage-wash denim jacket with brass buttons and a relaxed fit',
    },
    {
        id: '5',
        name: 'Black Leather Jacket',
        image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400',
        category: 'jacket',
        price: 8999,
        description: 'A genuine leather motorcycle jacket in sleek black with silver zippers',
    },
];

export default function LiveVTONPage() {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthStore();
    const [isOpen, setIsOpen] = useState(false);
    const [clothing] = useState<ClothingItem[]>(DEMO_CLOTHING);

    // Auto-open if user is authenticated
    useEffect(() => {
        if (isAuthenticated) {
            setIsOpen(true);
        }
    }, [isAuthenticated]);

    const handleAddToCart = (item: ClothingItem) => {
        console.log('Added to cart:', item);
        // TODO: Integrate with cart store
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-sm border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(-1)}
                            className="text-white hover:bg-white/10"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-6 h-6 text-gold-400" />
                            <span className="text-xl font-bold text-white">Live Try-On</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Camera className="w-4 h-4" />
                        <span>WebRTC Realtime</span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="pt-20 pb-10 px-4">
                <div className="max-w-4xl mx-auto">
                    {/* Hero Section */}
                    <div className="text-center mb-12">
                        <h1 className="text-4xl font-bold text-white mb-4">
                            Real-Time Virtual Try-On
                        </h1>
                        <p className="text-xl text-gray-400 mb-8">
                            See yourself in any outfit instantly with AI-powered live video editing
                        </p>

                        <Button
                            onClick={() => setIsOpen(true)}
                            size="lg"
                            className="gap-3 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-black font-semibold px-8 py-6 text-lg"
                        >
                            <Camera className="w-6 h-6" />
                            Start Live Try-On
                        </Button>
                    </div>

                    {/* Features Grid */}
                    <div className="grid md:grid-cols-3 gap-6 mb-12">
                        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                            <div className="w-12 h-12 bg-gold-500/20 rounded-lg flex items-center justify-center mb-4">
                                <Camera className="w-6 h-6 text-gold-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">Real-Time Streaming</h3>
                            <p className="text-gray-400 text-sm">
                                Sub-40ms latency with WebRTC direct streaming to Decart AI
                            </p>
                        </div>

                        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                            <div className="w-12 h-12 bg-gold-500/20 rounded-lg flex items-center justify-center mb-4">
                                <Shirt className="w-6 h-6 text-gold-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">Any Clothing</h3>
                            <p className="text-gray-400 text-sm">
                                Try on any garment with AI that preserves your exact identity
                            </p>
                        </div>

                        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                            <div className="w-12 h-12 bg-gold-500/20 rounded-lg flex items-center justify-center mb-4">
                                <Sparkles className="w-6 h-6 text-gold-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">Style Modes</h3>
                            <p className="text-gray-400 text-sm">
                                Switch between realistic, anime, and cyberpunk styles on-the-fly
                            </p>
                        </div>
                    </div>

                    {/* Clothing Preview */}
                    <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                        <h2 className="text-xl font-semibold text-white mb-4">Sample Clothing</h2>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {clothing.map((item) => (
                                <div
                                    key={item.id}
                                    className="bg-black/40 rounded-lg p-3 cursor-pointer hover:bg-white/10 transition-colors"
                                    onClick={() => setIsOpen(true)}
                                >
                                    <img
                                        src={item.image}
                                        alt={item.name}
                                        className="w-full h-24 object-cover rounded-lg mb-2"
                                    />
                                    <p className="text-white text-xs truncate">{item.name}</p>
                                    <p className="text-gold-400 text-xs font-semibold">₹{item.price}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            {/* Live VTON Modal */}
            <LiveVTON
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                clothing={clothing}
                onAddToCart={handleAddToCart}
            />
        </div>
    );
}
