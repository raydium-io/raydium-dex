import { Button, Col, Input, Row, Select, Slider, Switch } from 'antd';
import React, { useEffect, useState } from 'react';
import {
  useFeeDiscountKeys,
  useLocallyStoredFeeDiscountKey,
  useMarkPrice,
  useMarket,
  useSelectedBaseCurrencyAccount,
  useSelectedBaseCurrencyBalances,
  useSelectedOpenOrdersAccount,
  useSelectedQuoteCurrencyAccount,
  useSelectedQuoteCurrencyBalances,
} from '../utils/markets';

import FloatingElement from './layout/FloatingElement';
import { SwitchChangeEventHandler } from 'antd/es/switch';
import { notify } from '../utils/notifications';
import { refreshCache } from '../utils/fetch-loop';
import styled from 'styled-components';
import tuple from 'immutable-tuple';
import { useSendConnection } from '../utils/connection';
import { useWallet } from '../utils/wallet';
import {floorToDecimal, getDecimalCount, roundToDecimal,} from '../utils/utils';
import {getUnixTs, placeOrder} from '../utils/send';

const BuyButton = styled(Button)`
  margin: 20px 0px 0px 0px;
  background: #02bf76;
  border-color: #02bf76;
`;

const sliderMarks = {
  0: '0%',
  25: '25%',
  50: '50%',
  75: '75%',
  100: '100%',
};

