import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

// This is the hardcoded admin password
const ADMIN_PASSWORD = 'pisces2025';

interface AdminPasswordProtectionProps {
    children: React.ReactNode;
}

const AdminPasswordProtection: React.FC<AdminPasswordProtectionProps> = ({ children }) => {
    const [password, setPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const navigate = useNavigate();
    const { toast } = useToast();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (password === ADMIN_PASSWORD) {
            setIsAuthenticated(true);
            toast({
                title: "Access granted",
                description: "You have successfully authenticated as an admin",
            });
        } else {
            toast({
                variant: "destructive",
                title: "Access denied",
                description: "Incorrect admin password",
            });
            setPassword('');
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="w-full max-w-md space-y-8 p-8">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold">Admin Access</h1>
                        <p className="mt-2 text-muted-foreground">
                            Please enter the admin password to continue
                        </p>
                    </div>
                    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                        <div>
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter admin password"
                                required
                            />
                        </div>
                        <div className="flex justify-between">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => navigate('/dashboard')}
                            >
                                Back to Dashboard
                            </Button>
                            <Button type="submit">
                                Submit
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default AdminPasswordProtection; 