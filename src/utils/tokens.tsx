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
  RAY: {
    symbol: 'RAY',
    mintAddress: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    referrer: '33XpMmMQRf6tSPpmYyzpwU4uXpZHkFwCZsusD9dMYkjy',
  },
}
