import React, { Suspense } from 'react';
import './App.less';
import { ConnectionProvider } from './utils/connection';
import { WalletProvider } from './utils/wallet';
import { GlobalStyle } from './global_style';
import { Spin } from 'antd';
import ErrorBoundary from './components/ErrorBoundary';
import { Routes } from './routes';
import { ReferrerProvider } from './utils/referrer';

export default function App() {
  return (
    <Suspense fallback={() => <Spin size="large" />}>
      <GlobalStyle />
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
