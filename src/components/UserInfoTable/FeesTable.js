import React from 'react';
import {
  Row,
  Col,
  Typography,
  //  Tag
} from 'antd';
import { useFeeDiscountKeys } from '../../utils/markets';
import { TokenInstructions } from '@project-serum/serum';
import { percentFormat } from '../../utils/utils';

function getFeeRates(feeTier, market) {
  if (
    [
      '77quYg4MGneUdjgXCunt9GgM1usmrxKY31twEy3WHwcS',
      '5cLrMai1DsLRYc1Nio9qMTicsWtvzjzZfJPXyAoF4t1Z',
      'EERNEEnBqdGzBS8dd46wwNY5F2kwnaCQ3vsq2fNKGogZ',
      '8sFf9TW3KzxLiBXcDcjAxqabEsRroo4EiRr3UG1xbJ9m',
      '2iDSTGhjJEiRxNaLF27CY6daMYPs5hgYrP2REHd5YD62',
    ].includes(market)
  ) {
    return { taker: 0.001, maker: 0 };
  } else if (feeTier === 1) {
    return { taker: 0.0039, maker: 0 };
  } else if (feeTier === 2) {
    return { taker: 0.0038, maker: 0 };
  } else if (feeTier === 3) {
    return { taker: 0.0036, maker: 0 };
  } else if (feeTier === 4) {
    return { taker: 0.0034, maker: 0 };
  } else if (feeTier === 5) {
    return { taker: 0.0032, maker: 0 };
  } else if (feeTier === 6) {
    return { taker: 0.003, maker: 0 };
  }
  return { taker: 0.004, maker: 0 };
}

export default function FeesTable({ market }) {
  const [feeAccounts] = useFeeDiscountKeys();

  const dataSource = (feeAccounts || []).map((account, index) => ({
    ...account,
    index,
    key: account.pubkey.toBase58(),
  }));

  return (
    <>
      <Row>
        <Col span={24}>
          <Row
            style={{
              fontSize: 14,
              color: 'rgba(241, 241, 242, 0.5)',
              paddingBottom: 16,
            }}
          >
            <Col span={5} style={{ textAlign: 'left' }}>
              Fee Tier
            </Col>
            <Col span={5} style={{ textAlign: 'left' }}>
              Taker
            </Col>
            <Col span={4} style={{ textAlign: 'left' }}>
              Maker
            </Col>
            <Col span={5} style={{ textAlign: 'left' }}>
              Balance
            </Col>
            <Col span={5} style={{ textAlign: 'left' }}>
              Mint
            </Col>
          </Row>
          <div style={{ height: 350, overflowX: 'hidden' }}>
            {dataSource.map(({ mint, balance, pubkey, feeTier }, index) => (
              <Row
                key={index}
                style={{
                  fontSize: 14,
                  color: 'rgba(241, 241, 242, 1)',
                  paddingBottom: 16,
                }}
              >
                <Col span={5} style={{ textAlign: 'left' }}>
                  <Typography>{feeTier}</Typography>
                  {/* {index === 0 ? (
                    <div style={{ marginLeft: 10 }}>
                      <Tag color={'#41C77A'} style={{ fontWeight: 700 }}>
                        Selected
                      </Tag>
                    </div>
                  ) : null} */}
                </Col>
                <Col span={5} style={{ textAlign: 'left' }}>
                  {percentFormat.format(
                    getFeeRates(feeTier, market.marketAddress).taker,
                  )}
                </Col>
                <Col span={4} style={{ textAlign: 'left' }}>
                  {percentFormat.format(
                    getFeeRates(feeTier, market.marketAddress).maker,
                  )}
                </Col>
                <Col span={5} style={{ textAlign: 'left' }}>
                  {balance}
                </Col>
                <Col span={5} style={{ textAlign: 'left' }}>
                  {mint.equals(TokenInstructions.SRM_MINT)
                    ? 'SRM'
                    : mint.equals(TokenInstructions.MSRM_MINT)
                    ? 'MSRM'
                    : 'UNKNOWN'}
                </Col>

                <Col span={24} style={{ textAlign: 'left' }}>
                  Public key: {pubkey.toBase58()}
                </Col>
              </Row>
            ))}
          </div>
          {/*<DataTable*/}
          {/*  dataSource={dataSource}*/}
          {/*  columns={columns}*/}
          {/*  pagination={true}*/}
          {/*  pageSize={5}*/}
          {/*  emptyLabel="No (M)SRM accounts"*/}
          {/*/>*/}
        </Col>
      </Row>
      {/*<Row style={{ marginTop: 8 }}>*/}
      {/*  <Col>*/}
      {/*    <Typography>*/}
      {/*      Holding SRM or MSRM makes you eligible for fee discounts:*/}
      {/*    </Typography>*/}
      {/*    <FeeScheduleTable />*/}
      {/*  </Col>*/}
      {/*</Row>*/}
    </>
  );
}
