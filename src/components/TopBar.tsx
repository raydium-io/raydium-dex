import {
  InfoCircleOutlined,
  PlusCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Button, Col, Menu, Popover, Row, Select, } from 'antd';
import React, { useCallback, useEffect, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import logo from '../assets/logo.svg';
import styled from 'styled-components';
import { useWallet, WALLET_PROVIDERS } from '../utils/wallet';
import { ENDPOINTS, useConnectionConfig } from '../utils/connection';
import Settings from './Settings';
import CustomClusterEndpointDialog from './CustomClusterEndpointDialog';
import { EndpointInfo } from '../utils/types';
import { notify } from '../utils/notifications';
import { Connection } from '@solana/web3.js';
import WalletConnect from './WalletConnect';
import AppSearch from './AppSearch';
import { getTradePageUrl } from '../utils/markets';

const Wrapper = styled.div`
  // flex-direction: row;
  // justify-content: flex-end;
  // flex-wrap: wrap;
`;
const LogoWrapper = styled.div`
  display: flex;
  align-items: center;
  color: #2abdd2;
  font-weight: bold;
  cursor: pointer;
  img {
    height: 30px;
    margin-right: 8px;
  }
`;

const EXTERNAL_LINKS = {
  '/learn': 'https://serum-academy.com/en/serum-dex/',
  '/add-market': 'https://serum-academy.com/en/add-market/',
  '/wallet-support': 'https://serum-academy.com/en/wallet-support',
  '/dex-list': 'https://serum-academy.com/en/dex-list/',
  '/developer-resources': 'https://serum-academy.com/en/developer-resources/',
  '/explorer': 'https://explorer.solana.com',
  '/srm-faq': 'https://projectserum.com/srm-faq',
  '/swap': 'https://raydium.io/#/swap',
  '/pools': 'https://raydium.io/#/pool',
  '/staking': 'https://raydium.io/#/stake',
  '/farms': 'https://raydium.io/#/farm',
};

export default function TopBar() {
  const { connected, wallet, providerUrl, setProvider } = useWallet();
  const {
    endpoint,
    endpointInfo,
    setEndpoint,
    availableEndpoints,
    setCustomEndpoints,
  } = useConnectionConfig();
  const [addEndpointVisible, setAddEndpointVisible] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const location = useLocation();
  const history = useHistory();
  const [searchFocussed, setSearchFocussed] = useState(false);

  const handleClick = useCallback(
    (e) => {
      if (!(e.key in EXTERNAL_LINKS)) {
        history.push(e.key);
      }
    },
    [history],
  );

  const onAddCustomEndpoint = (info: EndpointInfo) => {
    const existingEndpoint = availableEndpoints.some(
      (e) => e.endpoint === info.endpoint,
    );
    if (existingEndpoint) {
      notify({
        message: `An endpoint with the given url already exists`,
        type: 'error',
      });
      return;
    }

    const handleError = (e) => {
      console.log(`Connection to ${info.endpoint} failed: ${e}`);
      notify({
        message: `Failed to connect to ${info.endpoint}`,
        type: 'error',
      });
    };

    try {
      const connection = new Connection(info.endpoint, 'recent');
      connection
        .getEpochInfo()
        .then((result) => {
          setTestingConnection(true);
          console.log(`testing connection to ${info.endpoint}`);
          const newCustomEndpoints = [
            ...availableEndpoints.filter((e) => e.custom),
            info,
          ];
          setEndpoint(info.endpoint);
          setCustomEndpoints(newCustomEndpoints);
        })
        .catch(handleError);
    } catch (e) {
      handleError(e);
    } finally {
      setTestingConnection(false);
    }
  };

  const endpointInfoCustom = endpointInfo && endpointInfo.custom;
  useEffect(() => {
    const handler = () => {
      if (endpointInfoCustom) {
        setEndpoint(ENDPOINTS[0].endpoint);
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [endpointInfoCustom, setEndpoint]);

  const tradePageUrl = location.pathname.startsWith('/market/')
    ? location.pathname
    : getTradePageUrl();

  return (
    <>
      <CustomClusterEndpointDialog
        visible={addEndpointVisible}
        testingConnection={testingConnection}
        onAddCustomEndpoint={onAddCustomEndpoint}
        onClose={() => setAddEndpointVisible(false)}
      />
      <Wrapper style={{ background: '#0F1429'}}>
        <Row wrap={false} style={{ paddingTop: 25 }}>
          <Col flex="none">
            <LogoWrapper onClick={() => history.push(tradePageUrl)}>
              <img src={logo} alt="" style={{ width: 145, height: 40}} />
            </LogoWrapper>
          </Col>
          <Col flex="auto" style={{ textAlign: 'center'}}>
              <div
                style={{
                  height: 50,
                  width: 100,
                  textAlign: 'center',
                  border: 'transparent',
                  borderBottom: '1px solid RGB(194,0,251)',
                  background: 'transparent',
                  fontSize: 14,
                  fontStyle: 'normal',
                  fontWeight: 600,
                  color: 'rgb(173,175,184)',
                  display: 'inline-block',
                }}
              >
                TRADING
              </div>
              <div
                style={{
                  height: 50,
                  width: 100,
                  textAlign: 'center',
                  border: 'transparent',
                  background: 'transparent',
                  fontSize: 14,
                  fontStyle: 'normal',
                  fontWeight: 600,
                  color: 'rgb(173,175,184)',
                  display: 'inline-block',
                }}
              >
                <a
                  href={EXTERNAL_LINKS['/swap']}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color : 'rgb(173,175,184)',}}
                >
                  SWAP
                </a>
              </div>
              <div
                style={{
                  height: 50,
                  width: 100,
                  textAlign: 'center',
                  border: 'transparent',
                  background: 'transparent',
                  fontSize: 14,
                  fontStyle: 'normal',
                  fontWeight: 600,
                  color: 'rgb(173,175,184)',
                  display: 'inline-block',
                }}
              >
                <a
                  href={EXTERNAL_LINKS['/pools']}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color : 'rgb(173,175,184)',}}
                >
                  POOLS
                </a>
              </div>
              <div
                style={{
                  height: 50,
                  width: 100,
                  textAlign: 'center',
                  border: 'transparent',
                  background: 'transparent',
                  fontSize: 14,
                  fontStyle: 'normal',
                  fontWeight: 600,
                  color: 'rgb(173,175,184)',
                  display: 'inline-block',
                }}
              >
                <a
                  href={EXTERNAL_LINKS['/staking']}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color : 'rgb(173,175,184)',}}
                >
                  STAKING
                </a>
              </div>
              <div
                style={{
                  height: 50,
                  width: 100,
                  textAlign: 'center',
                  border: 'transparent',
                  background: 'transparent',
                  fontSize: 14,
                  fontStyle: 'normal',
                  fontWeight: 600,
                  color: 'rgb(173,175,184)',
                  display: 'inline-block',
                }}
              >
                <a
                  href={EXTERNAL_LINKS['/farms']}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color : 'rgb(173,175,184)',}}
                >
                  FARMS
                </a>
              </div>

            {/*<Menu*/}
            {/*  mode="horizontal"*/}
            {/*  onClick={handleClick}*/}
            {/*  selectedKeys={[location.pathname]}*/}
            {/*  style={{*/}
            {/*    borderBottom: 'none',*/}
            {/*    backgroundColor: 'transparent',*/}
            {/*    textAlign: 'center',*/}
            {/*    color: '#F1F1F2',*/}

            {/*  }}*/}
            {/*>*/}
            {/*  <Menu.Item key={tradePageUrl} style={{ width: 100}}>*/}
            {/*    TRADEING*/}
            {/*  </Menu.Item>*/}
            {/*  <Menu.Item key="/swap">*/}
            {/*    <a*/}
            {/*      href={EXTERNAL_LINKS['/swap']}*/}
            {/*      target="_blank"*/}
            {/*      rel="noopener noreferrer"*/}
            {/*    >*/}
            {/*      SWAP*/}
            {/*    </a>*/}
            {/*  </Menu.Item>*/}
            {/*  <Menu.Item key="/pools">*/}
            {/*    <a*/}
            {/*      href={EXTERNAL_LINKS['/pools']}*/}
            {/*      target="_blank"*/}
            {/*      rel="noopener noreferrer"*/}
            {/*    >*/}
            {/*      POOLS*/}
            {/*    </a>*/}
            {/*  </Menu.Item>*/}
            {/*  <Menu.Item key="/staking">*/}
            {/*    <a*/}
            {/*      href={EXTERNAL_LINKS['/staking']}*/}
            {/*      target="_blank"*/}
            {/*      rel="noopener noreferrer"*/}
            {/*    >*/}
            {/*      STAKING*/}
            {/*    </a>*/}
            {/*  </Menu.Item>*/}
            {/*  <Menu.Item key="/farms">*/}
            {/*    <a*/}
            {/*      href={EXTERNAL_LINKS['/farms']}*/}
            {/*      target="_blank"*/}
            {/*      rel="noopener noreferrer"*/}
            {/*    >*/}
            {/*      FARMS*/}
            {/*    </a>*/}
            {/*  </Menu.Item>*/}

              {/*{!searchFocussed && (*/}
              {/*  <Menu.Item key="/swap" style={{ margin: '0 10px' }}>*/}
              {/*    <a*/}
              {/*      href={EXTERNAL_LINKS['/swap']}*/}
              {/*      target="_blank"*/}
              {/*      rel="noopener noreferrer"*/}
              {/*    >*/}
              {/*      SWAP*/}
              {/*    </a>*/}
              {/*  </Menu.Item>*/}
              {/*)}*/}
              {/*{connected && (!searchFocussed || location.pathname === '/balances') && (*/}
              {/*  <Menu.Item key="/balances" style={{ margin: '0 10px', width: 100 }}>*/}
              {/*    BALANCES*/}
              {/*  </Menu.Item>*/}
              {/*)}*/}
              {/*{connected && (!searchFocussed || location.pathname === '/orders') && (*/}
              {/*  <Menu.Item key="/orders" style={{ margin: '0 10px', width: 100 }}>*/}
              {/*    ORDERS*/}
              {/*  </Menu.Item>*/}
              {/*)}*/}
              {/*{connected && (!searchFocussed || location.pathname === '/convert') && (*/}
              {/*  <Menu.Item key="/convert" style={{ margin: '0 10px', width: 100 }}>*/}
              {/*    CONVERT*/}
              {/*  </Menu.Item>*/}
              {/*)}*/}
              {/*{(!searchFocussed || location.pathname === '/list-new-market') && (*/}
              {/*  <Menu.Item key="/list-new-market" style={{ margin: '0 10px', width: 100 }}>*/}
              {/*    ADD MARKET*/}
              {/*  </Menu.Item>*/}
              {/*)}*/}
              {/*{!searchFocussed && (*/}
              {/*  <Menu.SubMenu*/}
              {/*    title="LEARN"*/}
              {/*    onTitleClick={() =>*/}
              {/*      window.open(EXTERNAL_LINKS['/learn'], '_blank')*/}
              {/*    }*/}
              {/*    style={{ margin: '0 0px 0 10px' }}*/}
              {/*  >*/}
              {/*    <Menu.Item key="/add-market">*/}
              {/*      <a*/}
              {/*        href={EXTERNAL_LINKS['/add-market']}*/}
              {/*        target="_blank"*/}
              {/*        rel="noopener noreferrer"*/}
              {/*      >*/}
              {/*        Adding a market*/}
              {/*      </a>*/}
              {/*    </Menu.Item>*/}
              {/*    <Menu.Item key="/wallet-support">*/}
              {/*      <a*/}
              {/*        href={EXTERNAL_LINKS['/wallet-support']}*/}
              {/*        target="_blank"*/}
              {/*        rel="noopener noreferrer"*/}
              {/*      >*/}
              {/*        Supported wallets*/}
              {/*      </a>*/}
              {/*    </Menu.Item>*/}
              {/*    <Menu.Item key="/dex-list">*/}
              {/*      <a*/}
              {/*        href={EXTERNAL_LINKS['/dex-list']}*/}
              {/*        target="_blank"*/}
              {/*        rel="noopener noreferrer"*/}
              {/*      >*/}
              {/*        DEX list*/}
              {/*      </a>*/}
              {/*    </Menu.Item>*/}
              {/*    <Menu.Item key="/developer-resources">*/}
              {/*      <a*/}
              {/*        href={EXTERNAL_LINKS['/developer-resources']}*/}
              {/*        target="_blank"*/}
              {/*        rel="noopener noreferrer"*/}
              {/*      >*/}
              {/*        Developer resources*/}
              {/*      </a>*/}
              {/*    </Menu.Item>*/}
              {/*    <Menu.Item key="/explorer">*/}
              {/*      <a*/}
              {/*        href={EXTERNAL_LINKS['/explorer']}*/}
              {/*        target="_blank"*/}
              {/*        rel="noopener noreferrer"*/}
              {/*      >*/}
              {/*        Solana block explorer*/}
              {/*      </a>*/}
              {/*    </Menu.Item>*/}
              {/*    <Menu.Item key="/srm-faq">*/}
              {/*      <a*/}
              {/*        href={EXTERNAL_LINKS['/srm-faq']}*/}
              {/*        target="_blank"*/}
              {/*        rel="noopener noreferrer"*/}
              {/*      >*/}
              {/*        SRM FAQ*/}
              {/*      </a>*/}
              {/*    </Menu.Item>*/}
              {/*  </Menu.SubMenu>*/}
              {/*)}*/}
            {/*</Menu>*/}
          </Col>
          <Col flex="none">
            <WalletConnect />
          </Col>
          <Col flex="none">
            {/*<div*/}
            {/*  style={{*/}
            {/*    display: 'flex',*/}
            {/*    alignItems: 'center',*/}
            {/*    paddingRight: 5,*/}
            {/*  }}*/}
            {/*>*/}
            {/*  <AppSearch*/}
            {/*    onFocus={() => setSearchFocussed(true)}*/}
            {/*    onBlur={() => setSearchFocussed(false)}*/}
            {/*    focussed={searchFocussed}*/}
            {/*    width={searchFocussed ? '350px' : '35px'}*/}
            {/*  />*/}
            {/*</div>*/}
            <div style={{ display: 'inline-block'}}>
              <Row
                align="middle"
                style={{ paddingLeft: 5, paddingRight: 5 }}
                gutter={16}
              >
                {/*<Col>*/}
                {/*  <PlusCircleOutlined*/}
                {/*    style={{ color: '#2abdd2' }}*/}
                {/*    onClick={() => setAddEndpointVisible(true)}*/}
                {/*  />*/}
                {/*</Col>*/}
                {/*<Col>*/}
                {/*  <Popover*/}
                {/*    content={endpoint}*/}
                {/*    placement="bottomRight"*/}
                {/*    title="URL"*/}
                {/*    trigger="hover"*/}
                {/*  >*/}
                {/*    <InfoCircleOutlined style={{ color: '#2abdd2' }} />*/}
                {/*  </Popover>*/}
                {/*</Col>*/}
                <Col>
                  <Select
                    onSelect={setEndpoint}
                    value={endpoint}
                    style={{ marginRight: 8, width: '150px' }}
                  >
                    {availableEndpoints.map(({ name, endpoint }) => (
                      <Select.Option value={endpoint} key={endpoint}>
                        {name}
                      </Select.Option>
                    ))}
                  </Select>
                </Col>
              </Row>
            </div>
            {connected && (
              <div>
                <Popover
                  content={<Settings autoApprove={wallet?.autoApprove} />}
                  placement="bottomRight"
                  title="Settings"
                  trigger="click"
                >
                  <Button style={{ marginRight: 8 }}>
                    <SettingOutlined />
                    Settings
                  </Button>
                </Popover>
              </div>
            )}
            <div style={{ display: 'inline-block'}}>
              <Select onSelect={setProvider} value={providerUrl}>
                {WALLET_PROVIDERS.map(({ name, url }) => (
                  <Select.Option value={url} key={url}>
                    {name}
                  </Select.Option>
                ))}
              </Select>
            </div>
            {/*<div>*/}
            {/*  <WalletConnect />*/}
            {/*</div>*/}
          </Col>
        </Row>
      </Wrapper>
    </>
  );
}
