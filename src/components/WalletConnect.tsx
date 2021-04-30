import React from 'react';
import { Button, Popover } from 'antd';
import { Dropdown, Menu } from 'antd';
import { InfoCircleOutlined, UserOutlined } from '@ant-design/icons';
import { useWallet } from '../utils/wallet';
import LinkAddress from './LinkAddress';

export default function WalletConnect() {
  const { connected, wallet, select, connect, disconnect } = useWallet();
  const publicKey = (connected && wallet?.publicKey?.toBase58()) || '';

  const menu = (
    <Menu>
      {connected && <LinkAddress shorten={true} address={publicKey} />}
      <Menu.Item key="3" onClick={select}>
        Change Wallet
      </Menu.Item>
    </Menu>
  );

  return (
    <Dropdown.Button onClick={connected ? disconnect : connect} overlay={menu}>
      {connected ? 'Disconnect' : 'Connect'}
    </Dropdown.Button>
  // const { connected, wallet } = useWallet();
  // const publicKey = wallet?.publicKey?.toBase58();

  // return (
  //   <React.Fragment>
  //     <Button
  //       type="text"
  //       size="large"
  //       onClick={connected ? wallet.disconnect : wallet.connect}
  //       style={{ color: '#FFF', width: 160, background: 'RGB(26,43,67)', height: 50, borderRadius: 4 }}
  //     >
  //       {/*<UserOutlined />*/}
  //       {!connected ? 'CONNECT WALLET' : 'Disconnect'}
  //     </Button>
  //     {connected && (
  //       <Popover
  //         content={<LinkAddress address={publicKey} />}
  //         placement="bottomRight"
  //         title="Wallet public key"
  //         trigger="click"
  //       >
  //         <InfoCircleOutlined style={{ color: '#2abdd2' }} />
  //       </Popover>
  //     )}
  //   </React.Fragment>
  );
}