export default function TradeForm({
  style,
  setChangeOrderRef,
}: {
  style?: any;
  setChangeOrderRef?: (
    ref: ({ size, price }: { size?: number; price?: number }) => void,
  ) => void;
}) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const { baseCurrency, quoteCurrency, market } = useMarket();
  const baseCurrencyBalances = useSelectedBaseCurrencyBalances();
  const quoteCurrencyBalances = useSelectedQuoteCurrencyBalances();
  const baseCurrencyAccount = useSelectedBaseCurrencyAccount();
  const quoteCurrencyAccount = useSelectedQuoteCurrencyAccount();
  const openOrdersAccount = useSelectedOpenOrdersAccount(true);
  const { wallet, connected } = useWallet();
  const sendConnection = useSendConnection();
  const markPrice = useMarkPrice();
  useFeeDiscountKeys();
  const { storedFeeDiscountKey: feeDiscountKey } = useLocallyStoredFeeDiscountKey();

  const [postOnly, setPostOnly] = useState(false);
  const [ioc, setIoc] = useState(false);
  const [baseSize, setBaseSize] = useState<number | undefined>(undefined);
  const [quoteSize, setQuoteSize] = useState<number | undefined>(undefined);
  const [price, setPrice] = useState<number | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [sizeFraction, setSizeFraction] = useState(0);

  const availableQuote =
    openOrdersAccount && market
      ? market.quoteSplSizeToNumber(openOrdersAccount.quoteTokenFree)
      : 0;

  let quoteBalance = (quoteCurrencyBalances || 0) + (availableQuote || 0);
  let baseBalance = baseCurrencyBalances || 0;
  let sizeDecimalCount =
    market?.minOrderSize && getDecimalCount(market.minOrderSize);
  let priceDecimalCount = market?.tickSize && getDecimalCount(market.tickSize);

  useEffect(() => {
    setChangeOrderRef && setChangeOrderRef(doChangeOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setChangeOrderRef]);

  useEffect(() => {
    baseSize && price && onSliderChange(sizeFraction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side]);

  useEffect(() => {
    updateSizeFraction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [price, baseSize]);

  const walletPubkey =  wallet?.publicKey
  useEffect(() => {
    const warmUpCache = async () => {
      try {
        if (!wallet || !wallet.publicKey || !market) {
          console.log(`Skipping refreshing accounts`);
          return;
        }
        const startTime = getUnixTs();
        console.log(`Refreshing accounts for ${market.address}`);
        await market?.findOpenOrdersAccountsForOwner(
          sendConnection,
          wallet.publicKey,
        );
        await market?.findBestFeeDiscountKey(sendConnection, wallet.publicKey);
        const endTime = getUnixTs();
        console.log(
          `Finished refreshing accounts for ${market.address} after ${
            endTime - startTime
          }`,
        );
      } catch (e) {
        console.log(`Encountered error when refreshing trading accounts: ${e}`);
      }
    };
    warmUpCache();
    const id = setInterval(warmUpCache, 30_000);
    return () => clearInterval(id);
  }, [market, sendConnection, wallet, walletPubkey]);

  
  // useInterval(() => {
  //   const autoSettle = async () => {
  //     if (!wallet || !market || !openOrdersAccount || !baseCurrencyAccount || !quoteCurrencyAccount || 
  //       openOrdersAccount?.baseTokenFree.toNumber() <= 0 || openOrdersAccount.quoteTokenFree.toNumber() <= 0) {
  //       return;
  //     }
  //     try {
  //       // settle funds into selected token wallets
  //       await settleFunds({
  //         market,
  //         openOrders: openOrdersAccount,
  //         connection: sendConnection,
  //         wallet,
  //         baseCurrencyAccount,
  //         quoteCurrencyAccount
  //       });
  //     } catch (e) {
  //       console.log('Error auto settling funds: ' + e.message);
  //     }
  //   };
  //   (
  //     connected &&
  //     wallet?.autoApprove &&
  //     autoSettleEnabled &&
  //     autoSettle()
  //   );
  // }, 10000);

  const onSetBaseSize = (baseSize: number | undefined) => {
    setBaseSize(baseSize);
    if (!baseSize) {
      setQuoteSize(undefined);
      return;
    }
    let usePrice = price || markPrice;
    if (!usePrice) {
      setQuoteSize(undefined);
      return;
    }
    const rawQuoteSize = baseSize * usePrice;
    const quoteSize =
      baseSize && roundToDecimal(rawQuoteSize, sizeDecimalCount);
    setQuoteSize(quoteSize);
  };

  const onSetQuoteSize = (quoteSize: number | undefined) => {
    setQuoteSize(quoteSize);
    if (!quoteSize) {
      setBaseSize(undefined);
      return;
    }
    let usePrice = price || markPrice;
    if (!usePrice) {
      setBaseSize(undefined);
      return;
    }
    const rawBaseSize = quoteSize / usePrice;
    const baseSize = quoteSize && roundToDecimal(rawBaseSize, sizeDecimalCount);
    setBaseSize(baseSize);
  };

  const doChangeOrder = ({
    size,
    price,
  }: {
    size?: number;
    price?: number;
  }) => {
    const formattedSize = size && roundToDecimal(size, sizeDecimalCount);
    const formattedPrice = price && roundToDecimal(price, priceDecimalCount);
    formattedSize && onSetBaseSize(formattedSize);
    formattedPrice && setPrice(formattedPrice);
  };

  const updateSizeFraction = () => {
    const rawMaxSize =
      side === 'buy' ? quoteBalance / (price || markPrice || 1) : baseBalance;
    const maxSize = floorToDecimal(rawMaxSize, sizeDecimalCount);
    const sizeFraction = Math.min(((baseSize || 0) / maxSize) * 100, 100);
    setSizeFraction(sizeFraction);
  };

  const onSliderChange = (value) => {
    if (!price && markPrice) {
      let formattedMarkPrice: number | string = priceDecimalCount
        ? markPrice.toFixed(priceDecimalCount)
        : markPrice;
      setPrice(
        typeof formattedMarkPrice === 'number'
          ? formattedMarkPrice
          : parseFloat(formattedMarkPrice),
      );
    }

    let newSize;
    if (side === 'buy') {
      if (price || markPrice) {
        newSize = ((quoteBalance / (price || markPrice || 1)) * value) / 100;
      }
    } else {
      newSize = (baseBalance * value) / 100;
    }

    // round down to minOrderSize increment
    let formatted = floorToDecimal(newSize, sizeDecimalCount);

    onSetBaseSize(formatted);
  };

  const postOnChange: SwitchChangeEventHandler = (checked) => {
    if (checked) {
      setIoc(false);
    }
    setPostOnly(checked);
  };
  const iocOnChange: SwitchChangeEventHandler = (checked) => {
    if (checked) {
      setPostOnly(false);
    }
    setIoc(checked);
  };

  async function onSubmit() {
    if (!price) {
      console.warn('Missing price');
      notify({
        message: 'Missing price',
        type: 'error',
      });
      return;
    } else if (!baseSize) {
      console.warn('Missing size');
      notify({
        message: 'Missing size',
        type: 'error',
      });
      return;
    }

    setSubmitting(true);
    try {
      if (wallet) {
      await placeOrder({
        side,
        price,
        size: baseSize,
        orderType: ioc ? 'ioc' : postOnly ? 'postOnly' : 'limit',
        market,
        connection: sendConnection,
        wallet,
        baseCurrencyAccount: baseCurrencyAccount?.pubkey,
        quoteCurrencyAccount: quoteCurrencyAccount?.pubkey,
        feeDiscountPubkey: feeDiscountKey
      });
      refreshCache(tuple('getTokenAccounts', wallet, connected));
      setPrice(undefined);
      onSetBaseSize(undefined);
    } else {
      throw Error('Error placing order')
    }
    } catch (e) {
      console.warn(e);
      notify({
        message: 'Error placing order',
        description: e.message,
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  // @ts-ignore
  return (
    <FloatingElement
      style={{ display: 'flex', flexDirection: 'column', ...style }}
    >
      <div style={{ flex: 1 }}>
        <Row>
          <Col
            span={12}
            onClick={() => setSide('buy')}
            style={{
              height: 42,
              width: '50%',
              textAlign: 'center',
              border: 'transparent',
              borderBottom: side === 'buy' ? '2px solid #5AC4BE' : '2px solid #1C274F',
              background: 'transparent',
              fontSize: 14,
              fontStyle: 'normal',
              fontWeight: 600,
              color: side === 'buy' ? '#F1F1F2' : 'rgba(241, 241, 242, 0.5)',
              padding: '12px 0 0 0'
            }}
          >
            BUY
          </Col>
          <Col
            span={12}
            onClick={() => setSide('sell')}
            style={{
              height: 42,
              width: '50%',
              textAlign: 'center',
              border: 'transparent',
              borderBottom: side === 'sell' ? '2px solid #5AC4BE' : '2px solid #1C274F',
              background: 'transparent',
              fontSize: 14,
              fontStyle: 'normal',
              fontWeight: 600,
              color: side === 'sell' ? '#F1F1F2' : 'rgba(241, 241, 242, 0.5)',
              padding: '12px 0 0 0'
            }}
          >
            SELL
          </Col>
        </Row>
        <div
          style={{
            padding: '24px 24px 15px',
          }}
        >
          <Select
            defaultValue="Limit Order"
            bordered={false}
            style={{
              width: '100%',
              height: 47,
              left: 0,
              top: 0,
              background: '#1C274F',
              borderRadius: 4,
              paddingTop: 5,
              fontSize: 14
            }}
          >
            <Select.Option value="Limit Order">Limit Order</Select.Option>
            {/* <Select.Option value="Market Order">Market Order</Select.Option> */}
          </Select>
          <div style={{ marginTop: 25}}>
            <div style={{ textAlign: 'right', paddingBottom: 8, fontSize: 12, }}>Limit price</div>
            <Input
              type="number"
              bordered={false}
              style={{ textAlign: 'right', paddingBottom: 8, height: 47, background: '#1C274F', borderRadius: 4, }}
              suffix={
                <span style={{ fontSize: 10, opacity: 0.5 }}>{quoteCurrency}</span>
              }
              value={price}
              step={market?.tickSize || 1}
              onChange={(e) => setPrice(parseFloat( e.target.value))}
            />
          </div>

          <div style={{ marginTop: 25}}>
            <div style={{ textAlign: 'right', paddingBottom: 8, fontSize: 12, }}>Amount</div>
            <Input
              type="number"
              bordered={false}
              style={{ textAlign: 'right', paddingBottom: 8, height: 47, background: '#1C274F', borderRadius: 4, }}
              suffix={
                <span style={{ fontSize: 10, opacity: 0.5 }}>{baseCurrency}</span>
              }
              value={baseSize}
              step={market?.tickSize || 1}
              onChange={(e) => onSetBaseSize(parseFloat( e.target.value))}
            />
          </div>

          <div style={{ marginTop: 25}}>
            <div style={{ textAlign: 'right', paddingBottom: 8, fontSize: 12, }}>Total</div>
            <Input
              type="number"
              bordered={false}
              style={{ textAlign: 'right', paddingBottom: 8, height: 47, background: '#1C274F', borderRadius: 4, }}
              suffix={
                <span style={{ fontSize: 10, opacity: 0.5 }}>{quoteCurrency}</span>
              }
              value={quoteSize}
              step={market?.tickSize || 1}
              onChange={(e) => onSetQuoteSize(parseFloat( e.target.value))}
            />
          </div>

          <Row style={{ paddingTop: 8}}>
            <Col span={12}>
              <Slider
                style={{ width: '80%' }}
                value={sizeFraction}
                tipFormatter={(value) => `${value}%`}
                marks={sliderMarks}
                onChange={onSliderChange}
              />
            </Col>
            <Col span={6} style={{
              paddingTop: 10,
              paddingLeft: 10,
            }}>
              <Switch
                size="small"
                checked={postOnly}
                style={{ width: 32}}
                onChange={postOnChange}
              />
                <div style={{ display: 'inline-block', fontSize: 10, color: '#BEBEBE', paddingLeft: 4 }}>POST</div>
            </Col>
            <Col span={6} style={{
              paddingTop: 10,
              paddingLeft: 10,
            }}>
              <Switch
                size="small"
                checked={ioc}
                style={{ width: 32}}
                onChange={iocOnChange}
              />
              <div style={{ display: 'inline-block', fontSize: 10, color: '#BEBEBE', paddingLeft: 4 }}>IOC</div>
            </Col>
          </Row>

          <BuyButton
            disabled={!price || !baseSize}
            onClick={onSubmit}
            block
            type="primary"
            size="large"
            loading={submitting}
            style={{
              marginTop: 20,
              height: 41,
              background: 'rgba(90, 196, 190, 0.1)',
              border: '1px solid #5AC4BE',
              borderRadius: 4,
            }}
          >
            LIMIT {side.toUpperCase()} {baseCurrency}
          </BuyButton>
        </div>
      </div>
    </FloatingElement>
  );
}
