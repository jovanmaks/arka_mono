import { Button } from '@core/ui/components';
import { useNavigate } from 'react-router-dom';

export const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-8">Welcome to Our Platform</h1>
      <div className="space-x-4">
        <Button onClick={() => navigate('/login')}>Sign In</Button>
        <Button variant="outline" onClick={() => navigate('/register')}>
          Create Account
        </Button>
      </div>
    </div>
  );
};
