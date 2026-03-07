import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Key, Shield, ExternalLink, Settings, Loader2 } from 'lucide-react';

interface DiscoveredModel {
    name: string;
    displayName: string;
    score: number;
}

interface AgentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (key: string, model: string) => void;
}

export function AgentModal({ isOpen, onClose, onSave }: AgentModalProps) {
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('gemini-1.5-flash');
    const [models, setModels] = useState<DiscoveredModel[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);

    useEffect(() => {
        const savedKey = localStorage.getItem('gemini_api_key');
        const savedModel = localStorage.getItem('gemini_model');
        if (savedKey) setApiKey(savedKey);
        if (savedModel) setModel(savedModel);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        setIsLoadingModels(true);
        const headers: Record<string, string> = {};
        if (apiKey) Object.assign(headers, { 'X-Gemini-Key': apiKey });

        fetch(import.meta.env.PROD ? '/api/models' : 'http://localhost:5333/api/models', { headers })
            .then(res => res.json())
            .then(data => {
                if (data.models) {
                    const discovered = data.models
                        .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
                        .map((m: any) => {
                            const cleanName = m.name.replace("models/", "");
                            let score = 0;
                            if (cleanName.includes("pro")) score += 10;
                            if (cleanName.includes("flash")) score += 5;
                            return {
                                name: cleanName,
                                displayName: m.displayName || cleanName,
                                score: score
                            };
                        })
                        .sort((a: any, b: any) => b.score - a.score);

                    setModels(discovered);
                    if (discovered.length > 0 && !discovered.find((m: any) => m.name === model)) {
                        setModel(discovered[0].name);
                    }
                }
            })
            .catch(console.error)
            .finally(() => setIsLoadingModels(false));
    }, [isOpen, apiKey]);

    const handleSave = () => {
        localStorage.setItem('gemini_api_key', apiKey);
        localStorage.setItem('gemini_model', model);
        onSave(apiKey, model);
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
                                            placeholder="Using public fallback key — paste your own for higher limits"
                                        />
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-2 leading-snug px-1">
                                        ✅ A free public API key is active by default. Add your own for higher rate limits.<br />
                                        <strong className="text-slate-300">Free Tier Limits:</strong> 15 Requests/Min, 1,000,000 Tokens/Min, 1,500 Requests/Day.
                                    </div>
                                    <div className="flex items-center justify-between mt-2 text-xs mb-6">
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

                                    <div className="space-y-2 mt-4">
                                        <label className="text-sm font-semibold text-slate-300 flex items-center justify-between w-full">
                                            <span>Inference Engine</span>
                                            {isLoadingModels && <Loader2 size={14} className="animate-spin text-primary-400" />}
                                        </label>
                                        <select
                                            value={model}
                                            onChange={(e) => setModel(e.target.value)}
                                            className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all appearance-none"
                                        >
                                            {models.length > 0 ? (
                                                models.map(m => (
                                                    <option key={m.name} value={m.name}>{m.displayName}</option>
                                                ))
                                            ) : (
                                                <>
                                                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                                                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                                                    <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                                                </>
                                            )}
                                        </select>
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
