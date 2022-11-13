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
        <p>This trading page is a UI implementation that accesses the Project Serum DEX <a href='https://github.com/project-serum/serum-dex'>smart contracts</a>. New order creation will be disabled after November 21st.</p>
        <p>Please cancel and settle any existing orders. Serum can still be accessed from other protocols listed on the <a href='https://portal.projectserum.com/'>Serum website</a>. For more information, click <a href='https://docs.raydium.io/raydium/updates/serum-dex-pause'>here</a>. </p>
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
