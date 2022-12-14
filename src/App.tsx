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
      <div style={{background: '#9B1DAF', padding: '10px 20px', fontWeight: 'bold' }}>
        <div style={{width: '100%', maxWidth: '750px', margin: '0 auto', lineHeight: '8px'}}>
          <p>This page is a UI implementation that previously accessed Project Serum DEX <a style={{color: '#39D0D8'}} href='https://github.com/project-serum/serum-dex'>smart contracts</a>.</p>
          <p>This page no longer connects to Serum and all interactions are now deprecated.</p>
          <p>All other Raydium features (i.e. swaps, pools, farms, etc) are unaffected and operate as normal.</p>
          <p>For more info and other resources for accessing Serum, click <a  style={{color: '#39D0D8'}} href='https://docs.raydium.io/raydium/updates/serum-dex-pause'>here</a>.</p>
        </div>
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
