import './App.less';

import React, { Suspense } from 'react';

import { Spin } from 'antd';

import ErrorBoundary from './components/ErrorBoundary';
import { GlobalStyle } from './global_style';
import { Routes } from './routes';
import { ConnectionProvider } from './utils/connection';
import { ReferrerProvider } from './utils/referrer';
import { WalletProvider } from './utils/wallet';

export default function App() {
  return (
    <Suspense fallback={() => <Spin size="large" />}>
      <GlobalStyle />
      <div style={{background: 'red', padding: '0 10px', fontWeight: 'bold', textAlign: 'center' }}>
      <p>New order creation is currently disabled. Please cancel and settle any existing orders.</p>
      <p>This trading page is a UI implementation that accesses the Project Serum DEX <a style={{color: '#6bcdd6'}} href='https://github.com/project-serum/serum-dex'>smart contracts</a>.</p>
      <p>Serum can still be accessed from other protocols listed on the <a  style={{color: '#6bcdd6'}} href='https://portal.projectserum.com/'>Serum website</a>. For more info, click <a  style={{color: '#6bcdd6'}} href='https://docs.raydium.io/raydium/updates/serum-dex-pause'>here</a>.</p>
      </div>
      <ErrorBoundary>
        <ConnectionProvider>
          <ReferrerProvider>
            <WalletProvider>
              <Suspense fallback={() => <Spin size="large" />}>
                <Routes />
              </Suspense>
            </WalletProvider>
          </ReferrerProvider>
        </ConnectionProvider>
      </ErrorBoundary>
    </Suspense>
  );
}
