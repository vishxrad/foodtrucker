import React, { useState, useEffect } from 'react';
import BarcodeScannerComponent from "react-qr-barcode-scanner";
import axios from 'axios';
import { Camera, MessageCircle, AlertTriangle, Zap, Trophy, ChevronRight, ScanLine, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatInterface from './chatInterface';
import { openai } from './openaiClient';

// --- MAIN APP COMPONENT ---
const App = () => {
  const [view, setView] = useState('home'); 
  const [productData, setProductData] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  
  // Gamification States
  const [xp, setXp] = useState(340);
  const [level, setLevel] = useState(3);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 4500);
    return () => clearTimeout(timer);
  }, []);

  const handleVibration = (grade) => {
    const badGrades = ['C', 'D', 'F'];
    if (badGrades.includes(grade) && navigator.vibrate) {
      navigator.vibrate([500, 200, 500]);
    }
  };

  // --- HELPER: Generate Subpoints for the Grid ---
  const getTopicDetails = (topicId) => {
    if (!productData || !analysis) return { points: ["Loading...", "Loading..."] };
    const n = productData.nutriments;

    switch (topicId) {
      case 'nutrition':
        return {
          points: [
            `${Math.round(n['energy-kcal_100g'] || 0)} calories`,
            n['sugars_100g'] > 10 ? 'High Sugar' : 'Low Sugar'
          ]
        };
      case 'ingredients':
        const additivesCount = productData.additives_tags?.length || 0;
        const palmOil = productData.ingredients_text?.toLowerCase().includes('palm');
        return {
          points: [
            `${additivesCount} Additives`,
            palmOil ? 'Contains Palm Oil' : 'No Palm Oil'
          ]
        };
      case 'risks':
        const risk1 = analysis.health_risks?.[0] || "None detected";
        const risk2 = analysis.health_risks?.[1] || "Safe to consume";
        return {
          points: [
            risk1.length > 15 ? risk1.substring(0, 15) + '...' : risk1,
            risk2.length > 15 ? risk2.substring(0, 15) + '...' : risk2
          ]
        };
      case 'alternatives':
        return {
          points: [
            "Better options",
            "Healthier swaps"
          ]
        };
      default:
        return { points: [] };
    }
  };

  const analyzeWithLLM = async (productOverride = null) => {
    const currentProduct = productOverride || productData;
    if (!currentProduct) return;

    setView('analyzing');
    const productContext = {
      name: currentProduct.product_name,
      brands: currentProduct.brands,
      nutriments: {
        energy_kcal: currentProduct.nutriments['energy-kcal_100g'],
        sugar: currentProduct.nutriments['sugars_100g'],
        salt: currentProduct.nutriments['salt_100g'],
        fat: currentProduct.nutriments['saturated-fat_100g'],
        protein: currentProduct.nutriments['proteins_100g'],
        fiber: currentProduct.nutriments['fiber_100g'],
      },
      ingredients: currentProduct.ingredients_text,
      additives: currentProduct.additives_original_tags 
    };

    try {
      const completion = await openai.chat.completions.create({
        model: "meta-llama/Llama-3.3-70B-Instruct-fast",
        response_format: { type: "json_object" }, 
        messages: [
          {
            role: "system",
            content: `You are a strict, no-nonsense nutritionist. 
            Analyze the provided food data and grade it (S to F).
            
            STYLE RULES:
            1. Be brutal and direct. No filler words.
            2. Zero emojis.
            3. Maximum 20 words for the reasoning.
            4. If it has High Sugar, Red 40, or Trans Fat, the grade is F.
            
            OUTPUT JSON ONLY:
            {
              "grade": "S"|"A"|"B"|"C"|"D"|"F",
              "reasoning": "Short, punchy explanation.",
              "health_risks": ["Risk 1", "Risk 2"]
            }`
          },
          { role: "user", content: JSON.stringify(productContext) }
        ],
      });

      const result = JSON.parse(completion.choices[0].message.content);
      setAnalysis(result);
      handleVibration(result.grade); 
      setView('result_card');

    } catch (error) {
      console.error("Analysis Error:", error);
      alert("The Judge is sleeping (API Error).");
      setView('home');
    }
  };

  const fetchProduct = async (barcode) => {
    setLoading(true);
    try {
      const response = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      if (response.data.status === 1) {
        setProductData(response.data.product);
        analyzeWithLLM(response.data.product);
      } else {
        alert("Product not found! Try scanning again.");
        setView('scan');
      }
    } catch (error) {
      console.error(error);
      alert("Error fetching product data.");
    }
    setLoading(false);
  };

  // --- BACKGROUND PATTERN ---
  const BgPattern = () => (
    <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" 
      style={{
        backgroundImage: 'radial-gradient(#000 1px, transparent 1px)',
        backgroundSize: '20px 20px'
      }}
    />
  );

  return (
    <div className="h-[100dvh] bg-[#F2F3F5] text-slate-900 font-sans overflow-hidden relative">
      <BgPattern />
      
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[100] bg-[#F2F3F5] flex flex-col items-center justify-center overflow-hidden"
          >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5 pointer-events-none" 
                style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} 
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "backOut" }}
              className="relative z-10 flex flex-col items-center"
            >
              {/* Logo / Icon Placeholder */}
              <div className="mb-8 relative">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="absolute -inset-4 border-2 border-dashed border-slate-300 rounded-full"
                />
                <div className="w-24 h-24 bg-[#5865F2] rounded-2xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center transform -rotate-6">
                   <span className="text-5xl">🍎</span>
                </div>
              </div>

              {/* Title */}
              <h1 className="text-6xl font-black uppercase italic tracking-tighter text-slate-900 mb-2 relative drop-shadow-sm">
                Gut Feeling
                <span className="absolute -top-4 -right-8 text-xs bg-[#FFD028] px-2 py-1 border-2 border-black rounded-lg font-black not-italic tracking-normal rotate-12 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  v1.0
                </span>
              </h1>
              
              {/* Loading Bar */}
              <div className="w-64 h-6 bg-white border-2 border-black rounded-full p-1 mt-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
                <motion.div 
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 4, ease: "easeInOut" }}
                  className="h-full bg-[#00E054] rounded-full border border-black/10 relative overflow-hidden"
                >
                   <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.5)_50%,transparent_75%)] bg-[length:20px_20px] animate-[shimmer_1s_infinite_linear]" />
                </motion.div>
              </div>
              
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-3 font-mono text-xs font-bold text-slate-400 uppercase tracking-widest"
              >
                Calibrating Sensors...
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 max-w-md mx-auto h-full flex flex-col">
        
        {/* HEADER: GAMIFIED PROFILE */}
        <AnimatePresence>
          {view === 'home' && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex justify-between items-end mb-2 mt-2 shrink-0 px-6 pt-6"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-600 rounded-xl border-b-4 border-indigo-900 flex items-center justify-center text-white shadow-lg">
                  <span className="text-2xl">😎</span>
                </div>
                <div>
                  <h1 className="text-sm font-black text-slate-400 uppercase tracking-wider">Visharad</h1>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-slate-900 leading-none">Lvl {level}</span>
                    <div className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-200">
                      Healthy
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Next Lvl</div>
                <div className="w-24 h-3 bg-slate-200 rounded-full overflow-hidden border border-slate-300">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(xp/500)*100}%` }}
                    className="h-full bg-yellow-400" 
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 relative perspective-[1000px] min-h-0">
          <AnimatePresence mode="wait">
            
            {/* --- VIEW: HOME (REVAMPED) --- */}
            {view === 'home' && (
              <motion.div 
                key="home"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col h-full px-6 pb-6 pt-2"
              >
                {/* BENTO GRID LAYOUT */}
                <div className="grid grid-cols-2 gap-4 flex-1 content-start">
                  
                  {/* TILE 1: DAILY STATS */}
                  <div className="col-span-1 bg-white border-2 border-slate-200 border-b-4 rounded-[1.5rem] p-4 flex flex-col justify-between h-32 active:scale-95 transition-transform">
                    <div className="flex items-start justify-between">
                      <Zap className="text-yellow-500 fill-yellow-500" size={24} />
                      <span className="text-xs font-black text-slate-300">STREAK</span>
                    </div>
                    <div>
                      <span className="text-3xl font-black text-slate-800 block">4</span>
                      <span className="text-xs font-bold text-slate-400">Days clean eating</span>
                    </div>
                  </div>

                  {/* TILE 2: COLLECTION */}
                  <div className="col-span-1 bg-white border-2 border-slate-200 border-b-4 rounded-[1.5rem] p-4 flex flex-col justify-between h-32 active:scale-95 transition-transform">
                    <div className="flex items-start justify-between">
                      <Trophy className="text-orange-500" size={24} />
                      <span className="text-xs font-black text-slate-300">BADGES</span>
                    </div>
                    <div>
                      <span className="text-3xl font-black text-slate-800 block">12</span>
                      <span className="text-xs font-bold text-slate-400">Unlocked</span>
                    </div>
                  </div>

                  {/* TILE 3: MAIN ACTION (SCAN) */}
                  <button 
                    onClick={() => setView('scan')}
                    className="col-span-2 relative group h-48 rounded-[2rem] overflow-hidden border-2 border-black border-b-[8px] bg-[#FFD028] active:border-b-2 active:translate-y-1 transition-all"
                  >
                    {/* Decorative Patterns */}
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-black to-transparent" />
                    <div className="absolute top-4 right-4 animate-pulse">
                      <div className="w-3 h-3 bg-red-500 rounded-full border border-black" />
                    </div>
                    
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <motion.div 
                        whileHover={{ rotate: 10, scale: 1.1 }}
                        className="bg-white border-2 border-black p-4 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                      >
                         <ScanLine size={48} strokeWidth={2.5} />
                      </motion.div>
                      <div className="text-center mt-2">
                        <span className="block text-3xl font-black tracking-tighter text-black uppercase italic">Scan Loot</span>
                        <span className="text-xs font-bold bg-black text-[#FFD028] px-2 py-1 rounded-md uppercase tracking-widest">Identify Food</span>
                      </div>
                    </div>
                  </button>

                  {/* TILE 4: CHAT */}
                  <button 
                    onClick={() => setView('chat')}
                    className="col-span-2 h-24 bg-[#5865F2] rounded-[1.5rem] border-2 border-black border-b-[6px] flex items-center justify-between px-6 text-white active:border-b-2 active:translate-y-1 transition-all group"
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-black text-xl uppercase italic">Ask Gut Feeling</span>
                      <span className="text-xs font-bold opacity-80 group-hover:underline">Chat with AI Nutritionist</span>
                    </div>
                    <MessageCircle size={32} strokeWidth={2.5} className="group-hover:rotate-12 transition-transform" />
                  </button>

                  {/* TILE 5: RECENT */}
                  <div className="col-span-2 mt-2">
                    <div className="flex justify-between items-center mb-2 px-2">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Last Scanned</span>
                      <ChevronRight size={16} className="text-slate-400" />
                    </div>
                    <div className="bg-white p-3 rounded-2xl border-2 border-slate-100 flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-xl border border-slate-200">🍎</div>
                      <div>
                        <div className="font-bold text-slate-800">Fuji Apple</div>
                        <div className="text-xs text-green-500 font-black uppercase">Grade A • 52 kcal</div>
                      </div>
                    </div>
                  </div>

                </div>
              </motion.div>
            )}

            {/* VIEW: SCANNER */}
            {view === 'scan' && (
              <motion.div 
                key="scan"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center h-full px-6 pt-8"
              >
                <div className="w-full aspect-square bg-black rounded-[2.5rem] overflow-hidden relative shadow-2xl border-[6px] border-slate-800">
                  {!loading ? (
                    <BarcodeScannerComponent
                      width={500}
                      height={500}
                      onUpdate={(err, result) => {
                        if (result) fetchProduct(result.text);
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-white">
                      <Loader className="animate-spin" size={40} />
                      <span className="font-black text-xl tracking-widest">DECODING...</span>
                    </div>
                  )}
                  {/* Retro Scanner Overlay */}
                  <div className="absolute inset-0 pointer-events-none border-[40px] border-black/50">
                     <div className="absolute top-1/2 left-4 right-4 h-1 bg-red-500 shadow-[0_0_10px_red] animate-pulse" />
                     <div className="absolute top-4 left-4 text-green-400 font-mono text-xs">REC ●</div>
                  </div>
                </div>
                <button 
                  onClick={() => setView('home')} 
                  className="mt-8 px-8 py-4 bg-white border-2 border-slate-200 border-b-4 rounded-2xl text-slate-900 font-black uppercase tracking-wider hover:bg-slate-50 active:border-b-2 active:translate-y-[2px]"
                >
                  Abort Mission
                </button>
              </motion.div>
            )}

            {/* VIEW: CONFIRMATION */}
            {view === 'confirm' && productData && (
              <motion.div 
                key="confirm"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex flex-col px-6 pb-6 pt-10"
              >
                {/* Product Card */}
                <div className="bg-white p-4 rounded-[2rem] border-2 border-black border-b-8 flex-1 flex flex-col items-center text-center">
                  <div className="w-full h-48 bg-slate-50 rounded-2xl mb-4 flex items-center justify-center p-4 border border-slate-100">
                     <img src={productData.image_url} alt="Product" className="max-h-full object-contain" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase leading-none mb-2">{productData.product_name}</h2>
                  <p className="font-bold text-slate-400 uppercase text-xs tracking-widest">{productData.brands}</p>
                </div>
                
                <div className="flex gap-4 mt-4 shrink-0">
                  <button onClick={() => setView('scan')} className="flex-1 py-4 bg-slate-100 border-2 border-slate-300 border-b-4 text-slate-500 rounded-2xl font-black uppercase active:border-b-2 active:translate-y-1">Retry</button>
                  <button onClick={analyzeWithLLM} className="flex-1 py-4 bg-green-500 border-2 border-black border-b-4 text-white rounded-2xl font-black uppercase shadow-lg active:border-b-2 active:translate-y-1">Identify</button>
                </div>
              </motion.div>
            )}

            {/* VIEW: ANALYZING */}
            {view === 'analyzing' && (
              <motion.div 
                key="analyzing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full px-6 text-center"
              >
                <div className="text-6xl animate-bounce mb-6">🎲</div>
                <h2 className="text-3xl font-black text-slate-900 mb-2 uppercase italic">Rolling Stats...</h2>
                <p className="font-mono text-sm text-slate-500">Calculating health damage...</p>
              </motion.div>
            )}

            {/* VIEW: RESULT CARD (Refined & Moved) */}
            {view === 'result_card' && productData && analysis && (
              <motion.div 
                key="result_card"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute inset-0 flex flex-col bg-[#F2F3F5] overflow-y-auto no-scrollbar"
              >
                <div className="px-6 pt-8 pb-32">
                  
                  {/* 1. PRODUCT NAME */}
                  <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter leading-none mb-4 break-words">
                    {productData.product_name}
                  </h1>

                  {/* 2. BIG IMAGE & GRADE (MOVED) */}
                  <div className="relative mb-6 mt-8">
                    {/* The Image Card with Colored Border */}
                    <div className={`
                      bg-white rounded-[2rem] border-4 border-b-[8px] p-6 shadow-xl relative z-10 overflow-hidden
                      ${['F','D'].includes(analysis.grade) ? 'border-red-500' : 
                        ['C'].includes(analysis.grade) ? 'border-yellow-400' :
                        'border-green-500'}
                    `}>
                       <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]" />
                       <div className="w-full aspect-[4/3] flex items-center justify-center relative z-10">
                          <img 
                            src={productData.image_url} 
                            className="max-w-full max-h-full object-contain drop-shadow-xl" 
                            alt="Product"
                          />
                       </div>
                    </div>

                    {/* The Grade Badge (Floating TOP RIGHT) */}
                    <div className={`
                      absolute -top-6 -right-4 z-20 w-20 h-20 rounded-2xl border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] flex items-center justify-center
                      ${['F','D'].includes(analysis.grade) ? 'bg-red-500 text-white' : 
                        ['C'].includes(analysis.grade) ? 'bg-yellow-400 text-black' :
                        'bg-green-500 text-white'}
                    `}>
                      <span className="text-5xl font-black">{analysis.grade}</span>
                    </div>
                  </div>

                  {/* 3. VERDICT REASONING (REVERTED TO STACKED) */}
                  <div className="mb-8 px-2">
                    <div className="inline-block bg-black text-white text-[10px] font-bold px-2 py-1 rounded mb-1 uppercase tracking-widest">
                      Gut Feeling Verdict
                    </div>
                    <p className="text-lg font-bold text-slate-800 leading-tight">
                      {analysis.reasoning}
                    </p>
                  </div>

                  {/* 4. TOPICS GRID (FIXED: INLINE EMOJI + LABEL) */}
                  <h3 className="font-black text-xs uppercase text-slate-400 tracking-widest mb-3 px-1">
                    Analysis Data
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'ingredients', label: 'Ingredients', icon: '🧪' },
                      { id: 'nutrition', label: 'Nutrition', icon: '📊' },
                      { id: 'risks', label: 'Risks', icon: '💀' },
                      { id: 'alternatives', label: 'Alternatives', icon: '💎' }
                    ].map((topic) => {
                      const details = getTopicDetails(topic.id);
                      
                      return (
                        <button
                          key={topic.id}
                          onClick={() => { setSelectedTopic(topic.id); setView('chat'); }}
                          className="relative p-4 rounded-2xl border-2 border-black border-b-[6px] text-left transition-all active:border-b-2 active:translate-y-1 bg-white"
                        >
                          {/* UPDATED: Flex container to put Icon and Label on same line */}
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-2xl">{topic.icon}</span>
                            <span className="font-black text-slate-900 uppercase text-xs tracking-wide">{topic.label}</span>
                          </div>

                          <div className="space-y-1 mb-3">
                             {details.points.map((p, i) => (
                               <div key={i} className="flex items-center gap-1.5">
                                 <div className="w-1.5 h-1.5 bg-black rounded-full shrink-0" />
                                 <span className="text-[10px] font-bold text-slate-500 leading-tight truncate">
                                   {p}
                                 </span>
                               </div>
                             ))}
                          </div>

                          <div className="inline-block bg-slate-100 border border-slate-300 rounded px-1.5 py-0.5 text-[8px] font-black uppercase text-slate-600">
                             Know More
                          </div>
                        </button>
                      );
                    })}
                  </div>

                </div>

                {/* Floating Chat Button */}
                <div className="fixed bottom-6 left-6 right-6 z-30">
                  <button 
                    onClick={() => setView('chat')} 
                    className="w-full py-4 bg-[#5865F2] border-2 border-black border-b-[6px] text-white rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-wider shadow-xl active:border-b-2 active:translate-y-1 hover:brightness-110"
                  >
                    <MessageCircle size={24} strokeWidth={3} /> Open Comms
                  </button>
                </div>
              </motion.div>
            )}
            
            {/* VIEW: CHAT */}
            {view === 'chat' && (
              <motion.div 
                key="chat"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="absolute inset-0 bg-white z-50"
              > 
                <ChatInterface 
                  productData={productData} 
                  analysis={analysis} 
                  initialTopic={selectedTopic}
                  onReset={() => {
                    setProductData(null);
                    setAnalysis(null);
                    setSelectedTopic(null);
                    setView('home');
                  }} 
                />
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default App;