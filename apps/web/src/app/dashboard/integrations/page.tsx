// app/dashboard/integrations/page.tsx
import { IntegrationsOverview } from '@/components/integrations/components/IntegrationsOverview';

export const metadata = {
  title: 'Integrations | Life Navigator',
  description: 'Connect your external services to Life Navigator',
};

export default function IntegrationsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Service Integrations</h1>
      <p className="text-gray-600 mb-8">
        Connect your accounts to get personalized life navigation across financial, education, career, and health domains.
      </p>
      
      <IntegrationsOverview />
    </div>
  );
}
