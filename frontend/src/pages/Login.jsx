import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, ArrowRight } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20 mb-6">
          <ShieldCheck className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">
          Blue Sky Tracker
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Reg D 506(b) & 506(c) Compliance Management
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-800 py-8 px-4 shadow-2xl border border-slate-700 sm:rounded-2xl sm:px-10">
          <div className="space-y-6">
            <div>
              <button
                onClick={login}
                className="w-full flex justify-center items-center py-3 px-4 border border-slate-600 rounded-xl shadow-sm text-sm font-medium text-white bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 group"
              >
                <img 
                  className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform" 
                  src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                  alt="Google logo" 
                />
                Sign in with Google
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-slate-800 text-slate-500">
                  Secure Access Only
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-blue-900/20 border border-blue-500/20 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <ShieldCheck className="h-5 w-5 text-blue-400" aria-hidden="true" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-300">Enterprise Authentication</h3>
                  <div className="mt-1 text-sm text-blue-400/80">
                    <p>Your session is encrypted with bank-level security protocols.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <p className="mt-8 text-center text-xs text-slate-500 uppercase tracking-widest">
          Authorized Personnel Only
        </p>
      </div>
    </div>
  );
}
