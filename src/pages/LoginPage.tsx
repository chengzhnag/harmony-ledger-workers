import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api-client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Wallet, Loader2, ArrowRight, UserPlus, LogIn, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { translateApiError } from '@/lib/error-translator';

const createLoginSchema = (t: (key: string) => string) => z.object({
  email: z.string().email(t('login.emailError')),
  password: z.string().min(6, t('login.passwordError')),
});
const createRegisterSchema = (t: (key: string) => string) => createLoginSchema(t).extend({
  name: z.string().min(1, t('login.nameError')),
});
export function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const loginForm = useForm<z.infer<ReturnType<typeof createLoginSchema>>>({
    resolver: zodResolver(createLoginSchema(t)),
  });
  const registerForm = useForm<z.infer<ReturnType<typeof createRegisterSchema>>>({
    resolver: zodResolver(createRegisterSchema(t)),
  });
  type LoginValues = z.infer<ReturnType<typeof createLoginSchema>>;
  type RegisterValues = z.infer<ReturnType<typeof createRegisterSchema>>;
  const onLogin = async (data: LoginValues) => {
    setLoading(true);
    try {
      const res = await api<any>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      login(res);
      toast.success(t('login.welcomeBack'));
      setTimeout(() => {
        navigate('/');
      }, 500);
    } catch (err: unknown) {
      toast.error(translateApiError(err) || t('login.loginFailed'));
    } finally {
      setLoading(false);
    }
  };
  const onRegister = async (data: RegisterValues) => {
    setLoading(true);
    try {
      const res = await api<any>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      login(res);
      toast.success(t('login.registerSuccess'));
      navigate('/');
    } catch (err: unknown) {
      toast.error(translateApiError(err) || t('login.registerFailed'));
    } finally {
      setLoading(false);
    }
  };
  const handleForgotPassword = () => {
    toast.info(t('login.forgotPwdInfo'), {
      description: t('login.forgotPwdDesc')
    });
  };
  return (
    <div className="min-h-screen w-full relative overflow-hidden flex items-center justify-center bg-[#2B2D42] font-sans">
      {/* Immersive Mesh Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#E63946] opacity-20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#F4A261] opacity-10 blur-[120px] rounded-full" />
      </div>
      <div className="relative z-10 w-full max-w-[420px] px-6 py-12 md:py-20">
        {/* Branding Section */}
        <div className="text-center space-y-4 mb-10">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="inline-flex p-6 bg-gradient-to-tr from-[#E63946] to-[#ff5a68] rounded-[40px] shadow-2xl shadow-rose-500/40 border border-white/20"
          >
            <Wallet className="h-10 w-10 text-white" />
          </motion.div>
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="space-y-1"
          >
            <h1 className="text-4xl font-extrabold text-white tracking-tight">{t('login.brand')}</h1>
            <p className="text-rose-100/60 font-medium text-sm tracking-widest uppercase">{t('login.slogan')}</p>
          </motion.div>
        </div>
        {/* Glassmorphic Card */}
        <motion.div
          layout
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[40px] shadow-glass-lg overflow-hidden"
        >
          <div className="p-8 md:p-10">
            <AnimatePresence mode="wait">
              {isLogin ? (
                <motion.div
                  key="login-form"
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 20, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white">{t('login.loginTitle')}</h2>
                    <p className="text-white/50 text-sm mt-1">{t('login.loginSubtitle')}</p>
                  </div>
                  <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-white/70 text-xs font-bold uppercase tracking-wider ml-1">{t('login.email')}</Label>
                      <Input
                        {...loginForm.register('email')}
                        placeholder={t('login.emailPlaceholder')}
                        className="h-14 bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-2xl focus:ring-[#E63946] focus:border-[#E63946] transition-all"
                      />
                      {loginForm.formState.errors.email && <p className="text-xs text-rose-400 mt-1 ml-1">{loginForm.formState.errors.email.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center ml-1">
                        <Label className="text-white/70 text-xs font-bold uppercase tracking-wider">{t('login.password')}</Label>
                        <button
                          type="button"
                          onClick={handleForgotPassword}
                          className="text-xs text-rose-300/80 hover:text-rose-300 font-medium transition-colors"
                        >
                          {t('login.forgotPassword')}
                        </button>
                      </div>
                      <Input
                        type="password"
                        {...loginForm.register('password')}
                        placeholder={t('login.passwordPlaceholder')}
                        className="h-14 bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-2xl focus:ring-[#E63946] focus:border-[#E63946] transition-all"
                      />
                      {loginForm.formState.errors.password && <p className="text-xs text-rose-400 mt-1 ml-1">{loginForm.formState.errors.password.message}</p>}
                    </div>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full h-14 rounded-2xl bg-[#E63946] hover:bg-rose-600 text-white font-bold text-lg shadow-xl shadow-rose-900/20 mt-4 transition-all active:scale-95 group"
                    >
                      {loading ? <Loader2 className="animate-spin" /> : (
                        <span className="flex items-center justify-center">
                          {t('login.loginButton')} <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                        </span>
                      )}
                    </Button>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="register-form"
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white">{t('login.registerTitle')}</h2>
                    <p className="text-white/50 text-sm mt-1">{t('login.registerSubtitle')}</p>
                  </div>
                  <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-white/70 text-xs font-bold uppercase tracking-wider ml-1">{t('login.name')}</Label>
                      <Input
                        {...registerForm.register('name')}
                        placeholder={t('login.namePlaceholder')}
                        className="h-14 bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-2xl focus:ring-[#E63946] focus:border-[#E63946]"
                      />
                      {registerForm.formState.errors.name && <p className="text-xs text-rose-400 mt-1 ml-1">{registerForm.formState.errors.name.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/70 text-xs font-bold uppercase tracking-wider ml-1">{t('login.email')}</Label>
                      <Input
                        {...registerForm.register('email')}
                        placeholder={t('login.emailPlaceholder')}
                        className="h-14 bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-2xl focus:ring-[#E63946] focus:border-[#E63946]"
                      />
                      {registerForm.formState.errors.email && <p className="text-xs text-rose-400 mt-1 ml-1">{registerForm.formState.errors.email.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/70 text-xs font-bold uppercase tracking-wider ml-1">{t('login.password')}</Label>
                      <Input
                        type="password"
                        {...registerForm.register('password')}
                        placeholder={t('login.passwordPlaceholder')}
                        className="h-14 bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-2xl focus:ring-[#E63946] focus:border-[#E63946]"
                      />
                      {registerForm.formState.errors.password && <p className="text-xs text-rose-400 mt-1 ml-1">{registerForm.formState.errors.password.message}</p>}
                    </div>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full h-14 rounded-2xl bg-[#E63946] hover:bg-rose-600 text-white font-bold text-lg shadow-xl shadow-rose-900/20 mt-4 transition-all active:scale-95 group"
                    >
                      {loading ? <Loader2 className="animate-spin" /> : (
                        <span className="flex items-center justify-center">
                          {t('login.registerButton')} <UserPlus className="ml-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                        </span>
                      )}
                    </Button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="mt-10 flex flex-col items-center space-y-4">
              <div className="h-px w-full bg-white/10" />
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-white/60 hover:text-white text-sm font-medium flex items-center gap-2 transition-colors py-2"
              >
                {isLogin ? (
                  <>{t('login.noAccount')}<span className="text-rose-400">{t('login.register')}</span></>
                ) : (
                  <>{t('login.hasAccount')}<span className="text-rose-400">{t('login.backToLogin')}</span></>
                )}
              </button>
            </div>
          </div>
        </motion.div>
        {/* Support Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-8 text-white/30 text-xs font-medium"
        >
          &copy; {new Date().getFullYear()} {t('login.footer')}
        </motion.p>
      </div>
    </div>
  );
}