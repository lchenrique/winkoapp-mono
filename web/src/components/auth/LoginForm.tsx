import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, Users, Zap, Shield, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function LoginForm() {
  const { login, register, isLoading } = useAuth();
  const { toast } = useToast();
  
  // Login form state
  const [loginData, setLoginData] = useState({
    identifier: '',
    password: '',
  });
  
  // Register form state
  const [registerData, setRegisterData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
  });
  
  // Password visibility state
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await login(loginData.identifier, loginData.password);
      toast({
        title: 'Login realizado com sucesso!',
        description: 'Bem-vindo ao WinkoApp',
      });
    } catch (error) {
      toast({
        title: 'Erro no login',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await register(registerData.name, registerData.username, registerData.email, registerData.password);
      toast({
        title: 'Cadastro realizado com sucesso!',
        description: 'Bem-vindo ao WinkoApp',
      });
    } catch (error) {
      toast({
        title: 'Erro no cadastro',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen flex bg-background p-4">
      {/* Left Side - Features */}
      <div className="hidden lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:px-12">
        <div className="max-w-md">
          <div className="flex items-center mb-8">
            <div className="p-3 bg-primary rounded-xl mr-3">
              <MessageCircle className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">WinkoApp</h1>
          </div>
          
          <h2 className="text-2xl font-semibold text-foreground mb-6">
            Conecte-se com o mundo de forma segura e rápida
          </h2>
          
          <div className="space-y-6">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-accent/50 rounded-lg">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Mensagens em tempo real</h3>
                <p className="text-muted-foreground text-sm">Converse instantaneamente com seus contatos</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-accent/50 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Conexões sociais</h3>
                <p className="text-muted-foreground text-sm">Adicione amigos e mantenha contato</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-accent/50 rounded-lg">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Segurança total</h3>
                <p className="text-muted-foreground text-sm">Suas conversas são protegidas e privadas</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Right Side - Auth Forms */}
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-md shadow-2xl border border-border bg-card">
          <CardHeader className="text-center space-y-2 pb-6">
            <div className="flex justify-center">
              <div className="p-3 bg-primary rounded-xl">
                <MessageCircle className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-card-foreground">
              Bem-vindo ao WinkoApp
            </CardTitle>
            <p className="text-muted-foreground">
              Entre na sua conta ou crie uma nova para começar
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted">
                <TabsTrigger value="login" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Entrar</TabsTrigger>
                <TabsTrigger value="register" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Criar Conta</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login" className="space-y-5">
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="login-identifier" className="text-sm font-medium text-card-foreground">Username ou Email</Label>
                    <Input
                      id="login-identifier"
                      type="text"
                      placeholder="seu@email.com ou username"
                      className="h-11 bg-input border-border"
                      value={loginData.identifier}
                      onChange={(e) => setLoginData({ ...loginData, identifier: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-sm font-medium text-card-foreground">Senha</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showLoginPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="h-11 pr-10 bg-input border-border"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                      >
                        {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground" 
                    disabled={isLoading}
                  >
                    {isLoading ? 'Entrando...' : 'Entrar'}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="register" className="space-y-4">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-name" className="text-sm font-medium text-card-foreground">Nome</Label>
                      <Input
                        id="register-name"
                        type="text"
                        placeholder="João Silva"
                        className="h-11 bg-input border-border"
                        value={registerData.name}
                        onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="register-username" className="text-sm font-medium text-card-foreground">Username</Label>
                      <Input
                        id="register-username"
                        type="text"
                        placeholder="joao123"
                        className="h-11 bg-input border-border"
                        value={registerData.username}
                        onChange={(e) => setRegisterData({ ...registerData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="register-email" className="text-sm font-medium text-card-foreground">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="seu@email.com"
                      className="h-11 bg-input border-border"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="register-password" className="text-sm font-medium text-card-foreground">Senha</Label>
                    <div className="relative">
                      <Input
                        id="register-password"
                        type={showRegisterPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="h-11 pr-10 bg-input border-border"
                        value={registerData.password}
                        onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      >
                        {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres</p>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground" 
                    disabled={isLoading}
                  >
                    {isLoading ? 'Criando conta...' : 'Criar Conta'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
