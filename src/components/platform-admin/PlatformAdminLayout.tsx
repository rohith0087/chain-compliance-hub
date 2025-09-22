import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { PlatformAdminSidebar } from './PlatformAdminSidebar';
import { PlatformAdminHeader } from './PlatformAdminHeader';

export function PlatformAdminLayout() {
  const [activeSection, setActiveSection] = useState('dashboard');

  return (
    <div className="platform-admin min-h-screen bg-white text-black">
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <PlatformAdminSidebar 
            activeSection={activeSection} 
            onSectionChange={setActiveSection} 
          />
          
          <div className="flex-1 flex flex-col">
            <PlatformAdminHeader />
            
            <main className="flex-1 p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </div>
  );
}