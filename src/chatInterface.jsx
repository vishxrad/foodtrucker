import React, { useState, useEffect, useRef } from 'react';
import { Send, Image as ImageIcon, Loader, ChevronLeft, Bot, Sparkles, Zap, Skull, ShieldCheck, Sword } from 'lucide-react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { openai } from './openaiClient';

// --- GAMIFIED VERDICT CARD ---
const VerdictCard = ({ data, analysis }) => {
  const grade = analysis.grade;
  const isDeadly = ['F', 'D'].includes(grade);
  const isMid = ['C'].includes(grade);
  
  // Dynamic Styles based on "Health"
  const theme = isDeadly 
    ? { bg: 'bg-red-500', light: 'bg-red-50', text: 'text-red-600', border: 'border-red-500', icon: <Skull size={20} /> }
    : isMid 
      ? { bg: 'bg-yellow-400', light: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-400', icon: <ShieldCheck size={20} /> }
      : { bg: 'bg-green-500', light: 'bg-green-50', text: 'text-green-600', border: 'border-green-500', icon: <Sparkles size={20} /> };

  const sugar = data.nutriments['sugars_100g'] || 0;
  const protein = data.nutriments['proteins_100g'] || 0;
  const additives = data.additives_tags?.length || 0;

  return (
    <div className="bg-white rounded-[1.5rem] border-2 border-black border-b-[6px] shadow-sm overflow-hidden w-full max-w-sm mb-4 relative">
      {/* HEADER */}
      <div className={`${theme.bg} p-4 flex justify-between items-center border-b-2 border-black`}>
        <div className="text-white">
          <h3 className="text-xs font-black uppercase tracking-widest opacity-80 mb-1">Item Appraisal</h3>
          <div className="font-bold text-sm leading-tight pr-4 text-black mix-blend-multiply">
            "{analysis.reasoning}"
          </div>
        </div>
        <div className="w-16 h-16 bg-white border-2 border-black rounded-xl flex flex-col items-center justify-center shrink-0 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
          <span className={`text-4xl font-black ${theme.text}`}>{grade}</span>
        </div>
      </div>

      {/* STATS AREA */}
      <div className="p-4 space-y-4">
        
        {/* CHECKLIST */}
        <div className="bg-slate-50 rounded-xl border border-black p-3 space-y-2">
           <div className="flex justify-between items-center border-b border-dashed border-slate-300 pb-2 mb-2">
              <span className="text-xs font-black uppercase text-slate-400">Stat Check</span>
              <span className="text-[10px] bg-black text-white px-2 rounded-full">LVL 1</span>
           </div>
           
           {/* Row 1: Sugar */}
           <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                 <div className={`w-4 h-4 rounded border border-black ${sugar > 10 ? 'bg-red-500' : 'bg-green-500'}`} />
                 <span className="font-bold text-xs uppercase">Sugar Lvl</span>
              </div>
              <span className="font-mono text-xs">{Math.round(sugar)}g</span>
           </div>

           {/* Row 2: Additives */}
           <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                 <div className={`w-4 h-4 rounded border border-black ${additives > 1 ? 'bg-red-500' : 'bg-green-500'}`} />
                 <span className="font-bold text-xs uppercase">Chemicals</span>
              </div>
              <span className="font-mono text-xs">{additives} detected</span>
           </div>
        </div>

        {/* BARS */}
        <div>
           <div className="flex justify-between text-[10px] font-black uppercase mb-1">
              <span>Energy Composition</span>
           </div>
           <div className="flex h-4 w-full rounded-full overflow-hidden border-2 border-black">
             <div className="bg-yellow-400 border-r-2 border-black" style={{ width: `${Math.min((sugar / 30) * 100, 100)}%` }} /> 
             <div className="bg-blue-500 border-r-2 border-black" style={{ width: `${Math.min((protein / 30) * 100, 100)}%` }} /> 
             <div className="bg-slate-200 flex-1" /> 
           </div>
           <div className="flex gap-3 mt-2 text-[10px] font-bold uppercase">
              <div className="flex items-center gap-1"><div className="w-2 h-2 bg-yellow-400 rounded-full border border-black"/>Sugar</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-500 rounded-full border border-black"/>Protein</div>
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