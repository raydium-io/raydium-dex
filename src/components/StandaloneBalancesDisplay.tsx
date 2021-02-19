import { Button, Col, Divider, Popover, Row } from 'antd';
import React, { useState } from 'react';
import FloatingElement from './layout/FloatingElement';
import styled from 'styled-components';
import {
  useBalances,
  useMarket,
  useSelectedBaseCurrencyAccount,
  useSelectedOpenOrdersAccount,
  useSelectedQuoteCurrencyAccount,
  useTokenAccounts,
} from '../utils/markets';
import DepositDialog from './DepositDialog';
import { useWallet } from '../utils/wallet';
import Link from './Link';
import { settleFunds } from '../utils/send';
import { useSendConnection } from '../utils/connection';
import { notify } from '../utils/notifications';
import { Balances } from '../utils/types';
import StandaloneTokenAccountsSelect from './StandaloneTokenAccountSelect';
import LinkAddress from './LinkAddress';
import { InfoCircleOutlined } from '@ant-design/icons';
import logo1 from '../assets/logo1.svg';

const RowBox = styled(Row)`
  padding-bottom: 20px;
`;

const Tip = styled.p`
  font-size: 12px;
  padding-top: 6px;
`;

const ActionButton = styled(Button)`
  color: rgba(241, 241, 242, 0.75);
  font-size: 12px;
  display: 'inline-block';
  padding-right: 15px;
  padding-left: 15px;
  border-radius: 4px;
  border: 1px solid rgba(241, 241, 242, 0.5);
`;

export default function StandaloneBalancesDisplay() {
  const { baseCurrency, quoteCurrency, market } = useMarket();
  const balances = useBalances();
  const openOrdersAccount = useSelectedOpenOrdersAccount(true);
  const connection = useSendConnection();
  const { providerUrl, providerName, wallet, connected } = useWallet();
  const [baseOrQuote, setBaseOrQuote] = useState('');
  const baseCurrencyAccount = useSelectedBaseCurrencyAccount();
  const quoteCurrencyAccount = useSelectedQuoteCurrencyAccount();
  const [tokenAccounts] = useTokenAccounts();
  const baseCurrencyBalances =
    balances && balances.find((b) => b.coin === baseCurrency);
  const quoteCurrencyBalances =
    balances && balances.find((b) => b.coin === quoteCurrency);

  async function onSettleFunds() {
    if (!market) {
      notify({
        message: 'Error settling funds',
        description: 'market is undefined',
        type: 'error',
      });
      return;
    }
    if (!openOrdersAccount) {
      notify({
        message: 'Error settling funds',
        description: 'Open orders account is undefined',
        type: 'error',
      });
      return;
    }
    if (!baseCurrencyAccount) {
      notify({
        message: 'Error settling funds',
        description: 'Open orders account is undefined',
        type: 'error',
      });
      return;
    }
    if (!quoteCurrencyAccount) {
      notify({
        message: 'Error settling funds',
        description: 'Open orders account is undefined',
        type: 'error',
      });
      return;
    }

    try {
      await settleFunds({
        market,
        openOrders: openOrdersAccount,
        connection,
        wallet,
        baseCurrencyAccount,
        quoteCurrencyAccount,
      });
    } catch (e) {
      notify({
        message: 'Error settling funds',
        description: e.message,
        type: 'error',
      });
    }
  }

  const formattedBalances: [
    string | undefined,
    Balances | undefined,
    string,
    string | undefined,
  ][] = [
    [
      baseCurrency,
      baseCurrencyBalances,
      'base',
      market?.baseMintAddress.toBase58(),
    ],
    [
      quoteCurrency,
      quoteCurrencyBalances,
      'quote',
      market?.quoteMintAddress.toBase58(),
    ],
  ];

  return (
    <FloatingElement style={{ flex: 1, paddingTop: 10 }}>
      <div
       style={{
         width: '100%',
         borderBottom: '1px solid #1C274F',
         fontSize: 14,
         paddingBottom: 12,

       }}
      >
        Wallet Balance
      </div>
      <div style={{ paddingRight: 10}}>
        <Row style={{
          marginTop: 16,
          color: 'rgba(241, 241, 242, 0.5)',
          fontSize: 12,
          textAlign: 'right',
        }}>
          <Col span={6} style={{ textAlign: 'left' }}>
            Asset
          </Col>
          <Col span={9}>
            Wallet balance
          </Col>
          <Col span={9}>
            Unsettled balance
          </Col>
        </Row>
        {formattedBalances.map(
          ([currency, balances, baseOrQuote, mint], index) => (
            <React.Fragment key={index}>

              <Row style={{
                marginTop: 16,
                fontSize: 12,
                color: 'rgba(241, 241, 242, 1)',
                textAlign: 'right',
                borderBottom: '1px solid #1C274F',
                paddingBottom: 18,
              }}>
                <Col span={6} style={{ color: 'rgba(241, 241, 242, 0.5)', textAlign: 'left' }}>
                  {currency}
                </Col>
                <Col span={9}>
                  {balances && balances.wallet}
                </Col>
                <Col span={9}>
                  {balances && balances.unsettled}
                </Col>
                <Col span={6} style={{ paddingTop: 8}}>
                </Col>
                <Col span={9} style={{ paddingTop: 8}}>
                  <ActionButton
                    size="small"
                    onClick={() => setBaseOrQuote(baseOrQuote)}
                  >
                    Deposit
                  </ActionButton>
                </Col>
                <Col span={9} style={{ paddingTop: 8}}>
                  <ActionButton size="small" onClick={onSettleFunds}>
                    Settle
                  </ActionButton>
                </Col>
              </Row>

              {connected && (
                <RowBox align="middle" style={{ paddingBottom: 10 }}>
                  <StandaloneTokenAccountsSelect
                    accounts={tokenAccounts?.filter(
                      (account) => account.effectiveMint.toBase58() === mint,
                    )}
                    mint={mint}
                    label
                  />
                </RowBox>
              )}
            </React.Fragment>
          ),
        )}
      </div>
      <DepositDialog
        baseOrQuote={baseOrQuote}
        onClose={() => setBaseOrQuote('')}
      />
      <div style={{ textAlign: 'center', paddingTop: 32 }}>
        <img src={logo1} alt="" />
        <div style={{ paddingTop: 20, fontSize: 16, color: '#F1F1F2' }}>
          First time trading
        </div>
        <div style={{ fontSize: 16, color: '#F1F1F2' }}>
          on Raydium?
        </div>
        <div style={{ paddingTop: 16, fontSize: 12, color: '#5AC4BE' }}>
          see how it works
        </div>
      </div>
    </FloatingElement>
  );
}
