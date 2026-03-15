import React from 'react';
import { motion } from 'motion/react';
import { Book, Image as ImageIcon, Heart, Globe, Lock } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  resetView: () => void;
}

export default function BottomNav({ activeTab, setActiveTab, resetView }: BottomNavProps) {
  const tabs = [
    { id: 'logs', icon: Book, label: 'Logs' },
    { id: 'vault', icon: Lock, label: 'Vault' },
    { id: 'home', icon: Globe, label: 'Home', isCenter: true },
    { id: 'gallery', icon: ImageIcon, label: 'Gallery' },
    { id: 'core', icon: Heart, label: 'Core' },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-md">
      <div className="flex items-center justify-between px-6 py-3 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          if (tab.isCenter) {
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  resetView();
                }}
                className="relative -mt-8 flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-gray-300 to-orange-500 shadow-[0_0_20px_rgba(255,140,0,0.4)] border-2 border-white/20"
              >
                <Icon className="w-8 h-8 text-white" />
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center w-12 h-12 transition-colors ${
                isActive ? 'text-orange-400' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.id === 'core' ? (
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                >
                  <Icon className="w-6 h-6" />
                </motion.div>
              ) : (
                <Icon className="w-6 h-6" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
