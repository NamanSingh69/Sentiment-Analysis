import { useState, useEffect } from 'react';
import { AgentModal } from './AgentModal';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, BarChart2, MessageSquare, AlertCircle, Loader2 } from 'lucide-react';

interface AnalysisResult {
  sentiment: string;
  confidence: number;
  explanation: string;
}

function App() {
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [textToAnalyze, setTextToAnalyze] = useState('');

  // State machine values
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    // Initial UI load animation
    setTimeout(() => setIsLoaded(true), 100);
    // Check local storage for API key
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  const handleAnalyze = async () => {
    if (!textToAnalyze.trim()) return;

    setStatus('loading');
    setErrorMessage('');

    try {
      // Direct call to relative /api/analyze to trigger Vercel Serverless
      const response = await fetch(import.meta.env.PROD ? '/api/analyze' : 'http://localhost:5333/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gemini-Key': apiKey
        },
        body: JSON.stringify({
          text: textToAnalyze,
          model: localStorage.getItem('gemini_model') || 'gemini-1.5-flash'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze text');
      }

      setResult(data.result);
      setStatus('success');
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error analyzing text');
      setStatus('error');
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case 'positive': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30';
      case 'negative': return 'text-rose-400 bg-rose-400/10 border-rose-400/30';
      case 'neutral': return 'text-slate-400 bg-slate-400/10 border-slate-400/30';
      default: return 'text-primary-400 bg-primary-400/10 border-primary-400/30';
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col relative overflow-hidden font-sans">
      {/* Background Orbs */}
      <div className="absolute top-0 right-[10%] w-[500px] h-[500px] bg-primary-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen mix-blend-screen" />
      <div className="absolute bottom-[-10%] left-[5%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none mix-blend-screen" />

      {/* Navigation Layer */}
      <nav className="relative z-20 w-full px-6 py-4 flex items-center justify-between glass-panel-dark border-b-0 border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
            <BarChart2 className="text-white" size={20} />
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Sentiment<span className="text-primary-400">X</span>
          </span>
        </div>

        <button
          onClick={() => setIsAgentModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-sm font-medium"
        >
          <Settings size={16} className="text-primary-400" />
          <span className="hidden sm:inline text-slate-300">Agent Config</span>
        </button>
      </nav>

      {/* Main Workspace */}
      <main className="flex-1 relative z-10 flex flex-col items-center justify-center p-6 sm:p-12 h-full">
        <AnimatePresence>
          {isLoaded && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-4xl"
            >
              <div className="text-center mb-10">
                <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 tracking-tight drop-shadow-md">
                  Instant Contextual <br className="hidden sm:block" /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-indigo-400">Analysis Engine</span>
                </h1>
                <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                  Paste a tweet, review, or article block. The Gemini 1.5 Flash agent will autonomously extract semantic sentiment vectors and logical confidence scores.
                </p>
              </div>

              <div className="glass-panel-dark p-6 sm:p-8 rounded-3xl grid grid-cols-1 lg:grid-cols-2 gap-8 relative overflow-hidden">
                {/* Left Side: Input Area */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-primary-400 font-medium mb-1">
                    <MessageSquare size={18} />
                    <h3>INPUT SIGNAL</h3>
                  </div>

                  <textarea
                    value={textToAnalyze}
                    onChange={(e) => setTextToAnalyze(e.target.value)}
                    placeholder="Enter text payload to analyze..."
                    className="w-full h-48 sm:h-64 bg-black/40 border border-white/10 rounded-2xl p-4 text-slate-200 resize-none outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all placeholder:text-slate-600"
                  />

                  <button
                    onClick={handleAnalyze}
                    disabled={status === 'loading' || !textToAnalyze.trim()}
                    className="w-full py-4 mt-2 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white rounded-xl font-bold tracking-wide transition-all shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:shadow-[0_0_30px_rgba(236,72,153,0.5)] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {status === 'loading' ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        ANALYZING VECTORS...
                      </>
                    ) : 'INITIATE ANALYSIS'}
                  </button>

                  {status === 'error' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3"
                    >
                      <AlertCircle className="text-rose-400 shrink-0 mt-0.5" size={18} />
                      <p className="text-sm text-rose-200">{errorMessage}</p>
                    </motion.div>
                  )}
                </div>

                {/* Right Side: Results Area */}
                <div className="flex flex-col h-full bg-black/20 rounded-2xl border border-white/5 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary-500/30 to-transparent" />

                  <div className="p-6 sm:p-8 flex flex-col h-full justify-center">
                    {status === 'idle' && (
                      <div className="text-center text-slate-500">
                        <BarChart2 className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p>Awaiting text payload...</p>
                      </div>
                    )}

                    {status === 'loading' && (
                      <div className="text-center flex flex-col items-center gap-4">
                        <div className="w-16 h-16 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin" />
                        <p className="text-primary-400 font-mono text-sm tracking-widest animate-pulse">PROCESSING</p>
                      </div>
                    )}

                    {status === 'success' && result && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col h-full gap-6"
                      >
                        <div>
                          <p className="text-xs text-slate-500 font-bold tracking-widest uppercase mb-2">Primary Sentiment</p>
                          <div className={`inline-flex px-4 py-2 rounded-lg border font-bold tracking-wide text-lg sm:text-xl ${getSentimentColor(result.sentiment)}`}>
                            {result.sentiment.toUpperCase()}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500 font-bold tracking-widest uppercase mb-2">Confidence Score</p>
                          <div className="flex items-end gap-2">
                            <span className="text-4xl sm:text-5xl font-extrabold text-white">{(result.confidence * 100).toFixed(1)}</span>
                            <span className="text-xl text-slate-400 mb-1">%</span>
                          </div>
                          <div className="w-full h-2 bg-white/10 rounded-full mt-3 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${result.confidence * 100}%` }}
                              transition={{ duration: 1, ease: 'easeOut' }}
                              className="h-full bg-primary-500 rounded-full"
                            />
                          </div>
                        </div>

                        <div className="mt-auto">
                          <p className="text-xs text-slate-500 font-bold tracking-widest uppercase mb-2">Agent Explanation</p>
                          <p className="text-slate-300 leading-relaxed text-sm sm:text-base bg-white/[0.03] p-4 rounded-xl border border-white/5">
                            "{result.explanation}"
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AgentModal
        isOpen={isAgentModalOpen}
        onClose={() => setIsAgentModalOpen(false)}
        onSave={(key) => setApiKey(key)}
      />
    </div>
  );
}

export default App;
