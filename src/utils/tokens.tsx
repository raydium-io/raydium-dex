import * as BufferLayout from 'buffer-layout';

import { AccountInfo, Connection, PublicKey } from '@solana/web3.js';
import { useAllMarkets, useCustomMarkets, useTokenAccounts } from './markets';

import BN from 'bn.js';
import { TOKEN_MINTS } from '@project-serum/serum';
import { TokenAccount } from './types';
import { WRAPPED_SOL_MINT } from '@project-serum/serum/lib/token-instructions';
// @ts-ignore
import { cloneDeep } from 'lodash-es'
import { getMultipleSolanaAccounts } from './send';
import tuple from 'immutable-tuple';
import { useAsyncData } from './fetch-loop';
import { useConnection } from './connection';
import { useMemo } from 'react';

export const ACCOUNT_LAYOUT = BufferLayout.struct([
  BufferLayout.blob(32, 'mint'),
  BufferLayout.blob(32, 'owner'),
  BufferLayout.nu64('amount'),
  BufferLayout.blob(93),
]);

export const MINT_LAYOUT = BufferLayout.struct([
  BufferLayout.blob(36),
  BufferLayout.blob(8, 'supply'),
  BufferLayout.u8('decimals'),
  BufferLayout.u8('initialized'),
  BufferLayout.blob(36),
]);

export function parseTokenAccountData(
  data: Buffer,
): { mint: PublicKey; owner: PublicKey; amount: number } {
  let { mint, owner, amount } = ACCOUNT_LAYOUT.decode(data);
  return {
    mint: new PublicKey(mint),
    owner: new PublicKey(owner),
    amount,
  };
}

export interface MintInfo {
  decimals: number;
  initialized: boolean;
  supply: BN;
}

export function parseTokenMintData(data): MintInfo {
  let { decimals, initialized, supply } = MINT_LAYOUT.decode(data);
  return {
    decimals,
    initialized: !!initialized,
    supply: new BN(supply, 10, 'le'),
  };
}

export function getOwnedAccountsFilters(publicKey: PublicKey) {
  return [
    {
      memcmp: {
        offset: ACCOUNT_LAYOUT.offsetOf('owner'),
        bytes: publicKey.toBase58(),
      },
    },
    {
      dataSize: ACCOUNT_LAYOUT.span,
    },
  ];
}

export const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
);

export async function getOwnedTokenAccounts(
  connection: Connection,
  publicKey: PublicKey,
): Promise<Array<{ publicKey: PublicKey; accountInfo: AccountInfo<Buffer> }>> {
  let filters = getOwnedAccountsFilters(publicKey);
  let resp = await connection.getProgramAccounts(
    TOKEN_PROGRAM_ID,
    {
      filters,
    },
  );
  return resp
    .map(({ pubkey, account: { data, executable, owner, lamports } }) => ({
      publicKey: new PublicKey(pubkey),
      accountInfo: {
        data,
        executable,
        owner: new PublicKey(owner),
        lamports,
      },
    }))
}

export async function getTokenAccountInfo(
  connection: Connection,
  ownerAddress: PublicKey,
) {
  let [splAccounts, account] = await Promise.all([
    getOwnedTokenAccounts(connection, ownerAddress),
    connection.getAccountInfo(ownerAddress),
  ]);
  const parsedSplAccounts: TokenAccount[] = splAccounts.map(
    ({ publicKey, accountInfo }) => {
      return {
        pubkey: publicKey,
        account: accountInfo,
        effectiveMint: parseTokenAccountData(accountInfo.data).mint,
      };
    },
  );
  return parsedSplAccounts.concat({
    pubkey: ownerAddress,
    account,
    effectiveMint: WRAPPED_SOL_MINT,
  });
}

export function useMintToTickers(): { [mint: string]: string } {
  const { customMarkets } = useCustomMarkets();
  const [markets] = useAllMarkets();
  return useMemo(() => {
    const mintsToTickers = Object.fromEntries(
      TOKEN_MINTS.map((mint) => [mint.address.toBase58(), mint.name]),
    );
    for (let market of markets || []) {
      const customMarketInfo = customMarkets.find(
        (customMarket) =>
          customMarket.address === market.market.address.toBase58(),
      );
      if (!(market.market.baseMintAddress.toBase58() in mintsToTickers)) {
        if (customMarketInfo) {
          mintsToTickers[market.market.baseMintAddress.toBase58()] =
            customMarketInfo.baseLabel || `${customMarketInfo.name}_BASE`;
        }
      }
      if (!(market.market.quoteMintAddress.toBase58() in mintsToTickers)) {
        if (customMarketInfo) {
          mintsToTickers[market.market.quoteMintAddress.toBase58()] =
            customMarketInfo.quoteLabel || `${customMarketInfo.name}_QUOTE`;
        }
      }
    }
    return mintsToTickers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markets?.length, customMarkets.length]);
}

const _VERY_SLOW_REFRESH_INTERVAL = 5000 * 1000;

