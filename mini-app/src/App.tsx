import { h } from 'preact';
import { Layout } from './components/Layout';
import { ChatInterface } from './components/ChatInterface';
import { Search } from './components/Search';
import { RFQForm } from './components/RFQForm';
import { DealPipeline } from './components/DealPipeline';
import { UpgradeModal } from './components/UpgradeModal';
import { useStore } from './hooks/useStore';

/**
 * Main app component with routing and layout
 */
export function App() {
  const { activeTab } = useStore();

  const renderContent = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatInterface />;
      case 'search':
        return <Search />;
      case 'rfq':
        return <RFQForm />;
      case 'deals':
        return <DealPipeline />;
      default:
        return <ChatInterface />;
    }
  };

  return (
    <>
      <Layout>
        {renderContent()}
      </Layout>
      <UpgradeModal />
    </>
  );
}
