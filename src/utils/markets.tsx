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
  TOKENS,
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
  {
    name: 'whETH/SOL',
    deprecated: false,
    address: new PublicKey('7gtMZphDnZre32WfedWnDLhYYWJ2av1CCn1RES5g8QUf'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'whETH/USDC',
    deprecated: false,
    address: new PublicKey('8Gmi2HhZmwQPVdCwzS7CM66MGstMXPcTVHA7jF19cLZz'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'weUNI/USDC',
    deprecated: false,
    address: new PublicKey('B7b5rjQuqQCuGqmUBWmcCTqaL3Z1462mo4NArqty6QFR'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'weSUSHI/USDC',
    deprecated: false,
    address: new PublicKey('3uWVMWu7cwMnYMAAdtsZNwaaqeeeZHARGZwcExnQiFay'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'RAY/SOL',
    deprecated: false,
    address: new PublicKey('HTSoy7NCK98pYAkVV6M6n9CTziqVL6z7caS3iWFjfM4G'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'ETH/SOL',
    deprecated: false,
    address: new PublicKey('HkLEttvwk2b4QDAHzNcVtxsvBG35L1gmYY4pecF9LrFe'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'stSOL/USDC',
    deprecated: false,
    address: new PublicKey('5F7LGsP1LPtaRV7vVKgxwNYX4Vf22xvuzyXjyar7jJqp'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'ETH/mSOL',
    deprecated: false,
    address: new PublicKey('3KLNtqA8H4Em36tifoTHNqTZM6wiwbprYkTDyVJbrBuu'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'mSOL/USDT',
    deprecated: false,
    address: new PublicKey('HxkQdUnrPdHwXP5T9kewEXs3ApgvbufuTfdw9v1nApFd'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'BTC/mSOL',
    deprecated: false,
    address: new PublicKey('HvanEnuruBXBPJymSLr9EmsFUnZcbY97B7RBwZAmfcax'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SLIM/SOL',
    deprecated: false,
    address: new PublicKey('GekRdc4eD9qnfPTjUMK5NdQDho8D9ByGrtnqhMNCTm36'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'AURY/USDC',
    deprecated: false,
    address: new PublicKey('461R7gK9GK1kLUXQbHgaW9L6PESQFSLGxKXahvcHEJwD'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'PRT/SOL',
    deprecated: false,
    address: new PublicKey('H7ZmXKqEx1T8CTM4EMyqR5zyz4e4vUpWTTbCmYmzxmeW'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'FAB/USDC',
    deprecated: false,
    address: new PublicKey('Cud48DK2qoxsWNzQeTL5D8sAiHsGwG8Ev1VMNcYLayxt'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SLND/USDC',
    deprecated: false,
    address: new PublicKey('F9y9NM83kBMzBmMvNT18mkcFuNAPhNRhx7pnz9EDWwfv'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'FRKT/SOL',
    deprecated: false,
    address: new PublicKey('FE5nRChviHFXnUDPRpPwHcPoQSxXwjAB5gdPFJLweEYK'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'CYS/USDC',
    deprecated: false,
    address: new PublicKey('6V6y6QFi17QZC9qNRpVp7SaPiHpCTp2skbRQkUyZZXPW'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SAMO/USDC',
    deprecated: false,
    address: new PublicKey('FR3SPJmgfRSKKQ2ysUZBu7vJLpzTixXnjzb84bY3Diif'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'ABR/USDC',
    deprecated: false,
    address: new PublicKey('FrR9FBmiBjm2GjLZbfnCcgkbueUJ78NbBx1qcQKPUQe8'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'IN/USDC',
    deprecated: false,
    address: new PublicKey('49vwM54DX3JPXpey2daePZPmimxA4CrkXLZ6E1fGxx2Z'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'weDYDX/USDC',
    deprecated: false,
    address: new PublicKey('GNmTGd6iQvQApXgsyvHepDpCnvdRPiWzRr8kzFEMMNKN'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'STARS/USDC',
    deprecated: false,
    address: new PublicKey('DvLrUbE8THQytBCe3xrpbYadNRUfUT7SVCm677Nhrmby'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'weAXS/USDC',
    deprecated: false,
    address: new PublicKey('HZCheduA4nsSuQpVww1TiyKZpXSAitqaXxjBD2ymg22X'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'weSHIB/USDC',
    deprecated: false,
    address: new PublicKey('Er7Jp4PADPVHifykFwbVoHdkL1RtZSsx9zGJrPJTrCgW'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SBR/USDC',
    deprecated: false,
    address: new PublicKey('HXBi8YBwbh4TXF6PjVw81m8Z3Cc4WBofvauj5SBFdgUs'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'OXS/USDC',
    deprecated: false,
    address: new PublicKey('gtQT1ipaCBC5wmTm99F9irBDhiLJCo1pbxrcFUMn6mp'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'CWAR/USDC',
    deprecated: false,
    address: new PublicKey('CDYafmdHXtfZadhuXYiR7QaqmK9Ffgk2TA8otUWj9SWz'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'UPS/USDC',
    deprecated: false,
    address: new PublicKey('DByPstQRx18RU2A8DH6S9mT7bpT6xuLgD2TTFiZJTKZP'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'weSAND/USDC',
    deprecated: false,
    address: new PublicKey('3FE2g3cadTJjN3C7gNRavwnv7Yh9Midq7h9KgTVUE7tR'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'weMANA/USDC',
    deprecated: false,
    address: new PublicKey('7GSn6KQRasgPQCHwCbuDjDCsyZ3cxVHKWFmBXzJUUW8P'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'CAVE/USDC',
    deprecated: false,
    address: new PublicKey('KrGK6ZHyE7Nt35D7GqAKJYAYUPUysGtVBgTXsJuAxMT'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'GENE/USDC',
    deprecated: false,
    address: new PublicKey('FwZ2GLyNNrFqXrmR8Sdkm9DQ61YnQmxS6oobeH3rrLUM'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'GENE/RAY',
    deprecated: false,
    address: new PublicKey('DpFKTy69uZv2G6KW7b117axwQRSztH5g4gUtBPZ9fCS7'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'APT/USDC',
    deprecated: false,
    address: new PublicKey('ATjWoJDChATL7E5WVeSk9EsoJAhZrHjzCZABNx3Miu8B'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'GOFX/USDC',
    deprecated: false,
    address: new PublicKey('2wgi2FabNsSDdb8dke9mHFB67QtMYjYa318HpSqyJLDD'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SONAR/USDC',
    deprecated: false,
    address: new PublicKey('9YdVSNrDsKDaGyhKL2nqEFKvxe3MSqMjmAvcjndVg1kj'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'JSOL/SOL',
    deprecated: false,
    address: new PublicKey('GTfi2wtcZmFVjF5rr4bexs6M6xrszb6iT5bqn694Fk6S'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'JSOL/USDC',
    deprecated: false,
    address: new PublicKey('8mQ3nNCdcwSHkYwsRygTbBFLeGPsJ4zB2zpEwXmwegBh'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SHILL/USDC',
    deprecated: false,
    address: new PublicKey('3KNXNjf1Vp3V5gYPjwnpALYCPhWpRXsPPC8CWBXqmnnN'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'DFL/USDC',
    deprecated: false,
    address: new PublicKey('9UBuWgKN8ZYXcZWN67Spfp3Yp67DKBq1t31WLrVrPjTR'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'BOKU/USDC',
    deprecated: false,
    address: new PublicKey('Dvm8jjdAy8uyXn9WXjS2p1mcPeFTuYS6yW2eUL9SJE8p'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'MIMO/SOL',
    deprecated: false,
    address: new PublicKey('BBD3mBvHnx4PWiGeJCvwG8zosHwmAuwkx7JLjfTCRMw'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'wbWBNB/USDC',
    deprecated: false,
    address: new PublicKey('3zzTxtDCt9PimwzGrgWJEbxZfSLetDMkdYegPanGNpMf'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'wePEOPLE/USDC',
    deprecated: false,
    address: new PublicKey('GsWEL352sYgQC3uAVKgEQz2TtA1RA5cgNwUQahyzwJyz'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'XTAG/USDC',
    deprecated: false,
    address: new PublicKey('6QM3iZfkVc5Yyb5z8Uya1mvqU1JBN9ez81u9463px45A'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'KKO/USDC',
    deprecated: false,
    address: new PublicKey('9zR51YmUq2Tzccaq4iXXWDKbNy2TkEyPmoqCsfpjw2bc'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'VI/USDC',
    deprecated: false,
    address: new PublicKey('5fbYoaSBvAD8rW6zXo6oWqcCsgbYZCecbxAouk97p8SM'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SOLC/USDT',
    deprecated: false,
    address: new PublicKey('HYM1HS6MM4E1NxgHPH4Wnth7ztXsYTpbB2Rh9raje8Xq'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'STR/USDC',
    deprecated: false,
    address: new PublicKey('6vXecj4ipEXChK9uPAd5giWn6aB3fn5Lbu4eVMLX7rRU'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SPWN/USDC',
    deprecated: false,
    address: new PublicKey('CMxieHNoWYgF5c6wS1yz1QYhxpxZV7MbDMp8c7EpiRGj'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'ISOLA/USDT',
    deprecated: false,
    address: new PublicKey('42QVcMqoXmHT94zaBXm9KeU7pqDfBuAPHYN9ADW8weCF'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'TTT/USDC',
    deprecated: false,
    address: new PublicKey('2sdQQDyBsHwQBRJFsYAGpLZcxzGscMUd5uxr8jowyYHs'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'RUN/USDC',
    deprecated: false,
    address: new PublicKey('HCvX4un57v1SdYQ2LFywaDYyZySqLHMQ5cojq5kQJM3y'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'CRWNY/USDC',
    deprecated: false,
    address: new PublicKey('H8GSFzSZmPNs4ANW9dPd5XTgrzWkta3CaT57TgWYs7SV'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'CRWNY/RAY',
    deprecated: false,
    address: new PublicKey('6NRE3U7BRWftimyzmKoNSseWDMMxzuoTefxCRBciwD3'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'BLOCK/USDC',
    deprecated: false,
    address: new PublicKey('2b6GbUbY979QhRoWb2b9F3vNi7pcCGPDivuiKPHC56zY'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'REAL/USDC',
    deprecated: false,
    address: new PublicKey('AU8VGwd4NGRbcMz9LT6Fu2LP69LPAbWUJ6gEfEgeYM33'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },




  {
    name: 'USDT/USDC',
    deprecated: false,
    address: new PublicKey('77quYg4MGneUdjgXCunt9GgM1usmrxKY31twEy3WHwcS'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'APYS/USDC',
    deprecated: false,
    address: new PublicKey('4wCTEd1o46VjBmRoRks5CmZywaeM8gnEr93E8nFPGBqa'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'OOGI/USDC',
    deprecated: false,
    address: new PublicKey('ANUCohkG9gamUn6ofZEbnzGkjtyMexDhnjCwbLDmQ8Ub'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'STR/USDC',
    deprecated: false,
    address: new PublicKey('6vXecj4ipEXChK9uPAd5giWn6aB3fn5Lbu4eVMLX7rRU'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'DATE/USDC',
    deprecated: false,
    address: new PublicKey('3jszawPiXjuqg5MwAAHS8wehWy1k7de5u5pWmmPZf6dM'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'COBAN/USDC',
    deprecated: false,
    address: new PublicKey('4VCnuHoo6A3XhQ9YrD6YZWQKVvLxVGzHTB2opNyQi7bz'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SOLX/USDC',
    deprecated: false,
    address: new PublicKey('6DhnyzBiw59MgjjVE1dGwfX8PKSFmN5gagcoCAn6U6x8'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'SOLAR/USDC',
    deprecated: false,
    address: new PublicKey('BHfFJM36MirbBtLCcnZokwRvxUPxk7Ez6EAT6k44q6Go'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'BASIS/USDC',
    deprecated: false,
    address: new PublicKey('HCWgghHfDefcGZsPsLAdMP3NigJwBrptZnXemeQchZ69'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'CHICKS/USDC',
    deprecated: false,
    address: new PublicKey('Eg8a9ZicLPSyak4CiXfiMeJK6jmHq57Xx5ag5GY6vcDj'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'NOVA/USDT',
    deprecated: false,
    address: new PublicKey('2JYtpRB51ShaB7i4eaQyx6QYqWFmm38CAakFSMP8xush'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'GST/USDC',
    deprecated: false,
    address: new PublicKey('2JiQd14xAjmcNEJicyU1m3TVbzQDktTvY285gkozD46J'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'MBS/USDC',
    deprecated: false,
    address: new PublicKey('9sUSmgx78tt692hzwiRdBdfwjxPF6nsYeJfPCrTz6vxm'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'RACEFI/USDC',
    deprecated: false,
    address: new PublicKey('4iQ4BRcg6E7hNB384TzhQAjjVYnweMkQh5WFC2t8JNjw'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'MEAN/RAY',
    deprecated: false,
    address: new PublicKey('2zJKJgDb8M57J8K5JHZqJyU5ZWZHsxyFtCPi6GdRCi91'),
    programId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  },
  {
    name: 'MEAN/USDC',
    deprecated: false,
    address: new PublicKey('3WXrxhrj4PXYUwW4ozBjxdSxwEp9ELKf3vETxXTqdiQJ'),
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

  Object.values(TOKENS).forEach(itemToken => {
    if (!TOKEN_MINTS.find(item => item.address.toString === itemToken.mintAddress)) {
      TOKEN_MINTS.push({
        address: new PublicKey(itemToken.mintAddress),
        name: itemToken.symbol,
      });
    }
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