export function useMintInfos(): [
  (
    | {
        [mintAddress: string]: {
          decimals: number;
          initialized: boolean;
        } | null;
      }
    | null
    | undefined
  ),
  boolean,
] {
  const connection = useConnection();
  const [tokenAccounts] = useTokenAccounts();
  const [allMarkets] = useAllMarkets();

  const allMints = (tokenAccounts || [])
    .map((account) => account.effectiveMint)
    .concat(
      (allMarkets || []).map((marketInfo) => marketInfo.market.baseMintAddress),
    )
    .concat(
      (allMarkets || []).map(
        (marketInfo) => marketInfo.market.quoteMintAddress,
      ),
    );
  const uniqueMints = [...new Set(allMints.map((mint) => mint.toBase58()))].map(
    (stringMint) => new PublicKey(stringMint),
  );

  const getAllMintInfo = async () => {
    const mintInfos = await getMultipleSolanaAccounts(connection, uniqueMints);
    return Object.fromEntries(
      Object.entries(mintInfos.value).map(([key, accountInfo]) => [
        key,
        accountInfo && parseTokenMintData(accountInfo.data),
      ]),
    );
  };

  return useAsyncData(
    getAllMintInfo,
    tuple(
      'getAllMintInfo',
      connection,
      (tokenAccounts || []).length,
      (allMarkets || []).length,
    ),
    { refreshInterval: _VERY_SLOW_REFRESH_INTERVAL },
  );
}

interface Tokens {
  [key: string]: any
  [index: number]: any
}

export interface TokenInfo {
  symbol: string
  name: string

  mintAddress: string
  decimals: number

  referrer?: string
}


export function getTokenByMintAddress(mintAddress: string): TokenInfo | null {
  if (mintAddress === NATIVE_SOL.mintAddress) {
    return cloneDeep(NATIVE_SOL)
  }

  let token = null

  for (const symbol of Object.keys(TOKENS)) {
    const info = cloneDeep(TOKENS[symbol])

    if (info.mintAddress === mintAddress) {
      token = info
    }
  }

  return token
}

export const NATIVE_SOL: TokenInfo = {
  symbol: 'SOL',
  name: 'Native Solana',
  mintAddress: '11111111111111111111111111111111',
  decimals: 9
}


