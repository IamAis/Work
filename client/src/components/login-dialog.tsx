import { useState } from 'react';
import {
        Dialog,
        DialogTrigger,
        DialogContent,
        DialogHeader,
        DialogTitle,
        DialogDescription,
        DialogFooter,
        DialogClose
} from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { supabase } from '../lib/supabase';

export function LoginDialog({ trigger }: { trigger: React.ReactNode }) {
        const [open, setOpen] = useState(false);
        const [mode, setMode] = useState<'login' | 'register'>('login');
        const [email, setEmail] = useState('');
        const [password, setPassword] = useState('');
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState<string | null>(null);
        const [success, setSuccess] = useState<string | null>(null);
    const [sendingReset, setSendingReset] = useState<boolean>(false);

        const resetForm = () => {
                setEmail('');
                setPassword('');
                setError(null);
                setSuccess(null);
        };

        const handleSubmit = async (e: React.FormEvent) => {
                e.preventDefault();
                setLoading(true);
                setError(null);
                setSuccess(null);

                if (mode === 'register') {
                        const { error } = await supabase.auth.signUp({
                                email,
                                password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
                        });
                        setLoading(false);
                        if (error) {
                                setError(error.message);
                        } else {
                                setSuccess('Registrazione avvenuta! Controlla la tua email per confermare.');
                        }
                } else {
                        const { error } = await supabase.auth.signInWithPassword({
                                email,
                                password,
                        });
                        setLoading(false);
                        if (error) {
                                setError(error.message);
                        } else {
                                setSuccess('Login effettuato!');
                                // chiudi il dialog e reload la pagina dopo un breve delay
                                setTimeout(() => {
                                        setOpen(false);
                                        resetForm();
                                        window.location.reload();
                                }, 400);
                        }
                }
        };

    const handleForgotPassword = async () => {
        if (!email) {
            setError('Inserisci la tua email per ricevere il link di reset.');
            return;
        }
        setSendingReset(true);
        setError(null);
        setSuccess(null);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        });
        setSendingReset(false);
        if (error) {
            setError(error.message);
        } else {
            setSuccess('Email inviata! Controlla la casella per reimpostare la password.');
        }
    };

        return (
                <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
                        <DialogTrigger asChild>{trigger}</DialogTrigger>
                        <DialogContent>
                                <DialogHeader>
                                        <DialogTitle>{mode === 'login' ? 'Login' : 'Registrazione'}</DialogTitle>
                                        <DialogDescription>
                                                {mode === 'login'
                                                        ? 'Accedi con la tua email e password.'
                                                        : 'Crea un nuovo account con email e password.'}
                                        </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                        <Input
                                                type="email"
                                                placeholder="Email"
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                required
                                                autoFocus
                                        />
                                        <Input
                                                type="password"
                                                placeholder="Password"
                                                value={password}
                                                onChange={e => setPassword(e.target.value)}
                                                required
                                        />
                                        {error && <div className="text-red-500 text-sm">{error}</div>}
                                        {success && <div className="text-green-600 text-sm">{success}</div>}
                                        <DialogFooter>
                                                <Button type="submit" disabled={loading}>
                                                        {loading ? 'Attendi...' : mode === 'login' ? 'Login' : 'Registrati'}
                                                </Button>
                                                <Button
                                                        type="button"
                                                        variant="ghost"
                                                        onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); setSuccess(null); }}
                                                        disabled={loading}
                                                >
                                                        {mode === 'login' ? 'Non hai un account? Registrati' : 'Hai già un account? Login'}
                                                </Button>
                        {mode === 'login' && (
                            <Button
                                type="button"
                                variant="link"
                                onClick={handleForgotPassword}
                                disabled={loading || sendingReset}
                            >
                                {sendingReset ? 'Invio...' : 'Password dimenticata?'}
                            </Button>
                        )}
                                        </DialogFooter>
                                </form>
                        </DialogContent>
                </Dialog>
        );
}
