import React, { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, BookText, PieChart, Settings, Plus, Mic2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddRecordSheet } from "@/components/AddRecordSheet";
import { VoiceCommandSheet } from "@/components/VoiceCommandSheet";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
interface MobileLayoutProps {
  children: React.ReactNode;
}
export function MobileLayout({ children }: MobileLayoutProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = React.useState(false);
  const navItems = [
    { icon: Home, label: t('nav.home'), path: "/" },
    { icon: BookText, label: t('nav.ledgers'), path: "/ledgers" },
    { icon: null, label: "", path: null }, // Spacer for FAB
    { icon: PieChart, label: t('nav.analytics'), path: "/analytics" },
    { icon: Settings, label: t('nav.settings'), path: "/settings" },
  ];

  // 当路由路径变化时，将窗口滚动到顶部
  useEffect(() => {
    // window.scrollTo(0, 0); // 瞬间回到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' }); // 或者平滑滚动到顶部
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <main className="flex-1 max-w-3xl mx-auto w-full pb-24 pt-2 md:pt-6 px-2 sm:px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 px-2 pb-safe md:pb-6 z-40 transition-all">
        <div className="max-w-md mx-auto flex items-center justify-around h-16 md:h-20">
          {navItems.map((item, i) => {
            if (!item.path) return <div key={i} className="w-12" />;
            const isActive = location.pathname === item.path;
            const Icon = item.icon!;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center space-y-1 w-14 transition-all active:scale-90",
                  isActive ? "text-[#E63946]" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
                <span className="text-[10px] font-bold">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:bottom-10 flex items-center gap-3">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsVoiceOpen(true)}
          className="bg-white text-slate-700 p-3 rounded-full shadow-lg shadow-slate-200 ring-2 ring-white border border-slate-100"
          aria-label="语音指令"
        >
          <Mic2 className="h-5 w-5" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsAddOpen(true)}
          className="bg-[#E63946] text-white p-4 rounded-full shadow-lg shadow-rose-500/30 ring-4 ring-white"
          aria-label="新增记录"
        >
          <Plus className="h-6 w-6" />
        </motion.button>
      </div>
      <AddRecordSheet open={isAddOpen} onOpenChange={setIsAddOpen} />
      <VoiceCommandSheet open={isVoiceOpen} onOpenChange={setIsVoiceOpen} />
    </div>
  );
}