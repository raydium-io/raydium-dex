import {
  Balances,
  CustomMarketInfo,
  DeprecatedOpenOrdersBalances,
  FullMarketInfo,
  MarketContextValues,
  MarketInfo,
  OrderWithMarketAndMarketName,
  SelectedTokenAccounts,
  TokenAccount
} from './types';
import {
  MARKETS,
  Market,
  OpenOrders,
  Orderbook,
  TOKEN_MINTS,
  TokenInstructions
} from '@project-serum/serum';
import React, { useContext, useEffect, useState } from 'react';
import {getCache, setCache} from './fetch-loop';
import {
  divideBnToNumber,
  floorToDecimal,
  getTokenMultiplierFromDecimals,
  useLocalStorageState,
} from './utils';
import {
  getTokenAccountInfo,
  parseTokenAccountData,
  useMintInfos,
} from './tokens';
import { refreshCache, useAsyncData } from './fetch-loop';
import { useAccountData, useAccountInfo, useConnection } from './connection';

import BN from 'bn.js';
import RaydiumApi from './raydiumConnector';
import { Order } from '@project-serum/serum/lib/market';
import { PublicKey , Connection} from '@solana/web3.js';
import { WRAPPED_SOL_MINT } from '@project-serum/serum/lib/token-instructions';
import { notify } from './notifications';
import { sleep } from './utils';
import tuple from 'immutable-tuple';
import { useWallet } from './wallet';

// Used in debugging, should be false in production
const _IGNORE_DEPRECATED = false;

