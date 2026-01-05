import React, { useState, useEffect, useRef } from 'react';
import { Send, Image as ImageIcon, Loader, ChevronLeft, Bot, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { openai } from './openaiClient';

const VerdictCard = ({ data, analysis }) => {
  const isBad = ['C', 'D', 'F'].includes(analysis.grade);
  const color = isBad ? 'red' : analysis.grade === 'S' ? 'blue' : 'emerald';
  
  const sugar = data.nutriments['sugars_100g'] || 0;
  const protein = data.nutriments['proteins_100g'] || 0;
  const additives = data.additives_tags?.length || 0;

  const checks = [
    { label: 'Sugar Level', status: sugar > 10 ? 'fail' : 'pass', val: `${Math.round(sugar)}g` },
    { label: 'Additives', status: additives > 1 ? 'fail' : 'pass', val: `${additives} found` },
    { label: 'Protein', status: protein > 5 ? 'pass' : 'neutral', val: `${Math.round(protein)}g` },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden w-full max-w-sm mb-2">
      <div className={`bg-${color}-50 p-4 flex justify-between items-center border-b border-${color}-100`}>
        <div>
          <h3 className={`text-xs font-black uppercase tracking-widest text-${color}-600 mb-1`}>Final Verdict</h3>
          <div className="font-bold text-slate-700 text-sm leading-tight pr-4">
            {analysis.reasoning}
          </div>
        </div>
        <div className={`text-4xl font-black text-${color}-500 shadow-sm bg-white w-14 h-14 rounded-xl flex items-center justify-center shrink-0`}>
          {analysis.grade}
        </div>
      </div>

      <div className="p-4 space-y-3">
        <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Decision Logic</h4>
        {checks.map((check, i) => (
          <div key={i} className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              {check.status === 'pass' && <div className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">✓</div>}
              {check.status === 'fail' && <div className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs">✕</div>}
              {check.status === 'neutral' && <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xs">-</div>}
              <span className="font-medium text-slate-700">{check.label}</span>
            </div>
            <span className="font-bold text-slate-400 text-xs">{check.val}</span>
          </div>
        ))}
      </div>

      <div className="px-4 pb-4">
         <div className="flex h-2 w-full rounded-full overflow-hidden">
           <div className="bg-yellow-400" style={{ width: `${Math.min((sugar / 30) * 100, 100)}%` }} /> 
           <div className="bg-blue-500" style={{ width: `${Math.min((protein / 30) * 100, 100)}%` }} /> 
           <div className="bg-slate-200 flex-1" /> 
         </div>
         <div className="flex justify-between mt-1 text-[10px] font-bold text-slate-400 uppercase">
            <span className="text-yellow-500">Sugar</span>
            <span className="text-blue-500">Protein</span>
            <span>Other</span>
         </div>
      </div>
    </div>
  );
};

const ChatInterface = ({ productData, analysis, onReset, initialTopic }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const hasFetchedTopic = useRef(false);

  useEffect(() => {
    if (productData && analysis && !hasFetchedTopic.current) {
      const introMsg = {
          role: 'assistant',
          type: 'visual_verdict', 
          data: productData,
          analysis: analysis
      };

      if (initialTopic) {
        hasFetchedTopic.current = true;
        const topicPrompts = {
            'nutrition': "Analyze the nutritional values (macros, calories) in detail.",
            'health': "What are the specific health risks, additives, or harmful ingredients?",
            'ingredients': "Analyze the ingredient quality and origin.",
            'alternatives': "Suggest healthier alternatives to this product."
        };
        
        const userPrompt = topicPrompts[initialTopic] || `Tell me about ${initialTopic}`;
        
        const initialMsgs = [
            introMsg,
            { role: 'user', content: userPrompt } 
        ];
        
        // FIXED: Removed duplicate setMessages call here
        setMessages(initialMsgs);
        setIsTyping(true);

        (async () => {
            try {
                const systemContext = `Current Product Context: ${JSON.stringify(productData.nutriments)}. Analysis: ${JSON.stringify(analysis)}. Focus on health impacts. The user is specifically interested in ${initialTopic}.`;
                const apiMessages = [{ role: "system", content: systemContext }, ...initialMsgs];
                
                const completion = await openai.chat.completions.create({
                    model: "zai-org/GLM-4.5-Air",
                    messages: apiMessages,
                });
                const aiResponse = completion.choices[0].message.content;
                setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
            } catch (e) {
                console.error(e);
                setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble analyzing that specific topic right now." }]);
            } finally {
                setIsTyping(false);
            }
        })();

      } else {
        setMessages([{ ...introMsg, content: introMsg.content + "\n\nAsk me about side effects, allergies, or healthier alternatives." }]);
      }
    } else if (!productData) {
      setMessages([{
          role: 'assistant',
          content: "I am **NutriJudge**. Upload a photo of food or ask me anything. I'll tell you if it's garbage or gold."
      }]);
    }
  }, [productData, analysis, initialTopic]);

  useEffect(() => {
    // block: "nearest" is less aggressive than default, preventing the whole page from jumping
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
        ? `CONTEXT: User is asking about ${productData.product_name}. NUTRITION DATA: ${JSON.stringify(productData.nutriments)}. VERDICT: ${JSON.stringify(analysis)}. PERSONA: Blunt food critic. Short answers. No fluff.`
        : `CONTEXT: User uploaded food image. PERSONA: Identify food, estimate calories, grade it (S-F). Short, confident.`;

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
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: "My brain hurts. (API Error)" }]);
    }
    setIsTyping(false);
  };

  const sendQuickPrompt = (prompt) => handleSend(prompt);

  const MarkdownComponents = {
    p: ({node, ...props}) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
    strong: ({node, ...props}) => <span className="font-bold text-slate-900" {...props} />,
    ul: ({node, ...props}) => <ul className="list-disc list-outside ml-4 mb-2 space-y-1" {...props} />,
    ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-4 mb-2 space-y-1" {...props} />,
    li: ({node, ...props}) => <li className="pl-1" {...props} />,
    h1: ({node, ...props}) => <h1 className="text-lg font-bold mb-2 text-slate-900 mt-2" {...props} />,
    h2: ({node, ...props}) => <h2 className="text-base font-bold mb-2 text-slate-900 mt-2" {...props} />,
    blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-blue-200 bg-blue-50 py-2 px-3 my-2 rounded-r italic text-slate-600" {...props} />,
    table: ({node, ...props}) => <div className="overflow-x-auto my-3 rounded-lg border border-slate-200"><table className="min-w-full text-xs" {...props} /></div>,
    th: ({node, ...props}) => <th className="bg-slate-100 px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200" {...props} />,
    td: ({node, ...props}) => <td className="px-3 py-2 border-b border-slate-100 text-slate-600" {...props} />,
  };

  return (
    // FIXED: Added w-full to ensure explicit width
    <div className="flex flex-col h-full w-full bg-slate-50 font-sans text-slate-800 overflow-hidden">
      
      {/* HEADER */}
      <div className="shrink-0 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 z-10 flex items-center px-4 justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onReset} className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition active:scale-95 text-slate-600">
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col">
            <span className="font-bold text-slate-800 text-lg leading-none flex items-center gap-2">
              NutriJudge <Sparkles size={14} className="text-blue-500" />
            </span>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">
              Personal Dietician
            </span>
          </div>
        </div>
      </div>

      {/* MESSAGES AREA */}
      {/* FIXED: Added min-h-0 to force scrollbar inside this flex-1 item */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6 scroll-smooth overscroll-contain">
        {messages.map((msg, idx) => {
           const isUser = msg.role === 'user';

           if (msg.type === 'visual_verdict') {
             return (
               <motion.div 
                 key={idx}
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="flex justify-start mb-4"
               >
                 <div className="flex items-end gap-2 max-w-full w-full">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-sm text-white mb-1">
                       <Bot size={16} />
                    </div>
                    <VerdictCard data={msg.data} analysis={msg.analysis} />
                 </div>
               </motion.div>
             );
           }

           return (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3 }}
              key={idx} 
              className={`flex ${isUser ? 'justify-end' : 'justify-start items-end gap-2'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-sm text-white mb-1">
                  <Bot size={16} />
                </div>
              )}

              <div className={`max-w-[85%] md:max-w-[75%] p-3.5 shadow-sm ${
                isUser 
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl rounded-tr-sm' 
                  : 'bg-white text-slate-700 rounded-2xl rounded-tl-sm border border-slate-100'
              }`}>
                {msg.image && (
                  <div className="mb-3 rounded-xl overflow-hidden bg-black/5 relative">
                    <img src={msg.image} alt="upload" className="w-full max-h-60 object-cover" />
                  </div>
                )}
                <div className={`text-[15px] ${isUser ? 'text-blue-50' : ''}`}>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start items-end gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-sm text-white mb-1">
               <Bot size={16} />
            </div>
            <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm border border-slate-100 shadow-sm">
              <div className="flex gap-1.5">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}/>
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}/>
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}/>
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* INPUT AREA */}
      <div className="shrink-0 bg-white/90 backdrop-blur-md border-t border-slate-100 pb-safe">        
        <div className="pt-3 px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar mask-linear-fade">
          {['🤰 Pregnant safe?', '🤧 Allergens?', '💪 Protein?', '🥬 Vegan?'].map((chip) => (
            <button 
              key={chip} 
              onClick={() => sendQuickPrompt(chip)}
              className="whitespace-nowrap bg-white border border-slate-200 px-3 py-1.5 rounded-full text-xs font-bold text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition active:scale-95 shadow-sm"
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="p-3 flex items-end gap-2 max-w-4xl mx-auto w-full">
          {!productData && (
            <label className="mb-1 p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition cursor-pointer flex-shrink-0">
              <ImageIcon size={24} />
              <input 
                type="file" 
                accept="image/*" 
                className="hidden"
                onChange={(e) => e.target.files[0] && handleSend(null, e.target.files[0])}
              />
            </label>
          )}

          <div className="flex-1 bg-slate-100 rounded-[24px] flex items-center border border-transparent focus-within:border-blue-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all overflow-hidden">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if(e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask a question..."
              rows={1}
              className="w-full bg-transparent px-4 py-3.5 max-h-32 focus:outline-none text-slate-800 placeholder-slate-400 resize-none text-[15px]"
              style={{ minHeight: '48px' }}
            />
          </div>

          <button 
            onClick={() => handleSend()} 
            disabled={!input.trim() && !isTyping}
            className="mb-1 p-3 bg-blue-600 rounded-full text-white shadow-lg shadow-blue-200 hover:bg-blue-500 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed transition active:scale-90 flex-shrink-0"
          >
            {isTyping ? <Loader className="animate-spin" size={20}/> : <Send size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;