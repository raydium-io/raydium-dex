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
    referrer: 'HTcarLHe7WRxBQCWvhVB8AP56pnEtJUV2jDGvcpY3xo5'
  },
  BTC: {
    symbol: 'BTC',
    name: 'Wrapped Bitcoin',
    mintAddress: '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E',
    decimals: 6,
    referrer: 'GZpS8cY8Nt8HuqxzJh6PXTdSxc38vFUjBmi7eEUkkQtG'
  },
  ETH: {
    symbol: 'ETH',
    name: 'Wrapped Ethereum',
    mintAddress: '2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk',
    decimals: 6,
    referrer: 'CXPTcSxxh4AT38gtv3SPbLS7oZVgXzLbMb83o4ziXjjN'
  },
  USDT: {
    symbol: 'USDT',
    name: 'USDT',
    mintAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    decimals: 6,
    referrer: '8DwwDNagph8SdwMUdcXS5L9YAyutTyDJmK6cTKrmNFk3'
  },
  WUSDT: {
    symbol: 'WUSDT',
    name: 'Wrapped USDT',
    mintAddress: 'BQcdHdAQW1hczDbBi9hiegXAR7A98Q9jx3X3iBBBDiq4',
    decimals: 6,
    referrer: 'CA98hYunCLKgBuD6N8MJSgq1GbW9CXdksLf5mw736tS3'
  },
  USDC: {
    symbol: 'USDC',
    name: 'USDC',
    mintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    referrer: '92vdtNjEg6Zth3UU1MgPgTVFjSEzTHx66aCdqWdcRkrg'
  },
  WUSDC: {
    symbol: 'WUSDC',
    name: 'Wrapped USDC',
    mintAddress: 'BXXkv6z8ykpG1yuvUDPgh732wzVHB69RnB9YgSYh3itW',
    decimals: 6
  },
  YFI: {
    symbol: 'YFI',
    name: 'Wrapped YFI',
    mintAddress: '3JSf5tPeuscJGtaCp5giEiDhv51gQ4v3zWg8DGgyLfAB',
    decimals: 6,
    referrer: 'DZjgzKfYzZBBSTo5vytMYvGdNF933DvuX8TftDMrThrb'
  },
  LINK: {
    symbol: 'LINK',
    name: 'Wrapped Chainlink',
    mintAddress: 'CWE8jPTUYhdCTZYWPTe1o5DFqfdjzWKc9WKz6rSjQUdG',
    decimals: 6,
    referrer: 'DRSKKsYZaPEFkRgGywo7KWBGZikf71R9aDr8tjtpr41V'
  },
  XRP: {
    symbol: 'XRP',
    name: 'Wrapped XRP',
    mintAddress: 'Ga2AXHpfAF6mv2ekZwcsJFqu7wB4NV331qNH7fW9Nst8',
    decimals: 6,
    referrer: '6NeHPXG142tAE2Ej3gHgT2N66i1KH6PFR6PBZw6RyrwH'
  },
  SUSHI: {
    symbol: 'SUSHI',
    name: 'Wrapped SUSHI',
    mintAddress: 'AR1Mtgh7zAtxuxGd2XPovXPVjcSdY3i4rQYisNadjfKy',
    decimals: 6,
    referrer: '59QxHeHgb28tDc3gStnrW8FNKC9qWuRmRZHBaAqCerJX'
  },
  ALEPH: {
    symbol: 'ALEPH',
    name: 'Wrapped ALEPH',
    mintAddress: 'CsZ5LZkDS7h9TDKjrbL7VAwQZ9nsRu8vJLhRYfmGaN8K',
    decimals: 6,
    referrer: '8FKAKrenJMDd7V6cxnM5BsymHTjqxgodtHbLwZReMnWW'
  },
  SXP: {
    symbol: 'SXP',
    name: 'Wrapped SXP',
    mintAddress: 'SF3oTvfWzEP3DTwGSvUXRrGTvr75pdZNnBLAH9bzMuX',
    decimals: 6,
    referrer: '97Vyotr284UM2Fyq9gbfQ3azMYtgf7cjnsf8pN1PFfY9'
  },
  HGET: {
    symbol: 'HGET',
    name: 'Wrapped HGET',
    mintAddress: 'BtZQfWqDGbk9Wf2rXEiWyQBdBY1etnUUn6zEphvVS7yN',
    decimals: 6,
    referrer: 'AGY2wy1ANzLM2jJLSkVxPUYAY5iAYXYsLMQkoQsAhucj'
  },
  CREAM: {
    symbol: 'CREAM',
    name: 'Wrapped CREAM',
    mintAddress: '5Fu5UUgbjpUvdBveb3a1JTNirL8rXtiYeSMWvKjtUNQv',
    decimals: 6,
    referrer: '7WPzEiozJ69MQe8bfbss1t2unR6bHR4S7FimiUVRgu7P'
  },
  UBXT: {
    symbol: 'UBXT',
    name: 'Wrapped UBXT',
    mintAddress: '873KLxCbz7s9Kc4ZzgYRtNmhfkQrhfyWGZJBmyCbC3ei',
    decimals: 6,
    referrer: '9aocFzNkSVj9TCS6cJk2uYyuzEpXPWT7xoBBF9JcZ879'
  },
  HNT: {
    symbol: 'HNT',
    name: 'Wrapped HNT',
    mintAddress: 'HqB7uswoVg4suaQiDP3wjxob1G5WdZ144zhdStwMCq7e',
    decimals: 6,
    referrer: 'B61oHrGCFh8P75Z2cRDiw2nbEwbMyhVfZhMWiwxU2qCV'
  },
  FRONT: {
    symbol: 'FRONT',
    name: 'Wrapped FRONT',
    mintAddress: '9S4t2NEAiJVMvPdRYKVrfJpBafPBLtvbvyS3DecojQHw',
    decimals: 6,
    referrer: 'FnasnCc7c43hd2nanSmRjh9Sf9Cgz6aEvNj6wpDznS5h'
  },
  AKRO: {
    symbol: 'AKRO',
    name: 'Wrapped AKRO',
    mintAddress: '6WNVCuxCGJzNjmMZoKyhZJwvJ5tYpsLyAtagzYASqBoF',
    decimals: 6,
    referrer: 'FihBmWJbiLSEvq4QZpPPdjokdMgxqq6pESZ7oMkE1qJH'
  },
  HXRO: {
    symbol: 'HXRO',
    name: 'Wrapped HXRO',
    mintAddress: 'DJafV9qemGp7mLMEn5wrfqaFwxsbLgUsGVS16zKRk9kc',
    decimals: 6,
    referrer: '4NgrGZDRCzyqiwYvKPEePTKfQXtWzKmSDBoZJjRw6wNC'
  },
  UNI: {
    symbol: 'UNI',
    name: 'Wrapped UNI',
    mintAddress: 'DEhAasscXF4kEGxFgJ3bq4PpVGp5wyUxMRvn6TzGVHaw',
    decimals: 6,
    referrer: '4ntxDv95ajBbXfZyGy3UhcQDx8xmH1yJ6eKvuNNH466x'
  },
  SRM: {
    symbol: 'SRM',
    name: 'Serum',
    mintAddress: 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt',
    decimals: 6,
    referrer: 'HYxa4Ea1dz7ya17Cx18rEGUA1WbCvKjXjFKrnu8CwugH'
  },
  FTT: {
    symbol: 'FTT',
    name: 'Wrapped FTT',
    mintAddress: 'AGFEad2et2ZJif9jaGpdMixQqvW5i81aBdvKe7PHNfz3',
    decimals: 6,
    referrer: 'CafpgSh8KGL2GPTjdXfctD3vXngNZDJ3Q92FTfV71Hmt'
  },
  MSRM: {
    symbol: 'MSRM',
    name: 'MegaSerum',
    mintAddress: 'MSRMcoVyrFxnSgo5uXwone5SKcGhT1KEJMFEkMEWf9L',
    decimals: 0,
    referrer: 'Ge5q9x8gDUNYqqLA1MdnCzWNJGsbj3M15Yxse2cDbw9z'
  },
  TOMO: {
    symbol: 'TOMO',
    name: 'Wrapped TOMO',
    mintAddress: 'GXMvfY2jpQctDqZ9RoU3oWPhufKiCcFEfchvYumtX7jd',
    decimals: 6,
    referrer: '9fexfN3eZomF5gfenG5L9ydbKRQkPhq6x74rb5iLrvXP'
  },
  KARMA: {
    symbol: 'KARMA',
    name: 'Wrapped KARMA',
    mintAddress: 'EcqExpGNFBve2i1cMJUTR4bPXj4ZoqmDD2rTkeCcaTFX',
    decimals: 4
  },
  LUA: {
    symbol: 'LUA',
    name: 'Wrapped LUA',
    mintAddress: 'EqWCKXfs3x47uVosDpTRgFniThL9Y8iCztJaapxbEaVX',
    decimals: 6,
    referrer: 'HuZwNApjVFuFSDgrwZA8GP2JD7WMby4qt6rkWDnaMo7j'
  },
  MATH: {
    symbol: 'MATH',
    name: 'Wrapped MATH',
    mintAddress: 'GeDS162t9yGJuLEHPWXXGrb1zwkzinCgRwnT8vHYjKza',
    decimals: 6,
    referrer: 'C9K1M8sJX8WMdsnFT7DuzdiHHunEj79EsLuz4DixQYGm'
  },
  KEEP: {
    symbol: 'KEEP',
    name: 'Wrapped KEEP',
    mintAddress: 'GUohe4DJUA5FKPWo3joiPgsB7yzer7LpDmt1Vhzy3Zht',
    decimals: 6
  },
  SWAG: {
    symbol: 'SWAG',
    name: 'Wrapped SWAG',
    mintAddress: '9F9fNTT6qwjsu4X4yWYKZpsbw5qT7o6yR2i57JF2jagy',
    decimals: 6
  },
  FIDA: {
    symbol: 'FIDA',
    name: 'Bonfida',
    mintAddress: 'EchesyfXePKdLtoiZSL8pBe8Myagyy8ZRqsACNCFGnvp',
    decimals: 6,
    referrer: 'AeAsG75UmyPDB271c6NHonHxXAPXfkvhcf2xjfJhReS8'
  },
  KIN: {
    symbol: 'KIN',
    name: 'KIN',
    mintAddress: 'kinXdEcpDQeHPEuQnqmUgtYykqKGVFq6CeVX5iAHJq6',
    decimals: 5,
    referrer: 'AevFXmApVxN2yk1iemSxXc6Wy7Z1udUEfST11kuYKmr9'
  },
  MAPS: {
    symbol: 'MAPS',
    name: 'MAPS',
    mintAddress: 'MAPS41MDahZ9QdKXhVa4dWB9RuyfV4XqhyAZ8XcYepb',
    decimals: 6
  },
  OXY: {
    symbol: 'OXY',
    name: 'OXY',
    mintAddress: 'z3dn17yLaGMKffVogeFHQ9zWVcXgqgf3PQnDsNs2g6M',
    decimals: 6
  },
  RAY: {
    symbol: 'RAY',
    name: 'Raydium',
    mintAddress: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    decimals: 6,
    referrer: '33XpMmMQRf6tSPpmYyzpwU4uXpZHkFwCZsusD9dMYkjy'
  },
  xCOPE: {
    symbol: 'xCOPE',
    name: 'xCOPE',
    mintAddress: '3K6rftdAaQYMPunrtNRHgnK2UAtjm2JwyT2oCiTDouYE',
    decimals: 0,
    referrer: '8DTehuES4tfnd2SrqcjN52XofxWXGjiLZRgM12U9pB6f'
  },
  COPE: {
    symbol: 'COPE',
    name: 'COPE',
    mintAddress: '8HGyAAB1yoM1ttS7pXjHMa3dukTFGQggnFFH3hJZgzQh',
    decimals: 6,
    referrer: 'G7UYwWhkmgeL57SUKFF45K663V9TdXZw6Ho6ZLQ7p4p'
  },
  STEP: {
    symbol: 'STEP',
    name: 'STEP',
    mintAddress: 'StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT',
    decimals: 9,
    referrer: 'EFQVX1S6dFroDDhJDAnMTX4fCfjt4fJXHdk1eEtJ2uRY'
  },
  MEDIA: {
    symbol: 'MEDIA',
    name: 'MEDIA',
    mintAddress: 'ETAtLmCmsoiEEKfNrHKJ2kYy3MoABhU6NQvpSfij5tDs',
    decimals: 6,
    referrer: 'AYnaG3AidNWFzjq9U3BJSsQ9DShE8g7FszriBDtRFvsx'
  },
  ROPE: {
    symbol: 'ROPE',
    name: 'ROPE',
    mintAddress: '8PMHT4swUMtBzgHnh5U564N5sjPSiUz2cjEQzFnnP1Fo',
    decimals: 9,
    referrer: '5sGVVniBSPLTwRHDETShovq7STRH2rJwbvdvvH3NcVTF'
  },
  MER: {
    symbol: 'MER',
    name: 'Mercurial',
    mintAddress: 'MERt85fc5boKw3BW1eYdxonEuJNvXbiMbs6hvheau5K',
    decimals: 6,
    referrer: '36F4ryvqaNW2yKQsAry4ZHCZ3j7tz3gtEz7NEwv7pSRu'
  },
  TULIP: {
    symbol: 'TULIP',
    name: 'TULIP',
    mintAddress: 'TuLipcqtGVXP9XR62wM8WWCm6a9vhLs7T1uoWBk6FDs',
    decimals: 6,
    referrer: 'Bcw1TvX8jUj6CtY2a7GU2THeYVAudvmT8yzRypVMVsSH'
  },
  WOO: {
    symbol: 'WOO',
    name: 'WOO',
    mintAddress: 'E5rk3nmgLUuKUiS94gg4bpWwWwyjCMtddsAXkTFLtHEy',
    decimals: 6,
    referrer: '7UbeAZxpza5zN3QawQ5KsUo88zXvohUncYB9Zk5QCiim'
  },
  SNY: {
    symbol: 'SNY',
    name: 'SNY',
    mintAddress: '4dmKkXNHdgYsXqBHCuMikNQWwVomZURhYvkkX5c4pQ7y',
    decimals: 6,
    referrer: 'G7gyaTNn2hgjF67SWs4Ee9PEaFU2xadhtXL8HmkJ2cNL'
  },
  BOP: {
    symbol: 'BOP',
    name: 'BOP',
    mintAddress: 'BLwTnYKqf7u4qjgZrrsKeNs2EzWkMLqVCu6j8iHyrNA3',
    decimals: 8,
    referrer: 'FWxBZmNsvNckx8DnaL2NuyMtiQmT1x529WwV4e1UWiGk'
  },
  SLRS: {
    symbol: 'SLRS',
    name: 'SLRS',
    mintAddress: 'SLRSSpSLUTP7okbCUBYStWCo1vUgyt775faPqz8HUMr',
    decimals: 6,
    referrer: 'AmqeHgTdm6kBzy5ewZFKuMAfbynZmhve1GQxbJzQFLbP'
  },
  SAMO: {
    symbol: 'SAMO',
    name: 'SAMO',
    mintAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    decimals: 9,
    referrer: 'FnMDNFL9t8EpbADSU3hLWBtx7SuwRBB6NM84U3PzSkUu'
  },
  renBTC: {
    symbol: 'renBTC',
    name: 'renBTC',
    mintAddress: 'CDJWUqTcYTVAKXAVXoQZFes5JUFc7owSeq7eMQcDSbo5',
    decimals: 8,
    referrer: '7rr64uygy3o5RKVeNv12JGDUFMXVdr2YHvA3NTxzbZT6'
  },
  renDOGE: {
    symbol: 'renDOGE',
    name: 'renDOGE',
    mintAddress: 'ArUkYE2XDKzqy77PRRGjo4wREWwqk6RXTfM9NeqzPvjU',
    decimals: 8,
    referrer: 'J5g7uvJRGnpRyLnRQjFs1MqMkiTVgjxVJCXocu4B4BcZ'
  },
  LIKE: {
    symbol: 'LIKE',
    name: 'LIKE',
    mintAddress: '3bRTivrVsitbmCTGtqwp7hxXPsybkjn4XLNtPsHqa3zR',
    decimals: 8,
    referrer: '2rnVeVGfM88XqyNyBzGWEb7JViYKqncFzjWq5h1ujS9A'
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
      name: 'MNGO',
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
    referrer: '8upjSpvjcdpuzhfR1zriwg5NXkwDruejqNE9WNbPRtyA',
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
    tags: ['raydium']
  },
  APEX: {
    symbol: 'APEX',
    name: 'APEX',
    mintAddress: '51tMb3zBKDiQhNwGqpgwbavaGH54mk8fXFzxTc1xnasg',
    decimals: 9,
    tags: ['raydium']
  },
  MNDE: {
    symbol: 'MNDE',
    name: 'MNDE',
    mintAddress: 'MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey',
    decimals: 9,
    tags: ['raydium']
  },
  LIQ: {
    symbol: 'LIQ',
    name: 'LIQ',
    mintAddress: '4wjPQJ6PrkC4dHhYghwJzGBVP78DkBzA2U3kHoFNBuhj',
    decimals: 6,
    tags: ['raydium']
  },
  WAG: {
    symbol: 'WAG',
    name: 'WAG',
    mintAddress: '5tN42n9vMi6ubp67Uy4NnmM5DMZYN8aS8GeB3bEDHr6E',
    decimals: 9,
    tags: ['raydium']
  },
  JungleCats: {
    symbol: 'JungleCats',
    name: 'JungleCats',
    mintAddress: '9vaCzR4n4QpdN2vyaFmy7ZtvzGHVY3WVzDnLJAQLsKCX',
    decimals: 0,
    tags: ['raydium']
  },
  SYP: {
    symbol: 'SYP',
    name: 'SYP',
    mintAddress: 'FnKE9n6aGjQoNWRBZXy4RW6LZVao7qwBonUbiD7edUmZ',
    decimals: 9,
    tags: ['raydium']
  },
  MUNK : {
    symbol: 'MUNK ',
    name: 'MUNK ',
    mintAddress: '23sUwdK725SsMe9L5sX6h1NaLJvuhFcBQ8tunpNcc3R7',
    decimals: 0,
    tags: ['raydium']
  },
  Legends: {
    symbol: 'Legends',
    name: 'Legends',
    mintAddress: 'Aj2HHSuPg1WmyAa6eAyS2uamESPomsoGsi56LXjNyXrb',
    decimals: 0,
    tags: ['raydium']
  },
  WOOF: {
    symbol: 'WOOF',
    name: 'WOOF',
    mintAddress: '9nEqaUcb16sQ3Tn1psbkWqyhPdLmfHWjKGymREjsAgTE',
    decimals: 6,
    tags: ['raydium']
  }
}