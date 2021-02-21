import React from 'react';
import { Row, Col, Tag } from 'antd';
import { useFills, useMarket } from '../../utils/markets';
import DataTable from '../layout/DataTable';

export default function FillsTable() {
  const fills = useFills();

  const { quoteCurrency } = useMarket();

  const columns = [
    {
      title: 'Market',
      dataIndex: 'marketName',
      key: 'marketName',
    },
    {
      title: 'Side',
      dataIndex: 'side',
      key: 'side',
      render: (side) => (
        <Tag
          color={side === 'buy' ? '#41C77A' : '#F23B69'}
          style={{ fontWeight: 700 }}
        >
          {side.charAt(0).toUpperCase() + side.slice(1)}
        </Tag>
      ),
    },
    {
      title: `Size`,
      dataIndex: 'size',
      key: 'size',
    },
    {
      title: `Price`,
      dataIndex: 'price',
      key: 'price',
    },
    {
      title: `Liquidity`,
      dataIndex: 'liquidity',
      key: 'liquidity',
    },
    {
      title: quoteCurrency ? `Fees (${quoteCurrency})` : 'Fees',
      dataIndex: 'feeCost',
      key: 'feeCost',
    },
  ];

  const dataSource = (fills || []).map((fill) => ({
    ...fill,
    key: `${fill.orderId}${fill.side}`,
    liquidity: fill.eventFlags.maker ? 'Maker' : 'Taker',
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
              Market
            </Col>
            <Col span={4} style={{ textAlign: 'right' }}>
              Side
            </Col>
            <Col span={4} style={{ textAlign: 'right' }}>
              Size
            </Col>
            <Col span={4} style={{ textAlign: 'right' }}>
              Pirce
            </Col>
            <Col span={4} style={{ textAlign: 'right' }}>
              Liquidity
            </Col>
            <Col span={4} style={{ textAlign: 'right' }}>
              {quoteCurrency ? `Fees (${quoteCurrency})` : 'Fees'}
            </Col>
          </Row>
          <div style={{ height: 350, overflowX: 'hidden' }}>
            {dataSource.map(
              ({ marketName, side, size, price, liquidity, feeCost }, i) => (
                <Row
                  key={i}
                  style={{
                    fontSize: 14,
                    color: 'rgba(241, 241, 242, 1)',
                    paddingBottom: 16,
                  }}
                >
                  <Col span={4} style={{ textAlign: 'left' }}>
                    {marketName}
                  </Col>
                  <Col
                    span={4}
                    style={{
                      textAlign: 'right',
                      color: 'rgba(90, 196, 190, 1)',
                    }}
                  >
                    {side}
                  </Col>
                  <Col
                    span={4}
                    style={{
                      textAlign: 'right',
                      color: 'rgba(90, 196, 190, 1)',
                    }}
                  >
                    {size}
                  </Col>
                  <Col span={4} style={{ textAlign: 'right' }}>
                    {price}
                  </Col>
                  <Col span={4} style={{ textAlign: 'right' }}>
                    {liquidity}
                  </Col>
                  <Col span={4} style={{ textAlign: 'right' }}>
                    {feeCost}
                  </Col>
                </Row>
              ),
            )}
          </div>
          {/*<DataTable*/}
          {/*  dataSource={dataSource}*/}
          {/*  columns={columns}*/}
          {/*  pagination={true}*/}
          {/*  pageSize={5}*/}
          {/*  emptyLabel="No fills"*/}
          {/*/>*/}
        </Col>
      </Row>
    </>
  );
}
