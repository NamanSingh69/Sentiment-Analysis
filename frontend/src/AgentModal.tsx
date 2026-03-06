import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Key, Shield, ExternalLink, Settings } from 'lucide-react';

interface AgentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (key: string, _endpoint: string) => void;
}

export function AgentModal({ isOpen, onClose, onSave }: AgentModalProps) {
    const [apiKey, setApiKey] = useState('');

    useEffect(() => {
        const savedKey = localStorage.getItem('gemini_api_key');
        if (savedKey) setApiKey(savedKey);
    }, []);

    const handleSave = () => {
        localStorage.setItem('gemini_api_key', apiKey);
        onSave(apiKey, '');
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-50 p-4"
                    >
                        <div className="bg-[#0f172a] border border-primary-500/30 rounded-2xl shadow-2xl shadow-primary-500/10 overflow-hidden">
                            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary-500/20 rounded-lg text-primary-400">
                                        <Settings aria-hidden="true" size={20} />
                                    </div>
                                    <h2 className="text-xl font-semibold text-white">Agent Configuration</h2>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="text-slate-400 hover:text-white transition-colors"
                                    aria-label="Close configuration"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                <div>
                                    <label htmlFor="apiKey" className="block text-sm font-medium text-slate-300 mb-2">
                                        Gemini API Key
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                            <Key size={18} />
                                        </div>
                                        <input
                                            type="password"
                                            id="apiKey"
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            className="w-full bg-black/40 border border-slate-700/50 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all font-mono text-sm"
                                            placeholder="AIzaSy..."
                                        />
                                    </div>
                                    <div className="flex items-center justify-between mt-2 text-xs">
                                        <p className="text-slate-500 flex items-center gap-1.5">
                                            <Shield size={12} /> Stored locally in browser
                                        </p>
                                        <a
                                            href="https://aistudio.google.com/app/apikey"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary-400 hover:text-primary-300 flex items-center gap-1 transition-colors"
                                        >
                                            Get API Key <ExternalLink size={10} />
                                        </a>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-white/5 bg-white/[0.02]">
                                <button
                                    onClick={handleSave}
                                    className="w-full bg-primary-600 hover:bg-primary-500 text-white font-medium py-3 px-4 rounded-xl transition-all shadow-[0_0_15px_rgba(236,72,153,0.3)] hover:shadow-[0_0_20px_rgba(236,72,153,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Save Configuration
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
