// @ts-nocheck
import { useMemo } from 'react';
import { USE_MARKETS } from './markets';
import { sleep } from './utils';


export const useTvDataFeed = () => {
  return useMemo(() => makeDataFeed(), []);
};

const makeDataFeed = () => {
  let subscriptions = {};

  const getApi = async (url: string) => {
    try {
      const response = await fetch(url)
      if (response.ok) {
        const responseJson = await response.json()
        return responseJson.success
          ? responseJson.data
          : responseJson
          ? responseJson
          : null
      }
    } catch (err) {
      console.log(`Error fetching from Chart API ${url}: ${err}`)
    }
    return null
  }

  return {
    onReady(callback) {
      setTimeout(() => callback({
        supported_resolutions: ['1', '3', '5', '15', '30', '45', '60', '120', '240',
        '1D', '2D', '3D', '5D', '1W', '1M', '12M'],
        supports_group_request: false,
        supports_marks: false,
        supports_search: false,
        supports_timescale_marks: false,
      }), 0)
    },
    async searchSymbol(userInput, exchange, symbolType, onResult) {
      const result = await apiGet(`${URL_SERVER}search?query=${userInput}&type=${symbolType}&exchange=${exchange}&limit=${100}`);
      onResult(result);
    },
    async resolveSymbol(
      symbolName,
      onSymboleResolvedCallback,
      onResolveErrorCallback,
      extension?,
    ) {
      const marketInfo = USE_MARKETS.find(item => item.name === symbolName)

      if (!marketInfo){
        return
      }

      const result = await getApi(`${URL_SERVER}symbols?market=${marketInfo.address.toString()}`);

      if (!result) {
        onResolveErrorCallback();
        return;
      }
      onSymboleResolvedCallback(result);
    },
    async getBars(
      symbolInfo,
      resolution,
      from,
      to,
      onHistoryCallback,
      onErrorCallback,
      firstDataRequest,
    ) {
      from = Math.floor(from);
      to = Math.ceil(to);
      
      resolution = convertResolutionToApi(resolution)

      try {
        const result = await getApi(
          `${URL_SERVER}history?market=${symbolInfo.market}&resolution=${resolution}&from_time=${from}&to_time=${to}`
        )
        onHistoryCallback(parseCandles(result), {
          nodeData: result.length === 0,
        });
      } catch (err) {
        onErrorCallback(err);
      }
    },
    async subscribeBars(
      symbolInfo,
      resolution,
      onRealtimeCallback,
      subscriberUID,
      onResetCacheNeededCallback,
    ) {
      if (subscriptions[subscriberUID]) {
        subscriptions[subscriberUID].stop();
        delete subscriptions[subscriberUID];
      }

      let stopped = false;
      subscriptions[subscriberUID] = { stop: () => (stopped = true) };

      while (!stopped) {
        await sleep(2000);
        for (let i = 0; i < 10; ++i) {
          if (document.visibilityState !== 'visible') {
            await sleep(2000);
          }
        }
        if (stopped) {
          return;
        }

        let candle;
        try {
          const to = Math.ceil(new Date().getTime() / 1000);
          const from = reduceTs(to, resolution);

          resolution = convertResolutionToApi(resolution)

          candle = await getApi(
            `${URL_SERVER}history?market=${symbolInfo.market}&resolution=${resolution}&from_time=${from}&to_time=${to}`
          )
          const lastCandle = {
            time: candle.t[0] * 1000,
            close: candle.c[0],
            open: candle.o[0],
            high: candle.h[0],
            low: candle.l[0],
            volume: candle.v[0],
          };
          onRealtimeCallback(lastCandle);
          continue;
        } catch (e) {
          console.warn(e);
          await sleep(10000);
          continue;
        }
      }
    },
    unsubscribeBars(subscriberUID) {
      subscriptions[subscriberUID].stop();
      delete subscriptions[subscriberUID];
    },
    async searchSymbols(userInput: string, exchange: string, symbolType: string, onResult: SearchSymbolsCallback) {
      const marketList: any[] = USE_MARKETS.filter(item => item.name.includes(userInput))
      const reList = []
      marketList.forEach(item => {
        reList.push({
          symbol: item.name,
          full_name: item.name,
          description: item.name,
          exchange: 'Raydium',
          params: [],
          type: 'spot',
          ticker: item.name
        })
      })
      console.log(userInput, exchange, symbolType, onResult, reList)
      if (onResult) {
        onResult(reList)
      }
    }
  };
};

const reduceTs = (ts: number, resolutionTv: string) => {
  let resolution = convertResolution(resolutionTv);
  switch (resolution) {
    case 1:
      return ts - (ts % 60);
    case 60:
      return ts - (ts % (60 * 60));
    case 4 * 60:
      return ts - (ts % (4 * 60 * 60));
    case '1D':
      return ts - (ts % (24 * 60 * 60));
    default:
      return 0;
  }
};

const convertResolution = (resolution: string) => {
  switch (resolution) {
    case '1':
      return 1;
    case '60':
      return 60;
    case '240':
      return 4 * 60;
    case '1D':
      return '1D';
    default:
      return 1;
  }
};

const convertResolutionToApi = (resolution: string) => {
  switch (resolution) {
    case '1':
      return 1;
    case '60':
      return '1h';
    case '240':
      return 4 * 60;
    case '1D':
      return '1D';
    default:
      return 1;
  }
};

interface rawCandles {
  s: string;
  c: Array<number>;
  o: Array<number>;
  l: Array<number>;
  h: Array<number>;
  t: Array<number>;
  v: Array<number>;
}

interface bar {
  time: number;
  close: number;
  open: number;
  low: number;
  high: number;
  volume: number;
}

const parseCandles = (candles: rawCandles) => {
  const result: Array<bar> = [];
  for (let i = 0; i < candles.t.length; i++) {
    result.push({
      time: candles.t[i] * 1000,
      close: candles.c[i],
      open: candles.o[i],
      high: candles.h[i],
      low: candles.l[i],
      volume: candles.v[i],
    });
  }
  return result;
};
