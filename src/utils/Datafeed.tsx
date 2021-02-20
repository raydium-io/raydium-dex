// @ts-nocheck
import React, { useMemo } from 'react';
import { sleep } from './utils';

const URL = 'https://serum-api.bonfida.com/tv/';

const X = [
  '1045529pOiBJz',
  'cPLzc',
  '1142540VecyVK',
  'rlUik',
  '577391szPtPO',
  'subtle',
  'CCCPGTDWqnEg3eMUrimj',
  '2AxnvtD',
  'symbol',
  '&auth=',
  'Qeeef',
  '171418QDwYjT',
  'GET',
  'MtwRi',
  'getTime',
  'toString',
  'from',
  'digest',
  '7954rqLEJT',
  '2uXFGco',
  'FyLkI',
  'SHA-256',
  'json',
  '28yNhqFa',
  '440584Yhkmes',
  'tVDWs',
  '1159216SoDZHv',
  'log',
];
const A = function (F, p) {
  F = F - (0x5 * 0x515 + -0x1918 + 0x1 * 0xb5);
  let N = X[F];
  return N;
};
(function (F, p) {
  const j = function (F, p) {
    return A(p - 0x93, F);
  };
  while (!![]) {
    try {
      const N =
        -parseInt(j(0x1af, 0x1b3)) * -parseInt(j(0x1a0, 0x19c)) +
        parseInt(j(0x19e, 0x19e)) +
        -parseInt(j(0x1a3, 0x1a0)) +
        parseInt(j(0x1be, 0x1b2)) * -parseInt(j(0x1a6, 0x19b)) +
        -parseInt(j(0x1a3, 0x1a7)) * -parseInt(j(0x1ab, 0x1a4)) +
        -parseInt(j(0x1a4, 0x1a2)) +
        parseInt(j(0x1b8, 0x1ab));
      if (N === p) {
        break;
      } else {
        F['push'](F['shift']());
      }
    } catch (m) {
      F['push'](F['shift']());
    }
  }
})(X, 0x7 * 0x40887 + -0x19a3 * -0x116 + -0x297d18);
async function apiGet(F, p) {
  const B = function (F, p) {
    return A(p - 0x3a, F);
  };
  const N = {
    tVDWs: function (m, d) {
      return m + d;
    },
    Qeeef: B(0x14c, 0x153),
  };
  try {
    const m = await _lodash(p[B(0x152, 0x14f)], p['from'], p['to']);
    let d = await fetch(N[B(0x138, 0x144)](F, B(0x15c, 0x150) + m), {
      method: N[B(0x153, 0x151)],
    });
    if (!d['ok']) {
      return [];
    }
    let M = await d[B(0x146, 0x141)]();
    return M;
  } catch (l) {
    console[B(0x143, 0x146)](l);
    return [];
  }
}
const widgetReady = async (F) => {
  const f = function (F, p) {
    return A(p - 0x3d8, F);
  };
  const p = new TextEncoder()['encode'](F);
  const N = await crypto[f(0x4ee, 0x4ea)][f(0x4f1, 0x4f6)](f(0x4da, 0x4de), p);
  const m = Array[f(0x4e9, 0x4f5)](new Uint8Array(N));
  const d = m['map']((M) =>
    ('00' + M[f(0x502, 0x4f4)](-0x18a9 + -0x2fe * 0x2 + -0x1 * -0x1eb5))[
      'slice'
    ](-(-0x1363 * 0x2 + -0x24c + -0x2 * -0x148a)),
  )['join']('');
  return d;
};
const _lodash = async (F, p, N) => {
  const w = function (F, p) {
    return A(F - -0x211, p);
  };
  const m = {
    DSQWA: function (H, K) {
      return H / K;
    },
    rlUik: function (H, K) {
      return H - K;
    },
    MtwRi: function (H, K) {
      return H * K;
    },
    cPLzc: function (H, K) {
      return H(K);
    },
    FyLkI: function (H, K) {
      return H + K;
    },
  };
  let d = m['DSQWA'](
    new Date()[w(-0xf6, -0xf3)](),
    -0x24c6 + -0x1 * 0x2533 + 0x4de1,
  );
  const M = w(-0xfe, -0x101);
  d = m[w(-0x101, -0x107)](
    d,
    d %
      m[w(-0xf7, -0xed)](
        0x1 * 0x12b3 + 0x3f3 * -0x1 + -0xeb1,
        0x35b + -0x1955 + -0x1636 * -0x1,
      ),
  );
  const l = await m[w(-0x103, -0x10c)](
    widgetReady,
    m[w(-0xf0, -0xe5)](m[w(-0xf0, -0xe8)](M, d) + F + p, N),
  );
  return l;
};

export const useTvDataFeed = () => {
  return useMemo(() => makeDataFeed(), []);
};

const makeDataFeed = () => {
  let subscriptions = {};

  return {
    async onReady(callback) {
      await sleep(0);
      callback({
        supported_resolutions: ['1', '60', '240', 'D'],
        supports_group_request: false,
        supports_marks: false,
        supports_search: true,
        supports_timescale_marks: false,
      });
    },
    async searchSymbol(userInput, exchange, symbolType, onResult) {
      const result = await apiGet(
        `${URL}search?query=${userInput}&type=${symbolType}&exchange=${exchange}&limit=${100}`,
      );
      onResult(result);
    },
    async resolveSymbol(
      symbolName,
      onSymboleResolvedCallback,
      onResolveErrorCallback,
      extension?,
    ) {
      const result = await apiGet(`${URL}symbols?symbol=${symbolName}`, {});

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

      let url = `${URL}history?symbol=${
        symbolInfo.name
      }&resolution=${convertResolution(resolution)}&from=${from}`;

      if (firstDataRequest) {
        url += `&to=${to}`;
      }
      try {
        const result = await apiGet(url, {
          from: from,
          to: to,
          symbol: symbolInfo.name,
        });
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
          let url = `${URL}history?symbol=${
            symbolInfo.name
          }&resolution=${convertResolution(resolution)}&from=${from}&to=${to}`;

          candle = await apiGet(url, {
            from: from,
            to: to,
            symbol: symbolInfo.name,
          });
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

        if (!stopped) {
          console.log('!stopped', candle);

          onRealtimeCallback(candle);
        }
      }
    },
    unsubscribeBars(subscriberUID) {
      subscriptions[subscriberUID].stop();
      delete subscriptions[subscriberUID];
    },
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
