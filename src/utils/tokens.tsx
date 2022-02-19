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
    mintAddress: 'So11111111111111111111111111111111111111112',
    referrer: 'HTcarLHe7WRxBQCWvhVB8AP56pnEtJUV2jDGvcpY3xo5',
  },
  BTC: {
    symbol: 'BTC',
    mintAddress: '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E',
    referrer: 'GZpS8cY8Nt8HuqxzJh6PXTdSxc38vFUjBmi7eEUkkQtG',
  },
  ETH: {
    symbol: 'ETH',
    mintAddress: '2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk',
    referrer: 'CXPTcSxxh4AT38gtv3SPbLS7oZVgXzLbMb83o4ziXjjN',
  },
  USDT: {
    symbol: 'USDT',
    mintAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    referrer: '8DwwDNagph8SdwMUdcXS5L9YAyutTyDJmK6cTKrmNFk3',
  },
  WUSDT: {
    symbol: 'WUSDT',
    mintAddress: 'BQcdHdAQW1hczDbBi9hiegXAR7A98Q9jx3X3iBBBDiq4',
    referrer: 'CA98hYunCLKgBuD6N8MJSgq1GbW9CXdksLf5mw736tS3',
  },
  USDC: {
    symbol: 'USDC',
    mintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    referrer: '92vdtNjEg6Zth3UU1MgPgTVFjSEzTHx66aCdqWdcRkrg',
  },
  YFI: {
    symbol: 'YFI',
    mintAddress: '3JSf5tPeuscJGtaCp5giEiDhv51gQ4v3zWg8DGgyLfAB',
    referrer: 'DZjgzKfYzZBBSTo5vytMYvGdNF933DvuX8TftDMrThrb',
  },
  LINK: {
    symbol: 'LINK',
    mintAddress: 'CWE8jPTUYhdCTZYWPTe1o5DFqfdjzWKc9WKz6rSjQUdG',
    referrer: 'DRSKKsYZaPEFkRgGywo7KWBGZikf71R9aDr8tjtpr41V',
  },
  XRP: {
    symbol: 'XRP',
    mintAddress: 'Ga2AXHpfAF6mv2ekZwcsJFqu7wB4NV331qNH7fW9Nst8',
    referrer: '6NeHPXG142tAE2Ej3gHgT2N66i1KH6PFR6PBZw6RyrwH',
  },
  SUSHI: {
    symbol: 'SUSHI',
    mintAddress: 'AR1Mtgh7zAtxuxGd2XPovXPVjcSdY3i4rQYisNadjfKy',
    referrer: '59QxHeHgb28tDc3gStnrW8FNKC9qWuRmRZHBaAqCerJX',
  },
  ALEPH: {
    symbol: 'ALEPH',
    mintAddress: 'CsZ5LZkDS7h9TDKjrbL7VAwQZ9nsRu8vJLhRYfmGaN8K',
    referrer: '8FKAKrenJMDd7V6cxnM5BsymHTjqxgodtHbLwZReMnWW',
  },
  SXP: {
    symbol: 'SXP',
    mintAddress: 'SF3oTvfWzEP3DTwGSvUXRrGTvr75pdZNnBLAH9bzMuX',
    referrer: '97Vyotr284UM2Fyq9gbfQ3azMYtgf7cjnsf8pN1PFfY9',
  },
  HGET: {
    symbol: 'HGET',
    mintAddress: 'BtZQfWqDGbk9Wf2rXEiWyQBdBY1etnUUn6zEphvVS7yN',
    referrer: 'AGY2wy1ANzLM2jJLSkVxPUYAY5iAYXYsLMQkoQsAhucj',
  },
  CREAM: {
    symbol: 'CREAM',
    mintAddress: '5Fu5UUgbjpUvdBveb3a1JTNirL8rXtiYeSMWvKjtUNQv',
    referrer: '7WPzEiozJ69MQe8bfbss1t2unR6bHR4S7FimiUVRgu7P',
  },
  UNI: {
    symbol: 'UNI',
    mintAddress: 'DEhAasscXF4kEGxFgJ3bq4PpVGp5wyUxMRvn6TzGVHaw',
    referrer: '4ntxDv95ajBbXfZyGy3UhcQDx8xmH1yJ6eKvuNNH466x',
  },
  SRM: {
    symbol: 'SRM',
    mintAddress: 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt',
    referrer: 'HYxa4Ea1dz7ya17Cx18rEGUA1WbCvKjXjFKrnu8CwugH',
  },
  FTT: {
    symbol: 'FTT',
    mintAddress: 'AGFEad2et2ZJif9jaGpdMixQqvW5i81aBdvKe7PHNfz3',
    referrer: 'CafpgSh8KGL2GPTjdXfctD3vXngNZDJ3Q92FTfV71Hmt',
  },
  MSRM: {
    symbol: 'MSRM',
    mintAddress: 'MSRMcoVyrFxnSgo5uXwone5SKcGhT1KEJMFEkMEWf9L',
    referrer: 'Ge5q9x8gDUNYqqLA1MdnCzWNJGsbj3M15Yxse2cDbw9z',
  },
  TOMO: {
    symbol: 'TOMO',
    mintAddress: 'GXMvfY2jpQctDqZ9RoU3oWPhufKiCcFEfchvYumtX7jd',
    referrer: '9fexfN3eZomF5gfenG5L9ydbKRQkPhq6x74rb5iLrvXP',
  },
  LUA: {
    symbol: 'LUA',
    mintAddress: 'EqWCKXfs3x47uVosDpTRgFniThL9Y8iCztJaapxbEaVX',
    referrer: 'HuZwNApjVFuFSDgrwZA8GP2JD7WMby4qt6rkWDnaMo7j',
  },
  MATH: {
    symbol: 'MATH',
    mintAddress: 'GeDS162t9yGJuLEHPWXXGrb1zwkzinCgRwnT8vHYjKza',
    referrer: 'C9K1M8sJX8WMdsnFT7DuzdiHHunEj79EsLuz4DixQYGm',
  },
  FIDA: {
    symbol: 'FIDA',
    mintAddress: 'EchesyfXePKdLtoiZSL8pBe8Myagyy8ZRqsACNCFGnvp',
    referrer: 'AeAsG75UmyPDB271c6NHonHxXAPXfkvhcf2xjfJhReS8',
  },
  KIN: {
    symbol: 'KIN',
    mintAddress: 'kinXdEcpDQeHPEuQnqmUgtYykqKGVFq6CeVX5iAHJq6',
    referrer: 'AevFXmApVxN2yk1iemSxXc6Wy7Z1udUEfST11kuYKmr9',
  },
  RAY: {
    symbol: 'RAY',
    mintAddress: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    referrer: '33XpMmMQRf6tSPpmYyzpwU4uXpZHkFwCZsusD9dMYkjy',
  },
  xCOPE: {
    symbol: 'xCOPE',
    mintAddress: '3K6rftdAaQYMPunrtNRHgnK2UAtjm2JwyT2oCiTDouYE',
    referrer: '8DTehuES4tfnd2SrqcjN52XofxWXGjiLZRgM12U9pB6f',
  },
  COPE: {
    symbol: 'COPE',
    mintAddress: '8HGyAAB1yoM1ttS7pXjHMa3dukTFGQggnFFH3hJZgzQh',
    referrer: 'G7UYwWhkmgeL57SUKFF45K663V9TdXZw6Ho6ZLQ7p4p',
  },
  STEP: {
    symbol: 'STEP',
    mintAddress: 'StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT',
    referrer: 'EFQVX1S6dFroDDhJDAnMTX4fCfjt4fJXHdk1eEtJ2uRY',
  },
  MEDIA: {
    symbol: 'MEDIA',
    mintAddress: 'ETAtLmCmsoiEEKfNrHKJ2kYy3MoABhU6NQvpSfij5tDs',
    referrer: 'AYnaG3AidNWFzjq9U3BJSsQ9DShE8g7FszriBDtRFvsx',
  },
  ROPE: {
    symbol: 'ROPE',
    mintAddress: '8PMHT4swUMtBzgHnh5U564N5sjPSiUz2cjEQzFnnP1Fo',
    referrer: '5sGVVniBSPLTwRHDETShovq7STRH2rJwbvdvvH3NcVTF',
  },
  MER: {
    symbol: 'MER',
    mintAddress: 'MERt85fc5boKw3BW1eYdxonEuJNvXbiMbs6hvheau5K',
    referrer: '36F4ryvqaNW2yKQsAry4ZHCZ3j7tz3gtEz7NEwv7pSRu',
  },
  TULIP: {
    symbol: 'TULIP',
    mintAddress: 'TuLipcqtGVXP9XR62wM8WWCm6a9vhLs7T1uoWBk6FDs',
    referrer: 'Bcw1TvX8jUj6CtY2a7GU2THeYVAudvmT8yzRypVMVsSH',
  },
  SNY: {
    symbol: 'SNY',
    mintAddress: '4dmKkXNHdgYsXqBHCuMikNQWwVomZURhYvkkX5c4pQ7y',
    referrer: 'G7gyaTNn2hgjF67SWs4Ee9PEaFU2xadhtXL8HmkJ2cNL',
  },
  SLRS: {
    symbol: 'SLRS',
    mintAddress: 'SLRSSpSLUTP7okbCUBYStWCo1vUgyt775faPqz8HUMr',
    referrer: 'AmqeHgTdm6kBzy5ewZFKuMAfbynZmhve1GQxbJzQFLbP',
  },
  WOO: {
    symbol: 'WOO',
    mintAddress: 'E5rk3nmgLUuKUiS94gg4bpWwWwyjCMtddsAXkTFLtHEy',
    referrer: '7UbeAZxpza5zN3QawQ5KsUo88zXvohUncYB9Zk5QCiim',
  },
  BOP: {
    symbol: 'BOP',
    mintAddress: 'BLwTnYKqf7u4qjgZrrsKeNs2EzWkMLqVCu6j8iHyrNA3',
    referrer: 'FWxBZmNsvNckx8DnaL2NuyMtiQmT1x529WwV4e1UWiGk',
  },
  SAMO: {
    symbol: 'SAMO',
    mintAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    referrer: 'FnMDNFL9t8EpbADSU3hLWBtx7SuwRBB6NM84U3PzSkUu',
  },
  renBTC: {
    symbol: 'renBTC',
    mintAddress: 'CDJWUqTcYTVAKXAVXoQZFes5JUFc7owSeq7eMQcDSbo5',
    referrer: '7rr64uygy3o5RKVeNv12JGDUFMXVdr2YHvA3NTxzbZT6',
  },
  renDOGE: {
    symbol: 'renDOGE',
    mintAddress: 'ArUkYE2XDKzqy77PRRGjo4wREWwqk6RXTfM9NeqzPvjU',
    referrer: 'J5g7uvJRGnpRyLnRQjFs1MqMkiTVgjxVJCXocu4B4BcZ',
  },
  LIKE: {
    symbol: 'LIKE',
    mintAddress: '3bRTivrVsitbmCTGtqwp7hxXPsybkjn4XLNtPsHqa3zR',
    referrer: '2rnVeVGfM88XqyNyBzGWEb7JViYKqncFzjWq5h1ujS9A',
  },
  DXL: {
    symbol: 'DXL',
    mintAddress: 'GsNzxJfFn6zQdJGeYsupJWzUAm57Ba7335mfhWvFiE9Z',
    referrer: 'HF7mhT9YgD5CULAFDYQmhnUMi1FnNbKeBFCy9SZDh2XE',
  },
  mSOL: {
    symbol: 'mSOL',
    mintAddress: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
    referrer: '7h5bckf8P29RdviNoKjDyH3Ky3uwdrBiPgYuSCD4asV5',
  },
  PAI: {
    symbol: 'PAI',
    mintAddress: 'Ea5SjE2Y6yvCeW5dYTn7PYMuW5ikXkvbGdcmSnXeaLjS',
    referrer: '54X98LAxRR2j1KMBBXkbYyUaAWi1iKW9G1Y4TnTJVY2e',
  },
  PORT: {
    symbol: 'PORT',
    mintAddress: 'PoRTjZMPXb9T7dyU7tpLEZRQj7e6ssfAE62j2oQuc6y',
    referrer: '5Ve8q9fb7R2DhdqGV4o1RVy7xxo4D6ifQfbxGiASdxEH',
  },
  MNGO: {
    symbol: 'MNGO',
    mintAddress: 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac',
    referrer: 'CijuvE6qDpxZ5WqdEQEe7mS11fXEKiiHc7RR8wRiGzjY',
  },
  CRP: {
    symbol: 'CRP',
    mintAddress: 'DubwWZNWiNGMMeeQHPnMATNj77YZPZSAz2WVR5WjLJqz',
    referrer: 'FKocyVJptELTbnkUkDRmT7y6hUem2JYrqHoph9uyvQXt',
  },
  ATLAS: {
    symbol: 'ATLAS',
    mintAddress: 'ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx',
    referrer: '9t9mzbkMtLdazj1D9JycS15Geb1KVtcDt4XyAkpM72Ee',
  },
  POLIS: {
    symbol: 'POLIS',
    mintAddress: 'poLisWXnNRwC6oBu1vHiuKQzFjGL4XDSu4g9qjz9qVk',
    referrer: 'CQ7HWCeSSp3tAfWzqH7ZEzgnTBr5Tvz1No3Y1xbiWzBm',
  },
  GRAPE: {
    symbol: 'GRAPE',
    mintAddress: '8upjSpvjcdpuzhfR1zriwg5NXkwDruejqNE9WNbPRtyA',
    referrer: 'M4nDMB9krXbaNFPVu1DjrBTfqPUHbKEQLZSSDNH2JrL',
  },
  stSOL: {
    symbol: 'stSOL',
    mintAddress: '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj',
    referrer: '8Mq4Tugv1fcT4gb1wf5ChdEFmdqNGKxFVCnM9TVe44vD',
  },
  LARIX: {
    symbol: 'LARIX',
    mintAddress: 'Lrxqnh6ZHKbGy3dcrCED43nsoLkM1LTzU2jRfWe8qUC',
    referrer: 'DReKowvoxxEDdi5jnxBWJLTV73D9oHSt9uNMuSCk9cLk',
  },
}

function addToken() {
  fetch('https://api.raydium.io/v1/dex/token')
    .then(async (response) => {
      for (const [mint, symbol] of Object.entries(await response.json())) {
        TOKENS[mint] = {
          symbol,
          mintAddress: mint
        }
      }
    })
}
addToken()