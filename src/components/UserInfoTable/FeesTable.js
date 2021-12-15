import React from 'react';
import {
  Row,
  Col,
  Typography,
  //  Tag
} from 'antd';
import { useFeeDiscountKeys } from '../../utils/markets';
import { TokenInstructions, getFeeRates } from '@project-serum/serum';
import { percentFormat } from '../../utils/utils';

export default function FeesTable() {
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
                  {percentFormat.format(getFeeRates(feeTier).taker)}
                </Col>
                <Col span={4} style={{ textAlign: 'left' }}>
                  {percentFormat.format(getFeeRates(feeTier).maker)}
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
