import React from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Award, 
  Code2, 
  Heart,
  MessageSquare,
  ShieldCheck,
  Zap,
  Github,
  Linkedin
} from 'lucide-react';
import { useConfig } from '../context/ConfigContext';

export default function About() {
  const { companyName } = useConfig();
  
  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex p-4 bg-blue-600/10 rounded-3xl dark:bg-blue-900/20 mb-4 ring-1 ring-blue-600/20">
          <Zap className="w-12 h-12 text-blue-600" />
        </div>
        <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
          About {companyName}
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
          The ultimate inventory and sales command center for modern steel fabrication businesses. 
          Built for speed, accuracy, and sustainable growth.
        </p>
      </div>

      {/* Philosophy Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { title: 'Efficiency', icon: Zap, desc: 'Optimized workflows to save hours on bookkeeping and stock taking.', color: 'text-amber-500' },
          { title: 'Security', icon: ShieldCheck, desc: 'Robust data management with automated backups and cloud synchronization.', color: 'text-green-500' },
          { title: 'Clarity', icon: MessageSquare, desc: 'Real-time analytics and reports to give you complete visibility of your business.', color: 'text-blue-500' }
        ].map((item, i) => (
          <div key={i} className="p-8 bg-theme-card rounded-3xl border border-theme-border shadow-xl hover:scale-[1.02] transition-all cursor-default">
            <div className="w-12 h-12 rounded-2xl bg-theme-bg flex items-center justify-center mb-6 border border-theme-border">
              <item.icon className={`w-6 h-6 ${item.color}`} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{item.title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Developer Profile Card */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2.5rem] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative bg-theme-card rounded-[2.5rem] border border-theme-border p-8 md:p-12 overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
            <Code2 className="w-64 h-64 rotate-12" />
          </div>
          
          <div className="flex flex-col md:flex-row gap-10 items-center md:items-start text-center md:text-left">
            <div className="relative shrink-0">
               <div className="w-40 h-40 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-6xl font-black shadow-2xl transform hover:rotate-6 transition-transform">
                MK
              </div>
              <div className="absolute -bottom-2 -right-2 bg-green-500 w-8 h-8 rounded-full border-4 border-theme-card shadow-lg flex items-center justify-center">
                 <Zap className="w-4 h-4 text-white fill-white" />
              </div>
            </div>

            <div className="flex-1 space-y-6">
              <div>
                <h4 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mb-2">Designed & Developed by</h4>
                <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">Masroor Khan</h2>
              </div>
              
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed max-w-xl">
                Dedicated to building high-performance digital tools that empower local industries. 
                With a focus on clean code, intuitive user experiences, and real-world business solutions that solve complex problems simply.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <a 
                  href="tel:+923331306603" 
                  className="flex items-center gap-3 p-4 bg-theme-bg rounded-2xl hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all border border-theme-border group/link active:scale-95 shadow-sm"
                  title="Place a direct phone call to Masroor Khan"
                >
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 transition-all group-hover/link:bg-blue-600 group-hover/link:text-white">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Call Directly</span>
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">+92 333-1306603</span>
                  </div>
                </a>
                <a 
                  href="mailto:kmasroor50@gmail.com" 
                  className="flex items-center gap-3 p-4 bg-theme-bg rounded-2xl hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all border border-theme-border group/link active:scale-95 shadow-sm"
                  title="Send an email to kmasroor50@gmail.com"
                >
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 transition-all group-hover/link:bg-indigo-600 group-hover/link:text-white">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Email Inquiry</span>
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">kmasroor50@gmail.com</span>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="h-px w-24 bg-theme-border"></div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center justify-center gap-2">
          Handcrafted with <Heart className="w-3 h-3 text-red-500 fill-red-500 animate-pulse" /> in Pakistan
        </p>
      </div>
    </div>
  );
}