const _MARKETS = [
  {
    name: 'RAY/WUSDT',
    deprecated: true,
    address: new PublicKey('C4z32zw9WKaGPhNuU54ohzrV4CE1Uau3cFx6T8RLjxYC'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'RAY/USDC',
    deprecated: false,
    address: new PublicKey('2xiv8A5xrJ7RnGdxXB42uFEkYHJjszEhaJyKKt4WaLep'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'RAY/USDT',
    deprecated: false,
    address: new PublicKey('teE55QrL4a4QSfydR9dnHF97jgCfptpuigbb53Lo95g'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'RAY/SRM',
    deprecated: false,
    address: new PublicKey('Cm4MmknScg7qbKqytb1mM92xgDxv3TNXos4tKbBqTDy7'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'RAY/SOL',
    deprecated: false,
    address: new PublicKey('C6tp2RVZnxBPFbnAsfTjis8BN9tycESAT4SgDQgbbrsA'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'RAY/ETH',
    deprecated: false,
    address: new PublicKey('6jx6aoNFbmorwyncVP5V5ESKfuFc9oUYebob1iF6tgN4'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'RAY/USDT-V2',
    deprecated: true,
    address: new PublicKey('HZyhLoyAnfQ72irTdqPdWo2oFL9zzXaBmAqN72iF3sdX'),
    programId: new PublicKey('EUqojwWA2rd19FZrzeBncJsm38Jm1hEhE3zsmX3bRc2o'),
  },
  {
    name: 'RAY/USDC-V2',
    deprecated: true,
    address: new PublicKey('Bgz8EEMBjejAGSn6FdtKJkSGtvg4cuJUuRwaCBp28S3U'),
    programId: new PublicKey('EUqojwWA2rd19FZrzeBncJsm38Jm1hEhE3zsmX3bRc2o'),
  },
  {
    name: 'RAY/SRM-V2',
    deprecated: true,
    address: new PublicKey('HSGuveQDXtvYR432xjpKPgHfzWQxnb3T8FNuAAvaBbsU'),
    programId: new PublicKey('EUqojwWA2rd19FZrzeBncJsm38Jm1hEhE3zsmX3bRc2o'),
  },
  {
    name: 'OXY/WUSDT',
    deprecated: true,
    address: new PublicKey('HdBhZrnrxpje39ggXnTb6WuTWVvj5YKcSHwYGQCRsVj'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'OXY/USDC',
    deprecated: true,
    address: new PublicKey('GZ3WBFsqntmERPwumFEYgrX2B7J7G11MzNZAy7Hje27X'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'FIDA/RAY',
    deprecated: false,
    address: new PublicKey('9wH4Krv8Vim3op3JAu5NGZQdGxU8HLGAHZh3K77CemxC'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'OXY/RAY',
    deprecated: false,
    address: new PublicKey('HcVjkXmvA1815Es3pSiibsRaFw8r9Gy7BhyzZX83Zhjx'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'MAPS/RAY',
    deprecated: false,
    address: new PublicKey('7Q4hee42y8ZGguqKmwLhpFNqVTjeVNNBqhx8nt32VF85'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'KIN/RAY',
    deprecated: false,
    address: new PublicKey('Fcxy8qYgs8MZqiLx2pijjay6LHsSUqXW47pwMGysa3i9'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'YFI/SRM',
    deprecated: false,
    address: new PublicKey('6xC1ia74NbGZdBkySTw93wdxN4Sh2VfULtXh1utPaJDJ'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'FTT/SRM',
    deprecated: false,
    address: new PublicKey('CDvQqnMrt9rmjAxGGE6GTPUdzLpEhgNuNZ1tWAvPsF3W'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'BTC/SRM',
    deprecated: false,
    address: new PublicKey('HfsedaWauvDaLPm6rwgMc6D5QRmhr8siqGtS6tf2wthU'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SUSHI/SRM',
    deprecated: false,
    address: new PublicKey('FGYAizUhNEC9GBmj3UyxdiRWmGjR3TfzMq2dznwYnjtH'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'TOMO/SRM',
    deprecated: false,
    address: new PublicKey('7jBrpiq3w2ywzzb54K9SoosZKy7nhuSQK9XrsgSMogFH'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'LINK/SRM',
    deprecated: false,
    address: new PublicKey('FafaYTnhDbLAFsr5qkD2ZwapRxaPrEn99z59UG4zqRmZ'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'ETH/SRM',
    deprecated: false,
    address: new PublicKey('3Dpu2kXk87mF9Ls9caWCHqyBiv9gK3PwQkSvnrHZDrmi'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'STEP/USDC',
    deprecated: false,
    address: new PublicKey('97qCB4cAVSTthvJu3eNoEx6AY6DLuRDtCoPm5Tdyg77S'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'MEDIA/USDC',
    deprecated: false,
    address: new PublicKey('FfiqqvJcVL7oCCu8WQUMHLUC2dnHQPAPjTdSzsERFWjb'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'ROPE/USDC',
    deprecated: false,
    address: new PublicKey('4Sg1g8U2ZuGnGYxAhc6MmX9MX7yZbrrraPkCQ9MdCPtF'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'COPE/USDC',
    deprecated: false,
    address: new PublicKey('6fc7v3PmjZG9Lk2XTot6BywGyYLkBQuzuFKd4FpCsPxk'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'MER/USDC',
    deprecated: false,
    address: new PublicKey('G4LcexdCzzJUKZfqyVDQFzpkjhB1JoCNL8Kooxi9nJz5'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'TULIP/USDC',
    deprecated: false,
    address: new PublicKey('8GufnKq7YnXKhnB3WNhgy5PzU9uvHbaaRrZWQK6ixPxW'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'WOO/USDC',
    deprecated: false,
    address: new PublicKey('2Ux1EYeWsxywPKouRCNiALCZ1y3m563Tc4hq1kQganiq'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SNY/USDC',
    deprecated: false,
    address: new PublicKey('DPfj2jYwPaezkCmUNm5SSYfkrkz8WFqwGLcxDDUsN3gA'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'BOP/RAY',
    deprecated: false,
    address: new PublicKey('6Fcw8aEs7oP7YeuMrM2JgAQUotYxa4WHKHWdLLXssA3R'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SLRS/USDC',
    deprecated: false,
    address: new PublicKey('2Gx3UfV831BAh8uQv1FKSPKS9yajfeeD8GJ4ZNb2o2YP'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SAMO/RAY',
    deprecated: false,
    address: new PublicKey('AAfgwhNU5LMjHojes1SFmENNjihQBDKdDDT1jog4NV8w'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'renBTC/USDC',
    deprecated: false,
    address: new PublicKey('74Ciu5yRzhe8TFTHvQuEVbFZJrbnCMRoohBK33NNiPtv'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'renDOGE/USDC',
    deprecated: false,
    address: new PublicKey('5FpKCWYXgHWZ9CdDMHjwxAfqxJLdw2PRXuAmtECkzADk'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'LIKE/USDC',
    deprecated: false,
    address: new PublicKey('3WptgZZu34aiDrLMUiPntTYZGNZ72yT1yxHYxSdbTArX'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'DXL/USDC',
    deprecated: false,
    address: new PublicKey('DYfigimKWc5VhavR4moPBibx9sMcWYVSjVdWvPztBPTa'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'mSOL/USDC',
    deprecated: false,
    address: new PublicKey('6oGsL2puUgySccKzn9XA9afqF217LfxP5ocq4B3LWsjy'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'mSOL/SOL',
    deprecated: false,
    address: new PublicKey('5cLrMai1DsLRYc1Nio9qMTicsWtvzjzZfJPXyAoF4t1Z'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'MER/PAI',
    deprecated: false,
    address: new PublicKey('FtxAV7xEo6DLtTszffjZrqXknAE4wpTSfN6fBHW4iZpE'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'PORT/USDC',
    deprecated: false,
    address: new PublicKey('8x8jf7ikJwgP9UthadtiGFgfFuyyyYPHL3obJAuxFWko'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'MNGO/USDC',
    deprecated: false,
    address: new PublicKey('3d4rzwpy9iGdCZvgxcu7B1YocYffVLsQXPXkBZKt2zLc'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'ALEPH/RAY',
    deprecated: false,
    address: new PublicKey('4qATPNrEGqE4yFJhXXWtppzJj5evmUaZ5LJspjL6TRoU'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'TULIP/RAY',
    deprecated: false,
    address: new PublicKey('GXde1EjpxVV5fzhHJcZqdLmsA3zmaChGFstZMjWsgKW7'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SLRS/RAY',
    deprecated: false,
    address: new PublicKey('BkJVRQZ7PjfwevMKsyjjpGZ4j6sBu9j5QTUmKuTLZNrq'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'MER/RAY',
    deprecated: false,
    address: new PublicKey('75yk6hSTuX6n6PoPRxEbXapJbbXj4ynw3gKgub7vRdUf'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'MEDIA/RAY',
    deprecated: false,
    address: new PublicKey('2STXADodK1iZhGh54g3QNrq2Ap4TMwrAzV3Ja14UXut9'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SNY/RAY',
    deprecated: false,
    address: new PublicKey('HFAsygpAgFq3f9YQ932ptoEsEdBP2ELJSAK5eYAJrg4K'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'LIKE/RAY',
    deprecated: false,
    address: new PublicKey('E4ohEJNB86RkKoveYtQZuDX1GzbxE2xrbdjJ7EddCc5T'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'COPE/RAY',
    deprecated: false,
    address: new PublicKey('6y9WTFJRYoqKXQQZftFxzLdnBYStvqrDmLwTFAUarudt'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'ATLAS/RAY',
    deprecated: false,
    address: new PublicKey('Bn7n597jMxU4KjBPUo3QwJhbqr5145cHy31p6EPwPHwL'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'ATLAS/USDC',
    deprecated: false,
    address: new PublicKey('Di66GTLsV64JgCCYGVcY21RZ173BHkjJVgPyezNN7P1K'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'POLIS/RAY',
    deprecated: false,
    address: new PublicKey('3UP5PuGN6db7NhWf4Q76FLnR4AguVFN14GvgDbDj1u7h'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'POLIS/USDC',
    deprecated: false,
    address: new PublicKey('HxFLKUAmAMLz1jtT3hbvCMELwH5H9tpM2QugP8sKyfhW'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'GRAPE/USDC',
    deprecated: false,
    address: new PublicKey('72aW3Sgp1hMTXUiCq8aJ39DX2Jr7sZgumAvdLrLuCMLe'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'LARIX/USDC',
    deprecated: false,
    address: new PublicKey('DE6EjZoMrC5a3Pbdk8eCMGEY9deeeHECuGFmEuUpXWZm'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'RIN/USDC',
    deprecated: false,
    address: new PublicKey('7gZNLDbWE73ueAoHuAeFoSu7JqmorwCLpNTBXHtYSFTa'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'APEX/USDC',
    deprecated: false,
    address: new PublicKey('GX26tyJyDxiFj5oaKvNB9npAHNgdoV9ZYHs5ijs5yG2U'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'mSOL/RAY',
    deprecated: false,
    address: new PublicKey('HVFpsSP4QsC8gFfsFWwYcdmvt3FepDRB6xdFK2pSQtMr'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'MNDE/mSOL',
    deprecated: false,
    address: new PublicKey('AVxdeGgihchiKrhWne5xyUJj7bV2ohACkQFXMAtpMetx'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'LARIX/RAY',
    deprecated: false,
    address: new PublicKey('5GH4F2Z9adqkEP8FtR4sJqvrVgBuUSrWoQAa7bVCdB44'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'LIQ/USDC',
    deprecated: false,
    address: new PublicKey('D7p7PebNjpkH6VNHJhmiDFNmpz9XE7UaTv9RouxJMrwb'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'LIQ/RAY',
    deprecated: false,
    address: new PublicKey('FL8yPAyVTepV5YfzDfJvNu6fGL7Rcv5v653LdZ6h4Bsu'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'WAG/USDC',
    deprecated: false,
    address: new PublicKey('BHqcTEDhCoZgvXcsSbwnTuzPdxv1HPs6Kz4AnPpNrGuq'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'JungleCats/SOL',
    deprecated: false,
    address: new PublicKey('3KazPGTkRSn7znj5WSDUVYt73n6H87CLGw8HB5b9oeKF'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SYP/SOL',
    deprecated: false,
    address: new PublicKey('4ksjTQDc2rV3d1ZHdPxmi5s6TRc3j4aa7rAUKiY7nneh'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SYP/RAY',
    deprecated: false,
    address: new PublicKey('5s966j9dDcs6c25MZjUZJUCvpABpC4gXqf9pktwfzhw1'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SYP/USDC',
    deprecated: false,
    address: new PublicKey('9cuBrXXSH9Uw51JB9odLqEyeF5RQSeRpcfXbEW2L8X6X'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'MUNK/SOL',
    deprecated: false,
    address: new PublicKey('DgaNcvuYRA6rvUxptJRKh7T6qYT6TUxE4hNVZnE5Pmyj'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'Legends/SOL',
    deprecated: false,
    address: new PublicKey('7gqTp42iihaM4L997sAahnXdBNwzi1dNVuyR1nAtrYPJ'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'WOOF/RAY',
    deprecated: false,
    address: new PublicKey('EfckmBgVkKxBAqPgzLNni6mW1gbHaRKiJSJ3KgWihZ7V'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'WOOF/USDC',
    deprecated: false,
    address: new PublicKey('CwK9brJ43MR4BJz2dwnDM7EXCNyHhGqCJDrAdsEts8n5'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  // ...MARKETS,
];

MARKETS.forEach(item => {
  if (item.address.toBase58() === '5GAPymgnnWieGcRrcghZdA3aanefqa4cZx1ZSE8UTyMV') return
  if (_MARKETS.find(oldMarket => oldMarket.address.toBase58() === item.address.toBase58())) return

  if (item.address.toBase58() === '7MpMwArporUHEGW7quUpkPZp5L5cHPs9eKUfKCdaPHq2') {
    _MARKETS.push( {
      address: item.address,
      name: 'xCOPE/USDC',
      programId: item.programId,
      deprecated: item.deprecated,
    })
    return
  }
  
  _MARKETS.push(item)
})

export const USE_MARKETS: MarketInfo[] = _IGNORE_DEPRECATED
  ? _MARKETS.map((m) => ({ ...m, deprecated: false }))
  : _MARKETS;

export function useMarketsList() {
  return USE_MARKETS.filter(({ deprecated }) => !deprecated);
}

export function useAllMarkets() {
  const connection = useConnection();
  const { customMarkets } = useCustomMarkets();

  const getAllMarkets = async () => {
    const markets: Array<{
      market: Market;
      marketName: string;
      programId: PublicKey;
    } | null> = await Promise.all(
      getMarketInfos(customMarkets).map(async (marketInfo) => {
        try {
          const market = await Market.load(
            connection,
            marketInfo.address,
            {},
            marketInfo.programId,
          );
          return {
            market,
            marketName: marketInfo.name,
            programId: marketInfo.programId,
          };
        } catch (e) {
          notify({
            message: 'Error loading all market',
            description: e.message,
            type: 'error',
          });
          return null;
        }
      }),
    );
    return markets.filter(
      (m): m is { market: Market; marketName: string; programId: PublicKey } =>
        !!m,
    );
  };
  return useAsyncData(
    getAllMarkets,
    tuple('getAllMarkets', customMarkets.length, connection),
    { refreshInterval: _VERY_SLOW_REFRESH_INTERVAL },
  );
}

export function useUnmigratedOpenOrdersAccounts() {
  const connection = useConnection();
  const { wallet } = useWallet();

  async function getUnmigratedOpenOrdersAccounts(): Promise<OpenOrders[]> {
    if (!wallet || !connection || !wallet.publicKey) {
      return [];
    }
    console.log('refreshing useUnmigratedOpenOrdersAccounts');
    let deprecatedOpenOrdersAccounts: OpenOrders[] = [];
    const deprecatedProgramIds = Array.from(
      new Set(
        USE_MARKETS.filter(
          ({ deprecated }) => deprecated,
        ).map(({ programId }) => programId.toBase58()),
      ),
    ).map((publicKeyStr) => new PublicKey(publicKeyStr));
    let programId: PublicKey;
    for (programId of deprecatedProgramIds) {
      try {
        const openOrdersAccounts = await OpenOrders.findForOwner(
          connection,
          wallet.publicKey,
          programId,
        );
        deprecatedOpenOrdersAccounts = deprecatedOpenOrdersAccounts.concat(
          openOrdersAccounts
            .filter(
              (openOrders) =>
                openOrders.baseTokenTotal.toNumber() ||
                openOrders.quoteTokenTotal.toNumber(),
            )
            .filter((openOrders) =>
              USE_MARKETS.some(
                (market) =>
                  market.deprecated && market.address.equals(openOrders.market),
              ),
            ),
        );
      } catch (e) {
        console.log(
          'Error loading deprecated markets',
          programId?.toBase58(),
          e.message,
        );
      }
    }
    // Maybe sort
    return deprecatedOpenOrdersAccounts;
  }

  const cacheKey = tuple(
    'getUnmigratedOpenOrdersAccounts',
    connection,
    wallet?.publicKey?.toBase58(),
  );
  const [accounts] = useAsyncData(getUnmigratedOpenOrdersAccounts, cacheKey, {
    refreshInterval: _VERY_SLOW_REFRESH_INTERVAL,
  });

  return {
    accounts,
    refresh: (clearCache: boolean) => refreshCache(cacheKey, clearCache),
  };
}

const MarketContext: React.Context<null | MarketContextValues> = React.createContext<null | MarketContextValues>(
  null,
);

const _VERY_SLOW_REFRESH_INTERVAL = 5000 * 1000;

// For things that don't really change
const _SLOW_REFRESH_INTERVAL = 5 * 1000;
const _SLOW_REFRESH_INTERVAL_NEW = 60 * 1000;

// For things that change frequently
const _FAST_REFRESH_INTERVAL = 1000;

export const DEFAULT_MARKET = USE_MARKETS.find(
  ({ name, deprecated }) => name === 'RAY/USDT' && !deprecated,
);

export function getMarketDetails(
  market: Market | undefined | null,
  customMarkets: CustomMarketInfo[],
): FullMarketInfo {
  if (!market) {
    return {};
  }
  const marketInfos = getMarketInfos(customMarkets);
  const marketInfo = marketInfos.find((otherMarket) =>
    otherMarket.address.equals(market.address),
  );

  // add new token here
  // TOKEN_MINTS.push({
  //   address: new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'),
  //   name: 'RAY',
  // });
  for(let indexItem = 0 ;indexItem < TOKEN_MINTS.length; indexItem += 1) {
    if (TOKEN_MINTS[indexItem].address.toString() === '3K6rftdAaQYMPunrtNRHgnK2UAtjm2JwyT2oCiTDouYE') {
      TOKEN_MINTS[indexItem].name = 'xCOPE'
    }
  }
  TOKEN_MINTS.push({
    address: new PublicKey('8HGyAAB1yoM1ttS7pXjHMa3dukTFGQggnFFH3hJZgzQh'),
    name: 'COPE',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT'),
    name: 'STEP',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('ETAtLmCmsoiEEKfNrHKJ2kYy3MoABhU6NQvpSfij5tDs'),
    name: 'MEDIA',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('8PMHT4swUMtBzgHnh5U564N5sjPSiUz2cjEQzFnnP1Fo'),
    name: 'ROPE',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('MERt85fc5boKw3BW1eYdxonEuJNvXbiMbs6hvheau5K'),
    name: 'MER',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('TuLipcqtGVXP9XR62wM8WWCm6a9vhLs7T1uoWBk6FDs'),
    name: 'TULIP',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('E5rk3nmgLUuKUiS94gg4bpWwWwyjCMtddsAXkTFLtHEy'),
    name: 'WOO',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('4dmKkXNHdgYsXqBHCuMikNQWwVomZURhYvkkX5c4pQ7y'),
    name: 'SNY',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('BLwTnYKqf7u4qjgZrrsKeNs2EzWkMLqVCu6j8iHyrNA3'),
    name: 'BOP',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('SLRSSpSLUTP7okbCUBYStWCo1vUgyt775faPqz8HUMr'),
    name: 'SLRS',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'),
    name: 'SAMO',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('CDJWUqTcYTVAKXAVXoQZFes5JUFc7owSeq7eMQcDSbo5'),
    name: 'renBTC',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('ArUkYE2XDKzqy77PRRGjo4wREWwqk6RXTfM9NeqzPvjU'),
    name: 'renDOGE',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('3bRTivrVsitbmCTGtqwp7hxXPsybkjn4XLNtPsHqa3zR'),
    name: 'LIKE',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('GsNzxJfFn6zQdJGeYsupJWzUAm57Ba7335mfhWvFiE9Z'),
    name: 'DXL',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So'),
    name: 'mSOL',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('Ea5SjE2Y6yvCeW5dYTn7PYMuW5ikXkvbGdcmSnXeaLjS'),
    name: 'PAI',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('PoRTjZMPXb9T7dyU7tpLEZRQj7e6ssfAE62j2oQuc6y'),
    name: 'PORT',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac'),
    name: 'MNGO',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('DubwWZNWiNGMMeeQHPnMATNj77YZPZSAz2WVR5WjLJqz'),
    name: 'CRP',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx'),
    name: 'ATLAS',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('poLisWXnNRwC6oBu1vHiuKQzFjGL4XDSu4g9qjz9qVk'),
    name: 'POLIS',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('8upjSpvjcdpuzhfR1zriwg5NXkwDruejqNE9WNbPRtyA'),
    name: 'GRAPE',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('Lrxqnh6ZHKbGy3dcrCED43nsoLkM1LTzU2jRfWe8qUC'),
    name: 'LARIX',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('E5ndSkaB17Dm7CsD22dvcjfrYSDLCxFcMd6z8ddCk5wp'),
    name: 'RIN',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('51tMb3zBKDiQhNwGqpgwbavaGH54mk8fXFzxTc1xnasg'),
    name: 'APEX',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey'),
    name: 'MNDE',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('4wjPQJ6PrkC4dHhYghwJzGBVP78DkBzA2U3kHoFNBuhj'),
    name: 'LIQ',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('5tN42n9vMi6ubp67Uy4NnmM5DMZYN8aS8GeB3bEDHr6E'),
    name: 'WAG',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('9vaCzR4n4QpdN2vyaFmy7ZtvzGHVY3WVzDnLJAQLsKCX'),
    name: 'JungleCats',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('FnKE9n6aGjQoNWRBZXy4RW6LZVao7qwBonUbiD7edUmZ'),
    name: 'SYP',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('23sUwdK725SsMe9L5sX6h1NaLJvuhFcBQ8tunpNcc3R7'),
    name: 'MUNK',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('Aj2HHSuPg1WmyAa6eAyS2uamESPomsoGsi56LXjNyXrb'),
    name: 'Legends',
  });
  TOKEN_MINTS.push({
    address: new PublicKey('9nEqaUcb16sQ3Tn1psbkWqyhPdLmfHWjKGymREjsAgTE'),
    name: 'WOOF',
  });

  const baseCurrency =
    (market?.baseMintAddress &&
      TOKEN_MINTS.find((token) => token.address.equals(market.baseMintAddress))
        ?.name) ||
    (marketInfo?.baseLabel && `${marketInfo?.baseLabel}*`) ||
    'UNKNOWN';
  const quoteCurrency =
    (market?.quoteMintAddress &&
      TOKEN_MINTS.find((token) => token.address.equals(market.quoteMintAddress))
        ?.name) ||
    (marketInfo?.quoteLabel && `${marketInfo?.quoteLabel}*`) ||
    'UNKNOWN';
  return {
    ...marketInfo,
    marketName: marketInfo?.name,
    baseCurrency,
    quoteCurrency,
    marketInfo,
  };
}

export function useCustomMarkets() {
  const [customMarkets, setCustomMarkets] = useLocalStorageState<
    CustomMarketInfo[]
  >('customMarkets', []);
  return { customMarkets, setCustomMarkets };
}

export function MarketProvider({ marketAddress, setMarketAddress, children }) {
  const { customMarkets, setCustomMarkets } = useCustomMarkets();

  const address = marketAddress && new PublicKey(marketAddress);
  const connection = useConnection();
  const marketInfos = getMarketInfos(customMarkets);
  const marketInfo =
    address && marketInfos.find((market) => market.address.equals(address));

  const [market, setMarket] = useState<Market | null>();

  const [marketName, setMarketName] = useState('RAY/USDT');

  // Replace existing market with a non-deprecated one on first load
  useEffect(() => {
    if (marketInfo) {
      if (marketInfo.deprecated) {
        console.log('Switching markets from deprecated', marketInfo);
        if (DEFAULT_MARKET) {
          // setMarketAddress(DEFAULT_MARKET.address.toBase58());
          setMarketAddress('C4z32zw9WKaGPhNuU54ohzrV4CE1Uau3cFx6T8RLjxYC');
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      market &&
      marketInfo &&
      // @ts-ignore
      market._decoded.ownAddress?.equals(marketInfo?.address)
    ) {
      return;
    }
    setMarket(null);

    if (!marketInfo || !marketInfo.address) {
      notify({
        message: 'Error loading market',
        description: 'Please select a market from the dropdown',
        type: 'error',
      });
      return;
    } else {
      setMarketName(marketInfo.name);
    }
    Market.load(connection, marketInfo.address, {}, marketInfo.programId)
      .then(setMarket)
      .catch((e) =>
        notify({
          message: 'Error loading market',
          description: e.message,
          type: 'error',
        }),
      );
    // eslint-disable-next-line
  }, [connection, marketInfo]);

  return (
    <MarketContext.Provider
      value={{
        market,
        ...getMarketDetails(market, customMarkets),
        setMarketAddress,
        customMarkets,
        setCustomMarkets,
        marketName,
      }}
    >
      {children}
    </MarketContext.Provider>
  );
}

export function getTradePageUrl(marketAddress?: string) {
  if (!marketAddress) {
    const saved = localStorage.getItem('marketAddress');
    if (saved) {
      marketAddress = JSON.parse(saved);
    }
    marketAddress = marketAddress || DEFAULT_MARKET?.address.toBase58() || '';
  }
  return `/market/${marketAddress}`;
}

export function useSelectedTokenAccounts(): [
  SelectedTokenAccounts,
  (newSelectedTokenAccounts: SelectedTokenAccounts) => void,
] {
  const [
    selectedTokenAccounts,
    setSelectedTokenAccounts,
  ] = useLocalStorageState<SelectedTokenAccounts>('selectedTokenAccounts', {});
  return [selectedTokenAccounts, setSelectedTokenAccounts];
}

export function useMarket() {
  const context = useContext(MarketContext);
  if (!context) {
    throw new Error('Missing market context');
  }
  return context;
}

export function useMarkPrice() {
  const [markPrice, setMarkPrice] = useState<null | number>(null);

  const [orderbook] = useOrderbook();
  const trades = useTrades();

  useEffect(() => {
    let bb = orderbook?.bids?.length > 0 && Number(orderbook.bids[0][0]);
    let ba = orderbook?.asks?.length > 0 && Number(orderbook.asks[0][0]);
    let last = trades && trades.length > 0 && trades[0].price;

    let markPrice =
      bb && ba
        ? last
          ? [bb, ba, last].sort((a, b) => a - b)[1]
          : (bb + ba) / 2
        : null;

    setMarkPrice(markPrice);
  }, [orderbook, trades]);

  return markPrice;
}

export function _useUnfilteredTrades(limit = 10000) {
  const { market } = useMarket();
  const connection = useConnection();
  async function getUnfilteredTrades(): Promise<any[] | null> {
    if (!market || !connection) {
      return null;
    }
    return await market.loadFills(connection, limit);
  }
  const [trades] = useAsyncData(
    getUnfilteredTrades,
    tuple('getUnfilteredTrades', market, connection),
    { refreshInterval: _SLOW_REFRESH_INTERVAL },
  );
  return trades;
  // NOTE: For now, websocket is too expensive since the event queue is large
  // and updates very frequently

  // let data = useAccountData(market && market._decoded.eventQueue);
  // if (!data) {
  //   return null;
  // }
  // const events = decodeEventQueue(data, limit);
  // return events
  //   .filter((event) => event.eventFlags.fill && event.nativeQuantityPaid.gtn(0))
  //   .map(market.parseFillEvent.bind(market));
}

export function useRaydiumTrades() {
  const { market } = useMarket();
  const marketAddress = market?.address.toBase58();

  async function getRaydiumTrades() {
    if (!marketAddress) {
      return null;
    }
    return await RaydiumApi.getRecentTrades(marketAddress);
  }

  return useAsyncData(
    getRaydiumTrades,
    tuple('getRaydiumTrades', marketAddress),
    { refreshInterval: _SLOW_REFRESH_INTERVAL_NEW },
    false,
  );
}

export function useOrderbookAccounts() {
  const { market } = useMarket();
  // @ts-ignore
  let bidData = useAccountData(market && market._decoded.bids);
  // @ts-ignore
  let askData = useAccountData(market && market._decoded.asks);
  return {
    bidOrderbook: market && bidData ? Orderbook.decode(market, bidData) : null,
    askOrderbook: market && askData ? Orderbook.decode(market, askData) : null,
  };
}

export function useOrderbook(
  depth = 20,
): [{ bids: number[][]; asks: number[][] }, boolean] {
  const { bidOrderbook, askOrderbook } = useOrderbookAccounts();
  const { market } = useMarket();
  const bids =
    !bidOrderbook || !market
      ? []
      : bidOrderbook.getL2(depth).map(([price, size]) => [price, size]);
  const asks =
    !askOrderbook || !market
      ? []
      : askOrderbook.getL2(depth).map(([price, size]) => [price, size]);
  return [{ bids, asks }, !!bids || !!asks];
}

// Want the balances table to be fast-updating, dont want open orders to flicker
// TODO: Update to use websocket
export function useOpenOrdersAccounts(fast = false) {
  const { market } = useMarket();
  const { connected, wallet } = useWallet();
  const connection = useConnection();
  async function getOpenOrdersAccounts() {
    if (!connected || !wallet) {
      return null;
    }
    if (!market) {
      return null;
    }
    return await market.findOpenOrdersAccountsForOwner(
      connection,
      wallet.publicKey,
    );
  }
  return useAsyncData<OpenOrders[] | null>(
    getOpenOrdersAccounts,
    tuple('getOpenOrdersAccounts', wallet, market, connected),
    { refreshInterval: fast ? _FAST_REFRESH_INTERVAL : _SLOW_REFRESH_INTERVAL },
  );
}

// todo: refresh cache after some time?
export async function getCachedMarket(connection: Connection, address: PublicKey, programId: PublicKey) {
  let market;
  const cacheKey = tuple('getCachedMarket', 'market', address.toString(), connection);
  if (!getCache(cacheKey)) {
    market = await Market.load(connection, address, {}, programId)
    setCache(cacheKey, market)
  } else {
    market = getCache(cacheKey);
  }
  return market;
}

export async function getCachedOpenOrderAccounts(connection: Connection, market: Market, owner: PublicKey) {
  let accounts;
  const cacheKey = tuple('getCachedOpenOrderAccounts', market.address.toString(), owner.toString(), connection);
  if (!getCache(cacheKey)) {
    accounts = await market.findOpenOrdersAccountsForOwner(
      connection,
      owner,
    );
    setCache(cacheKey, accounts);
  } else {
    accounts = getCache(cacheKey);
  }
  return accounts;
}

export function useSelectedOpenOrdersAccount(fast = false) {
  const [accounts] = useOpenOrdersAccounts(fast);
  if (!accounts) {
    return null;
  }
  return accounts[0];
}

export function useTokenAccounts(): [
  TokenAccount[] | null | undefined,
  boolean,
] {
  const { connected, wallet } = useWallet();
  const connection = useConnection();
  async function getTokenAccounts() {
    if (!connected || !wallet) {
      return null;
    }
    return await getTokenAccountInfo(connection, wallet.publicKey);
  }
  return useAsyncData(
    getTokenAccounts,
    tuple('getTokenAccounts', wallet, connected),
    { refreshInterval: _SLOW_REFRESH_INTERVAL },
  );
}

export function getSelectedTokenAccountForMint(
  accounts: TokenAccount[] | undefined | null,
  mint: PublicKey | undefined,
  selectedPubKey?: string | PublicKey | null,
) {
  if (!accounts || !mint) {
    return null;
  }
  const filtered = accounts.filter(
    ({ effectiveMint, pubkey }) =>
      mint.equals(effectiveMint) &&
      (!selectedPubKey ||
        (typeof selectedPubKey === 'string'
          ? selectedPubKey
          : selectedPubKey.toBase58()) === pubkey.toBase58()),
  );
  return filtered && filtered[0];
}

export function useSelectedQuoteCurrencyAccount() {
  const [accounts] = useTokenAccounts();
  const { market } = useMarket();
  const [selectedTokenAccounts] = useSelectedTokenAccounts();
  const mintAddress = market?.quoteMintAddress;
  return getSelectedTokenAccountForMint(
    accounts,
    mintAddress,
    mintAddress && selectedTokenAccounts[mintAddress.toBase58()],
  );
}

export function useSelectedBaseCurrencyAccount() {
  const [accounts] = useTokenAccounts();
  const { market } = useMarket();
  const [selectedTokenAccounts] = useSelectedTokenAccounts();
  const mintAddress = market?.baseMintAddress;
  return getSelectedTokenAccountForMint(
    accounts,
    mintAddress,
    mintAddress && selectedTokenAccounts[mintAddress.toBase58()],
  );
}

// TODO: Update to use websocket
export function useSelectedQuoteCurrencyBalances() {
  const quoteCurrencyAccount = useSelectedQuoteCurrencyAccount();
  const { market } = useMarket();
  const [accountInfo, loaded] = useAccountInfo(quoteCurrencyAccount?.pubkey);
  if (!market || !quoteCurrencyAccount || !loaded || !accountInfo) {
    return null;
  }
  if (market.quoteMintAddress.equals(TokenInstructions.WRAPPED_SOL_MINT)) {
    return accountInfo?.lamports / 1e9 ?? 0;
  }
  return market.quoteSplSizeToNumber(
    new BN(accountInfo.data.slice(64, 72), 10, 'le'),
  );
}

// TODO: Update to use websocket
export function useSelectedBaseCurrencyBalances() {
  const baseCurrencyAccount = useSelectedBaseCurrencyAccount();
  const { market } = useMarket();
  const [accountInfo, loaded] = useAccountInfo(baseCurrencyAccount?.pubkey);
  if (!market || !baseCurrencyAccount || !loaded || !accountInfo) {
    return null;
  }
  if (market.baseMintAddress.equals(TokenInstructions.WRAPPED_SOL_MINT)) {
    return accountInfo?.lamports / 1e9 ?? 0;
  }
  return market.baseSplSizeToNumber(
    new BN(accountInfo.data.slice(64, 72), 10, 'le'),
  );
}

export function useOpenOrders() {
  const { market, marketName } = useMarket();
  const openOrdersAccount = useSelectedOpenOrdersAccount();
  const { bidOrderbook, askOrderbook } = useOrderbookAccounts();
  if (!market || !openOrdersAccount || !bidOrderbook || !askOrderbook) {
    return null;
  }
  return market
    .filterForOpenOrders(bidOrderbook, askOrderbook, [openOrdersAccount])
    .map((order) => ({ ...order, marketName, market }));
}

export function useTrades(limit = 100) {
  const trades = _useUnfilteredTrades(limit);
  if (!trades) {
    return null;
  }
  // Until partial fills are each given their own fill, use maker fills
  return trades
    .filter(({ eventFlags }) => eventFlags.maker)
    .map((trade) => ({
      ...trade,
      side: trade.side === 'buy' ? 'sell' : 'buy',
    }));
}

export function useLocallyStoredFeeDiscountKey(): {
  storedFeeDiscountKey: PublicKey | undefined;
  setStoredFeeDiscountKey: (key: string) => void;
} {
  const [
    storedFeeDiscountKey,
    setStoredFeeDiscountKey,
  ] = useLocalStorageState<string>(`feeDiscountKey`, undefined);
  return {
    storedFeeDiscountKey: storedFeeDiscountKey
      ? new PublicKey(storedFeeDiscountKey)
      : undefined,
    setStoredFeeDiscountKey,
  };
}

export function useFeeDiscountKeys(): [
  (
    | {
        pubkey: PublicKey;
        feeTier: number;
        balance: number;
        mint: PublicKey;
      }[]
    | null
    | undefined
  ),
  boolean,
] {
  const { market } = useMarket();
  const { connected, wallet } = useWallet();
  const connection = useConnection();
  const { setStoredFeeDiscountKey } = useLocallyStoredFeeDiscountKey();
  let getFeeDiscountKeys = async () => {
    if (!connected || !wallet) {
      return null;
    }
    if (!market) {
      return null;
    }
    const feeDiscountKey = await market.findFeeDiscountKeys(
      connection,
      wallet.publicKey,
    );
    if (feeDiscountKey) {
      setStoredFeeDiscountKey(feeDiscountKey[0].pubkey.toBase58());
    }
    return feeDiscountKey;
  };
  return useAsyncData(
    getFeeDiscountKeys,
    tuple('getFeeDiscountKeys', wallet, market, connected),
    { refreshInterval: _SLOW_REFRESH_INTERVAL },
  );
}

export function useFills(limit = 100) {
  const { marketName } = useMarket();
  const fills = _useUnfilteredTrades(limit);
  const [openOrdersAccounts] = useOpenOrdersAccounts();
  if (!openOrdersAccounts || openOrdersAccounts.length === 0) {
    return null;
  }
  if (!fills) {
    return null;
  }
  return fills
    .filter((fill) =>
      openOrdersAccounts.some((openOrdersAccount) =>
        fill.openOrders.equals(openOrdersAccount.publicKey),
      ),
    )
    .map((fill) => ({ ...fill, marketName }));
}

export function useAllOpenOrdersAccounts() {
  const { wallet, connected } = useWallet();
  const connection = useConnection();
  const marketInfos = useMarketInfos();
  const programIds = [
    ...new Set(marketInfos.map((info) => info.programId.toBase58())),
  ].map((stringProgramId) => new PublicKey(stringProgramId));

  const getAllOpenOrdersAccounts = async () => {
    if (!connected || !wallet) {
      return [];
    }
    return (
      await Promise.all(
        programIds.map((programId) =>
          OpenOrders.findForOwner(connection, wallet.publicKey, programId),
        ),
      )
    ).flat();
  };
  return useAsyncData(
    getAllOpenOrdersAccounts,
    tuple(
      'getAllOpenOrdersAccounts',
      connection,
      connected,
      wallet?.publicKey?.toBase58(),
      marketInfos.length,
      (programIds || []).length,
    ),
    { refreshInterval: _SLOW_REFRESH_INTERVAL },
  );
}

export function useAllOpenOrdersBalances() {
  const [
    openOrdersAccounts,
    loadedOpenOrdersAccounts,
  ] = useAllOpenOrdersAccounts();
  const [mintInfos, mintInfosConnected] = useMintInfos();
  const [allMarkets] = useAllMarkets();
  if (!loadedOpenOrdersAccounts || !mintInfosConnected) {
    return {};
  }

  const marketsByAddress = Object.fromEntries(
    (allMarkets || []).map((m) => [m.market.address.toBase58(), m]),
  );
  const openOrdersBalances: {
    [mint: string]: { market: PublicKey; free: number; total: number }[];
  } = {};
  for (let account of openOrdersAccounts || []) {
    const marketInfo = marketsByAddress[account.market.toBase58()];
    const baseMint = marketInfo?.market.baseMintAddress.toBase58();
    const quoteMint = marketInfo?.market.quoteMintAddress.toBase58();
    if (!(baseMint in openOrdersBalances)) {
      openOrdersBalances[baseMint] = [];
    }
    if (!(quoteMint in openOrdersBalances)) {
      openOrdersBalances[quoteMint] = [];
    }

    const baseMintInfo = mintInfos && mintInfos[baseMint];
    const baseFree = divideBnToNumber(
      new BN(account.baseTokenFree),
      getTokenMultiplierFromDecimals(baseMintInfo?.decimals || 0),
    );
    const baseTotal = divideBnToNumber(
      new BN(account.baseTokenTotal),
      getTokenMultiplierFromDecimals(baseMintInfo?.decimals || 0),
    );
    const quoteMintInfo = mintInfos && mintInfos[quoteMint];
    const quoteFree = divideBnToNumber(
      new BN(account.quoteTokenFree),
      getTokenMultiplierFromDecimals(quoteMintInfo?.decimals || 0),
    );
    const quoteTotal = divideBnToNumber(
      new BN(account.quoteTokenTotal),
      getTokenMultiplierFromDecimals(quoteMintInfo?.decimals || 0),
    );

    openOrdersBalances[baseMint].push({
      market: account.market,
      free: baseFree,
      total: baseTotal,
    });
    openOrdersBalances[quoteMint].push({
      market: account.market,
      free: quoteFree,
      total: quoteTotal,
    });
  }
  return openOrdersBalances;
}

export const useAllOpenOrders = (): {
  openOrders: { orders: Order[]; marketAddress: string }[] | null | undefined;
  loaded: boolean;
  refreshOpenOrders: () => void;
} => {
  const connection = useConnection();
  const { connected, wallet } = useWallet();
  const [loaded, setLoaded] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [openOrders, setOpenOrders] = useState<
    { orders: Order[]; marketAddress: string }[] | null | undefined
  >(null);
  const [lastRefresh, setLastRefresh] = useState(0);

  const refreshOpenOrders = () => {
    if (new Date().getTime() - lastRefresh > 10 * 1000) {
      setRefresh((prev) => prev + 1);
    } else {
      console.log('not refreshing');
    }
  };

  useEffect(() => {
    if (connected && wallet) {
      const getAllOpenOrders = async () => {
        setLoaded(false);
        const _openOrders: { orders: Order[]; marketAddress: string }[] = [];
        const getOpenOrdersForMarket = async (marketInfo: MarketInfo) => {
          await sleep(1000 * Math.random()); // Try not to hit rate limit
          try {
            const market = await Market.load(
              connection,
              marketInfo.address,
              undefined,
              marketInfo.programId,
            );
            const orders = await market.loadOrdersForOwner(
              connection,
              wallet?.publicKey,
              30000,
            );
            _openOrders.push({
              orders: orders,
              marketAddress: marketInfo.address.toBase58(),
            });
          } catch (e) {
            console.warn(`Error loading open order ${marketInfo.name} - ${e}`);
          }
        };
        await Promise.all(USE_MARKETS.map((m) => getOpenOrdersForMarket(m)));
        setOpenOrders(_openOrders);
        setLastRefresh(new Date().getTime());
        setLoaded(true);
      };
      getAllOpenOrders();
    }
  }, [connection, connected, wallet, refresh]);
  return {
    openOrders: openOrders,
    loaded: loaded,
    refreshOpenOrders: refreshOpenOrders,
  };
};

export function useBalances(): Balances[] {
  const baseCurrencyBalances = useSelectedBaseCurrencyBalances();
  const quoteCurrencyBalances = useSelectedQuoteCurrencyBalances();
  const openOrders = useSelectedOpenOrdersAccount(true);
  const { baseCurrency, quoteCurrency, market } = useMarket();
  const baseExists =
    openOrders && openOrders.baseTokenTotal && openOrders.baseTokenFree;
  const quoteExists =
    openOrders && openOrders.quoteTokenTotal && openOrders.quoteTokenFree;
  if (
    baseCurrency === 'UNKNOWN' ||
    quoteCurrency === 'UNKNOWN' ||
    !baseCurrency ||
    !quoteCurrency
  ) {
    return [];
  }
  return [
    {
      market,
      key: `${baseCurrency}${quoteCurrency}${baseCurrency}`,
      coin: baseCurrency,
      wallet: baseCurrencyBalances,
      orders:
        baseExists && market && openOrders
          ? market.baseSplSizeToNumber(
              openOrders.baseTokenTotal.sub(openOrders.baseTokenFree),
            )
          : null,
      openOrders,
      unsettled:
        baseExists && market && openOrders
          ? market.baseSplSizeToNumber(openOrders.baseTokenFree)
          : null,
    },
    {
      market,
      key: `${quoteCurrency}${baseCurrency}${quoteCurrency}`,
      coin: quoteCurrency,
      wallet: quoteCurrencyBalances,
      openOrders,
      orders:
        quoteExists && market && openOrders
          ? market.quoteSplSizeToNumber(
              openOrders.quoteTokenTotal.sub(openOrders.quoteTokenFree),
            )
          : null,
      unsettled:
        quoteExists && market && openOrders
          ? market.quoteSplSizeToNumber(openOrders.quoteTokenFree)
          : null,
    },
  ];
}

export function useWalletBalancesForAllMarkets(): {
  mint: string;
  balance: number;
}[] {
  const [tokenAccounts] = useTokenAccounts();
  const { connected } = useWallet();
  const [mintInfos, mintInfosConnected] = useMintInfos();

  if (!connected || !mintInfosConnected) {
    return [];
  }

  let balances: { [mint: string]: number } = {};
  for (let account of tokenAccounts || []) {
    if (!account.account) {
      continue;
    }
    let parsedAccount;
    if (account.effectiveMint.equals(WRAPPED_SOL_MINT)) {
      parsedAccount = {
        mint: WRAPPED_SOL_MINT,
        owner: account.pubkey,
        amount: account.account.lamports,
      };
    } else {
      parsedAccount = parseTokenAccountData(account.account.data);
    }
    if (!(parsedAccount.mint.toBase58() in balances)) {
      balances[parsedAccount.mint.toBase58()] = 0;
    }
    const mintInfo = mintInfos && mintInfos[parsedAccount.mint.toBase58()];
    const additionalAmount = divideBnToNumber(
      new BN(parsedAccount.amount),
      getTokenMultiplierFromDecimals(mintInfo?.decimals || 0),
    );
    balances[parsedAccount.mint.toBase58()] += additionalAmount;
  }
  return Object.entries(balances).map(([mint, balance]) => {
    return { mint, balance };
  });
}

export function useUnmigratedDeprecatedMarkets() {
  const connection = useConnection();
  const { accounts } = useUnmigratedOpenOrdersAccounts();
  const marketsList =
    accounts &&
    Array.from(new Set(accounts.map((openOrders) => openOrders.market)));
  const deps = marketsList && marketsList.map((m) => m.toBase58());

  const useUnmigratedDeprecatedMarketsInner = async () => {
    if (!marketsList) {
      return null;
    }
    const getMarket = async (address) => {
      const marketInfo = USE_MARKETS.find((market) =>
        market.address.equals(address),
      );
      if (!marketInfo) {
        console.log('Failed loading market');
        notify({
          message: 'Error loading market',
          type: 'error',
        });
        return null;
      }
      try {
        console.log('Loading market', marketInfo.name);
        // NOTE: Should this just be cached by (connection, marketInfo.address, marketInfo.programId)?
        return await Market.load(
          connection,
          marketInfo.address,
          {},
          marketInfo.programId,
        );
      } catch (e) {
        console.log('Failed loading market', marketInfo.name, e);
        notify({
          message: 'Error loading market',
          description: e.message,
          type: 'error',
        });
        return null;
      }
    };
    return (await Promise.all(marketsList.map(getMarket))).filter((x) => x);
  };
  const [markets] = useAsyncData(
    useUnmigratedDeprecatedMarketsInner,
    tuple(
      'useUnmigratedDeprecatedMarketsInner',
      connection,
      deps && deps.toString(),
    ),
    { refreshInterval: _VERY_SLOW_REFRESH_INTERVAL },
  );
  if (!markets) {
    return null;
  }
  return markets.map((market) => ({
    market,
    openOrdersList: accounts?.filter(
      (openOrders) => market && openOrders.market.equals(market.address),
    ),
  }));
}

export function useGetOpenOrdersForDeprecatedMarkets(): {
  openOrders: OrderWithMarketAndMarketName[] | null | undefined;
  loaded: boolean;
  refreshOpenOrders: () => void;
} {
  const { connected, wallet } = useWallet();
  const { customMarkets } = useCustomMarkets();
  const connection = useConnection();
  const marketsAndOrders = useUnmigratedDeprecatedMarkets();
  const marketsList =
    marketsAndOrders && marketsAndOrders.map(({ market }) => market);

  // This isn't quite right: open order balances could change
  const deps =
    marketsList &&
    marketsList
      .filter((market): market is Market => !!market)
      .map((market) => market.address.toBase58());

  async function getOpenOrdersForDeprecatedMarkets() {
    if (!connected || !wallet) {
      return null;
    }
    if (!marketsList) {
      return null;
    }
    console.log('refreshing getOpenOrdersForDeprecatedMarkets');
    const getOrders = async (market: Market | null) => {
      if (!market) {
        return null;
      }
      const { marketName } = getMarketDetails(market, customMarkets);
      try {
        console.log('Fetching open orders for', marketName);
        // Can do better than this, we have the open orders accounts already
        return (
          await market.loadOrdersForOwner(connection, wallet.publicKey)
        ).map((order) => ({ marketName, market, ...order }));
      } catch (e) {
        console.log('Failed loading open orders', market.address.toBase58(), e);
        notify({
          message: `Error loading open orders for deprecated ${marketName}`,
          description: e.message,
          type: 'error',
        });
        return null;
      }
    };
    return (await Promise.all(marketsList.map(getOrders)))
      .filter((x): x is OrderWithMarketAndMarketName[] => !!x)
      .flat();
  }

  const cacheKey = tuple(
    'getOpenOrdersForDeprecatedMarkets',
    connected,
    connection,
    wallet,
    deps && deps.toString(),
  );
  const [openOrders, loaded] = useAsyncData(
    getOpenOrdersForDeprecatedMarkets,
    cacheKey,
    {
      refreshInterval: _VERY_SLOW_REFRESH_INTERVAL,
    },
  );
  console.log('openOrders', openOrders);
  return {
    openOrders,
    loaded,
    refreshOpenOrders: () => refreshCache(cacheKey),
  };
}

export function useBalancesForDeprecatedMarkets() {
  const markets = useUnmigratedDeprecatedMarkets();
  const [customMarkets] = useLocalStorageState<CustomMarketInfo[]>(
    'customMarkets',
    [],
  );
  if (!markets) {
    return null;
  }

  const openOrderAccountBalances: DeprecatedOpenOrdersBalances[] = [];
  markets.forEach(({ market, openOrdersList }) => {
    const { baseCurrency, quoteCurrency, marketName } = getMarketDetails(
      market,
      customMarkets,
    );
    if (!baseCurrency || !quoteCurrency || !market) {
      return;
    }
    (openOrdersList || []).forEach((openOrders) => {
      const inOrdersBase =
        openOrders?.baseTokenTotal &&
        openOrders?.baseTokenFree &&
        market.baseSplSizeToNumber(
          openOrders.baseTokenTotal.sub(openOrders.baseTokenFree),
        );
      const inOrdersQuote =
        openOrders?.quoteTokenTotal &&
        openOrders?.quoteTokenFree &&
        market.baseSplSizeToNumber(
          openOrders.quoteTokenTotal.sub(openOrders.quoteTokenFree),
        );
      const unsettledBase =
        openOrders?.baseTokenFree &&
        market.baseSplSizeToNumber(openOrders.baseTokenFree);
      const unsettledQuote =
        openOrders?.quoteTokenFree &&
        market.baseSplSizeToNumber(openOrders.quoteTokenFree);

      openOrderAccountBalances.push({
        marketName,
        market,
        coin: baseCurrency,
        key: `${marketName}${baseCurrency}`,
        orders: inOrdersBase,
        unsettled: unsettledBase,
        openOrders,
      });
      openOrderAccountBalances.push({
        marketName,
        market,
        coin: quoteCurrency,
        key: `${marketName}${quoteCurrency}`,
        orders: inOrdersQuote,
        unsettled: unsettledQuote,
        openOrders,
      });
    });
  });
  return openOrderAccountBalances;
}

export function getMarketInfos(
  customMarkets: CustomMarketInfo[],
): MarketInfo[] {
  const customMarketsInfo = customMarkets.map((m) => ({
    ...m,
    address: new PublicKey(m.address),
    programId: new PublicKey(m.programId),
    deprecated: false,
  }));

  return [...customMarketsInfo, ...USE_MARKETS];
}

export function useMarketInfos() {
  const { customMarkets } = useCustomMarkets();
  return getMarketInfos(customMarkets);
}

/**
 * If selling, choose min tick size. If buying choose a price
 * s.t. given the state of the orderbook, the order will spend
 * `cost` cost currency.
 *
 * @param orderbook serum Orderbook object
 * @param cost quantity to spend. Base currency if selling,
 *  quote currency if buying.
 * @param tickSizeDecimals size of price increment of the market
 */
export function getMarketOrderPrice(
  orderbook: Orderbook,
  cost: number,
  tickSizeDecimals?: number,
) {
  if (orderbook.isBids) {
    return orderbook.market.tickSize;
  }
  let spentCost = 0;
  let price, sizeAtLevel, costAtLevel: number;
  const asks = orderbook.getL2(1000);
  for ([price, sizeAtLevel] of asks) {
    costAtLevel = price * sizeAtLevel;
    if (spentCost + costAtLevel > cost) {
      break;
    }
    spentCost += costAtLevel;
  }
  const sendPrice = Math.min(price * 1.02, asks[0][0] * 1.05);
  let formattedPrice;
  if (tickSizeDecimals) {
    formattedPrice = floorToDecimal(sendPrice, tickSizeDecimals);
  } else {
    formattedPrice = sendPrice;
  }
  return formattedPrice;
}

export function getExpectedFillPrice(
  orderbook: Orderbook,
  cost: number,
  tickSizeDecimals?: number,
) {
  let spentCost = 0;
  let avgPrice = 0;
  let price, sizeAtLevel, costAtLevel: number;
  for ([price, sizeAtLevel] of orderbook.getL2(1000)) {
    costAtLevel = (orderbook.isBids ? 1 : price) * sizeAtLevel;
    if (spentCost + costAtLevel > cost) {
      avgPrice += (cost - spentCost) * price;
      spentCost = cost;
      break;
    }
    avgPrice += costAtLevel * price;
    spentCost += costAtLevel;
  }
  const totalAvgPrice = avgPrice / Math.min(cost, spentCost);
  let formattedPrice;
  if (tickSizeDecimals) {
    formattedPrice = floorToDecimal(totalAvgPrice, tickSizeDecimals);
  } else {
    formattedPrice = totalAvgPrice;
  }
  return formattedPrice;
}

export function useCurrentlyAutoSettling(): [boolean, (currentlyAutoSettling: boolean) => void] {
  const [currentlyAutoSettling, setCurrentlyAutosettling] = useState<boolean>(false);
  return [currentlyAutoSettling, setCurrentlyAutosettling];
}