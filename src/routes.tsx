import React from 'react';

import {
  HashRouter,
  Redirect,
  Route,
  Switch,
} from 'react-router-dom';

import BasicLayout from './components/BasicLayout';
import ConvertPage from './pages/ConvertPage';
import ListNewMarketPage from './pages/ListNewMarketPage';
import OpenOrdersPage from './pages/OpenOrdersPage';
import NewPoolPage from './pages/pools/NewPoolPage';
import PoolListPage from './pages/pools/PoolListPage';
import PoolPage from './pages/pools/PoolPage';
import TradePage from './pages/TradePage';
import { getTradePageUrl } from './utils/markets';

export function Routes() {
  return (
    <>
      <HashRouter basename={'/'}>
        <BasicLayout>
          <Switch>
            <Route exact path="/">
              <Redirect to={getTradePageUrl()} />
            </Route>
            <Route exact path="/market/:marketAddress">
              <TradePage />
            </Route>
            <Route exact path="/orders" component={OpenOrdersPage} />
            {/* <Route exact path="/balances" component={BalancesPage} /> */}
            <Route exact path="/convert" component={ConvertPage} />
            <Route
              exact
              path="/list-new-market"
              component={ListNewMarketPage}
            />
            <Route exact path="/pools">
              <PoolListPage />
            </Route>
            <Route exact path="/pools/new">
              <NewPoolPage />
            </Route>
            <Route exact path="/pools/:poolAddress">
              <PoolPage />
            </Route>
          </Switch>
        </BasicLayout>
      </HashRouter>
    </>
  );
}
