/**
 * @fileoverview Live Virtual Try-On Page
 * 
 * Standalone page for accessing the Live VTON feature with WebRTC.
 * Users can upload their own clothing images and see themselves
 * wearing them in real-time using Decart's MirageLSD 2.0 model.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Camera, Upload, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LiveVTON from '@/components/LiveVTON';

export default function LiveVTONPage() {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);

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
            <main className="pt-24 pb-12 px-4">
                <div className="max-w-4xl mx-auto">
                    {/* Hero Section */}
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 bg-gold-500/10 text-gold-400 px-4 py-2 rounded-full text-sm mb-6">
                            <Zap className="w-4 h-4" />
                            Powered by MirageLSD 2.0
                        </div>

                        <h1 className="text-5xl font-bold text-white mb-6">
                            Real-Time Virtual Try-On
                        </h1>
                        <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
                            Upload any clothing image and see yourself wearing it instantly with AI-powered live video transformation
                        </p>

                        <Button
                            onClick={() => setIsOpen(true)}
                            size="lg"
                            className="gap-3 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-black font-bold px-10 py-7 text-lg rounded-xl shadow-lg shadow-gold-500/20"
                        >
                            <Camera className="w-6 h-6" />
                            Start Live Try-On
                        </Button>
                    </div>

                    {/* Features Grid */}
                    <div className="grid md:grid-cols-3 gap-8 mb-16">
                        <div className="bg-white/5 rounded-2xl p-8 border border-white/10 hover:border-gold-500/30 transition-colors">
                            <div className="w-14 h-14 bg-gold-500/20 rounded-xl flex items-center justify-center mb-6">
                                <Upload className="w-7 h-7 text-gold-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-3">Upload Any Clothing</h3>
                            <p className="text-gray-400">
                                Simply upload an image of any shirt, dress, jacket, or outfit you want to try on
                            </p>
                        </div>

                        <div className="bg-white/5 rounded-2xl p-8 border border-white/10 hover:border-gold-500/30 transition-colors">
                            <div className="w-14 h-14 bg-gold-500/20 rounded-xl flex items-center justify-center mb-6">
                                <Camera className="w-7 h-7 text-gold-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-3">Real-Time Preview</h3>
                            <p className="text-gray-400">
                                See yourself wearing the clothing instantly with sub-40ms latency WebRTC streaming
                            </p>
                        </div>

                        <div className="bg-white/5 rounded-2xl p-8 border border-white/10 hover:border-gold-500/30 transition-colors">
                            <div className="w-14 h-14 bg-gold-500/20 rounded-xl flex items-center justify-center mb-6">
                                <Sparkles className="w-7 h-7 text-gold-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-3">Photorealistic</h3>
                            <p className="text-gray-400">
                                AI preserves your identity while applying natural lighting, shadows, and realistic fabric textures
                            </p>
                        </div>
                    </div>

                    {/* How It Works */}
                    <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
                        <h2 className="text-2xl font-bold text-white mb-8 text-center">How It Works</h2>
                        <div className="grid md:grid-cols-3 gap-8">
                            <div className="text-center">
                                <div className="w-12 h-12 bg-gold-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-gold-400 font-bold text-xl">1</span>
                                </div>
                                <h4 className="text-white font-medium mb-2">Upload Clothing</h4>
                                <p className="text-gray-400 text-sm">Upload a photo of the clothing item you want to try on</p>
                            </div>
                            <div className="text-center">
                                <div className="w-12 h-12 bg-gold-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-gold-400 font-bold text-xl">2</span>
                                </div>
                                <h4 className="text-white font-medium mb-2">Start Camera</h4>
                                <p className="text-gray-400 text-sm">Allow camera access and connect to our AI streaming service</p>
                            </div>
                            <div className="text-center">
                                <div className="w-12 h-12 bg-gold-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-gold-400 font-bold text-xl">3</span>
                                </div>
                                <h4 className="text-white font-medium mb-2">See Results</h4>
                                <p className="text-gray-400 text-sm">Watch AI transform your video in real-time to show you wearing the outfit</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Live VTON Modal */}
            <LiveVTON
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
            />
        </div>
    );
}