export const TOKENS: Tokens = {
  WSOL: {
    symbol: 'WSOL',
    name: 'Wrapped Solana',
    mintAddress: 'So11111111111111111111111111111111111111112',
    decimals: 9,
    referrer: 'HTcarLHe7WRxBQCWvhVB8AP56pnEtJUV2jDGvcpY3xo5',
  },
  BTC: {
    symbol: 'BTC',
    name: 'Wrapped Bitcoin',
    mintAddress: '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E',
    decimals: 6,
    referrer: 'GZpS8cY8Nt8HuqxzJh6PXTdSxc38vFUjBmi7eEUkkQtG',
  },
  ETH: {
    symbol: 'ETH',
    name: 'Wrapped Ethereum',
    mintAddress: '2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk',
    decimals: 6,
    referrer: 'CXPTcSxxh4AT38gtv3SPbLS7oZVgXzLbMb83o4ziXjjN',
  },
  USDT: {
    symbol: 'USDT',
    name: 'USDT',
    mintAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    decimals: 6,
    referrer: '8DwwDNagph8SdwMUdcXS5L9YAyutTyDJmK6cTKrmNFk3',
  },
  WUSDT: {
    symbol: 'WUSDT',
    name: 'Wrapped USDT',
    mintAddress: 'BQcdHdAQW1hczDbBi9hiegXAR7A98Q9jx3X3iBBBDiq4',
    decimals: 6,
    referrer: 'CA98hYunCLKgBuD6N8MJSgq1GbW9CXdksLf5mw736tS3',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USDC',
    mintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    referrer: '92vdtNjEg6Zth3UU1MgPgTVFjSEzTHx66aCdqWdcRkrg',
  },
  WUSDC: {
    symbol: 'WUSDC',
    name: 'Wrapped USDC',
    mintAddress: 'BXXkv6z8ykpG1yuvUDPgh732wzVHB69RnB9YgSYh3itW',
    decimals: 6,
  },
  YFI: {
    symbol: 'YFI',
    name: 'Wrapped YFI',
    mintAddress: '3JSf5tPeuscJGtaCp5giEiDhv51gQ4v3zWg8DGgyLfAB',
    decimals: 6,
    referrer: 'DZjgzKfYzZBBSTo5vytMYvGdNF933DvuX8TftDMrThrb',
  },
  LINK: {
    symbol: 'LINK',
    name: 'Wrapped Chainlink',
    mintAddress: 'CWE8jPTUYhdCTZYWPTe1o5DFqfdjzWKc9WKz6rSjQUdG',
    decimals: 6,
    referrer: 'DRSKKsYZaPEFkRgGywo7KWBGZikf71R9aDr8tjtpr41V',
  },
  XRP: {
    symbol: 'XRP',
    name: 'Wrapped XRP',
    mintAddress: 'Ga2AXHpfAF6mv2ekZwcsJFqu7wB4NV331qNH7fW9Nst8',
    decimals: 6,
    referrer: '6NeHPXG142tAE2Ej3gHgT2N66i1KH6PFR6PBZw6RyrwH',
  },
  SUSHI: {
    symbol: 'SUSHI',
    name: 'Wrapped SUSHI',
    mintAddress: 'AR1Mtgh7zAtxuxGd2XPovXPVjcSdY3i4rQYisNadjfKy',
    decimals: 6,
    referrer: '59QxHeHgb28tDc3gStnrW8FNKC9qWuRmRZHBaAqCerJX',
  },
  ALEPH: {
    symbol: 'ALEPH',
    name: 'Wrapped ALEPH',
    mintAddress: 'CsZ5LZkDS7h9TDKjrbL7VAwQZ9nsRu8vJLhRYfmGaN8K',
    decimals: 6,
    referrer: '8FKAKrenJMDd7V6cxnM5BsymHTjqxgodtHbLwZReMnWW',
  },
  SXP: {
    symbol: 'SXP',
    name: 'Wrapped SXP',
    mintAddress: 'SF3oTvfWzEP3DTwGSvUXRrGTvr75pdZNnBLAH9bzMuX',
    decimals: 6,
    referrer: '97Vyotr284UM2Fyq9gbfQ3azMYtgf7cjnsf8pN1PFfY9',
  },
  HGET: {
    symbol: 'HGET',
    name: 'Wrapped HGET',
    mintAddress: 'BtZQfWqDGbk9Wf2rXEiWyQBdBY1etnUUn6zEphvVS7yN',
    decimals: 6,
    referrer: 'AGY2wy1ANzLM2jJLSkVxPUYAY5iAYXYsLMQkoQsAhucj',
  },
  CREAM: {
    symbol: 'CREAM',
    name: 'Wrapped CREAM',
    mintAddress: '5Fu5UUgbjpUvdBveb3a1JTNirL8rXtiYeSMWvKjtUNQv',
    decimals: 6,
    referrer: '7WPzEiozJ69MQe8bfbss1t2unR6bHR4S7FimiUVRgu7P',
  },
  UNI: {
    symbol: 'UNI',
    name: 'Wrapped UNI',
    mintAddress: 'DEhAasscXF4kEGxFgJ3bq4PpVGp5wyUxMRvn6TzGVHaw',
    decimals: 6,
    referrer: '4ntxDv95ajBbXfZyGy3UhcQDx8xmH1yJ6eKvuNNH466x',
  },
  SRM: {
    symbol: 'SRM',
    name: 'Serum',
    mintAddress: 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt',
    decimals: 6,
    referrer: 'HYxa4Ea1dz7ya17Cx18rEGUA1WbCvKjXjFKrnu8CwugH',
  },
  FTT: {
    symbol: 'FTT',
    name: 'Wrapped FTT',
    mintAddress: 'AGFEad2et2ZJif9jaGpdMixQqvW5i81aBdvKe7PHNfz3',
    decimals: 6,
    referrer: 'CafpgSh8KGL2GPTjdXfctD3vXngNZDJ3Q92FTfV71Hmt',
  },
  MSRM: {
    symbol: 'MSRM',
    name: 'MegaSerum',
    mintAddress: 'MSRMcoVyrFxnSgo5uXwone5SKcGhT1KEJMFEkMEWf9L',
    decimals: 0,
    referrer: 'Ge5q9x8gDUNYqqLA1MdnCzWNJGsbj3M15Yxse2cDbw9z',
  },
  TOMO: {
    symbol: 'TOMO',
    name: 'Wrapped TOMO',
    mintAddress: 'GXMvfY2jpQctDqZ9RoU3oWPhufKiCcFEfchvYumtX7jd',
    decimals: 6,
    referrer: '9fexfN3eZomF5gfenG5L9ydbKRQkPhq6x74rb5iLrvXP',
  },
  KARMA: {
    symbol: 'KARMA',
    name: 'Wrapped KARMA',
    mintAddress: 'EcqExpGNFBve2i1cMJUTR4bPXj4ZoqmDD2rTkeCcaTFX',
    decimals: 4,
  },
  LUA: {
    symbol: 'LUA',
    name: 'Wrapped LUA',
    mintAddress: 'EqWCKXfs3x47uVosDpTRgFniThL9Y8iCztJaapxbEaVX',
    decimals: 6,
    referrer: 'HuZwNApjVFuFSDgrwZA8GP2JD7WMby4qt6rkWDnaMo7j',
  },
  MATH: {
    symbol: 'MATH',
    name: 'Wrapped MATH',
    mintAddress: 'GeDS162t9yGJuLEHPWXXGrb1zwkzinCgRwnT8vHYjKza',
    decimals: 6,
    referrer: 'C9K1M8sJX8WMdsnFT7DuzdiHHunEj79EsLuz4DixQYGm',
  },
  KEEP: {
    symbol: 'KEEP',
    name: 'Wrapped KEEP',
    mintAddress: 'GUohe4DJUA5FKPWo3joiPgsB7yzer7LpDmt1Vhzy3Zht',
    decimals: 6,
  },
  SWAG: {
    symbol: 'SWAG',
    name: 'Wrapped SWAG',
    mintAddress: '9F9fNTT6qwjsu4X4yWYKZpsbw5qT7o6yR2i57JF2jagy',
    decimals: 6,
  },
  FIDA: {
    symbol: 'FIDA',
    name: 'Bonfida',
    mintAddress: 'EchesyfXePKdLtoiZSL8pBe8Myagyy8ZRqsACNCFGnvp',
    decimals: 6,
    referrer: 'AeAsG75UmyPDB271c6NHonHxXAPXfkvhcf2xjfJhReS8',
  },
  KIN: {
    symbol: 'KIN',
    name: 'KIN',
    mintAddress: 'kinXdEcpDQeHPEuQnqmUgtYykqKGVFq6CeVX5iAHJq6',
    decimals: 5,
    referrer: 'AevFXmApVxN2yk1iemSxXc6Wy7Z1udUEfST11kuYKmr9',
  },
  MAPS: {
    symbol: 'MAPS',
    name: 'MAPS',
    mintAddress: 'MAPS41MDahZ9QdKXhVa4dWB9RuyfV4XqhyAZ8XcYepb',
    decimals: 6,
  },
  OXY: {
    symbol: 'OXY',
    name: 'OXY',
    mintAddress: 'z3dn17yLaGMKffVogeFHQ9zWVcXgqgf3PQnDsNs2g6M',
    decimals: 6,
  },
  RAY: {
    symbol: 'RAY',
    name: 'Raydium',
    mintAddress: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    decimals: 6,
    referrer: '33XpMmMQRf6tSPpmYyzpwU4uXpZHkFwCZsusD9dMYkjy',
  },
  xCOPE: {
    symbol: 'xCOPE',
    name: 'xCOPE',
    mintAddress: '3K6rftdAaQYMPunrtNRHgnK2UAtjm2JwyT2oCiTDouYE',
    decimals: 0,
    referrer: '8DTehuES4tfnd2SrqcjN52XofxWXGjiLZRgM12U9pB6f',
  },
  COPE: {
    symbol: 'COPE',
    name: 'COPE',
    mintAddress: '8HGyAAB1yoM1ttS7pXjHMa3dukTFGQggnFFH3hJZgzQh',
    decimals: 6,
    referrer: 'G7UYwWhkmgeL57SUKFF45K663V9TdXZw6Ho6ZLQ7p4p',
  },
  STEP: {
    symbol: 'STEP',
    name: 'STEP',
    mintAddress: 'StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT',
    decimals: 9,
    referrer: 'EFQVX1S6dFroDDhJDAnMTX4fCfjt4fJXHdk1eEtJ2uRY',
  },
  MEDIA: {
    symbol: 'MEDIA',
    name: 'MEDIA',
    mintAddress: 'ETAtLmCmsoiEEKfNrHKJ2kYy3MoABhU6NQvpSfij5tDs',
    decimals: 6,
    referrer: 'AYnaG3AidNWFzjq9U3BJSsQ9DShE8g7FszriBDtRFvsx',
  },
  ROPE: {
    symbol: 'ROPE',
    name: 'ROPE',
    mintAddress: '8PMHT4swUMtBzgHnh5U564N5sjPSiUz2cjEQzFnnP1Fo',
    decimals: 9,
    referrer: '5sGVVniBSPLTwRHDETShovq7STRH2rJwbvdvvH3NcVTF',
  },
  MER: {
    symbol: 'MER',
    name: 'Mercurial',
    mintAddress: 'MERt85fc5boKw3BW1eYdxonEuJNvXbiMbs6hvheau5K',
    decimals: 6,
    referrer: '36F4ryvqaNW2yKQsAry4ZHCZ3j7tz3gtEz7NEwv7pSRu',
  },
  TULIP: {
    symbol: 'TULIP',
    name: 'TULIP',
    mintAddress: 'TuLipcqtGVXP9XR62wM8WWCm6a9vhLs7T1uoWBk6FDs',
    decimals: 6,
    referrer: 'Bcw1TvX8jUj6CtY2a7GU2THeYVAudvmT8yzRypVMVsSH',
  },
  SNY: {
    symbol: 'SNY',
    name: 'SNY',
    mintAddress: '4dmKkXNHdgYsXqBHCuMikNQWwVomZURhYvkkX5c4pQ7y',
    decimals: 6,
    referrer: 'G7gyaTNn2hgjF67SWs4Ee9PEaFU2xadhtXL8HmkJ2cNL',
  },
  SLRS: {
    symbol: 'SLRS',
    name: 'SLRS',
    mintAddress: 'SLRSSpSLUTP7okbCUBYStWCo1vUgyt775faPqz8HUMr',
    decimals: 6,
    referrer: 'AmqeHgTdm6kBzy5ewZFKuMAfbynZmhve1GQxbJzQFLbP',
  },
  WOO: {
    symbol: 'WOO',
    name: 'Wootrade Network',
    mintAddress: 'E5rk3nmgLUuKUiS94gg4bpWwWwyjCMtddsAXkTFLtHEy',
    decimals: 6,
    referrer: '7UbeAZxpza5zN3QawQ5KsUo88zXvohUncYB9Zk5QCiim',
  },
  BOP: {
    symbol: 'BOP',
    name: 'Boring Protocol',
    mintAddress: 'BLwTnYKqf7u4qjgZrrsKeNs2EzWkMLqVCu6j8iHyrNA3',
    decimals: 8,
    referrer: 'FWxBZmNsvNckx8DnaL2NuyMtiQmT1x529WwV4e1UWiGk',
  },
  SAMO: {
    symbol: 'SAMO',
    name: 'Samoyed Coin',
    mintAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    decimals: 9,
    referrer: 'FnMDNFL9t8EpbADSU3hLWBtx7SuwRBB6NM84U3PzSkUu',
  },
  renBTC: {
    symbol: 'renBTC',
    name: 'renBTC',
    mintAddress: 'CDJWUqTcYTVAKXAVXoQZFes5JUFc7owSeq7eMQcDSbo5',
    decimals: 8,
    referrer: '7rr64uygy3o5RKVeNv12JGDUFMXVdr2YHvA3NTxzbZT6',
  },
  renDOGE: {
    symbol: 'renDOGE',
    name: 'renDOGE',
    mintAddress: 'ArUkYE2XDKzqy77PRRGjo4wREWwqk6RXTfM9NeqzPvjU',
    decimals: 8,
    referrer: 'J5g7uvJRGnpRyLnRQjFs1MqMkiTVgjxVJCXocu4B4BcZ',
  },
  LIKE: {
    symbol: 'LIKE',
    name: 'LIKE',
    mintAddress: '3bRTivrVsitbmCTGtqwp7hxXPsybkjn4XLNtPsHqa3zR',
    decimals: 9,
    referrer: '2rnVeVGfM88XqyNyBzGWEb7JViYKqncFzjWq5h1ujS9A',
  },
  DXL: {
    symbol: 'DXL',
    name: 'DXL',
    mintAddress: 'GsNzxJfFn6zQdJGeYsupJWzUAm57Ba7335mfhWvFiE9Z',
    decimals: 6,
    referrer: 'HF7mhT9YgD5CULAFDYQmhnUMi1FnNbKeBFCy9SZDh2XE',
  },
  mSOL: {
    symbol: 'mSOL',
    name: 'Marinade staked SOL (mSOL)',
    mintAddress: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
    decimals: 9,
    referrer: '7h5bckf8P29RdviNoKjDyH3Ky3uwdrBiPgYuSCD4asV5',
  },
  PAI: {
    symbol: 'PAI',
    name: 'PAI (Parrot)',
    mintAddress: 'Ea5SjE2Y6yvCeW5dYTn7PYMuW5ikXkvbGdcmSnXeaLjS',
    decimals: 6,
    referrer: '54X98LAxRR2j1KMBBXkbYyUaAWi1iKW9G1Y4TnTJVY2e',
  },
  PORT: {
    symbol: 'PORT',
    name: 'PORT',
    mintAddress: 'PoRTjZMPXb9T7dyU7tpLEZRQj7e6ssfAE62j2oQuc6y',
    decimals: 6,
    referrer: '5Ve8q9fb7R2DhdqGV4o1RVy7xxo4D6ifQfbxGiASdxEH',
  },
  MNGO: {
    symbol: 'MNGO',
    name: 'Mango',
    mintAddress: 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac',
    decimals: 6,
    referrer: 'CijuvE6qDpxZ5WqdEQEe7mS11fXEKiiHc7RR8wRiGzjY',
  },
  CRP: {
    symbol: 'CRP',
    name: 'CRP',
    mintAddress: 'DubwWZNWiNGMMeeQHPnMATNj77YZPZSAz2WVR5WjLJqz',
    decimals: 9,
    referrer: 'FKocyVJptELTbnkUkDRmT7y6hUem2JYrqHoph9uyvQXt',
  },
  ATLAS: {
    symbol: 'ATLAS',
    name: 'ATLAS',
    mintAddress: 'ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx',
    decimals: 8,
    referrer: '9t9mzbkMtLdazj1D9JycS15Geb1KVtcDt4XyAkpM72Ee',
  },
  POLIS: {
    symbol: 'POLIS',
    name: 'POLIS',
    mintAddress: 'poLisWXnNRwC6oBu1vHiuKQzFjGL4XDSu4g9qjz9qVk',
    decimals: 8,
    referrer: 'CQ7HWCeSSp3tAfWzqH7ZEzgnTBr5Tvz1No3Y1xbiWzBm',
  },
  GRAPE: {
    symbol: 'GRAPE',
    name: 'GRAPE',
    mintAddress: '8upjSpvjcdpuzhfR1zriwg5NXkwDruejqNE9WNbPRtyA',
    decimals: 6,
    referrer: 'M4nDMB9krXbaNFPVu1DjrBTfqPUHbKEQLZSSDNH2JrL',
  },
  GENE: {
    symbol: 'GENE',
    name: 'GENE',
    mintAddress: 'GENEtH5amGSi8kHAtQoezp1XEXwZJ8vcuePYnXdKrMYz',
    decimals: 9,
  },
  CHEEMS: {
    symbol: 'CHEEMS',
    name: 'CHEEMS',
    mintAddress: '3FoUAsGDbvTD6YZ4wVKJgTB76onJUKz7GPEBNiR5b8wc',
    decimals: 4,
    referrer: '',
  },
  stSOL: {
    symbol: 'stSOL',
    name: 'stSOL',
    mintAddress: '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj',
    decimals: 9,
    referrer: '8Mq4Tugv1fcT4gb1wf5ChdEFmdqNGKxFVCnM9TVe44vD',
  },
  LARIX: {
    symbol: 'LARIX',
    name: 'LARIX',
    mintAddress: 'Lrxqnh6ZHKbGy3dcrCED43nsoLkM1LTzU2jRfWe8qUC',
    decimals: 6,
    referrer: 'DReKowvoxxEDdi5jnxBWJLTV73D9oHSt9uNMuSCk9cLk',
  },
  RIN: {
    symbol: 'RIN',
    name: 'RIN',
    mintAddress: 'E5ndSkaB17Dm7CsD22dvcjfrYSDLCxFcMd6z8ddCk5wp',
    decimals: 9,
  },
  APEX: {
    symbol: 'APEX',
    name: 'APEX',
    mintAddress: '51tMb3zBKDiQhNwGqpgwbavaGH54mk8fXFzxTc1xnasg',
    decimals: 9,
  },
  MNDE: {
    symbol: 'MNDE',
    name: 'MNDE',
    mintAddress: 'MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey',
    decimals: 9,
  },
  LIQ: {
    symbol: 'LIQ',
    name: 'LIQ',
    mintAddress: '4wjPQJ6PrkC4dHhYghwJzGBVP78DkBzA2U3kHoFNBuhj',
    decimals: 6,
  },
  WAG: {
    symbol: 'WAG',
    name: 'WAG',
    mintAddress: '5tN42n9vMi6ubp67Uy4NnmM5DMZYN8aS8GeB3bEDHr6E',
    decimals: 9,
  },
  wLDO: {
    symbol: 'wLDO',
    name: 'wLDO',
    mintAddress: 'HZRCwxP2Vq9PCpPXooayhJ2bxTpo5xfpQrwB1svh332p',
    decimals: 8,
  },
  SLIM: {
    symbol: 'SLIM',
    name: 'SLIM',
    mintAddress: 'xxxxa1sKNGwFtw2kFn8XauW9xq8hBZ5kVtcSesTT9fW',
    decimals: 6,
  },
  PRT: {
    symbol: 'PRT',
    name: 'PRT',
    mintAddress: 'PRT88RkA4Kg5z7pKnezeNH4mafTvtQdfFgpQTGRjz44',
    decimals: 6,
  },
  SBR: {
    symbol: 'SBR',
    name: 'SBR',
    mintAddress: 'Saber2gLauYim4Mvftnrasomsv6NvAuncvMEZwcLpD1',
    decimals: 6,
  },
  FAB: {
    symbol: 'FAB',
    name: 'FAB',
    mintAddress: 'EdAhkbj5nF9sRM7XN7ewuW8C9XEUMs8P7cnoQ57SYE96',
    decimals: 9,
  },
  ABR: {
    symbol: 'ABR',
    name: 'ABR',
    mintAddress: 'a11bdAAuV8iB2fu7X6AxAvDTo1QZ8FXB3kk5eecdasp',
    decimals: 9,
  },
  IVN: {
    symbol: 'IVN',
    name: 'IVN',
    mintAddress: 'iVNcrNE9BRZBC9Aqf753iZiZfbszeAVUoikgT9yvr2a',
    decimals: 6,
  },
  CYS: {
    symbol: 'CYS',
    name: 'CYS',
    mintAddress: 'BRLsMczKuaR5w9vSubF4j8HwEGGprVAyyVgS4EX7DKEg',
    decimals: 6,
  },
  FRKT: {
    symbol: 'FRKT',
    name: 'FRKT',
    mintAddress: 'ErGB9xa24Szxbk1M28u2Tx8rKPqzL6BroNkkzk5rG4zj',
    decimals: 8,
  },
  AURY: {
    symbol: 'AURY',
    name: 'AURY',
    mintAddress: 'AURYydfxJib1ZkTir1Jn1J9ECYUtjb6rKQVmtYaixWPP',
    decimals: 9,
  },
  SYP: {
    symbol: 'SYP',
    name: 'SYP',
    mintAddress: 'FnKE9n6aGjQoNWRBZXy4RW6LZVao7qwBonUbiD7edUmZ',
    decimals: 9,
  },
  WOOF: {
    symbol: 'WOOF',
    name: 'WOOF',
    mintAddress: '9nEqaUcb16sQ3Tn1psbkWqyhPdLmfHWjKGymREjsAgTE',
    decimals: 6,
  },
  ORCA: {
    symbol: 'ORCA',
    name: 'ORCA',
    mintAddress: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
    decimals: 6,
  },
  SLND: {
    symbol: 'SLND',
    name: 'SLND',
    mintAddress: 'SLNDpmoWTVADgEdndyvWzroNL7zSi1dF9PC3xHGtPwp',
    decimals: 6,
  },
  whETH: {
    symbol: 'whETH',
    name: 'whETH',
    mintAddress: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
    decimals: 8,
  },
  weUNI: {
    symbol: 'weUNI',
    name: 'weUNI',
    mintAddress: '8FU95xFJhUUkyyCLU13HSzDLs7oC4QZdXQHL6SCeab36',
    decimals: 8,
  },
  weSUSHI: {
    symbol: 'weSUSHI',
    name: 'weSUSHI',
    mintAddress: 'ChVzxWRmrTeSgwd3Ui3UumcN8KX7VK3WaD4KGeSKpypj',
    decimals: 8,
  },
  GOFX: {
    symbol: 'GOFX',
    name: 'GOFX',
    mintAddress: 'GFX1ZjR2P15tmrSwow6FjyDYcEkoFb4p4gJCpLBjaxHD',
    decimals: 9,
  },
  IN: {
    symbol: 'IN',
    name: 'IN',
    mintAddress: 'inL8PMVd6iiW3RCBJnr5AsrRN6nqr4BTrcNuQWQSkvY',
    decimals: 9,
  },
  weDYDX: {
    symbol: 'weDYDX',
    name: 'weDYDX',
    mintAddress: '4Hx6Bj56eGyw8EJrrheM6LBQAvVYRikYCWsALeTrwyRU',
    decimals: 8,
  },
  STARS: {
    symbol: 'STARS',
    name: 'STARS',
    mintAddress: 'HCgybxq5Upy8Mccihrp7EsmwwFqYZtrHrsmsKwtGXLgW',
    decimals: 6,
  },
  weAXS: {
    symbol: 'weAXS',
    name: 'weAXS',
    mintAddress: 'HysWcbHiYY9888pHbaqhwLYZQeZrcQMXKQWRqS7zcPK5',
    decimals: 8,
  },
  weSHIB: {
    symbol: 'weSHIB',
    name: 'weSHIB',
    mintAddress: 'CiKu4eHsVrc1eueVQeHn7qhXTcVu95gSQmBpX4utjL9z',
    decimals: 8,
  },
  OXS: {
    symbol: 'OXS',
    name: 'OXS',
    mintAddress: '4TGxgCSJQx2GQk9oHZ8dC5m3JNXTYZHjXumKAW3vLnNx',
    decimals: 9,
  },
  CWAR: {
    symbol: 'CWAR',
    name: 'CWAR',
    mintAddress: 'HfYFjMKNZygfMC8LsQ8LtpPsPxEJoXJx4M6tqi75Hajo',
    decimals: 9,
  },
  UPS: {
    symbol: 'UPS',
    name: 'UPS',
    mintAddress: 'EwJN2GqUGXXzYmoAciwuABtorHczTA5LqbukKXV1viH7',
    decimals: 6,
  },
  weSAND: {
    symbol: 'weSAND',
    name: 'weSAND',
    mintAddress: '49c7WuCZkQgc3M4qH8WuEUNXfgwupZf1xqWkDQ7gjRGt',
    decimals: 8,
  },
  weMANA: {
    symbol: 'weMANA',
    name: 'weMANA',
    mintAddress: '7dgHoN8wBZCc5wbnQ2C47TDnBMAxG4Q5L3KjP67z8kNi',
    decimals: 8,
  },
  CAVE: {
    symbol: 'CAVE',
    name: 'CAVE',
    mintAddress: '4SZjjNABoqhbd4hnapbvoEPEqT8mnNkfbEoAwALf1V8t',
    decimals: 6,
  },
  JSOL: {
    symbol: 'JSOL',
    name: 'JSOL',
    mintAddress: '7Q2afV64in6N6SeZsAAB81TJzwDoD6zpqmHkzi9Dcavn',
    decimals: 9,
  },
  APT: {
    symbol: 'APT',
    name: 'APT',
    mintAddress: 'APTtJyaRX5yGTsJU522N4VYWg3vCvSb65eam5GrPT5Rt',
    decimals: 6,
  },
  SONAR: {
    symbol: 'SONAR',
    name: 'SONAR',
    mintAddress: 'sonarX4VtVkQemriJeLm6CKeW3GDMyiBnnAEMw1MRAE',
    decimals: 9,
  },
  SHILL: {
    symbol: 'SHILL',
    name: 'SHILL',
    mintAddress: '6cVgJUqo4nmvQpbgrDZwyfd6RwWw5bfnCamS3M9N1fd',
    decimals: 6,
  },
  TTT: {
    symbol: 'TTT',
    name: 'TabTrader',
    mintAddress: 'FNFKRV3V8DtA3gVJN6UshMiLGYA8izxFwkNWmJbFjmRj',
    decimals: 6,
  },
  BOKU: {
    symbol: 'BOKU',
    name: 'BOKU',
    mintAddress: 'CN7qFa5iYkHz99PTctvT4xXUHnxwjQ5MHxCuTJtPN5uS',
    decimals: 9,
  },
  MIMO: {
    symbol: 'MIMO',
    name: 'MIMO',
    mintAddress: '9TE7ebz1dsFo1uQ2T4oYAKSm39Y6fWuHrd6Uk6XaiD16',
    decimals: 9,
  },
  wbWBNB: {
    symbol: 'wbWBNB',
    name: 'wbWBNB',
    mintAddress: '9gP2kCy3wA1ctvYWQk75guqXuHfrEomqydHLtcTCqiLa',
    decimals: 8,
  },
  wePEOPLE: {
    symbol: 'wePEOPLE',
    name: 'wePEOPLE',
    mintAddress: 'CobcsUrt3p91FwvULYKorQejgsm5HoQdv5T8RUZ6PnLA',
    decimals: 8,
  },
  XTAG: {
    symbol: 'XTAG',
    name: 'XTAG',
    mintAddress: '5gs8nf4wojB5EXgDUWNLwXpknzgV2YWDhveAeBZpVLbp',
    decimals: 6,
  },
  KKO: {
    symbol: 'KKO',
    name: 'KKO',
    mintAddress: 'kiNeKo77w1WBEzFFCXrTDRWGRWGP8yHvKC9rX6dqjQh',
    decimals: 9,
  },
  VI: {
    symbol: 'VI',
    name: 'VI',
    mintAddress: '7zBWymxbZt7PVHQzfi3i85frc1YRiQc23K7bh3gos8ZC',
    decimals: 9,
  },
  SOLC: {
    symbol: 'SOLC',
    name: 'SOLC',
    mintAddress: 'Bx1fDtvTN6NvE4kjdPHQXtmGSg582bZx9fGy4DQNMmAT',
    decimals: 9,
  },
  STR: {
    symbol: 'STR',
    name: 'STR',
    mintAddress: '9zoqdwEBKWEi9G5Ze8BSkdmppxGgVv1Kw4LuigDiNr9m',
    decimals: 9,
  },
  SPWN: {
    symbol: 'SPWN',
    name: 'SPWN',
    mintAddress: '5U9QqCPhqXAJcEv9uyzFJd5zhN93vuPk1aNNkXnUfPnt',
    decimals: 9,
  },
  ISOLA: {
    symbol: 'ISOLA',
    name: 'ISOLA',
    mintAddress: '333iHoRM2Awhf9uVZtSyTfU8AekdGrgQePZsKMFPgKmS',
    decimals: 6,
  },
  SOLAR: {
    symbol: 'SOLAR',
    name: 'SOLAR',
    mintAddress: '2wmKXX1xsxLfrvjEPrt2UHiqj8Gbzwxvffr9qmNjsw8g',
    decimals: 9,
  },
  BASIS: {
    symbol: 'BASIS',
    name: 'BASIS',
    mintAddress: 'Basis9oJw9j8cw53oMV7iqsgo6ihi9ALw4QR31rcjUJa',
    decimals: 6,
  },
  SOLX: {
    symbol: 'SOLX',
    name: 'SOLX',
    mintAddress: 'CH74tuRLTYcxG7qNJCsV9rghfLXJCQJbsu7i52a8F1Gn',
    decimals: 9,
  },
  RUN: {
    symbol: 'RUN',
    name: 'RUN',
    mintAddress: '6F9XriABHfWhit6zmMUYAQBSy6XK5VF1cHXuW5LDpRtC',
    decimals: 9,
  },
  REAL: {
    symbol: 'REAL',
    name: 'REAL',
    mintAddress: 'AD27ov5fVU2XzwsbvnFvb1JpCBaCB5dRXrczV9CqSVGb',
    decimals: 9,
  },
  CRWNY: {
    symbol: 'CRWNY',
    name: 'CRWNY',
    mintAddress: 'CRWNYkqdgvhGGae9CKfNka58j6QQkaD5bLhKXvUYqnc1',
    decimals: 6,
  },
  BLOCK: {
    symbol: 'BLOCK',
    name: 'BLOCK',
    mintAddress: 'NFTUkR4u7wKxy9QLaX2TGvd9oZSWoMo4jqSJqdMb7Nk',
    decimals: 6,
  },


  
  APYS: {
    symbol: 'APYS',
    name: 'APYS',
    mintAddress: '5JnZ667P3VcjDinkJFysWh2K2KtViy63FZ3oL5YghEhW',
    decimals: 9,
  },
  OOGI: {
    symbol: 'OOGI',
    name: 'OOGI',
    mintAddress: 'H7Qc9APCWWGDVxGD5fJHmLTmdEgT9GFatAKFNg6sHh8A',
    decimals: 9,
  },
  DATE: {
    symbol: 'DATE',
    name: 'DATE',
    mintAddress: 'Ce3PSQfkxT5ua4r2JqCoWYrMwKWC5hEzwsrT9Hb7mAz9',
    decimals: 9,
  },
  COBAN: {
    symbol: 'COBAN',
    name: 'COBAN',
    mintAddress: '7udMmYXh6cuWVY6qQVCd9b429wDVn2J71r5BdxHkQADY',
    decimals: 3,
  },
  DFL: {
    symbol: 'DFL',
    name: 'DFL',
    mintAddress: 'DFL1zNkaGPWm1BqAVqRjCZvHmwTFrEaJtbzJWgseoNJh',
    decimals: 9,
  },
  CHICKS: {
    symbol: 'CHICKS',
    name: 'CHICKS',
    mintAddress: 'cxxShYRVcepDudXhe7U62QHvw8uBJoKFifmzggGKVC2',
    decimals: 9,
  },
  NOVA: {
    symbol: 'NOVA',
    name: 'NOVA',
    mintAddress: 'BDrL8huis6S5tpmozaAaT5zhE5A7ZBAB2jMMvpKEeF8A',
    decimals: 9,
  },
  GST: {
    symbol: 'GST',
    name: 'GST',
    mintAddress: 'AFbX8oGjGpmVFywbVouvhQSRmiW2aR1mohfahi4Y2AdB',
    decimals: 9,
  },
  MBS: {
    symbol: 'MBS',
    name: 'MBS',
    mintAddress: 'Fm9rHUTF5v3hwMLbStjZXqNBBoZyGriQaFM6sTFz3K8A',
    decimals: 6,
  },
  RACEFI: {
    symbol: 'RACEFI',
    name: 'RACEFI',
    mintAddress: 'AAmGoPDFLG6bE82BgZWjVi8k95tj9Tf3vUN7WvtUm2BU',
    decimals: 6,
  },
  MEAN: {
    symbol: 'MEAN',
    name: 'MEAN',
    mintAddress: 'MEANeD3XDdUmNMsRGjASkSWdC8prLYsoRJ61pPeHctD',
    decimals: 6,
  },
  TINY: {
    symbol: 'TINY',
    name: 'TINY',
    mintAddress: 'HKfs24UEDQpHS5hUyKYkHd9q7GY5UQ679q2bokeL2whu',
    decimals: 6,
  },
  SHDW: {
    symbol: 'SHDW',
    name: 'SHDW',
    mintAddress: 'SHDWyBxihqiCj6YekG2GUr7wqKLeLAMK1gHZck9pL6y',
    decimals: 9,
  },
  SCY: {
    symbol: 'SCY',
    name: 'SCY',
    mintAddress: 'SCYfrGCw8aDiqdgcpdGjV6jp4UVVQLuphxTDLNWu36f',
    decimals: 9,
  },
  SLC: {
    symbol: 'SLC',
    name: 'SLC',
    mintAddress: 'METAmTMXwdb8gYzyCPfXXFmZZw4rUsXX58PNsDg7zjL',
    decimals: 6,
  },
  $WOOD: {
    symbol: '$WOOD',
    name: '$WOOD',
    mintAddress: '674PmuiDtgKx3uKuJ1B16f9m5L84eFvNwj3xDMvHcbo7',
    decimals: 9,
  },
}