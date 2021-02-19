import React from 'react';
import { Row, Col, Typography, Tag, Button } from 'antd';
import { useFeeDiscountKeys } from '../../utils/markets';
import DataTable from '../layout/DataTable';
import { TokenInstructions, getFeeRates } from '@project-serum/serum';
import { percentFormat } from '../../utils/utils';

export default function FeesTable() {
  const [feeAccounts] = useFeeDiscountKeys();

  const columns = [
    {
      title: 'Fee Tier',
      dataIndex: 'feeTier',
      key: 'feeTier',
      render: (feeTier, row) => (
        <div style={{ display: 'flex' }}>
          <Typography>{feeTier}</Typography>
          {row.index === 0 ? (
            <div style={{ marginLeft: 10 }}>
              <Tag color={'#41C77A'} style={{ fontWeight: 700 }}>
                Selected
              </Tag>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: 'Taker',
      dataIndex: 'taker',
      key: 'taker',
      render: (feeTier, row) =>
        percentFormat.format(getFeeRates(row.feeTier).taker),
    },
    {
      title: 'Maker',
      dataIndex: 'maker',
      key: 'maker',
      render: (feeTier, row) =>
        percentFormat.format(getFeeRates(row.feeTier).maker),
    },
    {
      title: `Public Key`,
      dataIndex: 'pubkey',
      key: 'pubkey',
      render: (pubkey) => pubkey.toBase58(),
    },
    {
      title: `Balance`,
      dataIndex: 'balance',
      key: 'balance',
    },
    {
      title: `Mint`,
      dataIndex: 'mint',
      key: 'mint',
      render: (_, row) =>
        row.mint.equals(TokenInstructions.SRM_MINT)
          ? 'SRM'
          : row.mint.equals(TokenInstructions.MSRM_MINT)
          ? 'MSRM'
          : 'UNKNOWN',
    },
  ];

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
            <Col span={4} style={{ textAlign: 'left' }}>
              Fee Tier
            </Col>
            <Col span={4} style={{ textAlign: 'left' }}>
              Taker
            </Col>
            <Col span={4} style={{ textAlign: 'left' }}>
              Maker
            </Col>
            <Col span={4} style={{ textAlign: 'left' }}>
              Public Key
            </Col>
            <Col span={4} style={{ textAlign: 'left' }}>
              Balance
            </Col>
            <Col span={4} style={{ textAlign: 'left' }}>
              Mint
            </Col>
          </Row>
          {dataSource.map(({ mint, balance, pubkey, feeTier }, index) => (
            <Row
              key={index}
              style={{
                fontSize: 14,
                color: 'rgba(241, 241, 242, 1)',
                paddingBottom: 16,
              }}
            >
              <Col span={4} style={{ textAlign: 'left' }}>
                <Typography>{feeTier}</Typography>
                {index === 0 ? (
                  <div style={{ marginLeft: 10 }}>
                    <Tag color={'#41C77A'} style={{ fontWeight: 700 }}>
                      Selected
                    </Tag>
                  </div>
                ) : null}
              </Col>
              <Col span={4} style={{ textAlign: 'left' }}>
                {percentFormat.format(getFeeRates(feeTier).taker)}
              </Col>
              <Col span={4} style={{ textAlign: 'left' }}>
                {percentFormat.format(getFeeRates(feeTier).maker)}
              </Col>
              <Col span={4} style={{ textAlign: 'left' }}>
                {pubkey.toBase58()}
              </Col>
              <Col span={4} style={{ textAlign: 'left' }}>
                {balance}
              </Col>
              <Col span={4} style={{ textAlign: 'left' }}>
                {mint.equals(TokenInstructions.SRM_MINT)
                  ? 'SRM'
                  : mint.equals(TokenInstructions.MSRM_MINT)
                  ? 'MSRM'
                  : 'UNKNOWN'}
              </Col>
            </Row>
          ))}
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

function FeeScheduleTable() {
  // Representation of serum-js/src/fees.ts
  const dataSource = [
    { feeTier: 0, taker: 0.0022, maker: -0.0003, token: '', balance: '' },
    { feeTier: 1, taker: 0.002, maker: -0.0003, token: 'SRM', balance: 100 },
    { feeTier: 2, taker: 0.0018, maker: -0.0003, token: 'SRM', balance: 1000 },
    { feeTier: 3, taker: 0.0016, maker: -0.0003, token: 'SRM', balance: 10000 },
    {
      feeTier: 4,
      taker: 0.0014,
      maker: -0.0003,
      token: 'SRM',
      balance: 100000,
    },
    {
      feeTier: 5,
      taker: 0.0012,
      maker: -0.0003,
      token: 'SRM',
      balance: 1000000,
    },
    { feeTier: 6, taker: 0.001, maker: -0.0005, token: 'MSRM', balance: 1 },
  ];
  const columns = [
    {
      title: 'Fee Tier',
      dataIndex: 'feeTier',
      key: 'feeTier',
    },
    {
      title: 'Taker',
      dataIndex: 'taker',
      key: 'taker',
      render: (feeTier, row) =>
        percentFormat.format(getFeeRates(row.feeTier).taker),
    },
    {
      title: 'Maker',
      dataIndex: 'maker',
      key: 'maker',
      render: (feeTier, row) =>
        percentFormat.format(getFeeRates(row.feeTier).maker),
    },
    {
      title: 'Requirements',
      dataIndex: 'requirements',
      key: 'requirements',
      render: (_, row) => (
        <Typography>
          {!row.balance ? 'None' : `≥ ${row.balance} ${row.token}`}
        </Typography>
      ),
    },
  ];
  return (
    <DataTable
      dataSource={dataSource.map((info) => ({ ...info, key: info.feeTier }))}
      columns={columns}
    />
  );
}
