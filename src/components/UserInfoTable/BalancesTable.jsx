import { Button, Col, Row } from 'antd';
import React, { useState } from 'react';
import {
  useTokenAccounts,
  getSelectedTokenAccountForMint,
} from '../../utils/markets';
import { useSendConnection } from '../../utils/connection';
import { useWallet } from '../../utils/wallet';
import { settleFunds } from '../../utils/send';
import { notify } from '../../utils/notifications';

export default function BalancesTable({
  balances,
  showMarket,
  hideWalletBalance,
  onSettleSuccess,
}) {
  const [accounts] = useTokenAccounts();
  const connection = useSendConnection();
  const { wallet } = useWallet();

  async function onSettleFunds(market, openOrders) {
    try {
      await settleFunds({
        market,
        openOrders,
        connection,
        wallet,
        baseCurrencyAccount: getSelectedTokenAccountForMint(
          accounts,
          market?.baseMintAddress,
        ),
        quoteCurrencyAccount: getSelectedTokenAccountForMint(
          accounts,
          market?.quoteMintAddress,
        ),
      });
    } catch (e) {
      notify({
        message: 'Error settling funds',
        description: e.message,
        type: 'error',
      });
      return;
    }
    onSettleSuccess && onSettleSuccess();
  }
  const [rowItem, setRowItem] = useState(4);
  if (showMarket) {
    setRowItem(rowItem + 1);
  }
  if (hideWalletBalance) {
    setRowItem(rowItem + 1);
  }
  // setRowItem(Math.floor(24 / rowItem));
  return (
    <>
      <Row
        style={{
          fontSize: 14,
          color: 'rgba(241, 241, 242, 0.5)',
          paddingBottom: 16,
        }}
      >
        {showMarket ? (
          <Col span={24 / rowItem} style={{ textAlign: 'left' }}>
            Market
          </Col>
        ) : null}
        <Col span={24 / rowItem} style={{ textAlign: 'right' }}>
          Coin
        </Col>
        {hideWalletBalance ? (
          <Col span={24 / rowItem} style={{ textAlign: 'right' }}>
            Wallet Balance
          </Col>
        ) : null}
        <Col span={24 / rowItem} style={{ textAlign: 'right' }}>
          Orders
        </Col>
        <Col span={24 / rowItem} style={{ textAlign: 'right' }}>
          Unsettled
        </Col>
        <Col span={24 / rowItem} style={{ textAlign: 'right' }}>
          Action
        </Col>
      </Row>
      <div style={{ height: 350, overflowX: 'hidden' }}>
        {balances.map(
          (
            { marketName, coin, wallet, orders, unsettled, market, openOrders },
            i,
          ) => (
            <Row
              key={i}
              style={{
                fontSize: 14,
                color: 'rgba(241, 241, 242, 1)',
                paddingBottom: 16,
              }}
            >
              {showMarket ? (
                <Col span={24 / rowItem} style={{ textAlign: 'left' }}>
                  {marketName}
                </Col>
              ) : null}
              <Col span={24 / rowItem} style={{ textAlign: 'right' }}>
                {coin}
              </Col>
              {hideWalletBalance ? (
                <Col span={24 / rowItem} style={{ textAlign: 'right' }}>
                  {wallet}
                </Col>
              ) : null}
              <Col span={24 / rowItem} style={{ textAlign: 'right' }}>
                {orders}
              </Col>
              <Col span={24 / rowItem} style={{ textAlign: 'right' }}>
                {unsettled}
              </Col>
              <Col span={24 / rowItem} style={{ textAlign: 'right' }}>
                <Button
                  ghost
                  style={{ marginRight: 12 }}
                  onClick={() => onSettleFunds(market, openOrders)}
                >
                  Settle {marketName}
                </Button>
              </Col>
            </Row>
          ),
        )}
      </div>
    </>
    // <DataTable
    //   emptyLabel="No balances"
    //   dataSource={balances}
    //   columns={columns}
    //   pagination={false}
    // />
  );
}
