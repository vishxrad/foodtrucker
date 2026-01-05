import React, { useState, useEffect, useRef } from 'react';
import { Send, Image as ImageIcon, Loader, ChevronLeft, Bot, Sparkles, Zap, Skull, ShieldCheck, Sword, Flame, Droplets, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { openai } from './openaiClient';

// --- GAMIFIED VERDICT CARD ---
const VerdictCard = ({ data, analysis }) => {
  const grade = analysis.grade;
  const isDeadly = ['F', 'D'].includes(grade);
  const isMid = ['C'].includes(grade);
  
  // --- DATA EXTRACTION ---
  const n = data.nutriments;
  const sugar = n['sugars_100g'] || 0;
  const protein = n['proteins_100g'] || 0;
  const fat = n['fat_100g'] || 0;
  const carbs = n['carbohydrates_100g'] || 0;
  const sodium = n['sodium_100g'] || 0; // In grams
  const calories = Math.round(n['energy-kcal_100g'] || 0);
  const additives = data.additives_tags?.length || 0;

  // --- THEME LOGIC ---
  const theme = isDeadly 
    ? { bg: 'bg-red-500', text: 'text-red-600', border: 'border-red-500', icon: <Skull size={24} /> }
    : isMid 
      ? { bg: 'bg-[#FFD028]', text: 'text-yellow-800', border: 'border-[#FFD028]', icon: <ShieldCheck size={24} /> }
      : { bg: 'bg-[#00E054]', text: 'text-green-800', border: 'border-[#00E054]', icon: <Sparkles size={24} /> };

  // --- MACRO BAR CALCULATION ---
  // We normalize to 100% based on the sum of macros + water/fiber (approx 100g)
  const totalMass = 100; 
  const p_perc = Math.min((protein / totalMass) * 100, 100);
  const f_perc = Math.min((fat / totalMass) * 100, 100);
  const c_perc = Math.min((carbs / totalMass) * 100, 100);
  // The remaining % is Water/Fiber (The new "Grey Space", but smaller and labeled)

  return (
    <div className="bg-white rounded-[1.5rem] border-2 border-black border-b-[6px] shadow-sm overflow-hidden w-full max-w-sm mb-4 relative font-sans">
      
      {/* 1. HEADER CARD */}
      <div className={`${theme.bg} p-4 flex justify-between items-start border-b-2 border-black relative overflow-hidden`}>
        {/* Decorative Pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
        
        <div className="relative z-10 pr-2 flex-1">
          <div className="flex flex-wrap items-center gap-1 mb-1">
             {isDeadly && <div className="bg-black text-white text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">Junk</div>}
             {additives > 2 && <div className="bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded uppercase animate-pulse">☣ Toxic</div>}
             {!isDeadly && additives <= 2 && <div className="bg-black text-white text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">Item Appraisal</div>}
          </div>
          <h3 className="font-black text-lg leading-tight text-black mix-blend-multiply uppercase italic mb-1">
            {data.product_name || 'Unknown Product'}
          </h3>
          <div className="text-xs font-bold text-black/70 leading-tight">
            {analysis.reasoning}
          </div>
        </div>

        <div className="relative z-10 w-14 h-14 bg-white border-2 border-black rounded-xl flex flex-col items-center justify-center shrink-0 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] ml-2">
          <span className={`text-4xl font-black ${theme.text}`}>{grade}</span>
        </div>
      </div>

      {/* 2. MAIN STATS GRID */}
      <div className="p-4 grid grid-cols-2 gap-3">
        
        {/* XP / Calories */}
        <div className="bg-slate-50 border border-black rounded-xl p-2 flex items-center justify-between">
           <div className="flex items-center gap-2">
              <div className="p-1.5 bg-orange-100 text-orange-600 rounded-lg border border-orange-200"><Flame size={14} strokeWidth={3}/></div>
              <span className="text-[10px] font-black uppercase text-slate-500">Energy</span>
           </div>
           <span className="font-black text-sm text-slate-900">{calories} <span className="text-[10px] text-slate-400">XP</span></span>
        </div>

        {/* Sodium */}
        <div className="bg-slate-50 border border-black rounded-xl p-2 flex items-center justify-between">
           <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg border border-blue-200"><Droplets size={14} strokeWidth={3}/></div>
              <span className="text-[10px] font-black uppercase text-slate-500">Salt</span>
           </div>
           <span className={`font-black text-sm ${sodium > 0.5 ? 'text-red-500' : 'text-slate-900'}`}>
             {sodium * 1000 < 1000 ? `${Math.round(sodium*1000)}mg` : `${sodium}g`}
           </span>
        </div>

        {/* Sugar */}
        <div className="bg-slate-50 border border-black rounded-xl p-2 flex items-center justify-between">
           <div className="flex items-center gap-2">
              <div className="p-1.5 bg-yellow-100 text-yellow-600 rounded-lg border border-yellow-200"><Zap size={14} strokeWidth={3}/></div>
              <span className="text-[10px] font-black uppercase text-slate-500">Sugar</span>
           </div>
           <span className={`font-black text-sm ${sugar > 10 ? 'text-red-500' : 'text-slate-900'}`}>{Math.round(sugar)}g</span>
        </div>

        {/* Chemicals */}
        <div className="bg-slate-50 border border-black rounded-xl p-2 flex items-center justify-between">
           <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg border border-purple-200"><Activity size={14} strokeWidth={3}/></div>
              <span className="text-[10px] font-black uppercase text-slate-500">Additives</span>
           </div>
           <span className="font-black text-sm text-slate-900">{additives}</span>
        </div>
      </div>

      {/* 3. MACRO SPLIT BAR (The "Grey Space" Fix) */}
      <div className="px-4 pb-4">
         <div className="flex justify-between items-end mb-2">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Composition Build</span>
         </div>
         
         {/* The Stacked Bar */}
         <div className="flex h-5 w-full rounded-full overflow-hidden border-2 border-black bg-slate-100 relative">
           {/* Carbs */}
           <div className="bg-[#FFD028] h-full border-r-2 border-black relative group" style={{ width: `${c_perc}%` }} />
           {/* Fat */}
           <div className="bg-[#FF90E8] h-full border-r-2 border-black relative group" style={{ width: `${f_perc}%` }} />
           {/* Protein */}
           <div className="bg-[#5865F2] h-full border-r-2 border-black relative group" style={{ width: `${p_perc}%` }} />
         </div>

         {/* Legend */}
         <div className="flex gap-4 mt-2 justify-center">
            <div className="flex items-center gap-1.5">
               <div className="w-2.5 h-2.5 bg-[#FFD028] rounded border border-black" />
               <span className="text-[10px] font-bold uppercase text-slate-600">Carbs</span>
            </div>
            <div className="flex items-center gap-1.5">
               <div className="w-2.5 h-2.5 bg-[#FF90E8] rounded border border-black" />
               <span className="text-[10px] font-bold uppercase text-slate-600">Fat</span>
            </div>
            <div className="flex items-center gap-1.5">
               <div className="w-2.5 h-2.5 bg-[#5865F2] rounded border border-black" />
               <span className="text-[10px] font-bold uppercase text-slate-600">Prot</span>
            </div>
            <div className="flex items-center gap-1.5">
               <div className="w-2.5 h-2.5 bg-[#FFFFFF] rounded border border-black" />
               <span className="text-[10px] font-bold uppercase text-slate-600">Others</span>
            </div>
         </div>
      </div>

    </div>
  );
};

// --- MAIN CHAT COMPONENT ---
const ChatInterface = ({ productData, analysis, onReset, initialTopic }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const hasFetchedTopic = useRef(false);

  // Background pattern for the "Screen" look
  const ScreenPattern = () => (
    <div className="absolute inset-0 z-0 opacity-5 pointer-events-none" 
      style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} 
    />
  );

  useEffect(() => {
    if (productData && analysis && !hasFetchedTopic.current) {
      // 1. Define the Card Message
      const introMsg = {
          role: 'assistant',
          type: 'visual_verdict', 
          data: productData,
          analysis: analysis
      };

      if (initialTopic) {
        hasFetchedTopic.current = true;
        
        // 2. Short, punchy prompts for the topics
        const topicPrompts = {
            'nutrition': "Briefly list the macro stats.",
            'health': "List the top 2 health risks.",
            'ingredients': "What is the main ingredient quality?",
            'alternatives': "Name 1 healthier option."
        };
        
        const userPrompt = topicPrompts[initialTopic] || `Summarize ${initialTopic}`;
        
        // Set initial state with the card + the user's question
        const initialMsgs = [introMsg, { role: 'user', content: userPrompt }];
        setMessages(initialMsgs);
        setIsTyping(true);

        (async () => {
            try {
                // 3. THE FIX: Strict System Constraints for brevity
                const systemContext = `
                  CONTEXT: ${JSON.stringify(productData.nutriments)}. 
                  ANALYSIS: ${JSON.stringify(analysis)}. 
                  TOPIC: ${initialTopic}.
                  
                  CRITICAL RULE: Keep response UNDER 100 WORDS. 
                  Format: 2-3 short bullet points. 
                  Tone: Robotic/Gaming HUD style. No intro/outro.
                `;

                const apiMessages = [{ role: "system", content: systemContext }, ...initialMsgs];
                
                const completion = await openai.chat.completions.create({
                    model: "zai-org/GLM-4.5-Air",
                    messages: apiMessages,
                });
                const aiResponse = completion.choices[0].message.content;
                setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
            } catch (e) {
                console.error(e);
                setMessages(prev => [...prev, { role: 'assistant', content: "Link unstable." }]);
            } finally {
                setIsTyping(false);
            }
        })();

      } else {
        // 4. THE FIX: Default scan greeting (No topic selected)
        // Instead of appending text to the card (which broke before), we add a separate tiny message.
        setMessages([
          introMsg, 
          { role: 'assistant', content: "Analysis complete. Select a stat to view details." }
        ]);
      }
    } else if (!productData) {
      // 5. THE FIX: Shorter Home Greeting
      setMessages([{
          role: 'assistant',
          content: "Oracle Online. Scan target to begin."
      }]);
    }
  }, [productData, analysis, initialTopic]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, isTyping]);

  const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });

  const handleSend = async (textOverride = null, imageFile = null) => {
    const textToSend = textOverride || input;
    if (!textToSend && !imageFile) return;

    const newUserMsg = { 
      role: 'user', 
      content: textToSend, 
      image: imageFile ? URL.createObjectURL(imageFile) : null 
    };
    
    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const systemContext = productData 
        ? `CONTEXT: User is asking about ${productData.product_name}. VERDICT: The following but without jargon and reducing cognitive load: ${JSON.stringify(analysis)}. PERSONA: Video game guide / sassy robot / helpful copilot. Use gaming terms (buff, nerf, xp, stats) where appropriate. Short answers.`
        : `CONTEXT: User uploaded food image. PERSONA: Identify food, grade it (S-F). Gaming terminology.`;

      const apiMessages = [
        { role: "system", content: systemContext },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ];

      if (imageFile) {
        const base64Image = await toBase64(imageFile);
        apiMessages.push({
          role: "user",
          content: [
            { type: "text", text: "Analyze this image for nutritional value and grade it." },
            { type: "image_url", image_url: { url: base64Image } }
          ]
        });
      } else {
        apiMessages.push({ role: "user", content: textToSend });
      }

      const modelToUse = imageFile ? "Qwen/Qwen2.5-VL-72B-Instruct" : "moonshotai/Kimi-K2-Instruct"; 
      const completion = await openai.chat.completions.create({ model: modelToUse, messages: apiMessages });
      const aiResponse = completion.choices[0].message.content;
      
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);

    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "CRITICAL FAILURE. API DOWN." }]);
    }
    setIsTyping(false);
  };

  const MarkdownComponents = {
    p: ({node, ...props}) => <p className="mb-2 last:mb-0 leading-relaxed text-sm font-medium" {...props} />,
    strong: ({node, ...props}) => <span className="font-black text-black bg-yellow-200 px-1 rounded-sm border border-black border-b-2 text-xs" {...props} />,
    ul: ({node, ...props}) => <ul className="list-disc list-outside ml-4 mb-2 space-y-1" {...props} />,
    li: ({node, ...props}) => <li className="pl-1 marker:text-indigo-500" {...props} />,
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#F2F3F5] font-sans text-slate-900 overflow-hidden relative">
      <ScreenPattern />
      
      {/* HEADER - "DISCORD" STYLE */}
      <div className="shrink-0 h-16 bg-[#5865F2] border-b-4 border-black z-20 flex items-center px-4 justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={onReset} className="p-2 -ml-2 rounded-xl hover:bg-black/20 transition active:scale-90 text-white">
            <ChevronLeft size={28} strokeWidth={3} />
          </button>
          <div className="flex flex-col">
            <span className="font-black text-white text-xl uppercase italic tracking-tighter flex items-center gap-2">
              Oracle <span className="bg-black text-[#FFD028] text-[10px] px-1 py-0.5 rounded not-italic tracking-normal">BOT</span>
            </span>
            <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest mt-0.5">
              Online • Lvl 99
            </span>
          </div>
        </div>
        <div className="w-3 h-3 bg-green-400 rounded-full border-2 border-black animate-pulse shadow-[0_0_10px_#4ade80]" />
      </div>

      {/* MESSAGES AREA */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6 scroll-smooth z-10">
        {messages.map((msg, idx) => {
           const isUser = msg.role === 'user';

           if (msg.type === 'visual_verdict') {
             return (
               <motion.div 
                 key={idx}
                 initial={{ opacity: 0, scale: 0.9 }}
                 animate={{ opacity: 1, scale: 1 }}
                 className="flex justify-start mb-4 pl-2"
               >
                 <VerdictCard data={msg.data} analysis={msg.analysis} />
               </motion.div>
             );
           }

           return (
            <motion.div 
              initial={{ opacity: 0, x: isUser ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              key={idx} 
              className={`flex ${isUser ? 'justify-end' : 'justify-start items-end gap-3'}`}
            >
              {!isUser && (
                <div className="w-10 h-10 rounded-xl border-2 border-black bg-white flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-indigo-600 mb-2">
                  <Bot size={24} strokeWidth={2.5} />
                </div>
              )}

              <div className={`
                max-w-[85%] md:max-w-[75%] p-4 border-2 border-black relative
                ${isUser 
                  ? 'bg-indigo-600 text-white rounded-[1.5rem] rounded-tr-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' 
                  : 'bg-white text-slate-800 rounded-[1.5rem] rounded-tl-none shadow-[-4px_4px_0px_0px_rgba(0,0,0,0.1)]'
                }
              `}>
                {msg.image && (
                  <div className="mb-3 rounded-xl overflow-hidden border-2 border-black bg-black">
                    <img src={msg.image} alt="upload" className="w-full max-h-60 object-contain" />
                  </div>
                )}
                <div className="text-[15px]">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={MarkdownComponents}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            </motion.div>
          );
        })}

        {isTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start items-end gap-3">
             <div className="w-10 h-10 rounded-xl border-2 border-black bg-white flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-indigo-600 mb-2">
                  <Bot size={24} strokeWidth={2.5} />
            </div>
            <div className="bg-white px-4 py-3 rounded-[1.5rem] rounded-tl-none border-2 border-black shadow-sm">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: '0ms' }}/>
                <span className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: '150ms' }}/>
                <span className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: '300ms' }}/>
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* INPUT AREA - "CONSOLE" STYLE */}
      <div className="shrink-0 bg-white border-t-4 border-black pb-safe z-20">        
        <div className="pt-3 px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
          {['Safe?', 'Allergens?', 'Macros?', 'Vegan?'].map((chip) => (
            <button 
              key={chip} 
              onClick={() => handleSend(chip)}
              className="whitespace-nowrap bg-white border-2 border-black border-b-4 px-3 py-1.5 rounded-xl text-xs font-black uppercase text-slate-800 hover:bg-indigo-50 active:border-b-2 active:translate-y-[2px] transition-all"
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="p-3 flex items-end gap-2 max-w-4xl mx-auto w-full">
          {!productData && (
            <label className="mb-1 p-3 text-slate-800 bg-slate-100 border-2 border-black rounded-xl hover:bg-yellow-300 transition cursor-pointer flex-shrink-0 active:scale-95 shadow-[2px_2px_0px_0px_#000]">
              <ImageIcon size={20} />
              <input 
                type="file" 
                accept="image/*" 
                className="hidden"
                onChange={(e) => e.target.files[0] && handleSend(null, e.target.files[0])}
              />
            </label>
          )}

          <div className="flex-1 bg-slate-100 rounded-xl flex items-center border-2 border-black focus-within:ring-4 focus-within:ring-indigo-100 transition-all overflow-hidden shadow-inner">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if(e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type command..."
              rows={1}
              className="w-full bg-transparent px-4 py-3.5 max-h-32 focus:outline-none text-slate-800 placeholder-slate-400 resize-none text-[15px] font-medium font-mono"
              style={{ minHeight: '48px' }}
            />
          </div>

          <button 
            onClick={() => handleSend()} 
            disabled={!input.trim() && !isTyping}
            className="mb-1 p-3 bg-indigo-600 border-2 border-black border-b-4 rounded-xl text-white hover:bg-indigo-500 disabled:opacity-50 disabled:border-b-2 disabled:translate-y-[2px] disabled:cursor-not-allowed transition-all active:border-b-2 active:translate-y-[2px] flex-shrink-0"
          >
            {isTyping ? <Loader className="animate-spin" size={20}/> : <Send size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;