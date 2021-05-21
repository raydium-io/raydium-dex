import {
  InfoCircleOutlined,
  PlusCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Button, Col, Menu, Popover, Row, Select, Dropdown } from 'antd';
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
  '/swap': 'https://raydium.io/swap',
  '/liquidity': 'https://raydium.io/liquidity',
  '/farms': 'https://raydium.io/farms',
  '/staking': 'https://raydium.io/staking',
  '/migrate': 'https://raydium.io/migrate',
  '/info': 'https://raydium.io/info',
  '/fusion': 'https://raydium.io/fusion/',
  '/acceleRaytor': 'https://raydium.io/acceleraytor/',
  '/pools': 'https://raydium.io/pools/',
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
        <Row wrap={false} style={{ paddingTop: 25, height: 70 }}>
          <Col flex="none">
            <LogoWrapper onClick={() => history.push(tradePageUrl)} style={{ paddingLeft: 40}}>
              <img src={logo} alt="" style={{ width: 145, height: 40 }} />
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
                  Swap
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
                  href={EXTERNAL_LINKS['/liquidity']}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color : 'rgb(173,175,184)',}}
                >
                  Liquidity
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
                Pools
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
                  Farms
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
                  href={EXTERNAL_LINKS['/fusion']}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color : 'rgb(173,175,184)',}}
                >
                  Fusion
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
                Staking
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
                href={EXTERNAL_LINKS['/acceleRaytor']}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color : 'rgb(173,175,184)',}}
              >
                AcceleRaytor
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
                href={EXTERNAL_LINKS['/migrate']}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color : 'rgb(173,175,184)',}}
              >
                Migrate
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
                href={EXTERNAL_LINKS['/info']}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color : 'rgb(173,175,184)',}}
              >
                Info
              </a>
            </div>
          </Col>
          <Col flex="none" style={{ paddingRight: 20}}>
            <WalletConnect />
          </Col>
        </Row>
      </Wrapper>
    </>
  );
}
