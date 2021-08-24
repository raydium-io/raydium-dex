import React from 'react';
import { Row, Col } from 'antd';
import { useFills, useMarket } from '../../utils/markets';

export default function FillsTable() {
  const fills = useFills();

  const { quoteCurrency } = useMarket();

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
              Price
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
