import React, { useState, useEffect, useRef } from 'react';
import BarcodeScannerComponent from "react-qr-barcode-scanner";
import axios from 'axios';
import { Camera, MessageCircle, AlertTriangle, Zap, Trophy, ChevronRight, ScanLine, Loader, Shield, Scroll, Activity, RefreshCw, Clock } from 'lucide-react';
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
  
  const scanningRef = useRef(false);
  
  // Gamification & Interaction States
  const [xp, setXp] = useState(340);
  const [level, setLevel] = useState(3);
  const [showSplash, setShowSplash] = useState(true);
  
  // -- INTERACTIVE STATES --
  const [shieldIntegrity, setShieldIntegrity] = useState(84); 
  const [sysStatus, setSysStatus] = useState("System Good");
  const [lootCount, setLootCount] = useState(12); 

  // -- DUMMY RECENTS DATA --
  const recentScans = [
    { id: 1, name: "Maggi Noodles", grade: "F", time: "2m ago", img: "🍜" },
    { id: 2, name: "Diet Coke", grade: "C", time: "1h ago", img: "🥤" },
    { id: 3, name: "Rice Crackers", grade: "S", time: "4h ago", img: "🌾" },
  ];

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const handleVibration = (grade) => {
    const badGrades = ['C', 'D', 'F'];
    if (badGrades.includes(grade) && navigator.vibrate) {
      navigator.vibrate([500, 200, 500]);
    }
  };

  // --- INTERACTION HANDLERS ---
  const handleShieldClick = () => {
    if (shieldIntegrity < 100) {
      setShieldIntegrity(100);
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
    }
  };

  const handleSysClick = () => {
    if (sysStatus === "Optimizing...") return;
    setSysStatus("Optimizing...");
    if (navigator.vibrate) navigator.vibrate(50);
    setTimeout(() => {
      setSysStatus("System Good");
      if (navigator.vibrate) navigator.vibrate([50, 50]);
    }, 1500);
  };

  const handleLootClick = () => {
    setLootCount("...");
    if (navigator.vibrate) navigator.vibrate(20);
    setTimeout(() => {
      setLootCount(prev => (prev === "..." ? 13 : prev + 1));
    }, 800);
  };

  // --- HELPER: Generate Subpoints for the Grid ---
  const getTopicDetails = (topicId) => {
    if (!productData || !analysis) return { points: ["Loading...", "Loading...", "Loading..."] };
    
    switch (topicId) {
      case 'nutrition':
        return {
          points: analysis.nutrition_highlights?.slice(0, 3) || ["Checking macros...", "Analyzing values...", "Calculating..."]
        };
      case 'ingredients':
        return {
          points: analysis.ingredients_summary?.slice(0, 3) || ["Checking labels...", "Scanning list...", "Reviewing..."]
        };
      case 'risks':
        const risk1 = analysis.health_risks?.[0] || "None detected";
        const risk2 = analysis.health_risks?.[1] || "Safe to consume";
        const risk3 = analysis.health_risks?.[2] || "No major risks";
        return {
          points: [
            risk1.length > 25 ? risk1.substring(0, 25) + '...' : risk1,
            risk2.length > 25 ? risk2.substring(0, 25) + '...' : risk2,
            risk3.length > 25 ? risk3.substring(0, 25) + '...' : risk3
          ]
        };
      case 'alternatives':
        return {
          points: analysis.alternatives?.slice(0, 3) || ["Better options", "Healthier swaps", "Clean choices"]
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
              "health_risks": ["Risk 1", "Risk 2", "Risk 3"],
              "ingredients_summary": ["Point 1", "Point 2", "Point 3"],
              "nutrition_highlights": ["Point 1", "Point 2", "Point 3"],
              "alternatives": ["Option 1", "Option 2", "Option 3"]
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
    // Prevent multiple scans or processing while already busy
    if (scanningRef.current) return;
    scanningRef.current = true;

    setLoading(true);
    try {
      const response = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      if (response.data.status === 1) {
        setProductData(response.data.product);
        // This will change the view, effectively stopping the scanner
        await analyzeWithLLM(response.data.product);
      } else {
        alert("Product not found! Try scanning again.");
        // If not found, stay on scan view
        setView('scan');
      }
    } catch (error) {
      console.error(error);
      alert("Error fetching product data.");
    } finally {
      setLoading(false);
      // Small delay to prevent double-triggering
      setTimeout(() => {
        scanningRef.current = false;
      }, 1000);
    }
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
            <div className="absolute inset-0 opacity-5 pointer-events-none" 
                style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} 
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "backOut" }}
              className="relative z-10 flex flex-col items-center"
            >
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

              <h1 className="text-6xl font-black uppercase italic tracking-tighter text-slate-900 mb-2 relative drop-shadow-sm">
                Gut Feeling
                <span className="absolute -top-4 -right-8 text-xs bg-[#FFD028] px-2 py-1 border-2 border-black rounded-lg font-black not-italic tracking-normal rotate-12 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  v1.0
                </span>
              </h1>
              
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
        
        {/* HEADER: PLAYER HUD */}
        <AnimatePresence>
          {view === 'home' && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex justify-between items-center mb-2 mt-2 shrink-0 px-6 pt-6"
            >
              {/* Profile Pill */}
              <div className="flex items-center gap-3 bg-white p-2 pr-4 rounded-full border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]">
                 <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-sm border border-black">
                   😎
                 </div>
                 <div className="flex flex-col">
                   <span className="text-[10px] font-black uppercase text-slate-400 leading-none">Athanth</span>
                   <span className="text-sm font-black text-slate-900 leading-none">LVL {level}</span>
                 </div>
              </div>

              {/* XP Bar Segmented */}
              <div className="flex flex-col items-end gap-1">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <motion.div 
                      key={i}
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className={`w-3 h-4 border border-black transform skew-x-12 ${i < 3 ? 'bg-[#00E054]' : 'bg-slate-200'}`} 
                    />
                  ))}
                </div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">XP Progress</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 relative perspective-[1000px] min-h-0">
          <AnimatePresence mode="wait">
            
            {/* --- VIEW: HOME (INTERACTIVE) --- */}
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
                  
                  {/* TILE 1: SYSTEM STATUS (Click to Optimize) */}
                  {/* <button 
                    onClick={handleSysClick}
                    className="col-span-2 bg-white border-2 border-black border-b-[6px] rounded-[1.5rem] p-4 flex items-center justify-between shadow-sm active:border-b-2 active:translate-y-1 transition-all group"
                  >
                     <div className="flex items-center gap-3">
                        <div className={`
                          p-3 rounded-xl border-2 border-black transition-colors duration-300
                          ${sysStatus === "Optimizing..." ? 'bg-yellow-100 text-yellow-600 animate-spin' : 'bg-green-100 text-green-600'}
                        `}>
                          <Activity size={24} strokeWidth={2.5} />
                        </div>
                        <div className="text-left">
                          <h3 className="font-black text-slate-900 uppercase text-lg leading-none transition-all">
                            {sysStatus}
                          </h3>
                          <span className="text-xs font-bold text-slate-400">
                             {sysStatus === "Optimizing..." ? "Running diagnostics..." : "Streak Active: 4 Days"}
                          </span>
                        </div>
                     </div>
                     <div className="flex gap-1 items-end h-8">
                        <motion.div animate={{ height: [10, 24, 10] }} transition={{ repeat: Infinity, duration: 1.2 }} className="w-2 bg-green-400 rounded-sm border border-black" />
                        <motion.div animate={{ height: [15, 30, 15] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }} className="w-2 bg-green-400 rounded-sm border border-black" />
                        <motion.div animate={{ height: [8, 20, 8] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }} className="w-2 bg-green-400 rounded-sm border border-black" />
                     </div>
                  </button> */}

                  {/* TILE 2: GUT SHIELD (Replaces Quest) */}
                  <button 
                    onClick={handleShieldClick}
                    className="col-span-1 bg-[#3B82F6] border-2 border-black border-b-[6px] rounded-[1.5rem] p-4 flex flex-col justify-between h-40 text-white relative overflow-hidden group active:border-b-2 active:translate-y-1 transition-all text-left"
                  >
                     <div className="absolute top-0 right-0 p-4 opacity-20 transform group-hover:scale-110 transition-transform">
                        <Shield size={48} />
                     </div>
                     <div className="relative z-10">
                        <span className="text-[10px] font-black uppercase bg-black/20 px-2 py-1 rounded">Defense</span>
                        <h3 className="font-black text-xl mt-2 leading-tight">
                           Gut Shield
                        </h3>
                     </div>
                     <div className="relative z-10 w-full mt-auto">
                        <div className="flex justify-between text-xs font-bold mb-1 opacity-90">
                           <span>Integrity</span>
                           <span>{shieldIntegrity}%</span>
                        </div>
                        <div className="h-3 bg-black/20 rounded-full overflow-hidden border border-black/10">
                           <motion.div 
                             initial={{ width: `${shieldIntegrity}%` }}
                             animate={{ width: `${shieldIntegrity}%` }}
                             className={`h-full ${shieldIntegrity < 50 ? 'bg-red-400' : 'bg-cyan-300'}`} 
                           />
                        </div>
                        {shieldIntegrity < 100 && <span className="text-[8px] font-black uppercase tracking-widest mt-1 block opacity-80">Click to Recharge</span>}
                     </div>
                  </button>

                  {/* TILE 3: LOOT COUNTER (Click to Sync) */}
                  <button 
                    onClick={handleLootClick}
                    className="col-span-1 bg-white border-2 border-black border-b-[6px] rounded-[1.5rem] p-4 flex flex-col justify-between h-40 group active:border-b-2 active:translate-y-1 transition-all cursor-pointer text-left"
                  >
                    
                    <div className="flex justify-between items-start w-full">
                       <div className="p-2 bg-orange-100 text-orange-600 rounded-lg border-2 border-orange-200 group-hover:rotate-12 transition-transform">
                          {lootCount === "..." ? <RefreshCw size={20} className="animate-spin"/> : <Scroll size={20} />}
                          
                       </div>
                       <ChevronRight size={20} className="text-slate-300" />
                    </div>
                    <div>
                      <div className="text-3xl font-black text-slate-900">{lootCount}</div> Items Scanned
                      <div className="text-xs font text-slate-400 leading-tight"><b>FoodDEX</b></div>
                    </div>
                  </button>

                  {/* TILE 4: SCANNER (Main Hero) */}
                  <button 
                    onClick={() => setView('scan')}
                    className="col-span-2 h-32 rounded-[2rem] bg-[#FFD028] border-2 border-black border-b-[8px] relative overflow-hidden group active:border-b-2 active:translate-y-1.5 transition-all"
                  >
                    <div className="absolute inset-0 flex items-center justify-center opacity-10">
                       <motion.div 
                         animate={{ scale: [1, 2], opacity: [1, 0] }}
                         transition={{ repeat: Infinity, duration: 2 }}
                         className="w-full h-full rounded-full border-[20px] border-white"
                       />
                    </div>
                    
                    <div className="absolute inset-0 flex items-center justify-between px-8">
                       <div className="flex flex-col text-left">
                          <span className="text-4xl font-black text-black uppercase tracking-tighter">Scan Loot</span>
                          <span className="text-xs font-black text-black/60 uppercase tracking-widest bg-white/30 inline-block px-2 py-0.5 rounded w-fit">Identify Target</span>
                       </div>
                       <div className="w-16 h-16 bg-white border-2 border-black rounded-2xl flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group-hover:rotate-6 transition-transform">
                          <ScanLine size={32} strokeWidth={3} />
                       </div>
                    </div>
                  </button>


                  <button 
                    onClick={() => setView('chat')}
                    className="col-span-2 h-20 bg-white rounded-[1.5rem] border-2 border-black border-b-[6px] flex items-center justify-between px-6 active:border-b-2 active:translate-y-1 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center border-2 border-black group-hover:bg-indigo-100 transition-colors">
                          <MessageCircle size={20} />
                       </div>
                       <div className="flex flex-col items-start">
                         <span className="font-black text-lg uppercase text-slate-900">Consult AI</span>
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nutritionist Link</span>
                       </div>
                    </div>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  </button>
                  
                  {/* --- NEW SECTION: RECENT DROPS --- */}
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-2 mt-2 px-1">
                      <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">Recent Drops</h3>
                      <button className="flex items-center gap-1 text-[10px] font-black text-slate-900 bg-white border-2 border-black rounded-lg pl-3 pr-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none transition-all uppercase group">
                        View All
                        <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" /> 
                      </button> 
                    </div>
                    
                    <div className="space-y-2">
                      {recentScans.map((item) => (
                        <div key={item.id} className="bg-white border-2 border-black border-b-4 rounded-xl p-3 flex items-center justify-between active:scale-[0.98] transition-transform">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-slate-100 rounded-lg border border-black flex items-center justify-center text-xl shadow-sm">
                                {item.img}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-black text-slate-900 text-sm">{item.name}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                  <Clock size={10} /> {item.time}
                                </span>
                              </div>
                           </div>
                           
                           {/* Grade Badge */}
                           <div className={`
                             w-8 h-8 rounded-lg border-2 border-black flex items-center justify-center font-black text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                             ${item.grade === 'S' ? 'bg-green-500 text-white' : 
                               item.grade === 'C' ? 'bg-yellow-400 text-black' : 
                               'bg-red-500 text-white'}
                           `}>
                             {item.grade}
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* TILE 5: CHAT (Wide Bottom) */}
                  

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
                  <div className={loading ? "hidden" : "block"}>
                    <BarcodeScannerComponent
                      width={500}
                      height={500}
                      videoConstraints={{
                        facingMode: 'environment'
                      }}
                      onUpdate={(err, result) => {
                        if (result) fetchProduct(result.text);
                      }}
                    />
                  </div>
                  {loading && (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-white">
                      <Loader className="animate-spin" size={40} />
                      <span className="font-black text-xl tracking-widest">DECODING...</span>
                    </div>
                  )}
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

            {/* VIEW: RESULT CARD */}
            {view === 'result_card' && productData && analysis && (
              <motion.div 
                key="result_card"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute inset-0 flex flex-col bg-[#F2F3F5] overflow-y-auto no-scrollbar"
              >
                <div className="px-6 pt-8 pb-32">
                  <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter leading-none mb-4 break-words">
                    {productData.product_name}
                  </h1>

                  <div className="relative mb-6 mt-8">
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

                    <div className={`
                      absolute -top-6 -right-4 z-20 w-20 h-20 rounded-2xl border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] flex items-center justify-center
                      ${['F','D'].includes(analysis.grade) ? 'bg-red-500 text-white' : 
                        ['C'].includes(analysis.grade) ? 'bg-yellow-400 text-black' :
                        'bg-green-500 text-white'}
                    `}>
                      <span className="text-5xl font-black">{analysis.grade}</span>
                    </div>
                  </div>

                  <div className="mb-8 px-2">
                    <div className="inline-block bg-black text-white text-[10px] font-bold px-2 py-1 rounded mb-1 uppercase tracking-widest">
                      Gut Feeling Verdict
                    </div>
                    <p className="text-lg font-bold text-slate-800 leading-tight">
                      {analysis.reasoning}
                    </p>
                  </div>

                  <h3 className="font-black text-xs uppercase text-slate-400 tracking-widest mb-3 px-1">
                    Analysis Data
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'ingredients', label: 'Ingredients', icon: '🌿' },
                      { id: 'nutrition', label: 'Nutrition', icon: '📊' },
                      { id: 'risks', label: 'Risks', icon: '⚠️' },
                      { id: 'alternatives', label: 'Alternatives', icon: '🥗' }
                    ].map((topic) => {
                      const details = getTopicDetails(topic.id);
                      
                      return (
                        <button
                          key={topic.id}
                          onClick={() => { setSelectedTopic(topic.id); setView('chat'); }}
                          className="relative p-4 rounded-2xl border-2 border-black border-b-[6px] text-left transition-all active:border-b-2 active:translate-y-1 bg-white"
                        >
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
                             
                          <div className="inline-flex items-center gap-1 bg-black border-2 border-black rounded-lg px-2 py-1 shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] text-[8px] font-black uppercase text-white group-hover:translate-x-0.5 transition-transform">
                             Know More
                          </div>
                        </button>
                      );
                    })}
                  </div>

                </div>

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