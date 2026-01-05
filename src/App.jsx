import React, { useState, useEffect, useRef } from 'react';
import BarcodeScannerComponent from "react-qr-barcode-scanner";
import axios from 'axios';
import { Camera, MessageCircle, AlertTriangle, Check, X, Send, Image as ImageIcon, Loader, ChevronLeft, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ChatInterface from './chatInterface';
import { openai } from './openaiClient';

// --- MAIN APP COMPONENT ---
const App = () => {
  const [view, setView] = useState('home'); 
  const [productData, setProductData] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);

  const handleVibration = (grade) => {
    const badGrades = ['C', 'D', 'F'];
    if (badGrades.includes(grade) && navigator.vibrate) {
      navigator.vibrate([500, 200, 500]);
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
  }; // <--- Fixed: Analyze function ends here

  // --- HELPER: Generate Preview Points for Cards ---
  // <--- Fixed: This is now correctly placed at the component level
  const getTopicPreview = (id) => {
    if (!productData || !analysis) return [];
    const n = productData.nutriments;
    
    switch(id) {
      case 'nutrition':
        const cals = n['energy-kcal_100g'] ? `${Math.round(n['energy-kcal_100g'])} kcal` : 'N/A';
        const highSugar = (n['sugars_100g'] > 10) ? `High Sugar (${Math.round(n['sugars_100g'])}g)` : null;
        const highProtein = (n['proteins_100g'] > 10) ? `High Protein (${Math.round(n['proteins_100g'])}g)` : null;
        return [cals, highSugar || highProtein || "Balanced Macros"];
      
      case 'health':
        const risk = analysis.health_risks?.[0] || "No major alerts";
        const additiveCount = productData.additives_tags?.length || 0;
        return [risk.substring(0, 15) + (risk.length>15 ? '...' : ''), `${additiveCount} Additives found`];

      case 'ingredients':
        const isPalm = productData.ingredients_text?.toLowerCase().includes('palm');
        const firstIng = productData.ingredients_text?.split(',')[0]?.substring(0,15) || "Unknown base";
        return [`Base: ${firstIng}`, isPalm ? "⚠️ Palm Oil" : "✅ No Palm Oil"];

      case 'alternatives':
        return ["Lower sugar options", "Cleaner labels"];
        
      default: return [];
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

  // --- COLORS CONFIGURATION ---
  // We explicitly define classes here so Tailwind doesn't purge them
  const topicConfig = {
    nutrition: { color: 'blue', dot: 'bg-blue-400', pill: 'bg-blue-50 text-blue-600', active: 'active:border-blue-300' },
    health: { color: 'blue', dot: 'bg-blue-400', pill: 'bg-blue-50 text-blue-600', active: 'active:border-blue-300' },
    ingredients: { color: 'blue', dot: 'bg-blue-400', pill: 'bg-blue-50 text-blue-600', active: 'active:border-blue-300' },
    alternatives: { color: 'blue', dot: 'bg-blue-400', pill: 'bg-blue-50 text-blue-600', active: 'active:border-blue-300' },
  };

  return (
    <div className="h-[100dvh] bg-slate-50 text-slate-900 font-sans overflow-hidden relative">
      
      <div className="relative z-10 max-w-md mx-auto h-full flex flex-col">
        
        {/* HEADER */}
        <AnimatePresence>
          {view !== 'chat' && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex justify-between items-center mb-4 mt-2 shrink-0 px-6 pt-6"
            >
              <div>
                <h1 className="text-3xl font-black tracking-tighter text-slate-900">
                  Nutri<span className="text-blue-600">Judge</span>
                </h1>
                <p className="text-xs text-slate-400 font-bold tracking-widest uppercase">Smart Food Scanner</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 relative perspective-[1000px] min-h-0">
          <AnimatePresence mode="wait">
            
            {/* VIEW: HOME */}
            {view === 'home' && (
              <motion.div 
                key="home"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col gap-6 mt-4 px-6"
              >
                <button 
                  onClick={() => setView('scan')}
                  className="group relative h-48 rounded-[2rem] overflow-hidden bg-white shadow-xl shadow-blue-100 border border-blue-50 transition-all hover:scale-[1.02] active:scale-95"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-600 opacity-0 group-hover:opacity-100 transition duration-500" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
                    <div className="p-5 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-white group-hover:text-blue-600 transition-colors shadow-sm">
                      <Camera size={40} strokeWidth={2} />
                    </div>
                    <div className="text-center group-hover:text-white transition-colors">
                      <span className="block text-2xl font-bold tracking-tight text-slate-900 group-hover:text-white">Scan Barcode</span>
                      <span className="text-sm text-slate-400 font-medium group-hover:text-blue-100">Instant Nutritional Analysis</span>
                    </div>
                  </div>
                </button>

                <button 
                  onClick={() => setView('chat')} 
                  className="group relative h-48 rounded-[2rem] overflow-hidden bg-white shadow-xl shadow-slate-200 border border-slate-100 transition-all hover:scale-[1.02] active:scale-95"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 opacity-0 group-hover:opacity-100 transition duration-500" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
                    <div className="p-5 bg-slate-50 text-slate-600 rounded-2xl group-hover:bg-white group-hover:text-slate-900 transition-colors shadow-sm">
                      <MessageCircle size={40} strokeWidth={2} />
                    </div>
                    <div className="text-center group-hover:text-white transition-colors">
                      <span className="block text-2xl font-bold tracking-tight text-slate-900 group-hover:text-white">Chat / Upload</span>
                      <span className="text-sm text-slate-400 font-medium group-hover:text-slate-300">Ask the AI Judge</span>
                    </div>
                  </div>
                </button>
              </motion.div>
            )}

            {/* VIEW: SCANNER */}
            {view === 'scan' && (
              <motion.div 
                key="scan"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center h-full px-6"
              >
                <div className="w-full aspect-square bg-black rounded-[2.5rem] overflow-hidden relative shadow-2xl shadow-slate-200 border-4 border-white ring-1 ring-slate-100">
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
                      <span className="font-bold text-sm tracking-widest">SCANNING...</span>
                    </div>
                  )}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.8)] animate-[scan_2s_infinite_linear]" />
                    <div className="absolute inset-0 border-[40px] border-black/40" />
                  </div>
                </div>
                <p className="mt-8 text-slate-500 text-sm font-bold text-center max-w-[200px]">Align barcode within the frame</p>
                <button 
                  onClick={() => setView('home')} 
                  className="mt-auto mb-8 px-8 py-4 bg-white border border-slate-200 rounded-full text-slate-600 font-bold hover:bg-slate-50 transition shadow-lg shadow-slate-100"
                >
                  Cancel Scan
                </button>
              </motion.div>
            )}

            {/* VIEW: CONFIRMATION */}
            {view === 'confirm' && productData && (
              <motion.div 
                key="confirm"
                initial={{ opacity: 0, scale: 0.8, rotateY: 90 }}
                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", damping: 20 }}
                className="absolute inset-0 flex flex-col px-6 pb-6"
              >
                <div className="bg-white p-2 rounded-[2rem] border border-slate-200 shadow-2xl shadow-blue-100 relative overflow-hidden flex-1 flex flex-col">
                  <div className="bg-slate-50 p-4 rounded-[1.5rem] h-full relative z-10 border border-slate-100 flex flex-col">
                    <h2 className="text-xl font-black text-slate-800 uppercase truncate mb-4">{productData.product_name}</h2>
                    <div className="bg-white p-4 rounded-2xl shadow-inner border border-slate-100 mb-4 relative group flex-1">
                      <div className="flex items-center justify-center overflow-hidden h-full">
                         <img src={productData.image_url} alt="Product" className="w-full h-full object-contain relative z-10" />
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm shrink-0">
                      <div className="font-bold text-slate-400 mb-1 block uppercase text-[10px] tracking-widest">Brand</div>
                      <p className="text-slate-800 font-bold text-lg">{productData.brands || 'Unknown'}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 mt-4 shrink-0">
                  <button onClick={() => setView('scan')} className="flex-1 py-4 bg-white border-b-4 border-slate-200 text-slate-600 rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-wider transition-all active:border-b-0 active:translate-y-[4px] shadow-lg">Cancel</button>
                  <button onClick={analyzeWithLLM} className="flex-1 py-4 bg-blue-600 border-b-4 border-blue-800 text-white rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-wider transition-all active:border-b-0 active:translate-y-[4px] shadow-lg">Judge It</button>
                </div>
              </motion.div>
            )}

            {/* VIEW: ANALYZING */}
            {view === 'analyzing' && (
              <motion.div 
                key="analyzing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-full px-6"
              >
                <div className="text-8xl animate-bounce mb-8">⚖️</div>
                <h2 className="text-3xl font-black text-slate-900 mb-2 text-center">The Council<br/>is Deciding</h2>
              </motion.div>
            )}

            {/* VIEW: RESULT CARD */}
            {view === 'result_card' && productData && analysis && (
              <motion.div 
                key="result_card"
                initial={{ opacity: 0, scale: 0.8, rotateY: -90 }}
                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", damping: 20 }}
                className="absolute inset-0 flex flex-col"
              >
                <div className="flex-1 overflow-y-auto no-scrollbar pb-32 px-6">
                  
                  {/* Card */}
                  <div className={`bg-white p-[6px] rounded-[2rem] border-[4px] shadow-2xl relative mt-2 mb-6 ${
                    ['F','D'].includes(analysis.grade) ? 'border-red-500 shadow-red-100' : 
                    ['C'].includes(analysis.grade) ? 'border-yellow-400 shadow-yellow-100' :
                    'border-green-500 shadow-green-100'
                  }`}>
                    <div className="bg-slate-50 p-5 rounded-[1.5rem] relative z-10 flex flex-col border border-slate-100">
                      <div className="flex justify-between items-start mb-4">
                        <h2 className="text-xl font-black text-slate-800 uppercase truncate pr-2 leading-tight flex-1">{productData.product_name}</h2>
                        <div className="flex flex-col items-end">
                          <span className={`text-4xl font-black leading-none ${['F','D'].includes(analysis.grade) ? 'text-red-500' : ['C'].includes(analysis.grade) ? 'text-yellow-500' : 'text-green-500'}`}>{analysis.grade}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Grade</span>
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6">
                        <div className="flex items-center justify-center overflow-hidden h-40">
                          <img src={productData.image_url} alt="Product" className="w-full h-full object-contain relative z-10" />
                        </div>
                      </div>
                      <div className="mb-6">
                        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-2">The Verdict</h3>
                        <p className="text-sm text-slate-700 leading-relaxed font-medium">{analysis.reasoning}</p>
                      </div>
                      {analysis.health_risks && analysis.health_risks.length > 0 && (
                        <div>
                          <h3 className="font-bold text-xs uppercase tracking-wider text-red-400 mb-2 flex items-center gap-1"><AlertTriangle size={12} /> Health Risks</h3>
                          <div className="space-y-2">
                            {analysis.health_risks.map((risk, i) => (
                              <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                <span className="text-xs text-slate-600 font-bold">{risk}</span>
                                <span className="text-[10px] font-black text-red-400 bg-red-50 px-2 py-1 rounded-full">-10 HP</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Topic Selection Grid - Fixed Colors */}
                  <div className="mb-24">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-4 px-2">Deep Dive Analysis</h3>
                    <div className="grid grid-cols-2 gap-3 px-1">
                      {[
                        { id: 'nutrition', label: 'Nutrition', icon: '📊' },
                        { id: 'health', label: 'Health Risks', icon: '⚠️' },
                        { id: 'ingredients', label: 'Ingredients', icon: '🌿' },
                        { id: 'alternatives', label: 'Alternatives', icon: '🥗' }
                      ].map((topic) => {
                        const points = getTopicPreview(topic.id);
                        const conf = topicConfig[topic.id]; // Access safe classes

                        return (
                          <button
                            key={topic.id}
                            onClick={() => { setSelectedTopic(topic.id); setView('chat'); }}
                            className={`
                              relative p-4 rounded-[1.5rem] border text-left transition-all duration-200
                              flex flex-col h-full bg-white border-slate-100 shadow-sm
                              active:scale-[0.98] ${conf.active}
                            `}
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-lg">{topic.icon}</span>
                              <span className="font-black text-slate-800 text-sm tracking-tight">{topic.label}</span>
                            </div>
                            <div className="space-y-2 mb-4 flex-1">
                              {points.map((point, idx) => (
                                <div key={idx} className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${conf.dot} shrink-0`} />
                                  <span className="text-xs text-slate-500 font-medium leading-tight truncate">{point}</span>
                                </div>
                              ))}
                            </div>
                            <div className={`mt-auto w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-center ${conf.pill}`}>
                              Read More
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Floating Chat Button */}
                <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent z-20 max-w-md mx-auto">
                  <button 
                    onClick={() => setView('chat')} 
                    className="w-full py-4 bg-slate-900 border-b-[6px] border-black text-white rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-wider transition-all active:border-b-0 active:translate-y-[6px] shadow-xl hover:bg-slate-800"
                  >
                    <MessageCircle size={24} strokeWidth={3} /> Chat More
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
                className="absolute inset-0 flex flex-col h-full overflow-hidden bg-slate-50"
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